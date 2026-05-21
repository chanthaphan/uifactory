# Deployment

UIFactory is a backend API (NestJS) plus a static frontend (React/Vite). See
[configuration.md](configuration.md) for every environment variable.

## Local (development)

```bash
npm install            # installs backend + frontend workspaces
npm run setup          # prisma generate + db push + seed (demo data + users)
npm run dev            # backend on :3001, frontend on :5173 (Vite proxies /api → :3001)
```

Open http://localhost:5173 and pick a demo user from the dev login. Useful scripts:

| Command | What it does |
| ------- | ------------ |
| `npm run build` | build backend + typecheck/bundle frontend |
| `npm test --workspace backend` | backend unit tests (`node --test` via tsx) |
| `npm run setup --workspace backend` | re-run prisma generate + db push + seed |
| `npm run migrate:agent-connectors --workspace backend` | one-off: convert legacy app-level agents → Agent API connectors (idempotent) |
| `npm run dev:backend` / `npm run dev:frontend` | run one side only |

## Docker

Two images are built from the repo root:

```bash
docker build -f Dockerfile           -t uifactory-api .        # NestJS API
docker build -f Dockerfile.frontend  -t uifactory-frontend .   # static frontend (nginx)
```

Run the API with the environment from [configuration.md](configuration.md) (at minimum `DATABASE_URL`,
`JWT_SECRET`, `SECRETS_KEY`, and `FRONTEND_URL`). The frontend serves the SPA and proxies `/api` to the
API (see `frontend/nginx.conf`).

## Azure / AKS (Helm)

A Helm chart lives in [`charts/uifactory`](../charts/uifactory) with per-environment values
(`values-dev.yaml`, `values-test.yaml`, `values-prod.yaml`). It is built for AKS and supports:

- **Application Gateway ingress** (`ingress.className: azure/application-gateway`, optional WAF policy + TLS).
- **Entra Workload Identity** — the API pod authenticates to Azure as a user-assigned managed identity
  (`workloadIdentity.clientId`, federated to the service account).
- **Azure Key Vault via the Secrets Store CSI driver** — secrets (`DATABASE_URL`, `JWT_SECRET`,
  `SECRETS_KEY`, `AZURE_AD_CLIENT_SECRET`, …) are synced into a Kubernetes Secret and injected via `envFrom`.
- **Autoscaling** for the API (HPA), non-secret config via a **ConfigMap**, and a hardened pod security context.

```bash
helm lint charts/uifactory --values charts/uifactory/values-dev.yaml
helm upgrade --install uifactory charts/uifactory \
  --values charts/uifactory/values-prod.yaml \
  --set image.registry=<acr>.azurecr.io --set image.tag=<tag>
```

### Metadata database

- **Demo / quick start**: `embeddedSqlite.enabled: true` runs a bundled SQLite on an `emptyDir`
  (single replica, **not durable** — do not use for real data).
- **Production**: set `embeddedSqlite.enabled: false`, switch the Prisma datasource provider to
  `postgresql`, provide `DATABASE_URL` via Key Vault, and enable the Prisma **migration Job**
  (`migrations.enabled: true`, a Helm pre-upgrade hook).

See [`charts/uifactory/README.md`](../charts/uifactory/README.md) for the full values reference.

## Production notes

- Set a strong `JWT_SECRET` and a real 32-byte `SECRETS_KEY` (rotating `JWT_SECRET` makes existing
  encrypted secrets unreadable when no `SECRETS_KEY` is set).
- Configure all four `AZURE_AD_*` variables for real SSO + Graph; set `ADMIN_EMAILS`.
- Keep `ALLOW_PRIVATE_NETWORK=false` unless you intentionally call internal APIs; use `OUTBOUND_ALLOWLIST`
  for specific internal hosts.
- Move to PostgreSQL with migrations; the SQLite path opens a connection per query (no pooling) and the
  schema currently uses `prisma db push` (no migration history yet).
- Rate limiting is in-memory per process — back it with a shared store for multiple replicas.
- **Upgrade step:** after deploying this version, run `npm run migrate:agent-connectors --workspace
  backend` once to convert any legacy app-level "external agent API" connections into Agent API
  connectors (idempotent — safe to re-run).
