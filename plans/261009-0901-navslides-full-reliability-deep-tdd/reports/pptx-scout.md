## Scope and limits
Read-only investigation only. No checks were run. No writes made. HEAD/branch status was provided in the task context; I did not run Git commands. Existing untracked plan directory is user-owned and untouched. Findings below are based on inspected source/test content, not test execution.

## Existing protection versus unproven behavior

### Import publication visibility
- `prepareImport` validates input, canonicalizes projection, inventories the source package, validates/rebinds source map, stages and commits the hash-verified blob (`import-commit.js:101-157`). This deliberately places blob bytes before metadata authority; a failed later publish can leave an unreferenced physical blob.
- `publishImport` runs under the package writer and single store mutation: destination head absence check, blob/revision records, presentation owner, head with generation 1 and fencing epoch, authority result, compatibility upsert, and durable completed job with `(revisionId,generation,headHash)` (`import-commit.js:159-239`). Duplicate head rejects. Existing guard is not proof against arbitrary concurrent compatibility JSON writers outside the outbox.
- Runtime import flow applies the compatibility outbox only after package publish, then completes the in-memory job (`pptx-import.js:381-590`). Contract B durable serialization withholds `presentationId` until `readAuthoritativePresentation` matches all three recorded outcome identity fields (`pptx-import.js:194-290`). This prevents an unrelated/newer head from satisfying old job visibility.
- `reconcileDurableImportJob` calls package rollback then outbox drain then compatibility delete (`pptx-import.js:301-378`). `rollbackImport` requires exact job/head revision/generation/hash match and rejects a changed head (`import-commit.js:245-295`). This is an important stale-loser fence.
- Crash suite CP1 exercises publish-before-drain pending visibility; CP2 drain failure rollback; CP3/4 drain-before-in-memory-completion/map miss; CP5 prepublish cancel; CP6 postpublish/pre-drain cancel; CP7 postvisibility cancel policy; CP8 restart durable GET and wrong head hash; CP9 durable terminal delete behavior. These are real temp store/outbox tests, but route seams do not simulate abrupt process death at all instruction points.

### Concurrency winner/stale loser / compensation
- State mutations are serialized in-process (`PackageStore.mutate`, `index.js:86-124`); cross-process writer is fenced by `WriterLock`, reloaded on acquisition (`index.js:32-70`). This is package-store serialization, not a transaction spanning package root and presentations JSON.
- Import duplicate destination check is inside publish mutation; only one concurrent writer can establish the head. Competing prepared imports may already have committed their bytes to blob storage; losing publication must not delete a shared blob. The store collector is audit-only (`collector.js:1-37`); release/removal does not physically collect bytes (`package-store.test.js` assertions around lines 331-334).
- Stale loser proof exists for rollback: job receipt identity must equal current exact head. But no targeted import-import race test was located exercising two distinct jobs prepared for the same presentation ID and verifying winner's row/head/outbox/owner/blob survive loser cleanup. Router currently generates UUID destination IDs, making same-destination route race require injected packageCommit barrier/test seam.
- Runtime catch and abort cleanup swallow rollback errors in some paths (`pptx-import.js:479-490,565-579`), while durable reconcile returns `reconciliation-failed` with identity and reason code. Existing proof needs to distinguish expected best-effort immediate cleanup from durable restart reconciliation; no claim that silent rollback-failure is recoverable automatically.
- Stale-writer fences exist in store and import rollback; exact cross-domain interleavings involving compatibility apply, later replacement of destination, stale loser cleanup, and another owner retaining same revision are incompletely evidenced.

### Durable cleanup/restart
- State publish records durable high-water, hashed index, prepared WAL, then root replacement and completion marker. Recovery validates root/index hash, walks bounded predecessor chain, classifies unpublished/published prepared WAL, restores matrix authority high-water, and defers mutation/quarantine to writer acquisition (`state-store.js:1-260`). Existing `package-store.test.js` covers faults after index/prepare/root/completion and reopen, plus stale epoch rejection/reload.
- These are in-process injected boundary faults followed by reopen. They do not prove OS power-loss/directory durability, abrupt kill at every fsync/rename boundary, cleanup of staging/temp roots, or a complete reconciliation of compatibility and package stores after process death.
- Blob staging/commit validates SHA/length and dedupe targets (`blob-store.js:52-114`); no automatic physical collection exists; `collector.js` audit explicitly reports deletion disabled. Therefore orphan blob cleanup is intentionally not a current behavior and must not be planned as destructive GC without ownership/lease/quarantine semantics.
- Durable job records store the package import success receipt in the same state mutation. Rollback removes head/owner/outbox/authority but keeps job marked failed/rolled-back. That provides idempotent evidence only when rollback itself commits; recovery after a crash between package publication and compatibility drain remains dependent on the outbox and reader policy.

### Portable revision/blob/media authority
- Export identifies binary pointers from head, resolves exactly one revision each, requires each revision to be owned by this presentation, resolves blob descriptors, verifies bytes, validates active projection/source-map authority, and optionally compares expected head (`portable.js:24-53,116-171,247-319,350-415`). Import validates exact descriptor/payload closure and bytes, rebinds presentation/source-map authority, checks destination descriptor conflicts, stages blobs, then mutates destination head/revisions/owners/results together (`portable.js:98-123,324-486`). Existing tests prove common closure, ownership, rebind, missing/cross-owner binary reference, malformed descriptor and corruption cases.
- Race gap: no focused portable import interleaving test was located where destination authority/head changes after preflight/staging but before `store.mutate`; closure is rechecked at mutation, but destination semantics currently replace a same-ID head/owners/results/outbox rather than requiring absent destination or expected head. Whether replace is intended must be explicitly decided from sync/import product contract before adding test expectations.
- Bundle currently covers package blobs/revisions/head/mutation results, not compatibility presentation JSON, outbox publication visibility, or associated client media placement/storage. This is package authority transfer, not a complete portable project/media archive. Keep package portability and project archive/media as separate contracts unless requirement explicitly joins them.
- `server/services/project-import-media-session.js` and recovery are a separate system: persisted session record, capability hash, placements, intended presentation UUID/lease and `recoverProjectImport` idempotently checks an existing row's session/payload digest before inserting then commits media owner. Existing tests include archive/session recovery and ownership. It does not import PPTX package-store authority.

## Proposed behaviors/invariants for plan
1. Publish point is the package state-root commit (for package authority); list/open visibility is later, after outbox apply and authoritative read equality. A response, cancel, or retry cannot treat package publication alone as compatible JSON visibility.
2. For a given destination, one package-head winner; each loser can clean only artifacts carrying its exact operation/job identity. A stale rollback must preserve newer head, winner JSON, owner's revisions and any shared content-addressed bytes.
3. Every cross-store uncertainty window needs a durable or derivable identity: operation/job, presentation ID, head hash/generation, compatibility outbox generation, and owner identity. Existing job outcome identity serves import rollback fence; do not add duplicate receipt authority without showing a missing capability.
4. Recovery is idempotent across repeated startup/retry: published WAL is completed, unpublished WAL quarantined; import visibility either converges to the exact expected row or remains pending/reconcile-required; cleanup never deletes immutable original bytes or shared blob absent a separately proven retention/GC design.
5. Portable import closure must be exact: each binary head pointer resolves one revision; revision owner is source presentation; every referenced blob descriptor and bytes match digest/length; logical projection/source-map/journal authority resolves uniquely and is rebound; destination conflict/replacement behavior is explicit and fenced. Media files outside package blobs must not be silently implied as transferred.
6. Snapshot reader uses a consistent authority state; exported bundle is bound to the exact `expectedHead`; changed source returns `SYNC_SOURCE_CHANGED`, not best-effort mixed generation.

## Suggested meaningful fault/interleaving matrix (24 scenarios; plan candidates, not claimed existing coverage)
Use barriers/deferred promises for ordering, temp data roots and actual package store/outbox/JSON wherever possible. For process death, child process plus durable marker/kill/reopen; injected rejection alone is not crash proof.

Publication, races and compensation:
1. Two distinct prepared imports publish same presentation ID; first wins; second rejects duplicate head; winner head/outbox/job remains untouched.
2. Stale loser invokes rollback after winner head has replaced/advanced; expect identity mismatch, no deletion of winner head/JSON/owner/outbox.
3. Loser blob equals winner blob; rollback retains file/descriptor required by winner and never physically collects it.
4. Losing job has another unrelated completed receipt; rollback filters only matching job/presentation authority.
5. Crash after blob commit before metadata publication; reopen has no authority/owner/head, source bytes may be orphan but integrity-auditable and not collected.
6. Crash after metadata root before compatibility drain; restart leaves job non-openable until exact outbox row appears.
7. Outbox JSON apply succeeds then ack fails; retry is idempotent and cannot regress newer compatibility generation.
8. Outbox snapshot contains older upsert, newer head commits before apply; generation fence prevents stale row becoming visible.
9. Outbox drain races with same-presentation newer mutation; only valid generation is acknowledged/applied; stale row does not overwrite newer JSON.
10. Drain transient I/O failure, retry; head remains authoritative and pending visibility persists until success.
11. Poisoned malformed compatibility record is dead-lettered without falsely making job visible; verify pending or explicit reconciliation behavior.
12. Rollback metadata commit succeeds but compatibility removal drain fails; list/open readers fail closed; retry removes stale row without deleting newer row.
13. Rollback store write failure after drain failure; job remains non-openable, owner/outbox state accurately reports cleanup pending, reconcile retry converges.
14. Cancel while package commit is paused before root; no head/outbox/list row after cancellation and late commit completion cleanup.
15. Cancel immediately after package root but before callback returns; exact job rollback; no openable ghost.
16. Cancel during compatibility apply; race outcome follows current postvisibility policy only if authoritative listability has actually been achieved.
17. Crash after visibility before media transaction commit; establish whether imported media placements are visible/orphaned and ensure cleanup/recovery is identity-bound.
18. Crash after visibility before job completion; durable job identity returns done only when exact row/head visible, already partly tested CP3/4/8; child-process proof desired.

Portable/archive authority:
19. Source head changes after sync resolve but before export; expected-head fence returns `SYNC_SOURCE_CHANGED` and invokes no remote sync (existing sync test covers an injected version).
20. Destination head changes after portable preflight but before metadata mutation; mutation rechecks descriptor compatibility; assert no mixed revision/authority and decide explicit replace-versus-conflict policy.
21. Destination already contains same revision ID with incompatible descriptor/manifest; import rejects with no metadata mutation.
22. Destination blob descriptor matches digest but preexisting physical blob bytes are corrupt; commit rejects and no destination head/owner publication.
23. Portable manifest omits/adds/duplicates revision/blob/payload or has length/hash mismatch; no metadata authority; existing tests cover a subset.
24. Imported mutation authority projection/source map points to wrong source presentation/revision or hash; fail closed, no published head.
25. Export head has logical projection/source-map pointer missing, ambiguous, stale or pending journal; fail with authority-unavailable, no package emitted.
26. Rebind source map / nested source authority to destination ID and retain revision/generation identity; verify authority hash and portable re-export/re-import round trip.
27. Package blob transfer succeeds but compatibility/media files are absent; caller must not claim project media portability; explicit negative contract test or docs.
28. Project import killed after media placement but before session placement checkpoint; restart does not duplicate placement or leak owner; recovery/rollback removes only session-owned media.
29. Project import killed after presentation JSON insert but before media owner commit/session committed; restart verifies session/payload identity then finishes exactly once.
30. Project import destination ID conflict with different session or payload; mark reconcile-required and preserve pre-existing row/media owner.

## Exact focused commands (not run)
Root has `"test": "node scripts/vitest/run-vitest-suite.mjs"`; direct focused command should use repository-installed Vitest runner, e.g. `npx vitest run <paths>` (package root). No server-local test script exists in `server/package.json`; its scripts are only start/dev. Existing named paths can be targeted with `npx vitest run server/services/pptx-import/package-store/package-store.test.js server/services/pptx-import/package-store/portable.test.js server/routes/pptx-import-crash-points.test.js server/routes/pptx-import-durable-job.test.js server/routes/pptx-import.test.js server/routes/sync.test.js server/routes/project-import.test.js server/services/project-import-media-session.test.js server/services/project-import-media-session-recovery.js server/services/project-import-media-session-lock.js server/routes/history-package-integrity.test.js server/routes/history-package-lock-order.test.js server/routes/history-snapshot-delete-compensation.test.js`. Remove non-test helper paths from that example before execution. For comprehensive existing suite use `npm test`; do not claim either was executed.

Configured script commands observed at root: `npm test` (`scripts/vitest/run-vitest-suite.mjs`), `npm run test:deep`, `npm run test:pptx:importer-qualification`, `npm run test:pptx:adversarial`, `npm run test:pptx:perf`/`:full`, `npm run test:pptx:corpus-metrics`. `server/package.json` has no test script. No command should be executed per assignment.

## Missing prerequisites / decisions for the parent plan
- Full task calls for stages 0–5 covering baseline evidence, settings race/CI scanner gates, history validation, PPTX lifecycle, release qualification, performance/docs; this subassignment inspected only PPTX package-store/routes/tests/docs requested. It cannot ground settings/CI scanner evidence or author the overall staged plan.
- Need define intended semantics for `importPresentationPackage` replacing an existing destination head and for project-archive media vs PPTX package portable transfer before writing acceptance tests.
- Durable restart proof for cross-domain JSON/outbox and project media needs child-process fixture infrastructure/IPC barriers; existing fault options prove logical recovery boundaries, not power-loss durability.
- No import-specific store test file named `package-store/import-commit.test.js` exists (read attempt failed); import cases are in `package-store/package-store.test.js` and route crash tests.
- Avoid claim that physical cleanup is a current guarantee: collector mode is audit-only and physical deletion disabled. Need explicit scope/retention policy before cleanup automation is planned.