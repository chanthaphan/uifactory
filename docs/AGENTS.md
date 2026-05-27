# DOCS KNOWLEDGE BASE

## OVERVIEW
Product and developer documentation. The docs folder mixes user/admin guides, API/config/deployment references, a developer walkthrough, PRD pages, demo videos, and legacy Word manuals.

## STRUCTURE
```
docs/
|-- README.md                  # docs index and concepts at a glance
|-- codebase-walkthrough.md    # developer architecture guide
|-- api-reference.md           # HTTP routes and data model
|-- configuration.md           # env vars and guardrails
|-- deployment.md              # local, Docker, Azure/Helm notes
|-- prd/                       # reverse-engineered product requirements
|-- *.mp4                      # demo videos
`-- *.docx                     # legacy manuals
```

## WHERE TO LOOK
| Task | Location | Notes |
| --- | --- | --- |
| Architecture explanation | `codebase-walkthrough.md` | Auth, app runtime, query gating, iframe bridge, chat |
| API contracts | `api-reference.md` | Role/permission semantics and model shape |
| Env vars | `configuration.md` | Auth, AI, limits, SSRF, outbound allowlist |
| Deployment | `deployment.md` | SQLite dev, Docker, Azure/AKS, upgrade step |
| Product requirements | `prd/` | Page-by-page functional inventory |
| User/admin behavior | `user-guide.md`, `admin-guide.md` | Builder and admin workflows |

## CONVENTIONS
- Keep user-facing guides business-readable; keep `codebase-walkthrough.md` engineering-focused.
- Keep route/model details in `api-reference.md`; do not scatter endpoint contracts across guides.
- When code behavior changes, update the matching docs page in the same change if the behavior is user-visible or API-visible.
- PRD files should describe reconstructable behavior, fields, routes, and permissions, not implementation commentary.
- Preserve large media/manual files; do not rewrite them during normal markdown edits.

## ANTI-PATTERNS
- Do not document production as SQLite-first. Dev/demo SQLite differs from production Postgres/migrations path.
- Do not contradict the 401/403 contract from `api-reference.md` and `codebase-walkthrough.md`.
- Do not duplicate full API route lists in user/admin guides.
- Do not treat `docs/prd/` as generated trash; it is a maintained product inventory.
