# Enum Dictionary

## Roles and Access

| Enum | Values | Meaning |
|---|---|---|
| Platform role | `admin`, `member`, `viewer` | `admin` manages platform and can build; `member` can build; `viewer` can only use apps |
| App membership role | `owner`, `editor`, `viewer` | App-level collaborator roles used in sharing |

## App Visibility and Status

| Enum | Values | Meaning |
|---|---|---|
| Visibility | `private`, `org`, `public` | Shared with invited people only, whole organization, or everyone |
| App status | `draft`, `deployed` | Not live yet or live for runtime users |

## Page and Editor Types

| Enum | Values | Meaning |
|---|---|---|
| Page type | `ui`, `chat` | Visual page or conversational page |
| Editor mode | `ai`, `canvas`, `code` | AI generation, drag-and-drop, or raw source editing |
| App AI mode | `platform`, `provider`, `agent-api` | Use platform LLM, app-specific provider key, or external agent flow |

## AI Providers

| Enum | Values | Meaning |
|---|---|---|
| AI provider | `anthropic`, `openai`, `azure-openai` | Supported model providers |
| Provider label | `Claude`, `OpenAI`, `Azure OpenAI` | Display labels used in the UI |
| Auth mode | `azure`, `dev` | Microsoft SSO mode or development demo-user mode |

## Connector and Query Types

| Enum | Values | Meaning |
|---|---|---|
| Connector type | `REST`, `POSTGRES`, `SQLITE`, `MSGRAPH`, `AGENT` | REST API, PostgreSQL, SQLite, Microsoft Graph, or external agent |
| Connector auth mode | `shared`, `per-user` | Shared secret for the app or a secret per end user |
| REST methods | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | Supported HTTP verbs for saved REST and Graph queries |

## Chat and Conversation Types

| Enum | Values | Meaning |
|---|---|---|
| Chat message role | `user`, `assistant`, `system` | End-user message, assistant reply, or system instruction |

## Canvas Builder Types

| Enum | Values | Meaning |
|---|---|---|
| Component type | `heading`, `text`, `metric`, `table`, `chart`, `button`, `textInput`, `fileUpload`, `image`, `divider`, `container` | Supported drag-and-drop UI blocks |
| Chart type | `bar`, `line`, `pie` | Supported chart presentations |
| Metric source | `count`, `sum`, `avg`, `field`, `static` | How a metric component derives its value |

## UI Color and Label Mappings

| Mapping | Values | Meaning |
|---|---|---|
| Visibility chip color | `public -> success`, `org -> info`, `private -> default` | Visual emphasis in the catalog |
| Connector type label | `REST API`, `PostgreSQL`, `SQLite`, `Microsoft 365`, `Agent API` | User-facing connector names |

## Operational Constants

| Constant | Value | Meaning |
|---|---|---|
| Session cookie | `uifactory_session` | Main session cookie name |
| OIDC state cookie | `uifactory_oidc_state` | Temporary Microsoft-login state cookie |
| AI-config mask | `********` | Placeholder shown instead of stored secrets |
| Max chat words | `5000` | Frontend message-length ceiling |

## Sensitive Fields

The backend explicitly treats the following config keys as secrets for redaction purposes:

| Key |
|---|
| `connectionString` |
| `password` |
| `authorization` |
| `apiKey` |
| `token` |
