# PPTX Import Multi-Tenant Decision Record

**Date:** 2026-07-24  
**Plan phase:** 8  
**Decision:** **Remain single-user self-hosted** for the current product model. No multi-tenant job auth implementation in this plan.

## Current model

| Aspect | Behavior |
| --- | --- |
| Tenancy | Single-user / trusted reverse-proxy self-host |
| Job identity | Unguessable UUIDv4 job ids |
| Concurrency | `MAX_CONCURRENT_RUNNING = 1` |
| Auth on job GET/SSE/DELETE | None in-app; comment in `pptx-import.js` documents trusted-proxy assumption |
| Residual risk | Anyone who learns a live job UUID can poll/cancel while Map-resident; durable GET after restart still identity-by-UUID |

## Options considered

1. **Accept single-user residual** (chosen) — document risk; no auth work.
2. **Per-job secret at create** — return secret with `202 { jobId, jobSecret }`; require header/query on GET/SSE/DELETE. Interface sketch only if multi-tenant later.
3. **User/session binding** — requires app user model not present today.

## Interface sketch (out of scope to implement)

```text
POST /api/pptx/import → 202 { jobId, jobToken }
GET  /api/pptx/jobs/:jobId  Authorization: Bearer <jobToken> | X-Pptx-Job-Token
DELETE same token required
Durable package jobs[] stores token hash only (not raw token)
```

Do **not** implement this until multi-tenant productization is an accepted plan.

## Residual risk acceptance

For best-effort self-hosted single-user deployments, UUID + single concurrent import + short Map TTL is accepted. Multi-tenant SaaS exposure is **explicitly out of scope** and would require option 2 or 3 before marketing multi-tenant safety.

## Unresolved product questions

None for this plan — default locked: single-user.
