# Auth and Session API

> **Route Group:** `/api/auth/*`
> **Module:** Authentication
> **Generated:** 2026-05-25

## Overview

This resource group handles session establishment, branding bootstrap, logout, demo-user authentication, and Azure AD single sign-on. It is the platform's entry point for identity and session lifecycle.

## Endpoint Inventory

| Endpoint | Access | Business Purpose |
|---|---|---|
| `GET /api/auth/config` | Public | Returns active auth mode and platform branding |
| `GET /api/auth/me` | Public | Returns the current signed-in user if a valid session exists |
| `POST /api/auth/logout` | Public | Clears the current session |
| `GET /api/auth/dev-users` | Public | Lists available demo users in development mode |
| `POST /api/auth/dev-login` | Public | Creates a session for a selected demo user |
| `GET /api/auth/login` | Public | Starts Microsoft login |
| `GET /api/auth/callback` | Public | Completes Microsoft login and creates the session |

## Interactions

### Session Bootstrap
- **Trigger:** Frontend shell loads.
- **Flow:** The frontend requests auth config and current-user information in parallel.
- **Outcome:** The shell either shows the signed-in product or the login page.

### Development Authentication
- **Trigger:** User selects a demo account.
- **Behavior:** The backend creates a normal session cookie for that account.
- **Special rule:** This flow is unavailable when Azure mode is active.

### Azure Authentication
- **Trigger:** User clicks Microsoft sign-in.
- **Behavior:** The backend generates an OIDC state cookie, redirects to Microsoft, validates the callback, and then issues the platform session cookie.

### Logout
- **Trigger:** User selects `Sign out`.
- **Behavior:** Session cookie is cleared and the shell returns to a signed-out state.

## Request and Response Shapes

### `GET /api/auth/config`
| Field | Type | Meaning |
|---|---|---|
| `mode` | `azure` or `dev` | Active login mode |
| `platformName` | string | Brand name |
| `platformLogo` | string | Image URL or text mark |
| `platformBrandColor` | string | Brand color used in fallback branding |

### `GET /api/auth/me`
| Field | Type | Meaning |
|---|---|---|
| `user.id` | string | User id |
| `user.email` | string | Email address |
| `user.name` | string | Display name |
| `user.role` | `admin` / `member` / `viewer` | Platform role |
| `user.active` | boolean | Whether the account is enabled |
| `user.avatarUrl` | string or null | Optional avatar |

### `POST /api/auth/dev-login`
| Input Field | Type | Required | Meaning |
|---|---|---|---|
| `email` | string | Yes | Demo user to sign in as |

## Business Rules

| Rule | Effect |
|---|---|
| Session cookie name is fixed | Runtime and auth guard both depend on `uifactory_session` |
| Public auth endpoints do not imply anonymous access elsewhere | Other APIs still require a valid session unless explicitly public |
| Branding is auth-config driven | The frontend relies on this endpoint to render the correct login and shell identity |
