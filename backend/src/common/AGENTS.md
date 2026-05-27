# COMMON UTILITIES KNOWLEDGE BASE

## OVERVIEW
Decorator-free backend helpers for secrets, SSRF, identity forwarding, page connector scope, rate limits, and runtime guardrails.

## WHERE TO LOOK
| Task | Location | Notes |
| --- | --- | --- |
| Encryption | `crypto.util.ts` | AES-256-GCM; `SECRETS_KEY` or dev fallback from `JWT_SECRET` |
| Redaction | `redact.util.ts` | Masks secret-bearing config fields before API responses |
| Secret updates | `secret-merge.util.ts` | Keeps stored values for blank or masked incoming secrets |
| SSRF guard | `safe-url.ts` | Blocks private/reserved IPs unless env allows |
| Query safety | `query-config.util.ts` | Mutation detection and page data-source scope helpers |
| Identity | `identity.util.ts` | Signed `X-UIFactory-User` assertion context |
| Limits | `limits.ts`, `rate-limiter.ts` | Runtime and generation guardrails |

## CONVENTIONS
- Keep utilities plain TypeScript. These are the primary backend test targets.
- Preserve exact semantics for masked values: `***` and redacted prefixes/suffixes should not overwrite stored secrets.
- `dataSourceInScope(undefined, id)` and `dataSourceInScope([], id)` intentionally return true.
- `isMutationConfig` treats SQL not starting with `select`, `with`, or `pragma` as write-like; REST defaults to GET.
- `assertSafeUrl` must resolve hostnames before allowing outbound calls.

## ANTI-PATTERNS
- Do not add Nest decorators or DI dependencies here.
- Do not change SSRF allow behavior without updating `safe-url.test.ts` and deployment/config docs.
- Do not treat non-secret config keys such as `baseUrl` as secret just because they live beside tokens.
- Do not swallow crypto/key errors with silent insecure defaults in production paths.

## TESTS
```bash
npm test --workspace backend
```
