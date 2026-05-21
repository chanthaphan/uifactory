# User guide

How to build, run, and share apps as a **member** (owner / editor / viewer).

## 1. Sign in

Open the platform URL and sign in with **Microsoft** (Azure AD). On a local/dev instance with no Azure
configured, pick a demo user from the **dev login**. You're auto-provisioned on first sign-in.

The top bar shows the platform branding (name + logo), and tabs for **Catalog**, **Build**, and (admins)
**Admin**.

## 2. Create an app

Go to **Build → New app**. Give it a name and optionally start **from a template** (e.g. *Conversational
Banking Agent*, *Chat with your data*, *Translate Side-by-Side*, *PDF Text Extraction*, *Parse Text into a
Table*, *Transactions Dashboard*). Templates clone their data sources, queries, and pages into your new app.

## 3. Connect data

Open **Data** (top bar of the editor) to manage data sources and queries for the app.

- **Add a data source** — choose a type:
  - **SQLite** — a file path on the server.
  - **PostgreSQL** — a connection string.
  - **REST API** — a base URL (+ optional default headers). You can also enable:
    - **Per-user credentials** — each user supplies their own token/connection string (see §7).
    - **Forward signed user identity** — attach a signed `X-UIFactory-User` JWT and fill
      `{{user_email}}` / `{{user_id}}` / `{{user_name}}` template values, so the API knows who's calling.
  - **Microsoft 365 (Graph)** — uses the platform's Azure app; no per-app config.
  - **…or add a prebuilt connector** an admin published, in one click.
- **Add a query** — name it, pick a data source, then:
  - SQL sources: write SQL. Use `{{param}}` placeholders (bound, never string-interpolated).
  - REST/Graph: pick a **method** + **path**, an optional **request body** (for non-GET), and
    **API schema / usage guidance** — a free-text hint that steers AI generation on how to use the response.
- **Test** a source and **Run** a query to preview results (table / chart / JSON).

## 4. Build a UI page

Each UI page can be authored three ways — switch with the toggle (**Drag & drop · AI generate · Source
code · Preview**). The **Data & actions** panel (top) is shared by all modes:

- **Bound query** — the query whose result becomes `window.APP_DATA` for the page. Click **Run query** to
  load sample data for the builder/preview.
- **Actions** — expose a query to the UI under a name; the UI calls `UIFactory.runAction(name, params)`
  (used for filters, lookups, and write-back).

### Drag-and-drop builder

Drag components from the palette onto the canvas (or double-click to append); reorder by dragging; select
a block to edit its **properties** on the right. Components: heading, text, metric/KPI, table, chart,
text input, file upload, button (runs an action), image, divider, and column container. Bindings (table
columns, chart fields, metric source, button action) come from the bound query's fields. The builder
compiles to the same self-contained HTML the runtime serves.

### AI generation

Describe the page in plain language and click **Generate**; refine with follow-up instructions
("add a bar chart"). The **Add a component** chips seed common requests. Generation uses the app's
configured AI (platform LLM, the app's own provider key, or an external agent) and respects the app's
**build guidelines**. If the AI is unavailable, a built-in template is used and the editor warns you.
Generation status persists if you switch pages, and a toast fires when it finishes.

### Source code

Edit the page HTML directly with a live preview. Generated UIs may use the `window.UIFactory` bridge:

| Call | Purpose |
| ---- | ------- |
| `UIFactory.runAction(name, params)` | run a named server query/action → `{ data, meta }` |
| `UIFactory.runQuery(queryId, params)` | run the page's bound query by id |
| `UIFactory.refresh()` | re-run the page's primary query |
| `UIFactory.onData(cb)` | subscribe to data updates (fires immediately with current data) |
| `UIFactory.navigate(slug)` | open another page of the app |
| `UIFactory.readFile(fileOrInput)` | read a user-selected file → `{ name, type, size, dataUrl, text }` |
| `UIFactory.showAlert / confirm / download / downloadCSV / copyToClipboard / storeValue / getValue` | UI helpers |

## 5. Build a chat page

Add a **chat page** and set a **system prompt**, **greeting**, and an optional **grounding query** (its
result is given to the assistant as context). The **responder** is the app's AI/agent connection:

- **Platform LLM** (server default), **the app's own provider key**, or an **external conversation-AI
  API**. The agent endpoint receives the transcript, the latest `message`, a stable `conversationId`, the
  grounding `data`, and the signed user identity — so a stateful, per-user assistant works out of the box.

Replies render as **markdown** and **stream** in. For signed-in users, conversations are **saved** as
named threads: use the thread switcher to resume, start a **New chat**, or delete a thread. (Anonymous
visitors on public apps stay ephemeral.)

## 6. AI / agent connection & build guidelines

In **Settings** (editor top bar):

- **AI / agent connection** — choose Platform default, this app's provider key (Claude / OpenAI / Azure
  OpenAI), or an external agent API URL (with optional auth header). This drives both UI generation and chat.
- **Build guidelines** — an AGENTS.md / CLAUDE.md-style note (conventions, design system, response
  decoding rules) injected into generation and chat prompts.
- **Branding, sharing, permissions** — per-app brand name/color/logo, who can access, and whether
  non-editors may run write actions.

## 7. Connect your own credentials

If a data source is marked **per-user**, you supply your own secret before it will run for you:

- In the editor's **Data → Your credentials** section, or in a deployed app via **Connect accounts** in
  the top bar. Enter your token/header (REST) or connection string (PostgreSQL).
- Your credential is encrypted per-user and only used for your sessions. Without it, that source returns
  a clear "connect your account" error.

## 8. Versions, deploy & share

- **Save** persists the draft. **Deploy** publishes it; while deployed, **Publish changes** rolls a new
  version forward. **Versions** lists history with notes/authors and **Restore** (rolls a version back
  into the draft to review, then re-publish).
- **Sharing** (Settings): `private` (named people from the org directory), `org` (anyone signed in), or
  `public`. Deployed apps appear in the **Catalog** for permitted users.
- Each user may have up to **20 deployed apps** (configurable); viewing/running others' apps is unlimited.

## Tips & limits

- Chat messages are capped (default **5000 words**); the box shows a counter and blocks oversize sends.
- Apps cap pages and data sources/queries (defaults 20 / 25 / 25). Generation and chat are rate-limited
  per user. See [configuration.md](configuration.md) to tune these.
