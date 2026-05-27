# FRONTEND COMPONENTS KNOWLEDGE BASE

## OVERVIEW
Reusable UI components plus the generated-page runtime surface. `PreviewFrame`, `layout-compiler`, `CanvasBuilder`, `DataPanel`, and `ChatView` are the main risk areas.

## WHERE TO LOOK
| Task | Location | Notes |
| --- | --- | --- |
| Iframe host | `PreviewFrame.tsx` | Builds `srcDoc`, injects data and bridge, handles postMessage replies |
| Canvas-to-HTML | `layout-compiler.ts` | Dependency-free runtime JS string for generated pages |
| Drag/drop builder | `CanvasBuilder.tsx` | Component tree editing, no nested containers |
| Connector/query panel | `DataPanel.tsx` | DataSources, queries, masked secret UI, test connection |
| Chat UI | `ChatView.tsx` | Streaming, markdown, persisted threads |
| Credentials | `CredentialsManager.tsx` | Per-user credential entry and refresh hooks |
| Results | `ResultView.tsx`, `ResultChart.tsx`, `JsonView.tsx` | Table/chart/JSON display, chart lazy loading |

## CONVENTIONS
- `PreviewFrame` is the only host for generated/authored UI HTML.
- `BRIDGE_SCRIPT` must remain self-contained browser JavaScript; no imports or React assumptions inside it.
- Bridge messages use `source: 'uifactory-app'` and host replies use `source: 'uifactory-host'`.
- Generated UI helpers include `runAction`, `runQuery`, `refresh`, `navigate`, `readFile`, alerts, confirm, download, clipboard, and session storage.
- `layout-compiler.ts` should emit HTML that reads `window.APP_DATA` and calls `UIFactory`, not app-specific React code.

## ANTI-PATTERNS
- Do not add `allow-same-origin` to the iframe sandbox without a security review.
- Do not let iframe messages from other windows pass; keep `e.source === frame.contentWindow` and source checks.
- Do not introduce dependencies into compiler-emitted runtime strings.
- Do not break masked secret preservation UX in `DataPanel`; backend depends on blank/masked semantics.

## VERIFY
```bash
cd frontend && npx tsc --noEmit
npm run build --workspace frontend
```
