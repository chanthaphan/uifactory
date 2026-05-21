# Admin guide

Admins (platform role `admin`) get an **Admin** tab with four sections. Admins can also view/edit any app.

## Users

`Admin → Users` lists every account. Change a user's **role** (`admin` / `member`) or **active** flag.
Users are auto-provisioned on first SSO login; the emails in `ADMIN_EMAILS` (and the very first user)
become admins automatically.

## Templates

`Admin → Templates` lists starter templates members can clone from **Build → New app**.

- **Create template from app** — pick one of your apps to export its definition + its data sources +
  queries into a portable, self-contained template bundle.
- **Delete** removes a template (apps already created from it are unaffected).

The seed ships bank- and agent-focused templates (Conversational Banking Agent, Contact Center Knowledge
Base, Chat with your data, Translate Side-by-Side, PDF Text Extraction, Parse Text into a Table,
Transactions Dashboard, Agent Console, and blank starters).

## Connectors (prebuilt data sources)

`Admin → Connectors` curates reusable data-source connections any member can clone into an app in one
click (**Data → Add a prebuilt connector**).

- **Create** — name, optional category/description, type (REST / PostgreSQL / SQLite / Microsoft 365),
  and config (e.g. a REST base URL + default headers). Secrets are encrypted and never shown back.
- **Delete** — removes the connector; apps that already cloned it keep their own copy.

Cloning copies the connector's (decrypted-then-re-encrypted) config into a new per-app data source.

## Settings — platform branding & AI defaults

`Admin → Settings`:

- **Platform name** — shown in the nav bar and login screen.
- **Platform logo** — an **image URL** *or* a short **letter/emoji** mark.
- **Brand color** — tints the logo mark when no image is set.
  A live preview is shown; saving updates the nav bar/login immediately.
- **Default visibility** for new shares, and **default AI provider**.

Branding is served (publicly) from `GET /auth/config`, so it appears on the login screen before sign-in.
Provider **API keys** are configured per-app or via server environment variables, not here — see
[configuration.md](configuration.md).

## Guardrails

Platform limits (deployed apps per user, chat input length, app size caps, rate limits, conversation
retention, etc.) are environment-tunable, not edited in the UI. See **[configuration.md](configuration.md)**.
