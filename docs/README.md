# UIFactory documentation

UIFactory is a low-code internal-app platform: sign in with SSO, connect data sources and agent APIs,
build multi-page apps (drag-and-drop, AI-generated, or hand-written HTML) plus chat assistants, then
version, deploy, and share them across the organization.

## Guides

- **[User guide](user-guide.md)** — build apps with the drag-and-drop builder, AI, or source code;
  bind data; add chat; manage versions; connect your own credentials; run & share apps.
- **[Admin guide](admin-guide.md)** — manage users and roles, templates, prebuilt connectors, platform
  branding (name / logo / color), and AI defaults.
- **[API reference](api-reference.md)** — every HTTP route and the database model.
- **[Configuration](configuration.md)** — all environment variables and tunable guardrails (limits).
- **[Deployment](deployment.md)** — running locally, with Docker, and on Azure / AKS via Helm.

## Concepts at a glance

- **App** — a deployable unit with one or more **pages** (UI or chat), a **theme**, optional **build
  guidelines**, and a per-app **AI connection** (platform LLM or own provider key; chat pages may use an
  Agent API connector). Edited as a *draft*; **publishing** snapshots an immutable **version** that
  runners see.
- **Page** — a **UI page** (rendered from `window.APP_DATA`, authored via builder / AI / code) or a
  **chat page** (LLM or Agent-API-connector-backed, optionally grounded on a query). A page can be
  **scoped** to a subset of the app's connectors.
- **Connector** — a connection owned by one app: REST API, PostgreSQL, SQLite, Microsoft 365, or an
  **Agent API** (an external assistant a chat page can use). Managed in the editor's **Connectors** panel;
  credentials can be **shared** or **per-user**. (A connector is a "data source" in the API/data model.)
- **Prebuilt connector** — an admin-curated, reusable connector template any builder can clone into an app.
- **Query** — a saved request (SQL or REST/Graph call) against a connector. A page exposes selected
  queries as **actions** the UI can call (`UIFactory.runAction`).
- **Conversation** — a persisted, per-user chat thread (for signed-in users).

> The platform is designed for **trusted internal use**: apps run the SQL / HTTP / agent calls you
> configure. See the security notes in the [API reference](api-reference.md) and [deployment](deployment.md) guides.
