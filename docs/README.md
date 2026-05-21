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
  guidelines**, and per-app **AI/agent connection**. Edited as a *draft*; **publishing** snapshots an
  immutable **version** that runners see.
- **Page** — a **UI page** (rendered from `window.APP_DATA`, authored via builder / AI / code) or a
  **chat page** (LLM or agent-backed, optionally grounded on a query).
- **Data source** — a REST API, PostgreSQL, SQLite, or Microsoft 365 connection owned by one app.
  Credentials can be **shared** or **per-user**.
- **Query** — a saved request (SQL or REST/Graph call) against a data source. A page exposes selected
  queries as **actions** the UI can call (`UIFactory.runAction`).
- **Connector** — an admin-curated, reusable data-source template any member can clone into an app.
- **Conversation** — a persisted, per-user chat thread (for signed-in users).

> The platform is designed for **trusted internal use**: apps run the SQL / HTTP / agent calls you
> configure. See the security notes in the [API reference](api-reference.md) and [deployment](deployment.md) guides.
