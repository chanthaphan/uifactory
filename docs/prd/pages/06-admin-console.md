# Admin Console

> **Route:** `/admin`
> **Module:** Administration
> **Generated:** 2026-05-25

## Overview

This page is the control center for platform administrators. It consolidates user management, reusable app templates, reusable connector definitions, and platform branding defaults in one tabbed interface.

Only admins can access this page. It is primarily operational rather than end-user facing.

## Layout

1. Page title.
2. Four tabs: `Users`, `Templates`, `Connectors`, `Settings`.
3. One table or form-driven workspace per tab.

## Fields

### Users Tab
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Name | Table column | Yes | None | User display name |
| Email | Table column | Yes | None | Unique account identity |
| Role | Dropdown per row | Yes | Current role | `admin`, `member (builder)`, `viewer` |
| Active | Switch per row | Yes | Current state | Toggles whether the user can access the system |

### Templates Tab
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Create template from app | Dropdown | No | Blank | Lists editable apps |
| Create | Button | Yes | Disabled until an app is selected | Creates a reusable starter from an existing app |
| Template name | Table column | Yes | None | Display name |
| Category | Table column | No | Blank | Optional classifier |
| Pages | Table column | Yes | None | Number of pages in the template |
| Delete | Icon button | No | Per row | Requires confirmation |

### Connectors Tab
| Field | Type | Required | Default | Validation | Notes |
|---|---|---|---|---|---|
| Name | Text input | Yes | Blank | Non-empty | Connector library display name |
| Category (optional) | Text input | No | Blank | None | Grouping label |
| Description (optional) | Text input | No | Blank | None | User-facing explanation |
| Type | Dropdown | Yes | `REST` | None | `REST`, `POSTGRES`, `SQLITE`, `MSGRAPH` |
| Base URL | Text input | Yes for REST | Blank | Required for REST | Example placeholder: `https://api.example.com` |
| Default headers (JSON, optional) | Multiline text | No | Blank | Parsed as JSON when provided | Invalid JSON is ignored when building config |
| Connection string | Text input | Yes for POSTGRES | Blank | Required for PostgreSQL | Secret field |
| SQLite file path | Text input | Yes for SQLITE | Blank | Required for SQLite | File location |
| Microsoft 365 info | Info alert | Shown for MSGRAPH | None | No config required | Uses platform Azure AD app |
| Create connector | Button | Yes | Disabled until required fields are valid | Saves a reusable connector |

### Settings Tab
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Platform name | Text input | Yes | Existing value | Main brand name |
| Platform logo | Text input | No | Existing value | Image URL or short character mark |
| Brand color | Text input + color picker | No | Existing value or `#3a64f0` | Used when no logo image exists |
| Default visibility for new shares | Dropdown | Yes | Existing value | `private`, `org`, `public` |
| Default AI provider | Dropdown | Yes | Existing value | `auto`, `anthropic`, `openai`, `azure-openai` |
| Save settings | Button | Yes | Always shown | Persists new defaults |

## Interactions

### Manage Users
- **Trigger:** Admin changes a row's role or active switch.
- **Behavior:** The update is sent immediately.
- **Failure:** The page shows the returned error message.
- **Special rules:** Admins cannot demote or deactivate themselves in a way that leaves the platform without an active admin.

### Create Template from Existing App
- **Trigger:** Admin selects an app and clicks `Create`.
- **Behavior:** The selected app is converted into a reusable template.
- **Success:** A toast confirms creation and the template list refreshes.

### Delete Template
- **Trigger:** Admin clicks the delete icon on a template row.
- **Behavior:** Browser confirmation appears first.
- **Success:** The template is removed.

### Create Prebuilt Connector
- **Trigger:** Admin completes the form and clicks `Create connector`.
- **Behavior:** Type-specific configuration is validated and saved.
- **Success:** The form resets and the connector appears in the shared library.

### Update Platform Settings
- **Trigger:** Admin clicks `Save settings`.
- **Behavior:** New settings are stored and the shell refreshes branding immediately.
- **User-facing effect:** Navigation branding and the login screen update without requiring a manual reload.

## API Dependencies

| API | Method | Path | Trigger | Notes |
|---|---|---|---|---|
| List users | GET | `/api/users` | Users tab load | Admin only |
| Update user | PATCH | `/api/users/:id` | Change role or active | Admin only |
| List templates | GET | `/api/templates` | Templates tab load | Shared list |
| Create template from app | POST | `/api/templates/from-app/:appId` | Create template | Admin only |
| Delete template | DELETE | `/api/templates/:id` | Delete template | Admin only |
| List connectors | GET | `/api/connectors` | Connectors tab load | Shared library |
| Create connector | POST | `/api/connectors` | Create connector | Admin only |
| Delete connector | DELETE | `/api/connectors/:id` | Delete connector | Admin only |
| Get settings | GET | `/api/settings` | Settings tab load | Public read |
| Update settings | PUT | `/api/settings` | Save settings | Admin only |

## Page Relationships

- **From:** Main nav `Admin` tab, visible only to admins.
- **To:** No direct page navigation, but created templates and connectors are consumed in builder workflows.
- **Data coupling:** Settings affect login and shell branding; templates affect new app creation; connectors affect app connector library choices.

## Business Rules

| Rule | Effect |
|---|---|
| Admin-only workspace | Non-admin users cannot access this page |
| Shared assets are reusable, not live-linked | Apps that already cloned a connector are unaffected if the library item is later deleted |
| Settings are allowlisted | Only known platform keys are persisted |
