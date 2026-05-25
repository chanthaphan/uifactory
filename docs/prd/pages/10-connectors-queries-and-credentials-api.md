# Connectors, Queries, and Credentials API

> **Route Group:** `/api/apps/:appId/datasources*`, `/api/apps/:appId/queries*`, `/api/apps/:appId/credentials*`
> **Module:** Builder Workspace
> **Generated:** 2026-05-25

## Overview

This resource group powers the data layer of UIFactory. It lets builders define app-scoped connectors, attach saved queries to those connectors, test them, and optionally require each end user to provide personal credentials.

## Endpoint Inventory

| Endpoint | Access | Business Purpose |
|---|---|---|
| `GET /api/apps/:appId/datasources` | Authenticated | List app connectors |
| `POST /api/apps/:appId/datasources/test` | Authenticated | Test a new unsaved connector definition |
| `POST /api/apps/:appId/datasources` | Authenticated | Create an app connector |
| `POST /api/apps/:appId/datasources/from-connector/:connectorId` | Authenticated | Clone a prebuilt connector into the app |
| `GET /api/apps/:appId/datasources/:id` | Authenticated | Get one app connector |
| `PUT /api/apps/:appId/datasources/:id` | Authenticated | Update an app connector |
| `DELETE /api/apps/:appId/datasources/:id` | Authenticated | Delete an app connector |
| `POST /api/apps/:appId/datasources/:id/test` | Authenticated | Test an existing connector |
| `GET /api/apps/:appId/queries` | Authenticated | List app queries |
| `POST /api/apps/:appId/queries/run` | Authenticated | Run an unsaved or ad hoc query definition |
| `POST /api/apps/:appId/queries` | Authenticated | Create a saved query |
| `GET /api/apps/:appId/queries/:id` | Authenticated | Get one saved query |
| `PUT /api/apps/:appId/queries/:id` | Authenticated | Update a saved query |
| `DELETE /api/apps/:appId/queries/:id` | Authenticated | Delete a saved query |
| `POST /api/apps/:appId/queries/:id/run` | Authenticated | Run a saved query |
| `GET /api/apps/:appId/credentials` | Authenticated | List per-user credential requirements for the current user |
| `PUT /api/apps/:appId/credentials/:dataSourceId` | Authenticated | Save current user's credential for one per-user connector |
| `DELETE /api/apps/:appId/credentials/:dataSourceId` | Authenticated | Remove current user's credential |

## Connector Model

| Field | Type | Meaning |
|---|---|---|
| `name` | string | Friendly connector name |
| `type` | `REST` / `POSTGRES` / `SQLITE` / `MSGRAPH` / `AGENT` | Connector technology |
| `config` | object | Type-specific configuration |
| `authMode` | `shared` / `per-user` | Whether the connector uses one shared secret or each user's own credential |

### Type-Specific Connector Fields
| Type | Key Fields |
|---|---|
| `REST` | `baseUrl`, optional `headers`, optional `forwardIdentity`, optional `identityHeader` |
| `POSTGRES` | `connectionString` |
| `SQLITE` | `file` |
| `MSGRAPH` | No manual config; uses platform Azure setup |
| `AGENT` | `url`, optional `apiKey`, optional `authHeader` |

## Query Model

| Query Kind | Fields |
|---|---|
| SQL query | `sql` |
| REST or Graph query | `method`, `path`, optional `body`, optional `schema` |

## Credential Model

| Connector Type | Personal Credential Shape |
|---|---|
| `POSTGRES` | `connectionString` |
| `REST` and `MSGRAPH` fallback | `headers` with a configurable header name and token value |

## Interactions

### Create or Edit Connector
- **Behavior:** Builders choose a type, fill the required config, optionally test it, then save it.
- **Special rules:** Connector type cannot be changed after creation; masked secrets preserve existing stored values.

### Clone from Shared Connector Library
- **Behavior:** Builder selects a prebuilt connector and clones it into the current app.
- **Outcome:** The app gets its own editable copy.

### Create or Edit Query
- **Behavior:** Builder selects a non-agent connector and defines either SQL or HTTP request details based on connector type.
- **Special rule:** Queries must belong to a connector in the same app.

### Personal Credentials
- **Behavior:** End users can save or remove their own secrets for per-user connectors.
- **Security rule:** Personal credentials are encrypted and only applied to that user's runtime requests.

## Page Relationships

- **Used by:** `04-app-editor.md` connector drawer and settings.
- **Used by:** `05-live-app-runner.md` personal credential dialog and UI runtime.
- **Used by:** Admin connector library cloning in `06-admin-console.md`.

## Business Rules

| Rule | Effect |
|---|---|
| Per-user mode is limited | Only connector types that support personal credentials can use `per-user` mode |
| Agent connectors are conversational | They are not selectable as standard query data sources |
| Secret redaction is mandatory | Stored secrets never come back to the UI in plain text |
