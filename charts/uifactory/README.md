# UIFactory Helm chart (AKS)

Deploys the UIFactory API (NestJS) and front end (React SPA) to Azure Kubernetes Service, behind an
Application Gateway (AGIC) ingress, with Entra Workload Identity and Key Vault (Secrets Store CSI).

See `docs/UIFactory-Azure-Deployment-Manual.docx` for the full infrastructure/networking guide.

## Images

Build from the repo root and push to ACR:

```bash
az acr build -r <acr> -t uifactory-api:<tag>      -f Dockerfile .
az acr build -r <acr> -t uifactory-frontend:<tag> -f Dockerfile.frontend .
```

## Quick start (Dev — demo)

Bundled SQLite on an emptyDir (single replica, not durable), no Key Vault required:

```bash
helm upgrade --install uifactory ./charts/uifactory -n uifactory --create-namespace \
  -f charts/uifactory/values-dev.yaml \
  --set image.registry=<acr>.azurecr.io --set image.tag=<tag>
```

## Production path (Test / Prod)

1. Switch the Prisma datasource provider to `postgresql` and commit an initial migration
   (`prisma migrate dev --name init`), so the migration Job can run `prisma migrate deploy`.
2. Populate Key Vault with the secrets listed under `keyVault.secrets` (DATABASE-URL, JWT-SECRET,
   SECRETS-KEY, AZURE-AD-CLIENT-SECRET).
3. Set `workloadIdentity.clientId`, `keyVault.name`/`tenantId`, the `config.*` values, and ingress host.

```bash
helm upgrade --install uifactory ./charts/uifactory -n uifactory --create-namespace \
  -f charts/uifactory/values-prod.yaml \
  --set image.registry=<acr>.azurecr.io --set image.tag=<sha>
```

## Key values

| Key | Purpose |
| --- | --- |
| `image.registry/.apiRepository/.frontendRepository/.tag` | Container images |
| `embeddedSqlite.enabled` | Demo SQLite (true) vs external DB (false) |
| `migrations.enabled` | Run `prisma migrate deploy` as a pre-upgrade Job |
| `keyVault.*` | Secrets Store CSI (Azure Key Vault) |
| `workloadIdentity.clientId` | User-assigned MI federated to the ServiceAccount |
| `config.*` | Non-secret env (rendered to a ConfigMap) |
| `ingress.host/.wafPolicyId/.tls` | AGIC ingress + WAF + TLS |
| `api.replicas`, `api.hpa.*` | API scaling |

## Prerequisites on the cluster

- AKS add-ons: OIDC issuer + Workload Identity, `azure-keyvault-secrets-provider` (CSI), `ingress-appgw` (AGIC).
- A user-assigned managed identity with a federated credential for
  `system:serviceaccount:uifactory:uifactory-api`, and roles: Key Vault Secrets User, Cognitive Services OpenAI User.
- ACR attached to the cluster (`az aks update --attach-acr`).
