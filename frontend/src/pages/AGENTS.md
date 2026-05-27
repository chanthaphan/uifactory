# FRONTEND PAGES KNOWLEDGE BASE

## OVERVIEW
Route-level product surfaces. `AppEditorPage.tsx` is the largest frontend hotspot; `AppRunnerPage.tsx` is the runtime surface for deployed apps.

## WHERE TO LOOK
| Task | Location | Notes |
| --- | --- | --- |
| Login | `LoginPage.tsx` | Azure vs dev login; branding shown before auth |
| Catalog | `CatalogPage.tsx` | Deployed apps visible to current user |
| Build list | `MyAppsPage.tsx` | Create apps from templates, delete owned/editable apps |
| Editor | `AppEditorPage.tsx` | Pages, connectors, queries, AI generation, canvas/code modes, deploy |
| Admin | `AdminPage.tsx` | Users, templates, prebuilt connectors, platform settings |
| Runner | `AppRunnerPage.tsx` | Public/org/private app runtime, page tabs, credentials, chat/UI split |

## CONVENTIONS
- Page files keep most page-local state inline; extract only reusable/runtime pieces to `components/`.
- `AppEditorPage` must keep connector-scope warnings aligned with backend `queryInPageScope` enforcement.
- UI pages bind one query into `window.APP_DATA`; actions expose named queries through `UIFactory.runAction`.
- Chat pages use `chat.queryId` for grounding and `chat.agentDataSourceId` for external assistant connectors.
- `AppRunnerPage` uses `publishedDefinition` from the backend and renders UI pages through `PreviewFrame`.

## ANTI-PATTERNS
- Do not silently overwrite code-mode HTML when switching canvas/code/AI flows without matching existing warnings.
- Do not let editor-side validation become the only enforcement. Backend remains authoritative.
- Do not duplicate API types in page files; import from `src/api/client.ts`.
- Do not change route access assumptions without updating both `App.tsx` gates and backend roles.

## VERIFY
```bash
cd frontend && npx tsc --noEmit
npm run build --workspace frontend
```
