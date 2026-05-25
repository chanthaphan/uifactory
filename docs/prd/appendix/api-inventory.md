# API Inventory

All paths below include the global `/api` prefix.

## Health and Platform Access

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Health check |
| GET | `/settings` | Public | Read platform settings |
| PUT | `/settings` | Admin | Update platform settings |
| GET | `/org/users` | Authenticated | Search organization members |
| GET | `/org/status` | Authenticated | Check directory-provider readiness |
| GET | `/users` | Admin | List all platform users |
| PATCH | `/users/:id` | Admin | Update role or active state |

## Authentication

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/auth/config` | Public | Get auth mode and branding |
| GET | `/auth/me` | Public | Get current session user |
| POST | `/auth/logout` | Public | End current session |
| GET | `/auth/dev-users` | Public | List demo users |
| POST | `/auth/dev-login` | Public | Start demo-user session |
| GET | `/auth/login` | Public | Start Azure AD login |
| GET | `/auth/callback` | Public | Finish Azure AD login |

## Templates and Prebuilt Connectors

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/templates` | Authenticated | List reusable app templates |
| POST | `/templates` | Admin | Create a template directly |
| POST | `/templates/from-app/:appId` | Admin | Create template from existing app |
| DELETE | `/templates/:id` | Admin | Delete template |
| GET | `/connectors` | Authenticated | List prebuilt connectors |
| POST | `/connectors` | Admin | Create prebuilt connector |
| PUT | `/connectors/:id` | Admin | Update prebuilt connector |
| DELETE | `/connectors/:id` | Admin | Delete prebuilt connector |

## App Lifecycle and Runtime

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/apps` | Authenticated | List editable apps |
| GET | `/apps/catalog` | Authenticated | List runnable deployed apps |
| GET | `/apps/by-slug/:slug` | Public | Load live app by slug |
| GET | `/apps/:id` | Authenticated | Load app details |
| POST | `/apps` | Builder | Create app |
| PUT | `/apps/:id` | Builder | Save draft app |
| DELETE | `/apps/:id` | Builder | Delete app |
| POST | `/apps/:id/deploy` | Builder | Publish and deploy app |
| POST | `/apps/:id/undeploy` | Builder | Remove app from live state |
| GET | `/apps/:id/versions` | Builder | List versions |
| POST | `/apps/:id/rollback` | Builder | Restore selected version to draft |
| PUT | `/apps/:id/sharing` | Builder | Update visibility and memberships |
| GET | `/apps/:id/pages/:pageId/data` | Public | Run bound page query |
| POST | `/apps/:id/run-query` | Public | Run page query or named action |
| POST | `/apps/:id/generate-ui` | Builder | Generate page HTML |
| POST | `/apps/:id/chat` | Public | Get non-streaming chat reply |
| POST | `/apps/:id/chat/stream` | Public | Get streaming chat reply |

## App Connectors

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/apps/:appId/datasources` | Authenticated | List app connectors |
| POST | `/apps/:appId/datasources/test` | Authenticated | Test unsaved connector config |
| POST | `/apps/:appId/datasources` | Authenticated | Create app connector |
| POST | `/apps/:appId/datasources/from-connector/:connectorId` | Authenticated | Clone prebuilt connector into app |
| GET | `/apps/:appId/datasources/:id` | Authenticated | Get connector details |
| PUT | `/apps/:appId/datasources/:id` | Authenticated | Update connector |
| DELETE | `/apps/:appId/datasources/:id` | Authenticated | Delete connector |
| POST | `/apps/:appId/datasources/:id/test` | Authenticated | Test existing connector |

## App Queries

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/apps/:appId/queries` | Authenticated | List queries |
| POST | `/apps/:appId/queries/run` | Authenticated | Run ad hoc query |
| POST | `/apps/:appId/queries` | Authenticated | Create query |
| GET | `/apps/:appId/queries/:id` | Authenticated | Get query details |
| PUT | `/apps/:appId/queries/:id` | Authenticated | Update query |
| DELETE | `/apps/:appId/queries/:id` | Authenticated | Delete query |
| POST | `/apps/:appId/queries/:id/run` | Authenticated | Run saved query |

## Personal Credentials

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/apps/:appId/credentials` | Authenticated | List per-user connector requirements |
| PUT | `/apps/:appId/credentials/:dataSourceId` | Authenticated | Save current user's connector credential |
| DELETE | `/apps/:appId/credentials/:dataSourceId` | Authenticated | Delete current user's connector credential |

## Conversations and AI

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/apps/:appId/conversations` | Authenticated | List current user's conversations |
| GET | `/apps/:appId/conversations/:conversationId` | Authenticated | Get one conversation |
| DELETE | `/apps/:appId/conversations/:conversationId` | Authenticated | Delete one conversation |
| GET | `/ai/status` | Authenticated | Check platform AI readiness |
| POST | `/ai/generate-ui` | Authenticated | Platform-level UI generation |
