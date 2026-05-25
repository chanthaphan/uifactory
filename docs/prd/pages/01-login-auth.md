# Login

> **Route:** shown whenever no authenticated user session exists
> **Module:** Authentication
> **Generated:** 2026-05-25

## Overview

This page is the single entry point into UIFactory for signed-out users. Its job is to present the platform brand and route users into the active authentication mode, either Microsoft single sign-on or a local demo-user picker for development environments.

Users arrive here automatically when the platform cannot load a valid session. They leave this page only after a successful sign-in, at which point the shell refreshes the current user and routes into the main product.

## Layout

1. Centered sign-in card.
2. Platform logo, name, and a short value statement.
3. Authentication action area.

## Fields

### Branding Region
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Platform logo | Brand image or fallback mark | No | `UIFactory` branding | Loaded from `/api/auth/config` |
| Platform name | Heading text | No | `UIFactory` | Loaded from `/api/auth/config` |
| Product description | Static text | Yes | "Build, deploy and share internal apps powered by your data and AI." | Explains the product in one sentence |

### Azure Sign-In Mode
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Sign in with Microsoft | Primary button | Yes | Visible only in Azure mode | Opens `/api/auth/login` |

### Dev Sign-In Mode
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Demo user buttons | Button list | Yes | Loaded from `/api/auth/dev-users` | Each button shows name, email, and role |
| Busy indicator | Inline spinner | No | Hidden | Shown only on the selected demo user while login is in progress |

## Interactions

### Page Load
- **Trigger:** The app has no authenticated user.
- **Behavior:** The shell first loads platform configuration and current-user details.
- **System response:** If no user is returned, the login page is rendered.

### Azure Sign-In
- **Trigger:** User clicks `Sign in with Microsoft`.
- **Behavior:** Browser navigates to `/api/auth/login`.
- **Success:** User completes the external login flow and returns with a valid session cookie.
- **Failure:** User remains signed out and the shell continues to show the login page.

### Dev Sign-In
- **Trigger:** User clicks a demo-user button.
- **Behavior:** The selected button shows a spinner and the page calls `POST /api/auth/dev-login` with the chosen email.
- **Success:** The shell refreshes the current session and enters the main app.
- **Failure:** Busy state clears and the user can try again.

### Session Expiry
- **Trigger:** Any non-authenticated API request returns `401` after the user had already entered the product.
- **Behavior:** The shell clears the current user and returns to the login page.

## API Dependencies

| API | Method | Path | Trigger | Notes |
|---|---|---|---|---|
| Get auth config | GET | `/api/auth/config` | Initial shell bootstrap | Determines platform branding and login mode |
| Get current session | GET | `/api/auth/me` | Initial shell bootstrap | Determines whether the login page is needed |
| List demo users | GET | `/api/auth/dev-users` | Dev-mode page load | Returns available local test users |
| Dev login | POST | `/api/auth/dev-login` | Click demo user | Accepts email only |
| Azure login redirect | GET | `/api/auth/login` | Click Microsoft button | Starts the external sign-in flow |

## Page Relationships

- **From:** Any signed-out state or expired session.
- **To:** `02-app-catalog.md` by default after a successful session refresh.
- **Data coupling:** Uses the same platform settings as the shell and admin settings page for branding.

## Business Rules

| Rule | Effect |
|---|---|
| Azure mode takes priority | If Azure AD is configured, the demo-user picker is not shown |
| Dev login is environment-specific | Demo-user sign-in is for local or fallback environments only |
| Branding is server-driven | Platform name, logo, favicon, and browser title all come from server configuration |
