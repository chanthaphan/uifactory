# UIFactory

A low-code internal-app builder, inspired by [Appsmith](https://github.com/appsmithorg/appsmith).
Business users connect a **data source** (REST API, PostgreSQL, or SQLite), run a **query**, and
let **Claude generate an app UI** from the query's output shape. Generated apps are saved and can be
re-opened to run against live data.

```
Data source ──▶ Query ──▶ Run ──▶ JSON/rows ──▶ Claude ──▶ HTML app ──▶ Save & run live
```

## Features

- **Data sources** — connect REST APIs, PostgreSQL (connection string), or SQLite (file). Test
  connections; secrets are redacted when read back.
- **Query workspace** — write SQL or configure REST requests, run them, and inspect results as a
  table, an auto-chart (Recharts), or raw JSON.
- **AI UI generation** — send the query output sample + a prompt to an LLM (Claude, OpenAI, or
  Azure OpenAI); it returns a self-contained HTML app that renders `window.APP_DATA`. Falls back to
  a built-in template generator when no provider is configured, so the feature always works.
- **Live preview** — generated apps render in a sandboxed iframe (scripts run, but with an opaque
  origin so generated code can't touch the host app).
- **Save & run apps** — persist generated apps; re-open them to re-run the bound query and render
  with fresh data.

## Tech stack

| Layer    | Stack                                                        |
| -------- | ------------------------------------------------------------ |
| Frontend | React 19, TypeScript, Vite 7, MUI (Material UI), Recharts    |
| Backend  | NestJS (Express), TypeScript, Prisma (SQLite), Anthropic + OpenAI SDKs |
| Runtime  | REST via axios · PostgreSQL via `pg` · SQLite via `node:sqlite` |

## Prerequisites

- Node.js **22.5+** (uses the built-in `node:sqlite` module)

## Setup

```bash
# from the repo root
npm install            # installs backend + frontend workspaces

# backend: generate Prisma client, create the metadata DB, and seed sample data
npm run setup          # == prisma generate + db push + seed
```

The seed creates a sample SQLite business database (`backend/data/sample.db`) with
`customers` / `products` / `orders`, plus two ready-to-use data sources and several example queries.

### Configure AI (optional but recommended)

"Generate UI" supports **Anthropic (Claude)**, **OpenAI**, and **Azure OpenAI**. Copy
`backend/.env.example` to `backend/.env` and configure **one** provider:

| Provider     | Required vars                                                                 | Default model      |
| ------------ | ----------------------------------------------------------------------------- | ------------------ |
| Anthropic    | `ANTHROPIC_API_KEY` (opt: `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL`)            | `claude-sonnet-4-6`|
| OpenAI       | `OPENAI_API_KEY` (opt: `OPENAI_MODEL`, `OPENAI_BASE_URL`)                     | `gpt-4o`           |
| Azure OpenAI | `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT` (opt: `AZURE_OPENAI_API_VERSION`) | deployment name |

The provider is auto-detected from the keys present (priority: Anthropic → Azure OpenAI → OpenAI).
Force one explicitly with `AI_PROVIDER=anthropic|openai|azure-openai`.

```env
# Example: use OpenAI
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

Without any provider, "Generate UI" still works using the built-in template generator (the nav
shows an "AI: template mode" badge); otherwise it shows e.g. "OpenAI connected".

## Run

```bash
npm run dev            # starts backend (:3001) and frontend (:5173) together
```

Then open **http://localhost:5173**. The Vite dev server proxies `/api` to the backend.

Run individually if you prefer:

```bash
npm run dev:backend    # NestJS on http://localhost:3001/api
npm run dev:frontend   # Vite on http://localhost:5173
```

## API overview

All routes are under `/api`.

| Method | Path                      | Description                                   |
| ------ | ------------------------- | --------------------------------------------- |
| GET/POST/PUT/DELETE | `/datasources[/:id]` | Manage data sources                  |
| POST   | `/datasources/:id/test`   | Test a saved connection                       |
| POST   | `/datasources/test`       | Test an unsaved connection config             |
| GET/POST/PUT/DELETE | `/queries[/:id]`     | Manage queries                       |
| POST   | `/queries/:id/run`        | Run a saved query                             |
| POST   | `/queries/run`            | Run an ad-hoc query against a data source     |
| GET    | `/ai/status`              | Whether Claude is configured + model          |
| POST   | `/ai/generate-ui`         | Generate app HTML from a data sample + prompt |
| GET/POST/PUT/DELETE | `/apps[/:id]`        | Manage saved apps                    |
| GET    | `/apps/:id/data`          | Re-run the app's bound query for live data    |

## Project layout

```
backend/    NestJS API (datasources, queries, ai, apps, execution engine, Prisma)
frontend/   React + Vite builder UI (Builder, Data Sources, My Apps, App runner)
```

## Notes

- This is an MVP that demonstrates the Appsmith concept end-to-end. Queries execute arbitrary SQL /
  HTTP against the data sources you configure — intended for trusted internal use, like Appsmith.
- The generated app's HTML reads its data from `window.APP_DATA`, so re-running the bound query
  refreshes the UI without regeneration.
```
