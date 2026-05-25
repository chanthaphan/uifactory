# UIFactory Product Requirements Document

## System Overview

UIFactory is a low-code internal application platform for business teams that need to turn connected data into usable internal tools quickly. Signed-in users can browse published apps, and authorized builders can create multi-page apps that mix traditional data-driven screens with AI-assisted chat experiences.

The product has two major operating modes. The first is a runtime mode where end users open deployed apps, supply any required personal credentials, run queries, submit actions, and talk to chat pages. The second is a builder mode where app authors configure data connectors, define queries, assemble pages with drag-and-drop, AI-generated HTML, or hand-written code, and then publish versioned releases.

The platform is also opinionated about governance. Access is controlled through role-based permissions, app-level sharing, page-level connector scope, secret redaction, and explicit protection around write actions. This makes the product suitable for internal business use where the same platform must serve admins, builders, and read-only viewers safely.

## Primary Users

| User Type | Business Goal |
|---|---|
| Platform admin | Configure platform branding, manage users, curate reusable templates and connectors |
| Builder (`admin` or `member`) | Create, edit, share, publish, and maintain apps |
| Viewer (`viewer`) | Open and use apps shared directly, with the organization, or publicly |
| App end user | Run published UI pages and chat pages, optionally connect personal credentials |

## Module Overview

| Module | Pages / Resource Groups | Core Functionality |
|---|---|---|
| Authentication | Login, Auth API | Sign-in, session bootstrap, logout, dev login, Azure AD login |
| Catalog & Runtime | Catalog, Live App Runner, App Runtime API | Browse deployed apps and use published pages |
| Builder Workspace | My Apps, App Editor, Connectors/Queries/Credentials API | Create and maintain apps, pages, connectors, queries, versions, and sharing |
| Administration | Admin Console, Users API, Settings API, Templates API, Connectors API | Manage the platform and shared assets |
| AI & Conversations | Chat pages, AI API, Conversations API | Generate page UIs and run persisted chat threads |

## Frontend Page Inventory

| # | Page Name | Route | Module | Doc |
|---|---|---|---|---|
| 1 | Login | gated root when signed out | Authentication | [01-login-auth.md](./pages/01-login-auth.md) |
| 2 | App Catalog | `/` | Catalog & Runtime | [02-app-catalog.md](./pages/02-app-catalog.md) |
| 3 | Build Apps | `/build` | Builder Workspace | [03-build-apps.md](./pages/03-build-apps.md) |
| 4 | App Editor | `/build/:id` | Builder Workspace | [04-app-editor.md](./pages/04-app-editor.md) |
| 5 | Live App Runner | `/run/:slug` | Catalog & Runtime | [05-live-app-runner.md](./pages/05-live-app-runner.md) |
| 6 | Admin Console | `/admin` | Administration | [06-admin-console.md](./pages/06-admin-console.md) |

## Backend Resource Inventory

| # | Resource Group | Primary Endpoints | Module | Doc |
|---|---|---|---|---|
| 7 | Auth & Session API | `/api/auth/*` | Authentication | [07-auth-and-session-api.md](./pages/07-auth-and-session-api.md) |
| 8 | Platform Access API | `/api/users`, `/api/settings`, `/api/org`, `/api/health` | Administration / Access | [08-platform-and-access-api.md](./pages/08-platform-and-access-api.md) |
| 9 | App Lifecycle & Runtime API | `/api/apps*`, `/api/apps/:id/chat*`, `/api/apps/:id/pages/:pageId/data` | Runtime / Builder | [09-app-lifecycle-and-runtime-api.md](./pages/09-app-lifecycle-and-runtime-api.md) |
| 10 | Connectors, Queries & Credentials API | `/api/apps/:appId/datasources*`, `/api/apps/:appId/queries*`, `/api/apps/:appId/credentials*` | Builder Workspace | [10-connectors-queries-and-credentials-api.md](./pages/10-connectors-queries-and-credentials-api.md) |
| 11 | Templates, Prebuilt Connectors & AI API | `/api/templates*`, `/api/connectors*`, `/api/ai/*`, `/api/apps/:id/conversations*` | Administration / AI | [11-templates-and-ai-api.md](./pages/11-templates-and-ai-api.md) |

## Global Notes

### Permission Model

| Role | Product Meaning | Key Access |
|---|---|---|
| `admin` | Platform administrator | Full access, including admin console and all builder features |
| `member` | Builder | Can create and edit apps but cannot access admin-only features |
| `viewer` | Consumer | Can use apps but cannot author them |

Additional access rules:

| Rule | Behavior |
|---|---|
| App sharing | Apps can be `private`, `org`, or `public` |
| App memberships | Specific people can be added as `editor` or `viewer` by email |
| Builder-only actions | App create, edit, deploy, undeploy, rollback, and AI generation require builder access |
| Page-level connector scope | A page can restrict which connectors its bound query and actions are allowed to use |
| Write-action control | Non-editors can be blocked from mutation queries unless the app explicitly enables write actions |

### Common Product Patterns

| Pattern | Behavior |
|---|---|
| Session bootstrap | The shell loads platform branding and current-user details before showing the product |
| Secret handling | Stored secrets are encrypted and returned to the UI as masked values only |
| Publishing | Apps have a draft definition for builders and a published snapshot for runtime users |
| Versioning | Every publish creates a numbered version that can be restored later |
| Runtime safety | Chat and page execution honor app access, page scope, and connector credential rules |
| Reusable assets | Templates and admin-curated connectors can be cloned into new apps |

## Supporting Appendices

| Appendix | Purpose |
|---|---|
| [enum-dictionary.md](./appendix/enum-dictionary.md) | Exhaustive value dictionary for roles, statuses, connector types, and other coded values |
| [page-relationships.md](./appendix/page-relationships.md) | How pages and resource groups connect to each other |
| [api-inventory.md](./appendix/api-inventory.md) | Full endpoint inventory with method, path, access, and business purpose |
