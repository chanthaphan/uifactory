# UIFactory Codebase Walkthrough

This guide explains how UIFactory works as code, not just as a product.

It is aimed at a developer who wants to answer questions like:

- Where does auth happen?
- How does an app move from editor to runtime?
- How are queries kept inside an app/page boundary?
- How does sandboxed HTML talk to the React host?
- Why does chat sometimes use the app AI config and sometimes an AGENT connector?

## High-Level Summary

UIFactory is a monorepo with two main parts:

- `backend/`: a NestJS API over Prisma/SQLite that owns auth, apps, connectors, queries, execution, AI, chat, and sharing.
- `frontend/`: a React + Vite app that provides the builder, catalog, admin UI, and runtime shell.

At the center of the system is the **App** model:

- Builders edit an app's `definition` draft.
- Deploying snapshots that draft into `publishedDefinition`.
- Runners usually see `publishedDefinition`, not the draft.
- Each page in the definition is either a `ui` page or a `chat` page.

The most important architectural idea is:

1. Data access is defined as `DataSource` + `Query` records.
2. Pages reference those queries inside the app definition.
3. The runtime only allows queries/actions that are referenced by the app and allowed by the page scope.
4. UI pages run inside a sandboxed iframe and can only call back into the host through `window.UIFactory`.

## System Map

```text
React shell
  |
  |  /api requests
  v
NestJS controllers/services
  |
  |  Prisma
  v
SQLite database

UI page runtime
  |
  |  postMessage bridge
  v
PreviewFrame host
  |
  |  appRunQuery / pageData / chat
  v
AppsService -> QueriesService -> DataSourcesService -> ExecutionService
```

## Main Code Hotspots

- App orchestration: `backend/src/apps/apps.service.ts`
- Runtime query gating: `backend/src/apps/apps.service.ts`, `backend/src/common/query-config.util.ts`
- Query execution: `backend/src/queries/queries.service.ts`, `backend/src/execution/execution.service.ts`
- Auth and role enforcement: `backend/src/auth/auth.guard.ts`, `backend/src/auth/auth.service.ts`
- App definition model: `backend/src/apps/app-defs.ts`
- Frontend runtime bridge: `frontend/src/components/PreviewFrame.tsx`
- Editor complexity: `frontend/src/pages/AppEditorPage.tsx`
- Chat UX: `frontend/src/components/ChatView.tsx`
- API contract surface: `frontend/src/api/client.ts`

## End-To-End Flow

### 1. Boot and auth

Backend startup is simple:

- `backend/src/main.ts` enables CORS, cookie parsing, validation pipes, and the `/api` prefix.
- `backend/src/app.module.ts` wires feature modules together.

Auth is enforced by a **global guard** in `backend/src/auth/auth.guard.ts`.

The guard does three things in order:

1. Reads the signed session cookie.
2. Resolves the current user from the database.
3. Applies `@Public()` and `@Roles()` rules.

That ordering matters because public routes can still access `req.user` if present.

```text
request
  -> AuthGuard
    -> read cookie
    -> AuthService.userFromToken()
    -> attach req.user if valid
    -> if route is public: allow
    -> if no user: 401
    -> if wrong role: 403
```

`backend/src/auth/auth.service.ts` supports two modes:

- `azure`: full Azure AD OIDC flow
- `dev`: mock login against local users

Important behavior:

- first user or configured admin emails become `admin`
- everyone else starts as `viewer`
- builders are `member` or `admin`
- `401` means unauthenticated, `403` means authenticated but not allowed

That last point is critical because the frontend logs the user out on `401` in `frontend/src/api/client.ts`.

### 2. Frontend shell and route gating

`frontend/src/App.tsx` is the main shell.

It splits the app into two layers:

- `Gate`: decides whether to show login or the signed-in app
- `Shell`: shows nav and normal pages

Route intent:

- `/`: deployed app catalog
- `/build`: builder workspace
- `/build/:id`: app editor
- `/admin`: admin-only tools
- `/run/:slug`: runtime runner for a deployed app

`frontend/src/auth/AuthContext.tsx` loads both:

- platform config/branding
- current signed-in user

It also listens for the custom `uifactory:unauthorized` event emitted by the axios interceptor.

## The Core Domain Model

`backend/src/apps/app-defs.ts` is the fastest way to understand the platform.

Key types:

- `AppDefinition`: pages, theme, write-action policy, build guidelines
- `AppPage`: one page in the app
- `CanvasLayout`: drag-and-drop source format
- `AppAiConfig`: app-level AI/provider/agent settings

### Why `definition` and `publishedDefinition` both exist

UIFactory separates editing from running:

- `definition`: editable draft
- `publishedDefinition`: last deployed snapshot

`AppsService.runtimeDefinition()` chooses which one to use:

- editors can see the draft
- normal runners get the published snapshot

That avoids the classic bug where a half-edited page becomes live before deployment.

### Legacy compatibility

`normalizeDefinition()` also accepts an older single-page shape and converts it into the new multi-page format.

That means most downstream code can assume `definition.pages` exists.

## App Lifecycle

`backend/src/apps/apps.service.ts` is the system's orchestration layer.

It owns:

- access decisions
- serialization rules
- app CRUD
- deploy/version/rollback
- runtime page data
- runtime query/action execution
- chat
- UI generation

### Create

On creation, the service can:

- start from `emptyDefinition()`
- or clone a template bundle

When cloning a template, it also remaps template-local connector/query references into newly created database ids.

### Update

Updating an app can touch:

- name/description
- draft definition
- encrypted AI config

AI config updates use `mergeAiConfig()` so a masked secret does not wipe an existing secret.

### Deploy

Deploying does two writes in one transaction:

1. create an `AppVersion` snapshot
2. update the app to `deployed`, bump the version, and copy `definition` into `publishedDefinition`

### Rollback

Rollback restores a previous version into the draft only. It does not auto-publish.

That is a deliberate safety choice.

## Data Path: Connector -> Query -> Page -> Runtime

This is the most important code path in the repo.

### Step 1. Connectors are stored encrypted

In product language the UI says "connector".
In code and API the persistent model is mostly `DataSource`.

`backend/src/datasources/datasources.service.ts` is responsible for:

- encrypting stored config
- redacting secrets before returning configs to the frontend
- validating config with zod-based schemas
- optionally merging per-user credentials over the shared config

The per-user credential flow is subtle:

1. a data source can be `shared` or `per-user`
2. `getRawForUser()` loads the base connector config
3. if `per-user`, it also loads `UserCredential`
4. shared headers and per-user headers are merged

This is why the same query can behave differently for two users without changing the app definition.

### Step 2. Queries are thin wrappers around execution

`backend/src/queries/queries.service.ts` is intentionally small.

Its job is mostly:

- make sure the query belongs to the correct app
- enforce view/edit access at the editor level
- load the data source for the current user
- forward the request into `ExecutionService`

That keeps the transport logic in one place.

### Step 3. ExecutionService is the connector adapter layer

`backend/src/execution/execution.service.ts` fans out by connector type:

- `REST`
- `POSTGRES`
- `SQLITE`
- `MSGRAPH`
- `AGENT` only for connection testing, not general query execution

Conceptually:

```text
query config + datasource config + params + identity
  -> ExecutionService.run()
    -> choose adapter by datasource type
    -> bind params
    -> call external system
    -> normalize result into { data, meta }
```

Important behaviors:

- SQL uses `{{param}}` placeholders that are rebound into positional SQL parameters
- REST paths, bodies, and headers can interpolate params with the same placeholder syntax
- server-trusted identity values override client params on name collisions
- outbound URLs go through `assertSafeUrl()` to reduce SSRF risk

### Step 4. AppsService adds the runtime security boundary

Running a query from the app runtime does **not** call `QueriesService.runChecked()`.
It goes through `AppsService.pageData()` or `AppsService.runQueryAction()`.

This is where UIFactory enforces that runtime pages only execute what the app definition allows.

There are two layers of restriction:

1. **App membership**: the query id must be referenced by the current app definition.
2. **Page connector scope**: if the page has `dataSourceIds`, the query's connector must be inside that allowed subset.

Relevant helpers:

- `allowedQueryIds()`
- `pageQueryIds()`
- `queryInPageScope()`
- `dataSourceInScope()` in `backend/src/common/query-config.util.ts`

### Runtime gating pseudocode

```text
resolve page from pageId
resolve queryId from explicit queryId or named action
if queryId not referenced by page/app definition: reject
if page scope excludes query's datasource: reject
if app disallows write actions for non-editors and query mutates: reject
else run query
```

This is one of the repo's key safety mechanisms.

## UI Runtime: Why the iframe exists

UI pages are stored as HTML and rendered inside a sandboxed iframe by `frontend/src/components/PreviewFrame.tsx`.

That component injects two things into `srcDoc`:

- `window.APP_DATA`
- a `window.UIFactory` bridge object

The bridge exposes methods such as:

- `runAction()`
- `runQuery()`
- `refresh()`
- `navigate()`
- `showAlert()`
- `download()`
- `copyToClipboard()`
- `storeValue()` / `getValue()`
- `readFile()`

### Bridge architecture

```text
iframe HTML
  -> window.UIFactory.runAction('save', params)
  -> postMessage to parent
  -> PreviewFrame receives message
  -> calls React-side bridge callback
  -> host calls backend API
  -> PreviewFrame posts response back to iframe
```

This gives the generated/custom HTML controlled capabilities without giving it direct access to the React app internals.

The iframe sandbox is:

```text
allow-scripts allow-popups allow-forms allow-modals
```

That is permissive enough for app UIs, but still isolates them from the parent DOM.

## Builder Architecture

`frontend/src/pages/AppEditorPage.tsx` is the biggest frontend file because it combines multiple tools in one screen:

- page management
- query/data binding
- actions for write-back
- AI generation
- drag-and-drop layout editing
- raw HTML editing
- chat page editing
- preview
- deployment/version/sharing controls

The important mental model is that a UI page can be authored in three modes:

- `ai`
- `canvas`
- `code`

But the runtime always renders `page.html`.

So the flow is:

```text
canvas layout -> compileLayout() -> html
AI generate   -> html
manual code   -> html
runtime       -> html in PreviewFrame
```

`frontend/src/components/layout-compiler.ts` is the bridge between the visual builder and the runtime.

It takes a component tree and emits a full self-contained HTML document with:

- inline CSS
- inline runtime JS
- optional Chart.js CDN if charts are present

This is a notable design choice: the visual builder is not rendered by React at runtime. It compiles to plain HTML/JS.

### Why that design is useful

- one runtime target for AI pages, canvas pages, and handwritten pages
- preview and production runner can share the same iframe mechanism
- generated pages stay portable and mostly self-contained

## Chat Flow

Chat is split across:

- frontend UX: `frontend/src/components/ChatView.tsx`
- app orchestration: `backend/src/apps/apps.service.ts`
- model/provider dispatch: `backend/src/apps/agent.service.ts`
- persistence: `backend/src/conversations/conversations.service.ts`

### Frontend chat behavior

`ChatView`:

- shows greeting as the first assistant message when configured
- streams replies token-by-token using `api.chatStream()`
- optionally persists conversation history for signed-in runner users
- can switch/delete prior threads

The component keeps an optimistic empty assistant bubble while streaming deltas in.

### Backend chat behavior

`AppsService.chat()` and `chatStream()` do the app-level work:

1. load the runnable definition
2. find the target chat page
3. build a system prompt
4. optionally load grounding data from the page's chat query
5. resolve the AI config for this page
6. call `AgentService`
7. optionally persist the conversation

### The important twist: page-level AGENT connectors

`resolvePageAiConfig()` in `AppsService` is easy to miss.

If a chat page sets `chat.agentDataSourceId` and that data source is type `AGENT`, the page uses that external agent endpoint instead of the app-level AI provider.

So:

- app AI settings define the default LLM behavior
- a chat page can override that by selecting an AGENT connector

That is why the app-level `mode` and the connector type are separate concepts.

### Provider selection order

In `backend/src/apps/agent.service.ts`, chat and generation follow this rough order:

1. use external agent API if mode is `agent-api`
2. else use app-specific provider config if present
3. else use platform default provider from env
4. else return a deterministic mock/demo response

The service also trims history to a character budget and appends grounding data to the system prompt.

## Sequence Diagrams

### Running a UI page

```text
AppRunnerPage
  -> GET /apps/by-slug/:slug
  -> select page
  -> GET /apps/:id/pages/:pageId/data
  -> AppsService.pageData()
  -> QueriesService.run()
  -> DataSourcesService.getRawForUser()
  -> ExecutionService.run()
  -> result returned as APP_DATA
  -> PreviewFrame renders iframe
```

### Clicking a button inside a generated page

```text
iframe button
  -> UIFactory.runAction('createOrder', params)
  -> postMessage
  -> PreviewFrame host callback
  -> POST /apps/:id/run-query
  -> AppsService.runQueryAction()
  -> validate action is on this page
  -> validate connector scope
  -> QueriesService.run()
  -> ExecutionService.run()
  -> response back through postMessage
```

### Streaming chat

```text
ChatView.send()
  -> POST /apps/:id/chat/stream
  -> AppsService.chatStream()
  -> chatContext()
  -> resolvePageAiConfig()
  -> AgentService.chatStream()
  -> provider/agent emits chunks
  -> frontend appends deltas into last assistant message
```

## Pitfalls and Edge Cases

### 1. `401` vs `403` is not cosmetic

Because the frontend logs out on `401`, returning `401` for an authorization failure would create a misleading forced logout. Use `403` for authenticated-but-forbidden paths.

### 2. Draft vs published behavior can look like stale data

If you test as an editor, you may see the draft definition.
If you test as a normal runner, you may see `publishedDefinition`.

When debugging "why is production not showing my change?", check deploy state first.

### 3. Page connector scope is a hard boundary

A page can reference only connectors inside `dataSourceIds` when that list is set.

Symptoms when this breaks:

- page data returns `null`
- actions are visible in the editor but blocked at runtime
- chat grounding silently disappears because the query is out of scope

### 4. Secret masking is merge-preserving, not overwrite-friendly

Masked values like `********` are placeholders. Update flows merge them with stored secrets rather than treating them as new values.

### 5. The visual builder is compile-time, not live React runtime

If you change builder component behavior, you often need to inspect `layout-compiler.ts`, not just `CanvasBuilder.tsx`.

### 6. Chat history persistence only applies to signed-in users

Editor previews and anonymous-like flows use ephemeral client-side conversation ids, not stored DB threads.

### 7. AGENT data sources are special

They are used for chat/generation integration, but generic query execution is implemented only for REST/Postgres/SQLite/Graph. `AGENT` in `ExecutionService` is mainly a validation/test path.

### 8. User identity can be forwarded downstream

Queries and agent calls can receive a signed end-user assertion. That is powerful, but it means downstream services may rely on headers added by UIFactory.

## Suggested Debugging Strategy

When something breaks, narrow it by layer.

### "A page shows no data"

Check in this order:

1. does the page have `queryId` or `chat.queryId`?
2. is that query still part of the app?
3. is the query's connector inside the page's `dataSourceIds` scope?
4. does the current user need a per-user credential?
5. does the underlying connector execution succeed?

### "A button/action fails"

Check:

1. action name exists on the page
2. action query id is still valid
3. write actions are allowed for this app/user
4. the query is actually a mutation or not
5. iframe -> host bridge message is reaching `PreviewFrame`

### "Chat is using the wrong AI"

Check:

1. app-level `aiConfig.mode`
2. page `chat.agentDataSourceId`
3. the referenced data source type is really `AGENT`
4. provider env vars vs app provider secrets

## Suggested Next Reading

For deeper study, read in this order:

1. `backend/src/apps/app-defs.ts`
2. `backend/src/apps/apps.service.ts`
3. `backend/src/queries/queries.service.ts`
4. `backend/src/execution/execution.service.ts`
5. `frontend/src/components/PreviewFrame.tsx`
6. `frontend/src/pages/AppEditorPage.tsx`
7. `frontend/src/components/ChatView.tsx`

If you are onboarding a new engineer, have them trace one complete path:

1. create a query in the editor
2. bind it to a page
3. preview the page
4. trigger `UIFactory.runAction()` from the iframe
5. follow the request back to `ExecutionService`

That single exercise covers most of UIFactory's architecture.
