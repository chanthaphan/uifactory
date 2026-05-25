# App Lifecycle and Runtime API

> **Route Group:** `/api/apps*`
> **Module:** Runtime / Builder
> **Generated:** 2026-05-25

## Overview

This is the central business API for UIFactory. It manages app creation, editing, sharing, deployment, rollback, runtime page data, query execution, and chat responses.

## Endpoint Inventory

| Endpoint | Access | Business Purpose |
|---|---|---|
| `GET /api/apps` | Authenticated | List apps the current user can edit |
| `GET /api/apps/catalog` | Authenticated | List deployed apps the user can run |
| `GET /api/apps/by-slug/:slug` | Public | Load a live app by slug for runtime use |
| `GET /api/apps/:id` | Authenticated | Load an app for editing or allowed viewing |
| `POST /api/apps` | Builder | Create a new app, optionally from a template |
| `PUT /api/apps/:id` | Builder | Save draft app metadata, definition, or AI config |
| `DELETE /api/apps/:id` | Builder | Delete an app |
| `POST /api/apps/:id/deploy` | Builder | Publish the draft as the live version |
| `POST /api/apps/:id/undeploy` | Builder | Remove the app from live availability |
| `GET /api/apps/:id/versions` | Builder | List published versions |
| `POST /api/apps/:id/rollback` | Builder | Restore the draft from a selected version |
| `PUT /api/apps/:id/sharing` | Builder | Update visibility and explicit memberships |
| `GET /api/apps/:id/pages/:pageId/data` | Public | Run the bound query for a UI page |
| `POST /api/apps/:id/run-query` | Public | Execute a named action or ad hoc page query |
| `POST /api/apps/:id/generate-ui` | Builder | Generate UI HTML using AI or fallback logic |
| `POST /api/apps/:id/chat` | Public | Non-streaming chat response |
| `POST /api/apps/:id/chat/stream` | Public | Streaming chat response |

## Core Business Flows

### Create an App
- **Input:** Name and optional template id.
- **Behavior:** Generates a unique slug, applies template content if requested, and stores a draft definition.

### Save Draft Changes
- **Input:** App name, description, definition, and optional AI config.
- **Behavior:** Updates the editable draft only.

### Publish and Deploy
- **Input:** Optional publish note.
- **Behavior:** Stores a versioned snapshot in `publishedDefinition`, increments version, and marks the app deployed.
- **Special rule:** Deployed app counts per owner are capped by platform limits.

### Roll Back
- **Input:** Target version number.
- **Behavior:** Replaces the current draft with the selected version snapshot.

### Runtime Page Data
- **Trigger:** Live UI page load or refresh.
- **Behavior:** Executes the page's bound query, but only if it remains inside the page's connector scope.

### Runtime Page Action
- **Trigger:** Live HTML calls a named action or query.
- **Behavior:** Runs the matching saved query with page and parameter context.
- **Special rule:** Non-editor users may be blocked when the query appears to perform write operations and the app disallows write actions.

### Chat
- **Trigger:** Chat page sends user messages.
- **Behavior:** Builds a page-aware system prompt, optionally runs a grounding query, then answers via platform AI, app-owned provider key, or Agent connector flow.
- **Special rules:** Rate limits, max word counts, and chat-history budgets apply.

## Key Request Shapes

### `POST /api/apps`
| Field | Type | Required | Meaning |
|---|---|---|---|
| `name` | string | Yes | New app name |
| `description` | string | No | Initial description |
| `templateId` | string | No | Template to clone |

### `PUT /api/apps/:id/sharing`
| Field | Type | Required | Meaning |
|---|---|---|---|
| `visibility` | `private` / `org` / `public` | Yes | Audience level |
| `members[].email` | string | Yes | User email |
| `members[].role` | `editor` / `viewer` | Yes | App-specific collaborator role |

### `POST /api/apps/:id/run-query`
| Field | Type | Required | Meaning |
|---|---|---|---|
| `queryId` | string | No | Direct query execution |
| `action` | string | No | Named action execution |
| `pageId` | string | No | Current page context |
| `params` | object | No | Runtime parameter values |

### `POST /api/apps/:id/chat/stream`
| Field | Type | Required | Meaning |
|---|---|---|---|
| `pageId` | string | No | Chat page context |
| `messages[]` | array | Yes | Chat messages excluding system rows from the UI |
| `conversationId` | string | No | Existing thread id |
| `persist` | boolean | No | Whether to store thread history |

## Page Relationships

- **Used by:** `02-app-catalog.md`, `03-build-apps.md`, `04-app-editor.md`, and `05-live-app-runner.md`.
- **Depends on:** connectors, queries, credentials, templates, and conversation infrastructure.

## Business Rules

| Rule | Effect |
|---|---|
| Draft vs published separation | Builders can keep unpublished work without affecting end users |
| Sharing is layered | Access depends on platform role, app visibility, and explicit memberships |
| Page connector scope is mandatory | A page cannot use connectors outside its declared scope |
| Write protections apply at runtime | Read-only consumers can be blocked from mutating data |
