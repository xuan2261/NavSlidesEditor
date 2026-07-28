# Deferred Desired Tests Manifest (non-CI red)

Phase 1 places **desired** behavior here so ordinary Vitest stays green. Owner phases activate these as real tests when implementing.

| ID | Desired invariant | Activation phase | Suggested path |
|---|---|---|---|
| D2-1 | Separate bounded admission deadline for busy retry and post-admission terminal-wait deadline for SSE, poll, and final GET | 2 | `client/src/utils/pptx-job-wait.test.js`, `api.test.js`, Home lifecycle |
| D2-2 | SSE budget path performs bounded final GET (or hands remaining budget to poll) | 2 | `pptx-job-wait.test.js` |
| D2-3 | Timeout/unknown recovery never calls POST `/reconcile` | 2 | Home + wait integration |
| D2-4 | Separate outer / transport / control-plane AbortControllers; no child request after settle | 2 | wait + Home |
| D3-1 | Durable DELETE re-checks listable; non-listable → pending-visibility, no presentationId | 3 | `pptx-import-durable-job.test.js` |
| D3-2 | Bulk list isolates missing-head rows; healthy rows remain; bare array + header/repair metadata | 3 | presentations + package-backed reader |
| D3-3 | Durable repair saga states + equal-generation-safe compensation | 3 | crash-points / outbox / import-commit |
| D3-4 | Contract B openability requires identity-bound package head + generation + projection provenance | 3 | authoritative reader + job DTO |
| D4-1 | classifyError / worker preserve `output-empty` type | 4 | diagnostics + parse-worker / worker-runner |
| D4-2 | EMF/WMF: absolute executable authority + narrow env | 4 | emf-wmf-sandbox |
| D4-3 | External imported URLs blocked by default; optional full-origin allowlist only | 4 | media / map-media |
| D4-4 | Aggregate reservation for background data URLs; snapshot ceilings measured | 4 | resource-budgets |
| D5-1 | Progress monotonic until terminal | 5 | job-manager |
| D5-2 | Editor report survives reload; external/export DTOs omit raw diagnostics/ids/paths | 5 | import-report + export consumers |
| D5-3 | Cancel / countdown UX uses typed cancellation messages | 5 | Home / report panel |
| D6-1 | Authority tombstones non-expiring; physical StateStore/WAL compaction only after dry-run policy | 6 | state-store + retention module |
| D7-1 | Fresh corpus/strict/adversarial/browser/perf/oracle artifacts with real run provenance | 7 | plans/reports + scripts |
| D8-10 | Package-first G0–G5 status handoff only (no claim promotion) | 8–10 | plan reports |
| D11-1 | Best-effort release matrix independent of G5 | 11 | docs/release |

## Characterization tests added in Phase 1

| Path | Labels |
|---|---|
| `client/src/utils/pptx-job-wait.test.js` | H2-SSE-NO-GET, H2-SSE-BUDGET-REUSE |
| `server/routes/pptx-import-durable-job.test.js` | CB-DELETE-BYPASS |
| `server/services/package-backed-presentation-read.test.js` | GHOST-LIST-422 |
| `server/services/pptx-import-job-manager.test.js` | PROGRESS-REGRESS |
| `server/services/pptx-import/diagnostics-output-empty-characterization.test.js` | TYPE-LOSS-EMPTY |
| `server/services/pptx-import/emf-wmf-sandbox.test.js` | EMF-ENV |
