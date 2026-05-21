# API reference

All routes are under the `/api` prefix. Auth is a cookie JWT session (set by login). Legend:
**(public)** = no session required (the current user is still attached if present);
**(admin)** = requires the platform `admin` role; everything else requires a signed-in member with the
appropriate per-app role.

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
| POST | `/apps` | create `{ name, description?, templateId? }` |
| PUT | `/apps/:id` | update `{ name?, description?, definition?, aiConfig? }` |
| DELETE | `/apps/:id` | owner/admin only |
| POST | `/apps/:id/deploy` | publish a new version `{ note? }` (enforces the deploy cap) |
| POST | `/apps/:id/undeploy` | back to draft |
| GET | `/apps/:id/versions` | version history |
| POST | `/apps/:id/rollback` | `{ version }` → restore that version into the draft |
| PUT | `/apps/:id/sharing` | `{ visibility, members[] }` |
| GET | `/apps/:id/pages/:pageId/data` | (public) the page's bound-query result |
| POST | `/apps/:id/run-query` | (public) run a page query/action `{ queryId?/action?, pageId?, params? }` |
| POST | `/apps/:id/generate-ui` | app-scoped generation via the app's agent / provider key / platform LLM |
| POST | `/apps/:id/chat` | (public) one chat turn `{ pageId?, conversationId?, persist?, messages[] }` |
| POST | `/apps/:id/chat/stream` | (public) streaming chat; newline-delimited JSON (`{delta}` … `{done,source,conversationId}`) |

### Data sources — `/apps/:appId/datasources`

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/` | list (configs redacted) |
| POST | `/` | create `{ name, type, config, authMode? }` |
| POST | `/test` | test an inline config without saving |
| POST | `/from-connector/:connectorId` | clone a prebuilt connector `{ name? }` |
| GET / PUT / DELETE | `/:id` | read / update / delete |
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
| `User` | platform user (auto-provisioned on first SSO/dev login); `role` admin/member |
| `App` | a deployable app: `definition` (draft JSON), `publishedDefinition`, `version`, `aiConfig` (encrypted), `visibility`, `status` |
| `AppVersion` | immutable snapshot captured on each publish (enables rollback) |
| `AppMembership` | per-app role (owner / editor / viewer), keyed by email |
| `DataSource` | per-app connection; `type`, encrypted `config`, `authMode` (shared / per-user) |
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
      "actions": [ { "name": "…", "queryId": "…" } ],
      "chat": { "systemPrompt": "…", "greeting": "…", "queryId": "…" }
    }
  ],
  "theme": { "brandName": "…", "brandColor": "#…", "logo": "…" },
  "buildGuidelines": "AGENTS.md / CLAUDE.md-style conventions",
  "allowWriteActions": true
}
```

> The schema is managed with `prisma db push` (no migration history yet). Per-page query isolation,
> rate limits, and other guardrails are enforced server-side — see [configuration.md](configuration.md).
