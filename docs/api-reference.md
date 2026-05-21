# API reference

All routes are under the `/api` prefix. Auth is a cookie JWT session (set by login). Legend:
**(public)** = no session required (the current user is still attached if present);
**(admin)** = requires the platform `admin` role;
**(builder)** = requires `admin` or `member` (app authoring — viewers are blocked);
everything else requires a signed-in user with the appropriate per-app role.
Role/permission failures return **403**; missing/expired session on a non-public route returns **401**.

## Health

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/health` | (public) liveness probe |

## Auth

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/auth/config` | (public) `{ mode, platformName, platformLogo, platformBrandColor }` |
| GET | `/auth/me` | (public) current user or `null` |
| POST | `/auth/logout` | clear the session cookie |
| GET | `/auth/dev-users` | (public, dev mode) list demo users |
| POST | `/auth/dev-login` | (public, dev mode) `{ email }` → session |
| GET | `/auth/login` | (public) start Azure AD OIDC |
| GET | `/auth/callback` | (public) OIDC redirect target |

## Users & org

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/users` | (admin) list users |
| PATCH | `/users/:id` | (admin) `{ role?, active? }` |
| GET | `/org/users?q=` | search the org directory (Graph or dev mock) |

## Templates

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/templates` | list starter templates |
| POST | `/templates` | (admin) create from a definition |
| POST | `/templates/from-app/:appId` | (admin) export an app into a template bundle |
| DELETE | `/templates/:id` | (admin) |

## Connectors (prebuilt data sources)

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/connectors` | list (configs redacted) |
| POST | `/connectors` | (admin) create |
| PUT | `/connectors/:id` | (admin) update |
| DELETE | `/connectors/:id` | (admin) |

## Settings

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/settings` | (public) platform settings (name, logo, brand color, AI defaults) |
| PUT | `/settings` | (admin) update |

## AI

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/ai/status` | platform LLM provider/model status |
| POST | `/ai/generate-ui` | platform-LLM generation; body `{ prompt, sample, queryName?, currentHtml?, dataGuidance?, guidelines? }` |

## Apps

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/apps` | apps you own or can edit |
| GET | `/apps/catalog` | deployed apps you may run |
| GET | `/apps/by-slug/:slug` | (public) run a deployed (or your draft) app |
| GET | `/apps/:id` | full app (editors see redacted AI config + members) |
| POST | `/apps` | (builder) create `{ name, description?, templateId? }` |
| PUT | `/apps/:id` | (builder) update `{ name?, description?, definition?, aiConfig? }` |
| DELETE | `/apps/:id` | (builder) owner/admin only |
| POST | `/apps/:id/deploy` | (builder) publish a new version `{ note? }` (enforces the deploy cap) |
| POST | `/apps/:id/undeploy` | (builder) back to draft |
| GET | `/apps/:id/versions` | (builder) version history |
| POST | `/apps/:id/rollback` | (builder) `{ version }` → restore that version into the draft |
| PUT | `/apps/:id/sharing` | (builder) `{ visibility, members[] }` |
| GET | `/apps/:id/pages/:pageId/data` | (public) the page's bound-query result |
| POST | `/apps/:id/run-query` | (public) run a page query/action `{ queryId?/action?, pageId?, params? }` (scoped to the page's connectors) |
| POST | `/apps/:id/generate-ui` | (builder) app-scoped generation via the app's provider key / platform LLM |
| POST | `/apps/:id/chat` | (public) one chat turn `{ pageId?, conversationId?, persist?, messages[] }` |
| POST | `/apps/:id/chat/stream` | (public) streaming chat; newline-delimited JSON (`{delta}` … `{done,source,conversationId}`) |

### Data sources (connectors) — `/apps/:appId/datasources`

`type` is `REST | POSTGRES | SQLITE | MSGRAPH | AGENT`. Config is **validated per type** on
create/update/test; updates **merge-preserve** secret fields left masked. (These are the "connectors" of
the editor UI.)

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/` | list (configs redacted) |
| POST | `/` | (builder) create `{ name, type, config, authMode? }` |
| POST | `/test` | (builder) test an inline config without saving (REST probes the endpoint) |
| POST | `/from-connector/:connectorId` | (builder) clone a prebuilt connector `{ name? }` |
| GET | `/:id` | read (config redacted) |
| PUT / DELETE | `/:id` | (builder) update / delete |
| POST | `/:id/test` | test a saved source |

### Queries — `/apps/:appId/queries`

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/` | list |
| POST | `/` | create `{ name, dataSourceId, config }` |
| POST | `/run` | editor ad-hoc run `{ dataSourceId, config }` |
| GET / PUT / DELETE | `/:id` | read / update / delete |
| POST | `/:id/run` | run a saved query |

### Per-user credentials — `/apps/:appId/credentials`

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/` | per-user data sources + whether you've connected each |
| PUT | `/:dataSourceId` | set your encrypted credential `{ config }` |
| DELETE | `/:dataSourceId` | remove your credential |

### Conversations — `/apps/:appId/conversations`

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/?pageId=` | your chat threads for the app/page |
| GET | `/:conversationId` | a thread with its messages (owner only) |
| DELETE | `/:conversationId` | delete a thread |

## Data model (Prisma)

| Model | Purpose |
| ----- | ------- |
| `User` | platform user (auto-provisioned on first SSO/dev login); `role` admin / member (builder) / viewer (default for new users) |
| `App` | a deployable app: `definition` (draft JSON), `publishedDefinition`, `version`, `aiConfig` (encrypted), `visibility`, `status` |
| `AppVersion` | immutable snapshot captured on each publish (enables rollback) |
| `AppMembership` | per-app role (owner / editor / viewer), keyed by email |
| `DataSource` | per-app connection (a "connector"); `type` (REST/POSTGRES/SQLITE/MSGRAPH/AGENT), encrypted `config`, `authMode` (shared / per-user) |
| `UserCredential` | a user's encrypted secret for a per-user data source |
| `Query` | a saved SQL/REST/Graph request against a data source |
| `Template` | a clonable starter app bundle (definition + data sources + queries) |
| `Connector` | an admin-curated, reusable data-source template |
| `Conversation` / `Message` | persisted per-user chat threads |
| `Setting` | platform settings (name, logo, brand color, AI defaults) |

### App definition JSON

```jsonc
{
  "pages": [
    {
      "id": "page-…", "name": "Home", "slug": "home", "type": "ui",   // or "chat"
      "html": "<!doctype html>…",        // rendered at runtime
      "layout": { "components": [ … ] }, // drag-and-drop source (compiled to html)
      "editorMode": "ai|canvas|code",
      "queryId": "…",                    // bound query → window.APP_DATA
      "dataSourceIds": ["…"],            // optional: connectors this page may use (empty = all)
      "actions": [ { "name": "…", "queryId": "…" } ],
      "chat": { "systemPrompt": "…", "greeting": "…", "queryId": "…", "agentDataSourceId": "…" } // agentDataSourceId → an AGENT connector responder
    }
  ],
  "theme": { "brandName": "…", "brandColor": "#…", "logo": "…" },
  "buildGuidelines": "AGENTS.md / CLAUDE.md-style conventions",
  "allowWriteActions": true
}
```

> The schema is managed with `prisma db push` (no migration history yet). Per-page connector scoping +
> query allowlist, builder-only authoring, rate limits, and other guardrails are enforced server-side —
> see [configuration.md](configuration.md).
