# Package-First PPTX Slice: Stronger Contracts, Open Gates

**Date**: 2026-07-20 12:35
**Severity**: High
**Component**: PPTX package-first import, save, and validated export
**Status**: Ongoing

## What Happened

This implementation slice hardened package-backed PPTX contracts; it did not prove an edited-package release. Keys are printable-ASCII/128-byte bounded and operation-scoped before state reads; package-store publication is serialized. The canonical matrix governs chart/complex policy: imported charts stay read-only/preserve-only until adapter qualification, transaction eligibility, and level-4 promotion coexist. Native re-import stages bytes through the strict importer and checks authoritative source identity plus final text. Normal returned denials/availability use canonical `reasonCode`, `reasonCodes`, and `reasonCodeSubject`; public thrown validator paths still drop them. The 21/21 fidelity and 4/4 availability suites cover corrected bindings and returned-authority behavior. See the [Session 5 plan](../../plans/archive/260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/plan.md) and [evidence boundary](../export-fidelity-and-limits.md).

## The Brutal Truth

It is maddening that green unit coverage cannot prove a valid edited package. The fence is safer, but the pipeline has no real proof run.

## Technical Details

**Historical snapshot:** Focused evidence: 129 files / 988 passed / 2 skipped; fidelity 21/21; package-store 25/25; availability 4/4; docs 10 files / 102 tests. The earlier full-unit attempt ended timeout/pending, not green. Final clean baseline: lint 0 errors / 25 warnings; excluded-test unit 473 files / 1 skipped and 3,720 tests / 3 skipped in 1,095.52 s; corpus 11/11, 100.0% semantic / 63.0% round-trip; SLA 7/7; route/chart 73/73. Strict real probes failed closed on `emf-convert-disabled` and `PPTX_SLA_STRICT_NODES`. No staging or commit occurred; unrelated artifacts remained untouched.

## Follow-up R1 Outcome — 2026-07-20

The package-backed PUT-to-POST composition now consumes a server-owned pending
projection into exactly one R1: R0 bytes remain immutable, R1 XML contains the
server-derived text, committed head/projection/source-map/journal state advances,
replay returns the same revision, mixed/non-text edits fail closed, and a true
no-op clears only its matching pending marker. The POST route admits only the
header envelope, drains compatibility state after commit with a durable pending
fallback, and returns `X-Pptx-Generation`; compatibility drains are serialized
and stale generations cannot overwrite newer compatibility data. Distinct
idempotency keys no longer coalesce into a false replay. The client waits for a
queued save before validated export and fences late generation adoption by route.
These are focused software-contract results only; native strict re-import,
OfficeCLI qualification, PowerPoint, Electron artifacts, durable lifecycle,
full matrix propagation, and universal reason authority remain unproven or open.

Post-review hardening also moved durable replay lookup ahead of fresh validator
availability probing, made the package outbox the sole package-backed JSON writer,
preserved server-owned compatibility metadata/tombstones, serialized distinct-key
exports per presentation, fenced publication against the target head rather than
the global store counter, and handled verified blob targets after directory-sync
`EPERM`. Missing or malformed successor-generation headers now fail closed.
Lifecycle-bound replay identity and shutdown-safe blob reclamation remain open.

## Post-hardening Contract Clarification — 2026-07-20

The availability statement needs one narrow qualification: absent external
validators normally leave **edited** package export unavailable, but a
server-proven pending no-op can reconcile to the current head without those
validators. It clears only the matching pending marker and does not create,
validate, or promote an edited package. The fidelity response labels this as
reconciliation availability rather than validated editing. The owners are
[`validated-edited-export.js`](../../server/services/validated-edited-export.js)
and
[`fidelity-contract.js`](../../server/services/pptx-import/fidelity-contract.js),
with focused coverage in
[`validated-edited-export.test.js`](../../server/services/validated-edited-export.test.js)
and
[`fidelity-contract.test.js`](../../server/services/pptx-import/fidelity-contract.test.js).

The pending projection/journal and any eligible `R1` are server-owned package
state. The constrained transaction materializes exactly one `R1` from the
pending journal; same-key replay returns that successor, while mixed/non-text
state fails closed. Fidelity reads its aggregate generation from the package
store, not the compatibility projection. See
[`generation-safe-save.js`](../../server/services/generation-safe-save.js),
[`validated-edited-export-context.js`](../../server/services/pptx-import/validated-edited-export-context.js),
[`mutation-transaction-execution.js`](../../server/services/pptx-import/mutation-transaction-execution.js),
[`presentations.js`](../../server/routes/presentations.js), and
[`validated-edited-export-materialization.test.js`](../../server/services/validated-edited-export-materialization.test.js).

Compatibility JSON remains nonauthoritative. Its package outbox merge retains
server-owned metadata and tombstones, preserves creation/deletion timestamps,
and applies the package write's server-generated `updatedAt`. When committed
authority exists, package lifecycle duplicate/restore flows rebind its
projection/source-map authority to the new identity and generation. Empty source
maps retain an explicit supplied or
rebound generation, preventing an empty map from losing its package-state
binding. See
[`compatibility-view.js`](../../server/services/pptx-import/compatibility-view.js),
[`compatibility-outbox.test.js`](../../server/services/pptx-import/compatibility-outbox.test.js),
[`lifecycle.js`](../../server/services/pptx-import/package-store/lifecycle.js),
[`lifecycle.test.js`](../../server/services/pptx-import/package-store/lifecycle.test.js),
and
[`source-map.test.js`](../../server/services/pptx-import/source-map.test.js).

The latest focused post-hardening software-contract run passed **15 files / 209
tests**. All of this is application software-contract evidence only. It is not
OfficeCLI, PowerPoint, Electron, or real-package native re-import evidence. G0–G5,
including G1, remain open; this does not establish release readiness or full
native re-import.

## What We Tried

Red/negative tests exposed an oversized key reaching journal validation, an operation-scope collision, and a metadata-publication race. Broad chart aliases were initially too permissive; 3-D and unrelated aliases now remain preserve-only. DTO forgery tests initially exposed contradictory or extra capability bindings; the current 21/21 fidelity suite forces original-only recovery, and the 4/4 availability suite verifies it on normal returns. These failures drove early request validation, explicit operation namespaces, serialized mutation tails, exact canonical row mapping, and fail-closed availability handling.

## Root Cause Analysis

We treated convenient identifiers, display mappings, and capability summaries as more authoritative than they are. Validation occurred too late and incompletely, while stubs hid production-importer preconditions. The hard lesson: a readable chart or passing test double cannot certify an editable OOXML path or a safe availability response.

## Lessons Learned

Keep request limits before state work; key replay must include operation scope; map policy from canonical rows, never aliases; reject missing or forged authority; and record fail-closed physical probes as blockers, not success.

## Next Steps

App/Storage must add reason authority to public thrown validator paths, propagate canonical matrix bytes to every required record, complete a successful strict-default native re-import, and add durable idempotency retention/quota/admission. Security must obtain one direct qualified OfficeCLI receipt. Release must build, hash, and probe G3 Windows artifacts, finish G4 exact-row/mutation-surface evidence, and run the G5 PowerPoint oracle. Until then there is no public execution-error reason authority, direct qualified OfficeCLI receipt, successful real strict-default native re-import, PowerPoint oracle, G3 artifacts, full matrix propagation, durable idempotency policy, or G4/G5 promotion.

## Continuation hardening

The follow-up review blockers were addressed at their authority boundaries. Package-backed GET now resolves projection and generation from one package-store snapshot and merges only trusted compatibility metadata. Duplicate and restore fail closed with `PACKAGE_PENDING_PROJECTION` instead of silently dropping pending package state; duplicate authority receives the destination projection/title, and lifecycle publication checks the live source and retained heads before committing.

Native re-import now binds presentation, revision, and package generation, requires the exact projected slide/element key, and compares stable provenance fields including relationship chain, group ancestry, occurrence path, kind, match method, confidence, and ambiguity. The post-edit source hash remains mutable by design. Import presentation creation receives the same server timestamp used by package compatibility publication. Inner stale-generation races return HTTP 409 with the current package generation.

Export candidates are registered in durable `candidateBlobs` quarantine metadata before content-addressed exposure and removed only after successor publication. Failed publication is therefore auditable as quarantined rather than unowned; physical collection remains disabled under the first-release policy. Focused validation for this continuation passed 15 files / 201 tests, targeted lint, repository lint (0 errors / 25 existing warnings), production build, and diff checks. These remain application software-contract results only; G0-G5, OfficeCLI, PowerPoint, Electron, and real native round-trip evidence remain open.

## Package-backed sink authority follow-up — 2026-07-21

Review reproduced a history restore response that returned stale compatibility
projection content paired with successor generation 2. The shared package-backed
reader now supplies authority-consistent data to export, present,
save-as-template, live presentation, history snapshot/restore, public share,
GitHub push, cloud sync, and explore/fork workflows. Explore forks duplicate package ownership when a package
head exists and quarantine the destination if compatibility persistence fails.
Focused route regressions cover stale compatibility summary,
export/present/template sinks and a restore response that must return the package
projection; live and cloud-sync readers use the same authority boundary. The
final focused run passed 22 files / 248 tests, repository lint passed with 0
errors and 25 existing warnings, and diff checks remained clean. No OfficeCLI,
PowerPoint, Electron, or real native evidence is implied.

## Authority blocker follow-up — 2026-07-21

A second review found three race/fail-open classes in the sink remediation. The
snapshot writer now clones and binds its package data to the exact head it read,
passes that head as a retention CAS precondition, and verifies the retained head
again before persisting. Duplicate and Explore fork package publication now runs
before the presentation-file lock; destination persistence is optimistic and
compensates with package quarantine, while rollback failures surface as a 503
lifecycle error. Lifecycle duplicate publication also accepts and fences an
expected source head.

The shared reader now fails closed when compatibility claims a missing live head
or when an original-only head has a stale journal pointer, missing revision/blob,
or missing presentation owner. Summary and full cloud-sync reads use one package
store snapshot for all active decks. Trashed sync records are skipped instead of
falling back to raw compatibility data, and fork/GitHub/sync JSON crosses the
editor DTO boundary so package authority fields are not published.

Focused blocker validation passed 35 route/package-store files / 223 tests,
repository lint passed with 0 errors and 25 existing warnings, and the production
build transformed 2,297 modules. These remain application software-contract
results only; G0-G5, OfficeCLI, PowerPoint, Electron, and real native round-trip
evidence remain open.
