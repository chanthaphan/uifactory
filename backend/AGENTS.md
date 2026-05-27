# BACKEND KNOWLEDGE BASE

## OVERVIEW
NestJS API over Prisma/SQLite. Feature modules own controllers/services; shared security and data-shape logic lives in plain utilities so it can be tested without decorators.

## STRUCTURE
```
backend/
|-- src/
|   |-- apps/          # app lifecycle, runtime, chat, AI generation
|   |-- auth/          # global auth guard, OIDC/dev login, roles
|   |-- common/        # pure helpers: secrets, SSRF, limits, identity, query scope
|   |-- datasources/   # app connectors, config validation, test connection
|   |-- execution/     # SQL/REST/MS Graph execution and identity forwarding
|   |-- prisma/        # Prisma service/module
|   `-- */             # small Nest feature modules
|-- prisma/schema.prisma
|-- scripts/
`-- test/
```

## WHERE TO LOOK
| Task | Location | Notes |
| --- | --- | --- |
| Backend bootstrap | `src/main.ts` | CORS, cookie parser, global prefix `/api`, port |
| Module graph | `src/app.module.ts` | Imports all feature modules |
| Auth behavior | `src/auth/auth.guard.ts`, `src/auth/auth.service.ts` | 401 vs 403, SSO/dev users, default roles |
| App permissions | `src/apps/app-access.service.ts`, `src/apps/apps.service.ts` | App owner/editor/viewer and platform roles interact |
| Data execution | `src/queries/`, `src/execution/` | Bound queries, REST/SQL/Graph execution |
| Connector config | `src/datasources/`, `src/connectors/` | App-owned DataSource vs admin-curated Connector |
| Tests | `test/*.test.ts` | Node built-in runner via tsx |

## CONVENTIONS
- Add backend HTTP features as Nest feature folders with controller/service/module files.
- Keep security-critical helpers decorator-free when practical; put reusable pure logic in `src/common/` and test it from `backend/test/`.
- Prisma stores JSON blobs as strings. Parse/normalize at service boundaries.
- Encrypt shared connector config, app AI config, and per-user credentials before persistence.
- Return redacted configs to the UI; preserve blank/masked secrets during updates.
- `@Public()` routes can still receive `CurrentUser()` because the global guard best-effort attaches the user first.

## ANTI-PATTERNS
- Never use 401 for role denial. Throw `ForbiddenException` for authenticated users without permission.
- Never run user-supplied REST/agent/provider URLs without `assertSafeUrl`.
- Never test Nest decorators/services with Node TS stripping. Test extracted utilities instead.
- Never assume app draft and runner state are the same. Runners use published snapshots unless the caller can edit.

## COMMANDS
```bash
npm run build --workspace backend
npm test --workspace backend
npm run setup --workspace backend
npm run migrate:agent-connectors --workspace backend
```
