# App Catalog

> **Route:** `/`
> **Module:** Catalog & Runtime
> **Generated:** 2026-05-25

## Overview

This page is the home screen for signed-in users. It lets people discover deployed apps that are shared directly with them, visible to the whole organization, or publicly available.

The catalog is intentionally lightweight: it is a search-and-open experience, not a management workspace. Editing, publishing, and admin tasks live elsewhere.

## Layout

1. Page header with title and supporting description.
2. Search box in the top-right area.
3. Card grid of available apps.
4. Empty-state message if no matching apps exist.

## Fields

### Search Region
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Search apps | Text input | No | Blank | Placeholder: `Search apps…` |

### App Card
| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| App icon | Visual indicator | Yes | Derived from page count | Multi-page apps show a dashboard icon; single-page apps show a chat icon |
| Visibility chip | Status chip | Yes | None | Values: `public`, `org`, `private` |
| App name | Text | Yes | None | Main card title |
| Description | Text | No | `No description` | Secondary summary |
| Page count and owner | Caption text | Yes | None | Example: `3 pages · by Alex` |

## Interactions

### Page Load
- **Trigger:** User enters the signed-in shell.
- **Behavior:** The page requests the catalog from the backend.
- **Success:** Matching app cards are displayed.
- **Failure:** The list falls back to empty.

### Search
- **Trigger:** User types in the search field.
- **Behavior:** Filtering happens immediately in the browser.
- **Scope:** Matches app `name` and `description` only.
- **Special rule:** Search does not call the backend again.

### Open App
- **Trigger:** User clicks an app card.
- **Behavior:** The app opens in the live runner at `/run/:slug`.

## API Dependencies

| API | Method | Path | Trigger | Notes |
|---|---|---|---|---|
| List visible deployed apps | GET | `/api/apps/catalog` | Page load | Returns only runtime-eligible apps |

## Page Relationships

- **From:** Main nav `Catalog` tab.
- **To:** `05-live-app-runner.md` via `/run/:slug`.
- **Inbound dependencies:** Apps must be deployed from `04-app-editor.md` before they appear here.

## Business Rules

| Rule | Effect |
|---|---|
| Catalog shows deployed apps only | Draft-only apps are not listed |
| Visibility matters | Public and organization-shared apps broaden the audience |
| Search is local | Filtering is fast but limited to data already loaded on the page |
