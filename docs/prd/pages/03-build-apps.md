# Build Apps

> **Route:** `/build`
> **Module:** Builder Workspace
> **Generated:** 2026-05-25

## Overview

This page is the builder landing area for people who can author apps. It shows the apps a user owns or can edit and provides the shortest path into creating a new app or reopening an existing one.

It functions as a portfolio view rather than a detailed editor. Users typically arrive here from the top navigation and then move into the full editor for actual changes.

## Layout

1. Header with page title and `New app` button.
2. Grid of app cards.
3. Modal dialog for creating a new app.
4. Empty-state message when the user has no editable apps.

## Fields

### App Card
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Deployment status | Chip | Yes | None | `deployed` is green, `draft` is neutral |
| Visibility | Chip | Yes | None | Shows current sharing setting |
| App name | Text | Yes | None | Primary card title |
| Description | Text | No | `No description` | Secondary summary |
| Page count and update date | Caption | Yes | None | Example: `2 pages · updated 5/25/2026` |
| Edit | Button | Yes | Always shown | Opens the full editor |
| Open | Button | No | Visible only when deployed | Opens the live runner |
| Delete | Icon button | Yes | Always shown | Requires confirmation |

### New App Dialog
| Field | Type | Required | Default | Validation | Notes |
|---|---|---|---|---|---|
| App name | Text input | Yes | Blank | Must be non-empty after trimming spaces | Main app title |
| Start from | Dropdown | No | `Blank app` | None | Allows creation from an existing template |

## Interactions

### Page Load
- **Trigger:** Builder opens the `Build` tab.
- **Behavior:** The page loads editable apps and available templates in parallel.

### Create App
- **Trigger:** User clicks `New app` and submits the dialog.
- **Behavior:** The app is created with the typed name and optional template.
- **Success:** The dialog closes, the form resets, and the user is taken directly to the editor.
- **Validation:** `Create` stays disabled until the trimmed name is not empty.

### Delete App
- **Trigger:** User clicks the delete icon.
- **Behavior:** Browser confirmation is shown first.
- **Success:** The app is removed and the list refreshes.

### Open Existing App
- **Trigger:** User clicks `Edit` or `Open`.
- **Behavior:** `Edit` goes to the builder editor; `Open` goes to the live runner but only for deployed apps.

## API Dependencies

| API | Method | Path | Trigger | Notes |
|---|---|---|---|---|
| List editable apps | GET | `/api/apps` | Page load | Returns apps the user owns or can edit |
| List templates | GET | `/api/templates` | Page load, new-app dialog | Used for `Start from` options |
| Create app | POST | `/api/apps` | Create app | Accepts `name` and optional `templateId` |
| Delete app | DELETE | `/api/apps/:id` | Delete action | Removes the draft app |

## Page Relationships

- **From:** Main nav `Build` tab, visible only to builders.
- **To:** `04-app-editor.md` when editing or immediately after creation.
- **To:** `05-live-app-runner.md` when opening a deployed app.
- **Inbound dependencies:** Templates created in `06-admin-console.md` appear in the new-app dialog.

## Business Rules

| Rule | Effect |
|---|---|
| Only builders can see this page | Viewers are redirected away |
| Templates accelerate creation | New apps can start with prebuilt pages, queries, and connectors |
| Deployment changes available actions | Only deployed apps show the `Open` button |
