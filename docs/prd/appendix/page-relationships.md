# Page Relationships

## Frontend Navigation Map

| From | To | Trigger | Notes |
|---|---|---|---|
| Login | App Catalog | Successful session bootstrap | Default signed-in landing path |
| App Catalog | Live App Runner | Click app card | Uses app slug |
| Build Apps | App Editor | Click `Edit` or create app | Uses app id |
| Build Apps | Live App Runner | Click `Open` on a deployed app | Uses app slug |
| App Editor | Build Apps | Back button | Returns to builder list |
| App Editor | Live App Runner | Open running app | Available only when deployed |
| Live App Runner | App Catalog | Back button | Returns to signed-in home |
| Admin Console | No direct page route | Tab switching only | Effects are indirect through shared assets |

## Data and Asset Relationships

| Source | Target | Relationship |
|---|---|---|
| Admin templates | Build Apps | Template list powers `Start from` when creating a new app |
| Admin connectors | App Editor | Shared connector library can be cloned into an app |
| App Editor sharing settings | App Catalog and Live Runner | Visibility and memberships decide who can discover and run the app |
| App Editor deployment | App Catalog | Deploying makes apps appear in the catalog |
| App Editor version publishing | Live App Runner | Publishing changes the runtime snapshot |
| App connector definitions | Live App Runner | Runtime pages use these connectors through bound queries and actions |
| Personal credentials | Live App Runner and App Editor connector drawer | Per-user connectors require user-supplied secrets |
| Chat conversations | Live App Runner chat page | Persisted threads are loaded, switched, and deleted here |

## Governance Relationships

| Control | Affects |
|---|---|
| Platform role | Visibility of `Build` and `Admin` navigation tabs |
| App membership role | Ability to edit a specific app |
| Page connector scope | Which queries and actions a page may use |
| `allowWriteActions` | Whether non-editors may run mutation-style actions in runtime |
