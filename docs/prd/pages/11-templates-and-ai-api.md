# Templates, Prebuilt Connectors, AI, and Conversations API

> **Route Group:** `/api/templates*`, `/api/connectors*`, `/api/ai/*`, `/api/apps/:appId/conversations*`
> **Module:** Administration / AI
> **Generated:** 2026-05-25

## Overview

This resource group contains the reusable building blocks and intelligence services behind UIFactory. It covers app templates, admin-curated prebuilt connectors, platform-level AI generation, and persisted chat conversation history.

## Endpoint Inventory

| Endpoint | Access | Business Purpose |
|---|---|---|
| `GET /api/templates` | Authenticated | List starter templates for new apps |
| `POST /api/templates` | Admin | Create a template directly from a definition bundle |
| `POST /api/templates/from-app/:appId` | Admin | Convert an existing app into a reusable template |
| `DELETE /api/templates/:id` | Admin | Delete a template |
| `GET /api/connectors` | Authenticated | List admin-curated prebuilt connectors |
| `POST /api/connectors` | Admin | Create a prebuilt connector |
| `PUT /api/connectors/:id` | Admin | Update a prebuilt connector |
| `DELETE /api/connectors/:id` | Admin | Delete a prebuilt connector |
| `GET /api/ai/status` | Authenticated | Report whether a platform AI provider is configured |
| `POST /api/ai/generate-ui` | Authenticated | Generate UI without app-specific context |
| `GET /api/apps/:appId/conversations` | Authenticated | List the current user's saved chat threads for an app/page |
| `GET /api/apps/:appId/conversations/:conversationId` | Authenticated | Get one saved thread |
| `DELETE /api/apps/:appId/conversations/:conversationId` | Authenticated | Delete one saved thread |

## Key Business Behaviors

### Templates
- Package reusable starter apps, including their pages and related data assets.
- When created from an existing app, referenced connector and query ids are remapped so the template can be safely installed into another app.

### Prebuilt Connectors
- Act as a shared library of reusable connector definitions.
- Apps receive a copy, not a live reference, when builders clone one.

### Platform AI Status and Generation
- `GET /api/ai/status` tells the frontend whether platform AI is configured.
- `POST /api/ai/generate-ui` provides a platform-wide generation service; most builder workflows use the app-scoped generation endpoint instead.

### Conversations
- Persist chat history for signed-in users on a per-app and optionally per-page basis.
- Only the owner of a thread can read or delete it.

## Page Relationships

- **Used by:** `03-build-apps.md` for template-based creation.
- **Used by:** `04-app-editor.md` for connector-library cloning and versioned chat behavior.
- **Used by:** `05-live-app-runner.md` for chat thread switching and deletion.
- **Used by:** `06-admin-console.md` for template and connector administration.

## Business Rules

| Rule | Effect |
|---|---|
| Templates are installable starters | They are not live mirrors of the source app |
| Conversation ownership is strict | Users can only manage their own chat history |
| Platform AI and app AI are distinct | App-scoped AI settings can override or supplement platform defaults |
