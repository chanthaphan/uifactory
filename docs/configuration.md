# Configuration

All configuration is via environment variables on the **backend** (`backend/.env` locally, or a
ConfigMap / Key Vault in production). A starter file lives at `backend/.env.example`.

## Core

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `DATABASE_URL` | `file:./dev.db` | Prisma metadata DB. SQLite for dev; PostgreSQL for production (also switch the Prisma provider). |
| `PORT` | `3001` | API listen port. |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin and OIDC redirect base. |
| `PLATFORM_NAME` | `UIFactory` | Default platform name (admins can override it, plus logo/color, in **Admin → Settings**). |
| `NODE_ENV` | — | `production` issues Secure session cookies. |

## Auth & secrets

| Variable | Purpose |
| -------- | ------- |
| `JWT_SECRET` | Signs session cookies **and** the short-lived `X-UIFactory-User` identity assertions. Change in production. |
| `SECRETS_KEY` | 32-byte hex/base64 AES-256-GCM key encrypting data-source configs, per-app AI keys, and per-user credentials. If unset, a key is derived from `JWT_SECRET` (dev only). Generate: `openssl rand -hex 32`. |
| `ADMIN_EMAILS` | Comma-separated emails granted `admin` on first login (the very first user also becomes admin). |
| `AZURE_AD_TENANT_ID` / `AZURE_AD_CLIENT_ID` / `AZURE_AD_CLIENT_SECRET` / `AZURE_AD_REDIRECT_URI` | Azure AD / Entra ID OIDC. Set **all four** to enable real Microsoft sign-in + Graph directory; otherwise the dev mock login is used. |

## Outbound / SSRF

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `ALLOW_PRIVATE_NETWORK` | `false` | Allow REST/agent/LLM calls to private/reserved IPs (e.g. internal APIs in a trusted network). |
| `OUTBOUND_ALLOWLIST` | — | Comma-separated hostnames always allowed to bypass the private-IP check. |

## AI providers

The platform LLM is auto-detected from whichever keys are present (priority: Anthropic → Azure OpenAI →
OpenAI), or forced with `AI_PROVIDER` (`anthropic` | `openai` | `azure-openai` | `auto`). Apps can
override this per-app with their own key or an external agent API. With no provider, chat and generation
fall back to a labelled mock / built-in template.

| Variable | Purpose |
| -------- | ------- |
| `AI_PROVIDER` | Force a provider, or `auto`. |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` / `ANTHROPIC_BASE_URL` | Anthropic (Claude). Default model `claude-sonnet-4-6`. |
| `OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_BASE_URL` | OpenAI. Default model `gpt-4o`. |
| `AZURE_OPENAI_API_KEY` / `AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_DEPLOYMENT` / `AZURE_OPENAI_API_VERSION` | Azure OpenAI. |

## Guardrails (limits)

Sensible defaults ship out of the box; override any of these to fit your deployment.

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `MAX_DEPLOYED_APPS_PER_USER` | `20` | Max apps a single owner can have **deployed** at once (viewing is unlimited). |
| `MAX_CHAT_INPUT_WORDS` | `5000` | Max words in a single chat message (enforced client + server). |
| `CHAT_HISTORY_CHAR_BUDGET` | `16000` | Char budget for the transcript sent to the model (keeps the most recent turns). |
| `MAX_PAGES_PER_APP` | `20` | Max pages per app. |
| `MAX_DATASOURCES_PER_APP` | `25` | Max data sources per app. |
| `MAX_QUERIES_PER_APP` | `25` | Max queries per app. |
| `AI_GENERATE_RATE_PER_MIN` | `20` | Per-user UI-generation rate limit (HTTP 429 when exceeded). |
| `CHAT_RATE_PER_MIN` | `30` | Per-user chat rate limit (429 when exceeded). |
| `MAX_CONVERSATIONS_PER_USER_APP` | `50` | Retained chat threads per user + app (oldest trimmed). |
| `MAX_MESSAGES_PER_CONVERSATION` | `200` | Retained messages per thread (oldest trimmed). |

> Rate limiting is in-memory per process (correct for a single instance). For multiple replicas, back it
> with a shared store (e.g. Redis) — noted in the code.
