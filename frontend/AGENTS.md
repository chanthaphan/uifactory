# FRONTEND KNOWLEDGE BASE

## OVERVIEW
React 19 + Vite + MUI SPA. The frontend provides login/catalog/build/admin/runner surfaces and hosts generated app HTML inside a sandboxed iframe.

## STRUCTURE
```
frontend/
|-- src/
|   |-- api/        # axios client, shared API/domain types
|   |-- auth/       # auth state, build/admin gating, branding application
|   |-- components/ # reusable UI plus runtime bridge/compiler components
|   |-- pages/      # route pages; AppEditorPage is the main hotspot
|   |-- App.tsx     # lazy route shell and navigation
|   `-- main.tsx    # BrowserRouter mount
|-- vite.config.ts  # dev server port 5173, proxy /api -> backend 3001
`-- package.json
```

## WHERE TO LOOK
| Task | Location | Notes |
| --- | --- | --- |
| Routes/nav | `src/App.tsx` | `Catalog`, `Build`, `Admin`, `/run/:slug` |
| API contract | `src/api/client.ts` | Axios instance, 401 event, frontend shared types |
| Auth/branding | `src/auth/AuthContext.tsx`, `src/branding.ts` | Session, role gates, tab title/favicon |
| Builder page | `src/pages/AppEditorPage.tsx` | AI/canvas/code modes, connectors, versions, publish |
| Runner page | `src/pages/AppRunnerPage.tsx` | Renders UI/chat pages and bridge handlers |
| Sandbox bridge | `src/components/PreviewFrame.tsx` | Injects `window.APP_DATA` and `window.UIFactory` |

## CONVENTIONS
- All HTTP calls go through `src/api/client.ts`; keep `baseURL: '/api'` and `withCredentials: true`.
- The axios interceptor logs out on non-auth 401s. Backend role failures must stay 403.
- Use `AuthContext` for `isAdmin` and `canBuild`; do not duplicate platform role logic in pages.
- Route pages are lazy-loaded from `App.tsx`; heavy chart/builder components are also lazy-loaded.
- Prefer existing MUI `Stack`, `Box`, `Card`, `Grid`, `Alert`, `Chip`, and `sx` patterns over new styling systems.

## ANTI-PATTERNS
- Do not call backend APIs directly from generated iframe HTML; use `window.UIFactory` bridge methods.
- Do not add a frontend test runner unless requested. Verification is typecheck and Vite build.
- Do not bypass `api.errMessage` handling conventions for displayed API errors.
- Do not assume viewers can access Build/Admin UI; frontend hides routes and backend enforces roles.

## COMMANDS
```bash
cd frontend && npx tsc --noEmit
npm run build --workspace frontend
npm run dev --workspace frontend
```
