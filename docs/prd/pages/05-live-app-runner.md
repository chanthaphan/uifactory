# Live App Runner

> **Route:** `/run/:slug`
> **Module:** Catalog & Runtime
> **Generated:** 2026-05-25

## Overview

This page is the end-user runtime for deployed apps. It loads a published app by slug, displays its branded header and page tabs, and renders either a visual UI page or a conversational chat page depending on the selected tab.

This is the most customer-facing surface in the product. It is where deployed apps become usable tools rather than configuration objects.

## Layout

1. Branded top bar with back button, app identity, page tabs, and optional account-connection action.
2. Modal dialog for personal credential management when needed.
3. Main content region that switches between UI page runtime and chat runtime.

## Fields

### Header Region
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Back to catalog | Icon button | Yes | Always shown | Returns to `/` |
| App badge | Brand mark | Yes | Derived from app theme | Uses theme logo or initials |
| App name | Text | Yes | App name | Can be overridden by theme brand name |
| Page tabs | Tab strip | Yes | First page selected | One tab per published page |
| Connect accounts | Button | No | Visible only when personal credentials are required | Opens credential dialog |

### UI Page Runtime
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Sandboxed page content | Embedded runtime | Yes | Current page HTML | Receives bound data and host actions |
| Loading indicator | Spinner | No | Hidden | Shown while loading page data |
| Empty content message | Text | No | Hidden | Shown if the page has no HTML |

### Chat Page Runtime
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Conversation switcher | Dropdown | No | Most recent thread | Available for signed-in users when history is persisted |
| New chat | Icon button | No | Visible with persisted history | Starts a fresh thread |
| Delete conversation | Icon button | No | Visible only for existing persisted thread | Requires confirmation |
| Message list | Chat transcript | Yes | Greeting or prior thread | Assistant replies render markdown |
| Message composer | Text input | Yes | Blank | Placeholder: `Type a message…` |
| Send | Icon button | Yes | Disabled when blank, busy, or over limit | Submits the message |

### Personal Credentials Dialog
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Connector status | Chip | Yes | Connected or Not connected | One row per per-user connector |
| Header | Text input | No | `Authorization` | For REST-style personal headers |
| API token / key | Password input | No | Blank | Connects personal API credentials |
| Your connection string | Password input | No | Blank | Used for personal PostgreSQL credentials |
| Connect / Update | Button | Yes | Enabled once a credential is present | Saves the personal secret |
| Disconnect | Button | No | Visible once connected | Removes the saved personal secret |

## Interactions

### Load App by Slug
- **Trigger:** User opens `/run/:slug`.
- **Behavior:** The page loads the published app definition and then checks whether any personal credentials are required.
- **Failure:** An error message is shown with a back button to the catalog.

### Switch Between Pages
- **Trigger:** User changes tabs.
- **Behavior:** The selected page is rendered immediately from the published definition.

### Run a UI Page
- **Trigger:** User lands on a UI page.
- **Behavior:** If the page has a bound query, the page requests its live data first. If not, it falls back to the page's saved sample data.
- **Runtime abilities:** The page can run named actions, execute queries, refresh itself, and navigate to other pages within the same app.

### Use a Chat Page
- **Trigger:** User opens a chat tab and sends a message.
- **Behavior:** The user message appears immediately and the assistant reply streams into the UI.
- **Success:** The final reply stays in the transcript; when history is enabled the thread list refreshes.
- **Validation:** Messages above 5,000 words are blocked.

### Manage Conversation History
- **Trigger:** Signed-in user switches threads, starts a new thread, or deletes a thread.
- **Behavior:** The page loads, resets, or removes conversation history tied to the current app and page.

### Connect Personal Accounts
- **Trigger:** User clicks `Connect accounts`.
- **Behavior:** A dialog opens so the user can supply their own connector credentials.
- **Success:** Runtime pages can immediately use those credentials after refresh.

## API Dependencies

| API | Method | Path | Trigger | Notes |
|---|---|---|---|---|
| Get app by slug | GET | `/api/apps/by-slug/:slug` | Page load | Returns the published app for runtime use |
| List app credentials | GET | `/api/apps/:id/credentials` | Page load, open credentials dialog | Determines whether `Connect accounts` should appear |
| Get page data | GET | `/api/apps/:id/pages/:pageId/data` | UI-page load, refresh | Loads bound-query results |
| Run page query/action | POST | `/api/apps/:id/run-query` | Runtime actions | Supports action and query execution |
| List conversations | GET | `/api/apps/:id/conversations` | Chat initialization | Optional `pageId` filter |
| Get conversation | GET | `/api/apps/:id/conversations/:conversationId` | Thread switch | Loads one chat history |
| Delete conversation | DELETE | `/api/apps/:id/conversations/:conversationId` | Delete thread | Removes one saved thread |
| Stream chat reply | POST | `/api/apps/:id/chat/stream` | Send message | Streams assistant output and returns conversation id |
| Save personal credential | PUT | `/api/apps/:id/credentials/:dataSourceId` | Connect or update | Stores encrypted personal secret |
| Delete personal credential | DELETE | `/api/apps/:id/credentials/:dataSourceId` | Disconnect | Removes saved secret |

## Page Relationships

- **From:** `02-app-catalog.md`, `03-build-apps.md`, and `04-app-editor.md` open-live action.
- **To:** Back navigation returns to the catalog.
- **Data coupling:** Uses the app's published definition, theme, page configuration, chat rules, and credential requirements.

## Business Rules

| Rule | Effect |
|---|---|
| Runtime uses published state | End users never see unsaved draft changes |
| Personal credentials are optional and connector-specific | The button appears only when the app includes per-user connectors |
| Chat history is user-scoped | Persisted threads belong to the signed-in user only |
| Markdown is safe by default | Assistant replies allow markdown formatting but not raw HTML |
