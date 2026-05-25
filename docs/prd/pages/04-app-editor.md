# App Editor

> **Route:** `/build/:id`
> **Module:** Builder Workspace
> **Generated:** 2026-05-25

## Overview

This is the core authoring workspace of UIFactory. Builders use it to name an app, create UI and chat pages, bind queries, generate HTML with AI, manage connector scope, configure AI behavior, control sharing, publish versions, and deploy or undeploy the live app.

In practice, this page is a full product inside the product. It combines page composition, data integration, governance controls, and release management in one builder surface.

## Layout

1. Top toolbar for app identity, save state, deployment, and secondary drawers.
2. Left sidebar listing pages in the app.
3. Main editor area for the selected page.
4. Right-side drawers for `Connectors`, `Settings`, and `Version history`.

## Fields

### Top Toolbar
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Back | Icon button | Yes | Always shown | Returns to `/build` |
| App name | Inline text field | Yes | Current app name | Editable in place |
| Status chip | Status chip | Yes | None | `draft` or `deployed` |
| Version chip | Status chip | Yes | None | Shows current version number |
| Unsaved chip | Status chip | No | Hidden | Appears when local changes are not saved |
| Undo / Redo | Icon buttons | No | Enabled only when history exists | Applies to local editor state |
| Connectors | Button | Yes | Always shown | Opens connector and query drawer |
| Versions | Button | Yes | Always shown | Opens version history drawer |
| Settings | Button | Yes | Always shown | Opens app settings drawer |
| Save | Button | Yes | Always shown | Saves draft changes |
| Publish changes | Button | No | Visible when unpublished changes exist | Creates a new live version |
| Deploy / Undeploy | Button | Yes | Always shown | Toggles live availability |
| Open running app | Icon button | No | Visible when deployed | Opens `/run/:slug` |

### Page Sidebar
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Add UI page | Icon button | Yes | Always shown | Creates a standard UI page |
| Add chat page | Icon button | Yes | Always shown | Creates a conversational page |
| Page list | Selectable list | Yes | Existing pages | Each row shows page name and type |
| Delete page | Icon button | No | Available per row | Removes the page from the app |

### Shared Page Metadata
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Page name | Text input | Yes | Existing value | Available for all page types |

### UI Page: Data and Actions Panel
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Connectors available on this page | Multi-select | No | All app connectors when empty | Hard boundary for allowed queries and actions |
| Bound query | Dropdown | No | Blank | Result becomes `window.APP_DATA` in the page runtime |
| Run query | Button | No | Disabled until a query is selected | Pulls sample data for preview |
| Existing actions | Action list | No | Empty | Each action maps a friendly action name to a saved query |
| Action name | Text input | No | Blank | Used by runtime HTML when calling `runAction` |
| Query | Dropdown | No | Blank | Query behind the action |
| Add action | Icon button | No | Disabled until both fields are set | Adds another named action |

### UI Page: Authoring Modes
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Drag & drop | Toggle | Yes | One of four modes | Opens visual canvas builder |
| AI generate | Toggle | Yes | One of four modes | Opens prompt-based generation workflow |
| Source code | Toggle | Yes | One of four modes | Opens direct HTML editor |
| Preview | Toggle | Yes | One of four modes | Renders current HTML in sandbox |

### UI Page: AI Generation
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Describe the UI | Multiline text | Yes | Existing prompt | Primary AI generation brief |
| Generate | Button | Yes | Disabled while running | Requests fresh HTML |
| Refine | Text input | No | Blank | Adds incremental changes to the current HTML |
| Refine button | Button | No | Disabled until text exists | Revises rather than replacing intent |

### UI Page: Source Editor
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Page HTML (edit directly) | Large text area | No | Existing HTML | Free-form source editor |

### Chat Page Configuration
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| System prompt | Multiline text | No | Blank | High-level assistant instructions |
| Greeting | Text input | No | Blank | Preloaded assistant opening message |
| Connectors available on this page | Multi-select | No | All app non-agent connectors when empty | Limits grounding options |
| Ground answers on query (optional) | Dropdown | No | Blank | Fetches structured context before answering |
| Preview grounding data | Icon button | No | Disabled until query selected | Runs the selected grounding query |
| Agent API (optional) | Dropdown | No | Blank | Selects an app connector of type `AGENT` as the responder |
| Change AI settings | Button | No | Always shown near AI warning text | Opens app settings drawer |

### App Settings Drawer
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Description | Multiline text | No | Existing description | Used across app cards and metadata |
| Visibility | Radio group | Yes | Existing value | `private`, `org`, or `public` |
| Share with specific people | Search + list | No | Existing memberships | Adds members by email with `editor` or `viewer` role |
| Brand name | Text input | No | App name | Runner header branding |
| Brand color | Text input + color picker | No | `#0b1f3a` fallback | Used in runner branding |
| Logo | Text input | No | Blank | Short text mark, letter, or emoji |
| AI connection | Dropdown | Yes | `platform` | `platform` or app-owned provider key |
| Provider | Dropdown | No | `openai` when in provider mode | `anthropic`, `openai`, `azure-openai` |
| API key | Password input | No | Masked or blank | Leaving blank preserves existing secret |
| Model / deployment | Text input | No | Blank | Provider-specific model identifier |
| Azure endpoint | Text input | No | Blank | Only shown for Azure OpenAI |
| Build guidelines | Multiline text | No | Blank | Additional generation guidance for this app |
| Allow non-editors to run write actions | Toggle | No | Existing value | Controls whether viewers can trigger mutations |

### Version History Drawer
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Note for next publish | Text input | No | Blank | Release note stored with the new version |
| Publish current draft | Button | Yes | Always shown | Captures a new live version |
| Version list | Historical list | Yes | Loaded from backend | Shows version number, page count, date, note, and live marker |
| Restore version | Icon button | No | Disabled for current live version | Replaces the draft with a selected version snapshot |

## Interactions

### Load App
- **Trigger:** Builder opens `/build/:id`.
- **Behavior:** The page loads app details, then secondary data such as connectors, queries, and versions on demand.
- **Special rule:** Builders work on the draft definition, not the published snapshot.

### Add or Delete Pages
- **Trigger:** User clicks add UI page, add chat page, or delete page.
- **Behavior:** The page list updates immediately in the draft state.
- **Special rule:** Deleting a page removes its local configuration from the app definition.

### Bind Page Data
- **Trigger:** User selects connector scope, a bound query, or named actions.
- **Behavior:** The page warns if a selected query is outside the allowed connector scope.
- **Runtime result:** Bound query data becomes the default data object for the page; named actions become callable events from runtime HTML.

### Generate UI with AI
- **Trigger:** User enters a prompt and clicks `Generate`, or enters a refinement and clicks `Refine`.
- **Behavior:** The request includes the prompt, sample data, optional current HTML, and app build guidelines.
- **Success:** The generated HTML replaces or updates the page content.
- **Fallback:** If no live model is available, the backend can return a fallback template.

### Preview a UI Page
- **Trigger:** User switches to `Preview`.
- **Behavior:** The page runs inside a sandboxed iframe.
- **Special rules:** Runtime HTML can call host functions such as running actions, refreshing data, navigating between pages, downloading files, copying values, and showing confirmation dialogs.

### Configure a Chat Page
- **Trigger:** User edits the chat configuration fields.
- **Behavior:** Chat can use a system prompt, an opening greeting, an optional grounding query, and an optional external agent connector.
- **Special rule:** Agent connectors are selected separately from the page connector-scope list.

### Save Draft
- **Trigger:** User clicks `Save`.
- **Behavior:** Draft app metadata and definition are persisted.
- **Success:** Unsaved indicator clears.

### Publish Changes
- **Trigger:** User clicks `Publish changes` or publishes from the version drawer.
- **Behavior:** The current draft becomes the new published snapshot and receives a new version number.
- **Success:** Runtime users immediately see the new live definition.

### Deploy or Undeploy
- **Trigger:** User clicks `Deploy` or `Undeploy`.
- **Behavior:** Deployment controls whether the app is visible in the catalog and usable via `/run/:slug`.

## API Dependencies

| API | Method | Path | Trigger | Notes |
|---|---|---|---|---|
| Get app | GET | `/api/apps/:id` | Editor load | Core draft data |
| Update app | PUT | `/api/apps/:id` | Save draft | Saves name, description, definition, AI config |
| Update sharing | PUT | `/api/apps/:id/sharing` | Save settings | Stores visibility and member roles |
| Generate UI | POST | `/api/apps/:id/generate-ui` | Generate / refine | App-scoped AI generation |
| List data sources | GET | `/api/apps/:id/datasources` | Open connector drawer, page config | Connector inventory |
| List queries | GET | `/api/apps/:id/queries` | Open connector drawer, page config | Query inventory |
| Run saved query | POST | `/api/apps/:id/queries/:queryId/run` | Preview bound query or action | Editor-side testing |
| Run inline query | POST | `/api/apps/:id/run-query` | Preview page action or grounding query | Supports page-scoped execution |
| List versions | GET | `/api/apps/:id/versions` | Open versions drawer | Version history |
| Deploy app | POST | `/api/apps/:id/deploy` | Publish / deploy | Creates a live snapshot |
| Undeploy app | POST | `/api/apps/:id/undeploy` | Undeploy | Removes live availability |
| Roll back app | POST | `/api/apps/:id/rollback` | Restore version | Replaces the draft with a prior version |

## Page Relationships

- **From:** `03-build-apps.md` after selecting an app.
- **To:** `05-live-app-runner.md` via the open-live action.
- **Data coupling:** Uses shared connector, template, sharing, credential, AI, and conversation infrastructure documented in backend resource-group files.

## Business Rules

| Rule | Effect |
|---|---|
| Builders only | Viewers cannot open or use this page |
| Draft and live are separate | Unsaved or unpublished work does not affect runtime users |
| Page scope is enforced | Queries and actions cannot silently escape the page's allowed connectors |
| Write actions are guarded | Non-editors can be prevented from running mutation operations |
| Secrets are preserved on edit | Masked secrets remain stored unless explicitly replaced |
