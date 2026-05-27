# APPS MODULE KNOWLEDGE BASE

## OVERVIEW
Core domain module. Owns app draft/publish/version behavior, sharing, runtime page data, chat, AI generation, and the AGENT-connector bridge.

## WHERE TO LOOK
| Task | Location | Notes |
| --- | --- | --- |
| App service hotspot | `apps.service.ts` | 581-line central service; edit with extra care |
| HTTP routes | `apps.controller.ts` | `/apps`, `/apps/:id/*`, public runner endpoints |
| App access | `app-access.service.ts` | Shared app view/edit assertions for nested modules |
| Definition model | `app-defs.ts` | `AppDefinition`, page remaps, normalization, query collection |
| Agent/provider calls | `agent.service.ts` | OpenAI/Anthropic/Azure/agent-api chat and generation |
| DTOs | `dto/` | Route request shapes |

## CONVENTIONS
- Use `canView` and `canEdit` semantics consistently: platform `admin/member/viewer` is not the same as per-app `owner/editor/viewer`.
- Mutating app authoring routes are builder-gated in the controller and rechecked in the service.
- Deploy snapshots `definition` into `publishedDefinition` and increments immutable `AppVersion` rows.
- Runtime query execution must pass both app-level query allowlist and page-level query/action allowlist.
- `page.dataSourceIds` is a hard connector boundary. Empty or undefined means unscoped/all connectors.
- Chat system prompt appends `definition.buildGuidelines`; keep truncation and context composition centralized here.
- External assistant support is an AGENT DataSource selected by `chat.agentDataSourceId`; `resolvePageAiConfig` synthesizes `agent-api`.

## ANTI-PATTERNS
- Do not remove `agent-api` support because app `aiConfig.mode` normally says `platform` or `provider`.
- Do not let an action run by name without resolving it through the page action list when `pageId` is supplied.
- Do not expose unredacted `aiConfig` to users who cannot edit the app.
- Do not weaken mutation blocking when `allowWriteActions === false`; non-editors must not run write queries.
- Do not change template clone/remap helpers without updating `backend/test/app-defs.test.ts`.

## TESTS
```bash
npm test --workspace backend
npm run build --workspace backend
```
