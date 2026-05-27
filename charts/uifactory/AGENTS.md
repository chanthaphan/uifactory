# HELM CHART KNOWLEDGE BASE

## OVERVIEW
AKS Helm chart for the UIFactory API and frontend. Targets Application Gateway ingress, Entra Workload Identity, Key Vault CSI, optional embedded SQLite for dev, and production Postgres migrations.

## STRUCTURE
```
charts/uifactory/
|-- Chart.yaml
|-- values.yaml        # base values
|-- values-dev.yaml    # demo/dev overrides
|-- values-test.yaml   # test overrides
|-- values-prod.yaml   # production overrides
`-- templates/         # deployments, services, ingress, CSI, migration job
```

## WHERE TO LOOK
| Task | Location | Notes |
| --- | --- | --- |
| Deployment guide | `README.md` | ACR build commands and dev/prod install paths |
| Base config | `values.yaml` | Default image, resources, Workload Identity, Key Vault, env |
| Environment overrides | `values-*.yaml` | Dev/test/prod differences |
| API deployment | `templates/api-deployment.yaml` | Backend pod env, secrets, ports, sqlite volume |
| Frontend deployment | `templates/frontend-deployment.yaml` | SPA container/service path |
| Migration hook | `templates/migration-job.yaml` | Pre-upgrade `prisma migrate deploy` path |
| Ingress | `templates/ingress.yaml` | AGIC host/TLS/WAF settings |

## CONVENTIONS
- `api.port` must stay aligned with backend port 3001 unless both app and chart are changed.
- Non-secret env belongs under `config`; secrets come from Key Vault sync when enabled.
- `embeddedSqlite.enabled` is demo-only and non-durable; production should disable it and use external Postgres.
- `migrations.enabled` assumes a committed Prisma migration history and Postgres provider.
- CI runs `helm lint charts/uifactory --values charts/uifactory/values-dev.yaml` and renders dev/test/prod templates.

## ANTI-PATTERNS
- Do not enable migration jobs against the current SQLite `db push` dev schema without a real migration history.
- Do not place secrets in `values.yaml` or `config` values.
- Do not scale embedded SQLite deployments as if the DB were durable/shared.
- Do not change Key Vault secret names without matching env keys and deployment docs.

## VERIFY
```bash
helm lint charts/uifactory --values charts/uifactory/values-dev.yaml
helm template uifactory charts/uifactory --values charts/uifactory/values-dev.yaml --set image.registry=example.azurecr.io --set image.tag=ci > /dev/null
```
