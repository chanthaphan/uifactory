# Platform and Access API

> **Route Group:** `/api/users`, `/api/settings`, `/api/org`, `/api/health`
> **Module:** Administration / Access
> **Generated:** 2026-05-25

## Overview

This resource group covers platform administration and organizational access helpers. It includes health reporting, global settings, admin user management, and organization-directory search used by sharing flows.

## Endpoint Inventory

| Endpoint | Access | Business Purpose |
|---|---|---|
| `GET /api/health` | Public | Simple service health check |
| `GET /api/settings` | Public | Read current platform defaults and branding |
| `PUT /api/settings` | Admin | Update platform branding and default settings |
| `GET /api/org/users` | Authenticated | Search organization members by name or email |
| `GET /api/org/status` | Authenticated | Report whether live Microsoft Graph directory lookup is available |
| `GET /api/users` | Admin | List all platform users |
| `PATCH /api/users/:id` | Admin | Change a user's role and/or active state |

## Key Business Behaviors

### Platform Settings
- Controls login-page branding, navigation branding, default share visibility, and preferred default AI provider.
- Only allowlisted keys are persisted.

### Organization Directory Search
- Supports the app-sharing UI.
- Can return live Azure Graph users when configured.
- Falls back to local platform users and mock colleagues when live directory integration is unavailable.

### User Administration
- Lets admins change role and active state.
- Prevents dangerous self-service changes such as self-demotion or leaving the platform without an active admin.

## Request and Response Shapes

### `PUT /api/settings`
| Field | Type | Required | Meaning |
|---|---|---|---|
| `platformName` | string | No | Platform brand name |
| `platformLogo` | string | No | Image URL or short text mark |
| `platformBrandColor` | string | No | Default brand color |
| `defaultAiProvider` | string | No | Default provider preference for new app AI configuration |
| `defaultVisibility` | `private` / `org` / `public` | No | Default share visibility |

### `PATCH /api/users/:id`
| Field | Type | Required | Meaning |
|---|---|---|---|
| `role` | `admin` / `member` / `viewer` | No | New platform role |
| `active` | boolean | No | Whether the user can sign in |

## Page Relationships

- **Used by:** `06-admin-console.md` for users and settings.
- **Used by:** `04-app-editor.md` sharing settings through organization search.
- **Used by:** platform monitoring and deployment checks through health.

## Business Rules

| Rule | Effect |
|---|---|
| Role denial returns `403`, not `401` | The frontend only treats `401` as session expiry |
| Public settings read supports signed-out branding | Login page can render without a session |
