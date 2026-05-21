# CLAUDE.md

Guidance for working in this repo. UIFactory is a low-code internal-app platform: users sign in (SSO),
add **connectors**, and build multi-page apps (drag-and-drop / AI-generated / hand-written HTML + chat
pages), then version, deploy, and share them. Monorepo with npm workspaces: `backend/` (NestJS) and
`frontend/` (React + Vite).

## Commands

Run from the repo root unless noted.

```bash
npm install                                   # install both workspaces
npm run setup                                 # backend: prisma generate + db push + seed (demo data + users)
npm run dev                                    # backend :3001 + frontend :5173 (Vite proxies /api → :3001)
npm run dev:backend / npm run dev:frontend     # one side only
npm run build                                  # backend (nest build) + frontend (tsc --noEmit && vite build)

npm test --workspace backend                   # backend unit tests: node --test via tsx (test/*.test.ts)
npx tsc --noEmit                               # (in frontend/) typecheck only
npm run migrate:agent-connectors --workspace backend   # one-off upgrade migration (idempotent)
```

- **Node 22.5+** required (backend uses the built-in `node:sqlite`). The dev box runs Node 24.
- There is **no lint step** and **no frontend test runner**; verify frontend with `tsc --noEmit` + `vite build`.
- Backend tests use Node's built-in runner through `tsx` (no Jest). **Test targets must be decorator-free
  pure functions** — Node's TS type-stripping can't execute NestJS decorators, so don't import
  `@Injectable()` services into tests. Extract logic into plain util modules (see `backend/src/common/*.util.ts`)
  and test those.

## Architecture

**Backend (`backend/src`)** — NestJS feature modules, each `*.controller.ts` + `*.service.ts`:
`auth`, `users`, `org`, `templates`, `connectors`, `settings`, `datasources`, `queries`, `credentials`,
`conversations`, `ai`, `apps` (+ `agent.service`), `execution`. A global `AuthGuard` attaches the user,
rejects unauthenticated non-`@Public()` routes (401), and enforces `@Roles()` (403). Prisma over SQLite
(dev) via `prisma db push` — **no migration history**. Secrets are AES-256-GCM encrypted at rest
(`backend/src/common/crypto.util.ts`, key from `SECRETS_KEY` or derived from `JWT_SECRET` in dev).

**Frontend (`frontend/src`)** — React 19 + MUI + Vite. Pages: `LoginPage`, `CatalogPage`, `MyAppsPage`,
`AppEditorPage` (the big multi-page editor), `AdminPage`, `AppRunnerPage`. Routes are `React.lazy`-split;
`ResultChart` (recharts) and `CanvasBuilder` are lazy too. All HTTP goes through `src/api/client.ts`
(axios, `withCredentials`, baseURL `/api`). Auth state in `src/auth/AuthContext.tsx`.

**Runtime UI sandbox** — generated/authored page HTML runs in a sandboxed iframe and talks to the host
only via the `window.UIFactory` postMessage bridge (`runAction`, `runQuery`, `refresh`, `readFile`, …).

## Domain model & key terms

- **App** → `definition` (draft JSON) + `publishedDefinition` (snapshot runners see) + `aiConfig`
  (encrypted) + `visibility` (`private`/`org`/`public`) + `status`. Definition shape & data model:
  [docs/api-reference.md](docs/api-reference.md).
- **Page** (`AppPage`) — `type: 'ui' | 'chat'`. UI pages bind one query → `window.APP_DATA` and expose
  `actions`. `dataSourceIds?` scopes the page to specific connectors. Chat pages have
  `chat.{systemPrompt,greeting,queryId,agentDataSourceId}`.
- **Connector == DataSource.** The UI/editor calls them "connectors"; the API, Prisma model, and code call
  them **`DataSource`** (routes under `/apps/:appId/datasources`). `type`:
  `REST | POSTGRES | SQLITE | MSGRAPH | AGENT`.
- **Prebuilt connector** (`Connector` model) — admin-curated template cloned into an app's DataSource.
- **Query** — saved SQL or REST/Graph request bound to a connector; pages run them as bound query/actions.

## Conventions & gotchas (important)

- **Roles:** `admin` | `member` (builder) | `viewer`. New SSO users default to **viewer**
  (`auth.service.upsertUser`); admin promotes to member. App authoring routes are gated with
  `@Roles('admin','member')`; viewers can still run/view public+org apps. Role denials are **403**
  (the frontend axios interceptor logs out on **401** — never use 401 for "authenticated but not allowed").
- **External agents are connectors, not an app mode.** App `aiConfig.mode` is `platform | provider`
  (LLM only). An external assistant is an **AGENT connector** selected per chat page via
  `chat.agentDataSourceId`; `resolvePageAiConfig` synthesizes an `agent-api` config from it (so the
  `agent-api` handling in `agent.service` is still required — don't remove it).
- **Secrets:** `redactConfig` masks secret fields in API responses (`***`). On update, configs
  **merge-preserve** any field left blank/masked (`secret-merge.util.ts`) — editing a connector's name
  must never wipe its stored secret.
- **Per-page connector scope is a hard boundary:** enforced in `runQueryAction`/`pageData`/`chatContext`
  via `queryInPageScope` (`query-config.util.ts`), plus the editor multi-select. Template export/install
  remap page `dataSourceIds` (`remapDataSourceIds`).
- **Config validation:** per-type zod schemas validate connector config server-side
  (`datasources/config-validation.ts`), used in datasource + connector create/update/test.
- **SSRF guard:** all outbound REST/agent URLs go through `assertSafeUrl` (`common/safe-url.ts`) — blocks
  private/reserved IPs unless `ALLOW_PRIVATE_NETWORK=true` / `OUTBOUND_ALLOWLIST`.
- **Platform branding** (name/logo/color) drives the nav, login, and the browser tab title/favicon
  (`frontend/src/branding.ts`, applied from `AuthContext`).
- **Dev server management:** `.claude/launch.json` defines the `backend`/`frontend` servers; backend
  needs port **3001** specifically (the frontend proxy targets it).

## Editing notes

- Keep changes minimal and match existing style (no lint config; concise, comment-light TS).
- After backend changes: `npm run build --workspace backend` (+ `npm test` if touching the pure utils).
- After frontend changes: `cd frontend && npx tsc --noEmit` and, for UI work, `npm run build`.
- Don't introduce a Jest dependency for tests — use the existing `node --test`/tsx setup.

## Docs

Full guides in [`/docs`](docs/): [user-guide](docs/user-guide.md), [admin-guide](docs/admin-guide.md),
[api-reference](docs/api-reference.md), [configuration](docs/configuration.md),
[deployment](docs/deployment.md).
