# Package scenario map — final source acceptance

## Receipt identities and claim limits

All focused assertions below were selected from `final-coverage-frozen02.json` (`F02`, in this reports directory): their assertion status and owning package file status are **passed**. The complete F02 run nevertheless **failed**: 5,662 passed and one unrelated obsolete desktop source-audit failure. It is not a passed whole-suite receipt. Main owns F03 and final E2E reconciliation.

Current source-runtime receipts in this directory:

- `PUB`: `pptx-publication-final-admission-refusal02.json`, passed, exit 0.
- `REC`: `pptx-recovery-final03-http.json`, passed, exit 0.
- `KILL`: `portable-kill-final03-http.json`, passed, exit 0.

Each records equal backend before/after SHA256 **`11b99818295da61dac29fd0439deaf21c34b15430946b12eeb999943cf778ccc`**. Older P09/P10 receipts bound to `d136…` cannot qualify these current inputs.

`UI04`: `editor-portable-ui-final04.json`, seven actual browser tests passed, including four Home/Editor A→B→C variants and two export refusals; this is **older-input evidence**, not current final-browser binding. `native-gap-repaired-final04.json` is pending at this mapping checkpoint. Its repaired legacy journey retains real content/notes/edit/reload assertions; initial exact-title decoration failure is not a positive journey pass. Full E2E pending.

P08 `wx` admission to root `reports/pptx-phase08-concurrency-exit-final03.json` failed with EEXIST **before app startup**. Reading the preserved receipt shows `status: failed`, started `2026-10-09T19:41:00.203Z`, backend `a35b4010…`; its partial P08-07 pass is not current phase qualification. Main reports old final04 passed but backend `853767…`, also not current. Fresh root `reports/pptx-phase08-concurrency-exit-reconciled05.json` is **pending**; no predicted verdict.

### Paths and statuses

`PS/` = `server/services/pptx-import/package-store/`; `PI/` = `server/services/pptx-import/`; `R/` = `server/routes/`; `S/` = `server/services/`; `C/` = `client/src/`. Filenames below are actual owning files. Quoted titles are exact F02 assertion titles, not inferred coverage from totals. `Focused passed` means F02 assertion/file passed, not whole-run success. Runtime boundaries are named separately.

## P07 publication matrix

| Row | Exact executed assertion / runtime boundary | Local status and limit |
|---|---|---|
| P07-01 C | `R/pptx-import-crash-points.test.js`: `CP1: after publish before drain — outbox pending, not listable, durable pending-visibility, head exists`; PUB paused job/list/open HTTP | Focused + current runtime passed; source HTTP, not Office rendering. |
| P07-02 C | Same file: `P07-02: live and durable GET withhold done after raw publication identity diverges`; `S/package-backed-presentation-read.test.js`: `P07-14: rejects a persisted wrong-generation before canonical authority can mask it`, `P07-14: rejects a persisted same-generation-wrong-hash before canonical authority can mask it` | Focused passed; controlled raw-row divergence, not an independent native HTTP variant. |
| P07-03 C | `PI/package-store-runtime-lock-order.test.js`: `P08-05: apply success followed by acknowledgement I/O failure replays without another business outcome`; `PI/compatibility-outbox.test.js`: `P07-03: a mismatched captured payload cannot acknowledge the queued publication` | Focused passed; production replay owner with injected ACK EIO; not process death. |
| P07-04 H | `PS/publication-acceptance.test.js`: `P07-04 rejects malformed outbox schema without publishing success or losing Original`; exact generation/operation/destination variants also passed | Focused passed; unchanged root, reopened state and Original; mutation-level malformed-record proof. |
| P07-05 H | Same file: `P07-05 refuses pending retained-template instantiation without a partial destination`; `R/presentations.test.js`: `rejects duplicate while package projection is pending`, `rejects save-as-template while package projection is pending` | Focused passed; store and route admission, no separate browser refusal claimed. |
| P07-06 H | `PS/publication-acceptance.test.js`: `P07-06 rejects a template head changed at admission with no partial destination or stale replay` | Focused passed; admission interleave and reopened state, no partial owner/head/outbox. |
| P07-07 H | `PS/lifecycle.test.js`: `rebinds committed source authority when duplicating an imported package`; `R/presentations.test.js`: `instantiates package-backed templates with rebound source identity`; PUB destination source-map/head/owners and Original digest | Focused + current runtime passed; destination authority, not Edited/Office fidelity. |
| P07-08 H | `R/pptx-import-crash-points.test.js`: `CP5: cancel during mapping (pre-publish) — no head, cancelled, no list row`, `CP6: cancel after publish pre-drain — rollback + non-openable; no ghost openable done`, `CP7: cancel after listable drain — complete as done (post-visibility no-op delete policy)` | Focused passed; controlled route cancellation boundaries, not kill evidence. |
| P07-09 H | Same file: `CP4: completeJob never called (Map miss) — durable openable done + reportSummary; presentation openable`, `CP8: restart clear Map then GET — visibility-safe durable payload (not presentationId-only phantom)` | Focused passed; Map-loss durable reconciliation. |
| P07-10 H | `R/pptx-edited-export.test.js`: `returns typed stale and cancellation responses without bytes`; PUB edited refusals generations 1/2: 422 `OFFICECLI_VALIDATOR_UNAVAILABLE`, Original preserved | Focused + current runtime refusal passed; PUB availability precedes generation, so generation-2 request alone does not prove stale-generation rejection. No Edited success. |
| P07-11 M | PUB refusal preserves Original SHA256 `e433a1780b7e7b0b69d98cb7e2d7e99b487c47736b89b1649bd311360352d044`; `PI/mutation-transaction.test.js`: `keeps R0 authoritative when state publication faults after immutable blob commit` | Local refusal + publication-fault proofs passed; no external Office export qualification. |
| P07-12 H | `S/package-backed-presentation-read.test.js`: `P07-12: exposes an exactly projected import through both list and direct readers`; PUB job/list/open/template HTTP | Focused + current runtime passed; reader consistency, not visual fidelity. |
| P07-13 C | `R/pptx-import-crash-points.test.js`: `P07-13: a production drain that dead-letters every write never publishes openable live or SSE done` | Focused passed; actual production drain with controlled dead-letter fault. |
| P07-14 C | `S/package-backed-presentation-read.test.js`: `P07-14: rejects a persisted missing-head before canonical authority can mask it`, exact wrong-generation/same-generation-wrong-hash titles above | Focused passed; persisted raw publication identity before canonical merge. |

## P08 concurrency matrix

| Row | Exact executed assertion / runtime boundary | Local status and limit |
|---|---|---|
| P08-01 C | `R/pptx-lifecycle-concurrency.test.js`: `P08-01/02: overlapping same-destination publications preserve the winner after loser compensation` | Focused passed; real store and HTTP reader, deterministic package destination injection, not public UUID collision. Fresh runtime pending. |
| P08-02 C | Same file: `P08-02/14: a late old-job rollback cannot erase a new publication at the same generation` | Focused passed; winner root/row/Original unchanged. Fresh runtime pending. |
| P08-03 C | `PS/package-store.test.js`: `deduplicates blobs while retaining two explicit owners`; `PI/media.test.js`: `P08-03/13: a published winner stays fetchable when overlapping identical-media jobs roll back` | Focused passed; package-blob and upload-media ownership separately proved, no physical GC claim. |
| P08-04 C | `PI/compatibility-outbox.test.js`: `ignores compatibility writes older than the stored package generation`; P08-14 exact captured-write tests | Focused passed; monotonic and exact identity fencing, controlled barriers. |
| P08-05 H | `PI/package-store-runtime-lock-order.test.js`: `P08-05: apply success followed by acknowledgement I/O failure replays without another business outcome` | Focused passed; injected ACK EIO, not process-death proof. |
| P08-06 H | `R/pptx-lifecycle-concurrency.test.js`: `P08-06: a duplicate waiting at admission rejects an actual source restore without a partial destination`; `R/history-package-lock-order.test.js`: `rejects restore when its pre-restore snapshot head becomes stale` | Focused passed; duplicate and restore stale-source refusal. |
| P08-07 H | `R/presentations.test.js`: `P08-07: recovers a lost native save response without purging receipt authority or adding another outcome` | Focused passed; actual lost-response route interleave and same-result replay. Fresh standalone runtime pending; old failed receipt not promoted. |
| P08-08 H | Same file: `replays only the identical idempotency request and never returns stale success`; P08-07 body also asserts changed payload 409 `IDEMPOTENCY_KEY_CONFLICT` and unchanged committed state | Focused passed; native-save contract, not invented import-key semantics. |
| P08-09 H | `R/history-snapshot-delete-compensation.test.js`: `preserves a snapshot when package release status is unknown` | Focused passed; unknown-release compensation, not power-loss backup durability. |
| P08-10 H | `R/history-package-lock-order.test.js`: `P08-10: an overlapping snapshot waits for restore and preserves its reversible package ownership`; `PI/package-store-runtime-lock-order.test.js`: `releases package serialization before replaying against a history-style lock` | Focused passed; deferred barriers/bounded lock-order test, not load qualification. |
| P08-11 H | `R/pptx-import-crash-points.test.js`: `P08-11/13: cancel-successor retains media and immutable Original instead of destructive compensation`; CP6/CP7 above | Focused passed; exact-job/successor policy. Fresh standalone runtime pending. |
| P08-12 M | `R/pptx-lifecycle-concurrency.test.js`: `P08-12: an unrelated deck publishes and stays readable while another lifecycle admission is paused` | Focused passed; explicit isolated-deck overlap, not global throughput proof. Fresh HTTP runtime pending. |
| P08-13 C | `PI/media.test.js`: `P08-03/13: a published winner stays fetchable when overlapping identical-media jobs roll back`; crash-points `P08-11/13: rollback-error retains media and immutable Original instead of destructive compensation`, visible-error/stale-cleanup variants | Focused passed; shared winner and uncertain rollback retention; no destructive GC. |
| P08-14 C | `PI/package-store-runtime-lock-order.test.js`: `P08-14: rejects a captured upsert after replacement at the same numeric generation`, `P08-14: rejects a captured remove after replacement at the same numeric generation`; lifecycle P08-02/14 | Focused passed; equal numeric generation, exact publication fence, head/owner/Original retained. |

## P09 recovery matrix

REC executes **11 actual startServer/process-death HTTP boundaries**, all passed: `project-placement`, `project-checkpoint`, `project-committing`, `project-row`, `project-committed`, `pptx-media`, `pptx-blob`, `pptx-root`, `pptx-json`, `pptx-visible`, `pptx-rollback`. Every boundary records restarts 0/1 plus restart 2 with `backupRestore: true` and a distinct `backupRestoreRoot`.

**Copied-backup restore is actual behavior:** `server/recovery-http-smoke.cjs:102–108` creates a new temp root, performs `fs.cp(root, restoreRoot, { recursive: true })`, and launches the copied root. Restart-2 HTTP checks verify retained winner/media hashes and published Original, or 503 mutation refusal for uncertain placement/checkpoint/media/rollback. This is not merely a boolean marker. Limits: process death, not power loss/fsync; controlled importer, no native conversion-lineage claim.

| Row | Exact executed assertion / runtime boundary | Local status and limit |
|---|---|---|
| P09-01 C | `PS/restart-recovery.test.js`: `retains immutable bytes and validates root/WAL after death at blob`; REC `pptx-blob` | Focused + current runtime passed; no ghost head, orphan audit-only, bytes retained. |
| P09-02 C | `server/index-project-recovery.test.js`: `P09-02/03/04/14 recovers pptx-root through startup with exact HTTP Original/media`; REC `pptx-root` | Focused + current runtime passed; actual startup/process death. |
| P09-03 C | Same file: `P09-02/03/04/14 recovers pptx-json through startup with exact HTTP Original/media`; REC `pptx-json` | Focused + current runtime passed; exact restart convergence. |
| P09-04 C | Same file: `P09-02/03/04/14 recovers pptx-visible through startup with exact HTTP Original/media`; REC `pptx-visible` | Focused + current runtime passed; durable outcome/readability after death. |
| P09-05 H | Same file: `P09-05/14/15 retains uncertain project-placement intent and blocks admission after restart`, project-checkpoint variant; REC corresponding boundaries | Focused + current runtime passed; uncertainty remains degraded rather than false completed. |
| P09-06 H | Same file: `P09-06/08/15 recovers project-row once before readiness and preserves winner media`, committing/committed variants; REC all three | Focused + current runtime passed; exact-session recovery before readiness. |
| P09-07 H | Same file: `P09-07/11 preserves failed rollback authority and winner bytes after real death`; REC `pptx-rollback` | Focused + current runtime passed; durable failure and admission 503, not false success. |
| P09-08 H | Startup tests and REC restarts 0/1/2; `S/project-import-media-session.test.js`: `P09-08 rereads exact session under its lock instead of replaying a stale snapshot` | Focused + current runtime passed; repeated restart and copied-backup restore. |
| P09-09 H | `PS/restart-recovery.test.js`: `P09-09 validates every retained root; all corrupt = false`, `P09-09 validates every retained root; all corrupt = true` | Focused passed; newest/predecessor corruption selection/quarantine. Not a fresh REC HTTP corruption boundary. |
| P09-10 H | `PS/restart-recovery.test.js` executed `retains immutable bytes and validates root/WAL after death at blob`, `… prepared`, `… root`, `… completed`; source lines 67–76 releases/reopens/acquires, assigns `resource.store.fencingEpoch = rootBefore.fencingEpoch`, asserts `mutate(() => {})` rejects `/fencing/i`, then unchanged state hash | **Focused passed: explicit stale writer epoch mutation rejection after reopen**, not inferred from second-writer denial. |
| P09-11 H | `server/index-project-recovery.test.js`: `P09-07/11 preserves failed rollback authority and winner bytes after real death`; REC `pptx-rollback`; exact stale-loser P08 proofs | Focused + current runtime passed; winner authority/shared bytes survive cleanup uncertainty. |
| P09-12 M | `PS/restart-recovery.test.js`: `P09-12 keeps the previous authority on ENOSPC before root rename`, `P09-12 keeps the previous authority on EACCES before root rename` | Focused passed; **injected** errors, not physically full disk or Linux permissions. |
| P09-13 C | `S/project-import-media-session.test.js`: `P09-13 preserves invalid durable ledger instead of admitting over it: {"unfinished":`, exact `[]`/foreign-schema variants; `P09-13 preserves unreadable ledger and its intent instead of resetting it`; `server/index-project-recovery.test.js`: `P09-13 corrupt ledger survives actual startup and readiness rejects admission` | Focused passed; actual startup and controlled unreadable ledger. Fresh REC does not list corrupt-ledger boundary. |
| P09-14 C | `server/index-project-recovery.test.js`: `P09-05/14/15 retains uncertain pptx-media intent and blocks admission after restart`; REC `pptx-media` plus root/json/visible | Focused + current runtime passed; real route/startup shared-media checkpoint; controlled importer. |
| P09-15 H | Same file: `P09-15 bounded recovery timeout stays degraded and retains the durable intent`; startup committing/row/committed and uncertain-media tests; REC expected ready 200/degraded 503 | Focused + current runtime passed; timeout controlled barrier, production startup rather than helper-only proof. |

## P10 portable matrix

| Row | Exact executed assertion / runtime boundary | Local status and limit |
|---|---|---|
| P10-01 C | `R/portable-package-project.test.js`: `reopens immutable Original and destination media after import (local media=true)` and false variant; UI04 `P10-01/12/13/14 owned media via Home A-B-C` / Editor variant | Focused HTTP passed; actual native UI older-input passed, fresh browser binding pending. |
| P10-02 C | `PS/portable.test.js`: `rechecks replace after asynchronous staging instead of overwriting a new head` | Focused passed; deterministic staged replace race, no browser replace proof claimed. |
| P10-03 C | `R/project-export.test.js`: `rejects source head replacement while verified blob reads are in flight`; `PS/portable.test.js`: `rejects a source head advanced while real blob bytes are being read` | Focused passed; mixed-archive source fence, not a browser race journey. |
| P10-04 C | `PS/portable-descriptor-atomicity.test.js`: `rejects missing revision independently before staging/publication`, extra/duplicate revision, missing/extra/duplicate blob descriptor, missing/extra/duplicate supplied payload variants; `S/project-import-archive-v2.test.js`: missing/extra admission variants | Focused passed; independent exact closure defects rejected before publication. |
| P10-05 H | `S/project-import-archive-v2.test.js`: `rejects length package content before creating the staging directory`, `rejects digest package content before creating the staging directory`; `PS/portable-descriptor-atomicity.test.js`: `P10-05: corrupt existing destination blob refuses portable admission without a new head or losing valid staged/source bytes` | Focused passed; real staging/store bytes, not Office validation. |
| P10-06 H | `S/project-import-archive-v2.test.js`: `rejects foreign-authority package content before creating the staging directory`; `PS/portable-retained-authority.test.js`: `rejects supplied foreign-revision instead of normalizing it into destination authority`, foreign-generation/unsupported-schema variants; `PS/portable.test.js`: `rejects corrupted pending journal content before installing a destination head` | Focused passed; owner/source-map/pending journal authority, no attacker-authority normalization. |
| P10-07 H | `S/project-import-archive.test.js`: `rejects case-colliding paths before extraction`; exact `rejects unsafe archive path /outside.png before any staging side effect`, `media/../outside.png`, `media\outside.png`, `C:/outside.png`, encoded traversal variants | Focused passed; sandbox/path admission. |
| P10-08 H | KILL `prepublication`, `root-committed`, `raw-applied`, `owner-committed`, `cleanup-partial` all passed with two restarts | Current runtime passed; genuine ZIPv2/repository corpus package-store source and owned Windows termination; not power loss, native OfficeCLI conversion or Edited validation. |
| P10-09 H | `R/portable-package-project-dedup.test.js`: `P10-09: identical archive twice in one store independently owns authority; permanent deletion preserves sibling HTTP consumers after restart` | Focused passed; same-store double create-new/delete/restart consumer independence. |
| P10-10 H | `PS/portable.test.js`: `requires explicit replace and rebases onto the destination predecessor`; canonical-media replace=true variants and lifecycle retention | Focused passed; destination-local generation/predecessor/ownership; separate native browser explicit-replace journey not claimed. |
| P10-11 M | `C/utils/import-project.test.js`: `validates correct JSON project` (validation only); `C/hooks/use-export-actions.project.test.jsx`: `rolls back failed media placement without generic creation for legacy.json` (failure only) | **Positive native legacy content/notes/edit/reload proof pending** in repaired final04. Initial incidental exact-title failure is not a positive pass; these focused tests cannot substitute. No lossless/Original claim. |
| P10-12 H | `R/portable-package-project.test.js`: `exports B then reopens C with A and B offline and preserves Original/media hashes`; UI04 four Home/Editor variants | Focused HTTP passed; native UI older-input passed, fresh binding pending. |
| P10-13 C | `R/project-export.test.js`: `exports exact ZIP v2 package closure without local media`; `C/utils/export-project.test.js`: `P10 preserves the server package archive even when the deck has no local media`; UI04 `P10-01/12/13/14 no local media via Home A-B-C` / Editor variant | Focused passed; both actual UI entrypoints older-input passed, fresh binding pending. |
| P10-14 C | `PS/portable.test.js`: `rebinds canonical media and immutable Original (pending=false, replace=false)` plus all four pending/replace combinations; HTTP B→C offline title above | Focused passed; canonical destination URLs/pending and committed hashes/fetched media. Native browser four journeys older-input passed. |
| P10-15 H | `C/hooks/use-export-actions.project.test.jsx`: `does not download or request an archive when the dirty save conflicts`, `does not download degraded archives after PROJECT_MEDIA_MISSING and releases the barrier`; `R/project-export.test.js`: `aborts required local media missing and never fetches external links`; UI04 `P10-15 refuses package export with missing owned media`, `P10-15 refuses package export with save generation conflict` | Focused passed; actual native refusals older-input passed, fresh final binding pending. |

## Outstanding local consumer-proof gates

- Current-backend P08 standalone runtime remains pending in `pptx-phase08-concurrency-exit-reconciled05.json`; EEXIST admission failure is neither runtime failure nor runtime pass.
- P10-11 full positive native legacy journey remains pending repaired final04; passing validation and rollback are insufficient substitutes.
- P10-01/12/13/14/15 have actual older-input native UI passes; final current-browser source binding and full E2E remain pending.
- P07-10 PUB establishes validator-unavailable refusal, not stale-generation precedence; focused route assertions own the stale/no-bytes proof.
- P09-09/12/13 have explicit focused/startup proofs but are not fresh REC boundary scenarios. P09-12 is injected ENOSPC/EACCES only.
- P09-10 is **mapped**, not missing: reopened-store stale-epoch rejection is asserted in four executed process-death parameterizations. Copied-backup restore is **mapped**, not missing: real recursive copy and restart-2 consumer checks at all 11 REC boundaries.

## Separate external/physical qualification limits

These receipts do not establish standalone Office rendering, Edited-success/PowerPoint fidelity, physically full disk, Linux permission behavior, or power-loss/fsync durability. Do not turn those targets into alleged missing local product implementations or promote local source receipts to clean release-artifact qualification.
