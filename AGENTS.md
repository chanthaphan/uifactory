# PROJECT KNOWLEDGE BASE

**Generated:** 2026-05-27
**Commit:** 6b84a0f
**Branch:** main

## OVERVIEW
UIFactory is a low-code internal-app platform. The repo is an npm workspaces monorepo with a NestJS API in `backend/`, a React 19 + Vite SPA in `frontend/`, docs, and an AKS Helm chart.

## STRUCTURE
```
uifactory/
|-- backend/             # NestJS API, Prisma schema, seed/migration scripts, node:test units
|-- frontend/            # React/Vite SPA, editor, runner, iframe bridge
|-- docs/                # user/admin/API/config/deployment docs plus PRD tree and media
|-- charts/uifactory/    # Helm chart for AKS/App Gateway/Key Vault CSI deployment
|-- Dockerfile           # backend image
|-- Dockerfile.frontend  # frontend image
|-- CLAUDE.md            # previous repo guidance; keep in sync with this file
`-- package.json         # root workspace scripts only
```

## WHERE TO LOOK
| Task | Location | Notes |
| --- | --- | --- |
| Boot backend | `backend/src/main.ts` | CORS, cookies, `/api` prefix, port 3001 |
| Wire backend modules | `backend/src/app.module.ts` | Feature modules, no central router |
| Auth and roles | `backend/src/auth/` | Global guard, SSO/dev login, `@Public()`, `@Roles()` |
| App lifecycle/runtime | `backend/src/apps/` | Draft/publish, sharing, page data, chat, generation |
| Connector execution | `backend/src/datasources/`, `backend/src/queries/`, `backend/src/execution/` | DataSource == connector in UI terms |
| Security utilities | `backend/src/common/` | Secret redaction/merge, SSRF, limits, identity, query scope |
| DB model | `backend/prisma/schema.prisma` | SQLite dev schema; no migration history yet |
| Frontend shell | `frontend/src/App.tsx` | Lazy routes, role-gated nav, runner route |
| Auth/API client | `frontend/src/auth/AuthContext.tsx`, `frontend/src/api/client.ts` | Branding, 401 logout event, shared frontend types |
| App editor | `frontend/src/pages/AppEditorPage.tsx` | Largest frontend file; AI/canvas/code/deploy/version UI |
| Runtime iframe | `frontend/src/components/PreviewFrame.tsx`, `frontend/src/components/layout-compiler.ts` | `window.UIFactory` bridge and generated page runtime |
| Docs | `docs/README.md`, `docs/codebase-walkthrough.md` | Developer flow, product docs, PRD inventory |
| Helm deployment | `charts/uifactory/README.md`, `charts/uifactory/values.yaml` | Dev SQLite vs production Postgres path |

## CODE MAP
| Symbol | Type | Location | Role |
| --- | --- | --- | --- |
| `AppModule` | Nest module | `backend/src/app.module.ts` | Imports all API feature modules |
| `AuthGuard` | global guard | `backend/src/auth/auth.guard.ts` | Attaches current user, emits 401/403 correctly |
| `AppsService` | service | `backend/src/apps/apps.service.ts` | App lifecycle, runtime query gating, chat/generation |
| `AppDefinition` | domain type | `backend/src/apps/app-defs.ts` | Draft/published page model and remap helpers |
| `assertSafeUrl` | utility | `backend/src/common/safe-url.ts` | SSRF guard for REST/agent/provider calls |
| `redactConfig` | utility | `backend/src/common/redact.util.ts` | Masks secrets before API responses |
| `mergeConfigPreservingSecrets` | utility | `backend/src/common/secret-merge.util.ts` | Keeps stored secrets when update fields are blank/masked |
| `PreviewFrame` | component | `frontend/src/components/PreviewFrame.tsx` | Hosts sandboxed UI HTML and bridge messages |
| `compileLayout` | compiler | `frontend/src/components/layout-compiler.ts` | Converts canvas layout to dependency-free runtime HTML |
| `AppEditorPage` | page | `frontend/src/pages/AppEditorPage.tsx` | Main builder surface |

## CONVENTIONS
- Run commands from repo root unless a child AGENTS.md says otherwise.
- Root workspaces are only `backend` and `frontend`; there are no shared packages.
- Backend feature folders follow `*.controller.ts`, `*.service.ts`, `*.module.ts`; pure shared logic lives under `backend/src/common/*.util.ts`.
- Frontend pages live in `frontend/src/pages`; reusable/runtime UI lives in `frontend/src/components`; all HTTP goes through `frontend/src/api/client.ts`.
- UI language says connector; backend, Prisma, and API use `DataSource`.
- App runtime reads `publishedDefinition`; editors usually work with draft `definition`.
- Generated/authored UI HTML must use `window.APP_DATA` and `window.UIFactory`, not direct API calls.

## ANTI-PATTERNS (THIS PROJECT)
- Do not return 401 for authenticated-but-forbidden users. Use 403; frontend logs out on non-auth 401s.
- Do not wipe secrets when a user edits connector names or leaves masked/blank secret fields unchanged.
- Do not bypass `assertSafeUrl` for REST, agent, or provider URLs.
- Do not remove `agent-api` handling from `AppsService`/`AgentService`; external agents are AGENT connectors selected per chat page.
- Do not import Nest `@Injectable()` services into backend tests. Extract plain helpers and test those.
- Do not add Jest/Vitest/frontend test dependencies unless explicitly requested.
- Do not treat empty page `dataSourceIds` as deny-all; empty/undefined means all app connectors allowed.

## UNIQUE STYLES
- Code is concise, comment-light TypeScript. Comments are used for security/runtime gotchas, not routine operations.
- Backend tests use `node:test` and `node:assert/strict` against decorator-free utilities.
- The frontend uses MUI `sx` inline styling and route/component lazy loading for heavy editor/runtime pieces.
- The iframe bridge is intentionally dependency-free string-injected JavaScript.

## COMMANDS
```bash
npm install
npm run setup
npm run dev
npm run dev:backend
npm run dev:frontend
npm run build
npm run build --workspace backend
npm test --workspace backend
cd frontend && npx tsc --noEmit
npm run build --workspace frontend
npm run migrate:agent-connectors --workspace backend
```

## NOTES
- Node 22.5+ is required; `.nvmrc` pins local dev to 24.
- Backend dev metadata DB is SQLite via Prisma `db push`; production chart expects a future Postgres migration path.
- CI builds backend/frontend, renders Helm templates, and builds Docker images. It does not currently run backend unit tests.
- Backend dev port must stay 3001 because Vite proxies `/api` there; frontend dev port is 5173.
- LSP for TypeScript was not installed during generation, so code map is from direct reads, grep fallback, and AST-grep.
