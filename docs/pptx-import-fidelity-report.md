# PPTX Import Fidelity Report

> **Scope:** This is a stateful engineering record, not release proof. The
> product-facing policy is [Export Fidelity and Known Limitations](export-fidelity-and-limits.md).
> Historical counts and phase labels below do not supersede the current evidence
> boundary.

## Current import lifecycle and evidence

### Admission, wait, and cancellation

The dashboard treats admission to the shared import slot and the admitted job as separate bounded phases. It retries a busy slot only within its admission clock; the separately bounded absolute wait begins after admission. Streaming progress falls back to status polling, and the wait reserves a bounded final status `GET` rather than allowing an unbounded final request. After a transport handoff, queued progress is ignored, while terminal SSE outcomes remain eligible to settle the job; settlement aborts the wait-owned recovery transport before public completion. The owners are [`HomePage.jsx`](../client/src/pages/HomePage.jsx), [`api.js`](../client/src/utils/api.js), and [`pptx-job-wait.js`](../client/src/utils/pptx-job-wait.js).

Automatic deadline recovery only reads the job status. It does not reconcile, cancel, or treat an unconfirmed outcome as cancelled; the editor directs the user to check existing presentations before retrying. Explicit `DELETE /api/pptx/jobs/:jobId` cancellation is separate and can be accepted, still in progress, or too late after a job is committed or finished. The HTTP contract is owned by [`pptx-import.js`](../server/routes/pptx-import.js).

### Visibility, capabilities, and reports

A completed durable package job remains `pending-visibility` and deliberately withholds `presentationId` until its compatibility projection is listable (contract B). The per-job capability secret has a one-time, in-memory plaintext handoff; job state retains a verifier hash. Status, cancellation, and reconciliation use the capability header, while SSE must carry it in the stream query because `EventSource` cannot set headers. Proxy access logs must scrub the query string for `/api/pptx/jobs/*/stream`; deployment guidance is in the [deployment guide](deployment-guide.md#pptx-import-policy). The owners are [`pptx-import-job-manager.js`](../server/services/pptx-import-job-manager.js) and [`pptx-import.js`](../server/routes/pptx-import.js).

Recovery reads also recognize a server-owned saved successor of a visible import.
New import authority records retain the original head hash; recovery requires that
hash to match the durable receipt, the presentation identity and original revision
to agree, and the current authoritative projection and package bytes to validate.
The import commit and rollback probes still require the exact original head.
Older authority records without the retained hash are not promoted by guessing
from a larger generation; missing or conflicting proof remains `pending-visibility`.
Regression coverage includes two saves and a package-store restart in
[`pptx-import-successor-visibility.test.js`](../server/routes/pptx-import-successor-visibility.test.js).

The server owns a bounded import report. Its editor form retains only bounded categories, locations, and summary data; it removes job identifiers, timestamps, and raw diagnostic messages. External DTOs reduce the report to a summary, and portable project exports omit it. See [`import-report.js`](../server/services/pptx-import/import-report.js), [`dto.js`](../server/services/pptx-import/package-store/dto.js), and [`export-project.js`](../client/src/utils/export-project.js).

The bounded warning collector keeps its accumulation method non-enumerable so
returned warning arrays can cross structured-clone boundaries and deterministic
import comparisons as data. Count/byte caps and the source collector's
`omittedCount` remain intact; copying its entries is not a substitute for
carrying omission accounting through the importer. Owner:
[`warning-budget.js`](../server/services/pptx-import/warning-budget.js).

### Media and claim boundary

Imported external media is blocked by default and can only use administrator-configured exact origins. EMF/WMF conversion remains default-off; when enabled, the converter policy requires an allowed absolute executable below an absolute trusted root and a matching SHA-256 before spawning it. Those checks are not an OS or network sandbox. The configuration and operational boundary is in the [deployment guide](deployment-guide.md#pptx-import-policy); executable owners are [`constants.js`](../server/services/pptx-import/constants.js), [`map-media.js`](../server/services/pptx-import/mapper/map-media.js), and [`emf-wmf-sandbox.js`](../server/services/pptx-import/emf-wmf-sandbox.js).

This evidence supports the application parser and its software contracts only. It does not claim native PowerPoint or OfficeCLI validation, or pixel-perfect/1:1 fidelity; see [Export Fidelity and Known Limitations](export-fidelity-and-limits.md#evidence-boundary).

### Semantic projection working-tree evidence (2026-10-25)

The approved acceptance ledger remains **10/29**, Tasks1–10 only. The
[execution ledger](../.omo/drafts/pptx-semantic-execution.md#current-acceptance-ledger--2026-10-25)
owns the remaining task prerequisites; historical family receipts are not task
promotion or native edited-PPTX qualification.

Exact-duration fade admission retains source XML, both AlternateContent branches,
and hash/path-bound provenance. Source projection initializes the imported slide;
later NavSlides transition edits survive normalization/reopen without rewriting
that source. Owners: [transition contract](../shared/src/pptx-transition-document.js),
[source adapter](../server/services/pptx-import/semantic-source-transitions.js), and
[reopen/provenance regressions](../tests/pptx-semantic/transition-oct25-source.test.js).
The [90/90 focused result](../.omo/evidence/pptx-semantic/transition-oct25-tests.json)
is not full-deck admission. The unchanged `Bai_2_2.pptx`
[full-import receipt](../.omo/evidence/pptx-semantic/transition-oct25-smoke-receipt.json)
fails at **Semantic data budget exceeded**, not the old unmapped transition.
No budget increase or source/corpus rewrite is qualified by this result.

The [compatibility receipt](../.omo/evidence/pptx-semantic/compatibility-oct25-execution-receipt.md)
records **83/83** focused tests, narrow lint, reverse restoration between base and
edited pending semantic snapshots, nine byte/hash-identical Original responses,
and actual HTTP/package-store shutdown/restart proof. Its residual slide12
transition note is superseded by the full-import receipt above. These bounded
consumer/history results do not complete Task23, its family dependencies, native
validation, or Docker/Electron runtime qualification. The journal-epoch reader
change remains under independent security review; no security approval is claimed.

Retained native inputs ([prerequisites](../.omo/evidence/pptx-semantic/native-evidence-oct25-prerequisites-f4096ecf.json))
have verified integrity for 11 decks/152 PNGs and exact Arial regular/bold assets.
That is **input integrity, not a current visual pass**: the attempted canonical
capture failed on its first deck and published no actuals. Native line boxes,
Aptos/script-face coverage, audited extra-feature references and current authorized
oracle bindings remain missing. Bounded genuine geometry desktop light/dark
lifecycle receipts do not close the phone matrix or native pixel qualification.
Linked workspace CommonJS direct package imports are owned by
[`client/vite.config.js`](../client/vite.config.js); corrected Vite development
interop is not proof of a current production build or full runtime qualification.

Current regression entry points: [native chart source/rendering](../tests/pptx-semantic/semantic-chart-native-geometry.test.jsx),
[real parser-to-mapper XY preservation](../tests/pptx-semantic/semantic-chart-parser-mapper.test.js),
[committed semantic-cut transactions](../client/src/hooks/use-clipboard.semantic-concurrency.test.jsx),
and [source timing after canonical reopen](../client/src/hooks/editor-controller/editor-source-timing-reopen.test.jsx).
Synthetic source-explicit editor smoke is not a PowerPoint-authored native
comparison or full dashboard workflow qualification.

### Geometry validation and projection repair (2026-10-27)

Source-context admission resolves latent stroke colors even for uninstantiated,
hidden, tombstoned or occurrence-masked source declarations. Geometry returned by
`materializeGeometry` remains caller-owned mutable data: connector endpoint
resolution must not contaminate later reads or source geometry. Compatibility
projection reuses one materialization only within the current schema-2 element
pass; ordinary elements and other schema versions retain their existing route.

The [geometry regression receipt](../.omo/evidence/pptx-semantic/oct27-geometry-local-reuse-regressions.json)
records **1,953/1,953** passing tests across 68 files. Strict lint passed for both
changed shared modules. A mixed ordinary/semantic element smoke passed; repeated
normalization of the retained double-ellipse presentation remained equal and took
about 1.24 seconds in the measured run. The rejected shared-mutable cache's 1.2ms
result is not a valid performance claim. This is not a completed dashboard
lifecycle, native fidelity qualification or task promotion; the ledger remains
**10/29**.

Subsequent actual dashboard lifecycle execution reached the edited/reopened
canvas and Original/sibling assertions, then exhausted its unchanged 360-second
overall deadline during portable project export. The retained failure is
`oct27-local-reuse-lifecycle` under the evidence directory. The CPU profile
`oct27-select-geometry.cpuprofile` locates repeated compound-outline clipping in
geometry normalization during selection. The correction retains only one
successful value-keyed outline-validation proof, never a mutable geometry or
paint result; each call still clones and structurally validates input, and a
changed input must pass outline derivation again. Failed derivations are not
cached. `oct27-outline-proof-regressions.json` records **1,956/1,956** passing
geometry tests across 68 files, including repeated-read ownership and edited
reversal rejection. Final strict lint and client build passed. The current-source
four-environment lifecycle is a separate acceptance check, not implied by those
unit results.

Signed zero is excluded from validation-proof reuse and admission: JSON encoding
alone conflates `0` and `-0`, although guide evaluation can distinguish them.
The failing-before regression and [current full geometry receipt](../.omo/evidence/pptx-semantic/oct27-outline-signed-zero-full-regressions.json)
record **1,957/1,957** passing tests across 68 files. A current-code smoke on the
retained native presentation returned independent normalized values without
changing its input; measured calls took approximately 2,013ms, 175ms and 160ms.

The next four-environment run (`oct27-outline-proof-lifecycle`) failed separately:
keyboard navigation crossed an unsupported `Default` cap before the requested
choice; portable reimport collapsed generations 1–7 into six generation-1
authorities and one generation-2 head. The latter returned HTTP422
`CURRENT_SOURCE_AUTHORITY_UNAVAILABLE` after durable package publication.
The keyboard helper now navigates relative to the actual selected option, with
its keyboard and persisted-value assertions retained. Portable import reserves
the whole source generation range above an existing destination instead of
merging historical authorities. This also preserves older-package journal source
references; compacting only the retained-result range made a re-export fail with
`Invalid source package generation`.

The [portable boundary receipt](../.omo/evidence/pptx-semantic/oct27-portable-full-range-green.json)
records **51/51** passing tests across three files, including multi-save
edit/undo/redo histories, same-package replacement, older journal references,
Original bytes and input-bundle immutability. The earlier wider post-fixture run
records **56/57**, not a suite pass: one existing HTTP round-trip test exceeded
its unchanged 5,000ms deadline (5,236ms). Contention/cold-start is an unproven
explanation, not grounds to increase the deadline or suppress that result.
Strict lint and the rebuilt client passed. These are bounded repairs, not Task11,
full lifecycle/native qualification or promotion beyond **10/29**.

### Portable picture ownership repair (2026-10-27)

Project import rebinds uploaded-picture receipts to the destination presentation
and installed upload filename, including retained journal preconditions and
inverse values. The derived `pptxPictureAsset.src` follows the same URL mapping;
source definitions and unrelated occurrences remain unchanged. Media inventory
is read-only, including when a receipt belongs to a different presentation.
Schema 3 picture operations and geometry-provider resolution use the existing
semantic record adapters; parent topology is checked before catalog decoding.

The [ownership/replay regression receipt](../.omo/evidence/pptx-semantic/oct27-picture-portable-cycle-green.json)
records **114/114** tests; the [provider/geometry regression receipt](../.omo/evidence/pptx-semantic/oct27-portable-provider-geometry-regressions.json)
records **2,472/2,472** across 101 files. Independent review removed repeated
identity-index construction from receipt traversal; raw wire keys and identity
catalogs remain unchanged, with [24/24 affected regressions](../.omo/evidence/pptx-semantic/oct27-picture-literal-receipt-green.json).
Changed-file strict ESLint, the final client build and runtime closure passed.

The [four-environment browser receipt](../.omo/evidence/pptx-semantic/oct27-picture-portable-final-browser.json)
passes desktop/phone, light/dark and pointer/keyboard journeys for crop500,
whole-image replacement, explicit save, Undo/Redo, reopen, shared-occurrence and
Original immutability, and portable project reimport. That runtime predates only
the traversal-performance correction. The [final reviewed runtime binding](../.omo/evidence/pptx-semantic/oct27-picture-linear-runtime.json)
records actual HTTP asset-byte equality, source-visitor hash and readiness; its
[desktop pointer/light lifecycle](../.omo/evidence/pptx-semantic/oct27-picture-linear-browser.json)
also passed. These are genuine application lifecycle results, not native visual
qualification, full Task12 acceptance or promotion beyond the **10/29** ledger.

### Import correctness repairs (2026-10-12, working tree)

Parser output now follows the relationship-bound `p:sldIdLst` order rather than
numeric slide filenames. Scene graph, chart/diagram inventory, layout lookup,
animation metadata and source-map indexing use the same authored order, including
gaps in slide numbering. The adapter in
[`slide-order.js`](../server/services/pptx-import/slide-order.js) checks parser
part identity before reordering; it does not rewrite source package bytes.

Picture crop values use the installed parser's percentage contract, so a 0.5%
crop remains 0.005 rather than 0.5. Flattened groups compose image reflections
and reflection-aware rotations, while line endpoints retain their transformed
orientation without a second group reflection. These repairs have synthetic
real-package and mapper regressions; they do not establish numerical full-corpus
fidelity or generic shape-reflection rendering.

### Table and paragraph repair boundary (2026-10-12, working tree)

The importer uses its 72-DPI point coordinate space for paragraph EMU lengths (12,700 EMU/point), not the generic 96-DPI CSS conversion. Owners: [`ooxml-native-text-style-paragraph.js`](../server/services/pptx-import/ooxml-native-text-style-paragraph.js) and [`paragraph-point-space.test.js`](../server/services/pptx-import/paragraph-point-space.test.js).

Table source matching restores ordinary spaces, genuine NBSP and paragraph/break boundaries only with exact provenance; selected table-style `noFill` remains transparent without overriding applicable direct fills. The owners are [`table-source-text.js`](../server/services/pptx-import/mapper/table-source-text.js), [`table-source-fill.js`](../server/services/pptx-import/mapper/table-source-fill.js) and [`table-rich-cell.js`](../server/services/pptx-import/mapper/table-rich-cell.js). Canonical rich content has one sanitized authority; primitive strings remain literal to avoid silently reinterpreting old authored cells as markup.

The [Phase 17 verification contract](../plans/261009-0901-navslides-full-reliability-deep-tdd/phase-17-worst-slide-table-text-tdd.md) and [affected regression receipt](../plans/261009-0901-navslides-full-reliability-deep-tdd/reports/rich-cell-affected-final-green.json) own the bounded evidence. Rich editing and reconstructed exports do not qualify validated edited-package export, numerical corpus fidelity or release acceptance.

### Native projection corrections (2026-10-11, working tree)

Native parser layout/master elements now pass through the existing mapper instead of being replaced by reduced XML decorations. Matching uses source-part identity; hidden content is suppressed only with exact source proof. Native groups retain their contiguous paint order, including unmatched descendants, and an earlier consumed match cannot make an ambiguous name unique. Unmatched parser content remains visible.

Relationship-linked OOXML text styles resolve supported Latin fonts and untransformed colors through direct, layout, master and theme inheritance. Paragraph spacing and leading use the source body defaults; unsupported or ambiguous styling remains in the parser payload. Canvas and generated shape text retain sanitized rich markup. Valid XML whitespace around attribute `=` is accepted; malformed attributes still reject.

The visual capture excludes only owned presenter chrome, retaining the fixed viewport and authored pixels. A real blank/red sentinel smoke changed from 1,626/1,636 contaminated pixels to zero. The final affected run passed 1,592 tests with zero failures and two platform skips; actual production-editor import displayed Times New Roman on slide 18 and returned byte-identical Original PPTX. Full canonical capture completed 11 decks / 152 slides with valid source/image manifests and unchanged declared source inputs. Mean SSIM is 0.566244 and minimum 0.026795: the unchanged `phase08_full` policy (0.99 / 0.97) still fails, with 151 slides below its minimum. Existing 960×540 normalization remains unchanged; the 4:3 actual is stretched while the native-aspect golden is letterboxed. Closing this mismatch requires an explicit geometry-contract decision, not a threshold override. [Scoped repair evidence](../plans/261009-0901-navslides-full-reliability-deep-tdd/reports/261011-fidelity-remediation.json) records the full comparison and authority blockers; this is not release qualification.

## Current EMF/WMF converter boundary (2026-07-26)

EMF/WMF conversion remains default-off. Explicit opt-in requires an absolute
allowlisted executable, an absolute trusted root, and a matching SHA-256 pin
before the child is spawned. The child uses `shell:false` and a narrow
administrator-process environment. These are executable-authority and process
hygiene checks, not a full OS/network sandbox: Windows reparse-point proof,
TOCTOU-free execution, and whole-server RSS isolation remain outside the claim.

## Current strict importer qualification sync (2026-09-17)

The manifest-bound strict importer qualification passes all 11 checked-in corpus
decks. The receipt records exact source hashes, `exitCode: 0`, zero unmapped
scene-graph nodes, zero permanent placeholders, and zero blockers for every
strict result. This is application importer-corpus evidence only; it does not
qualify an edited package, OfficeCLI, or Microsoft PowerPoint.

## Current package-first evidence boundary (2026-07-22)

The immutable original package remains the recovery authority when its bytes can
be verified. A projection save does not make a PPTX a validated edited package:
that outcome can only come from the guarded transaction, which rejects missing
or stale authority instead of creating a fallback package. The executable
boundaries are
[`package-store/import-commit.js`](../server/services/pptx-import/package-store/import-commit.js),
[`generation-safe-save.js`](../server/services/generation-safe-save.js), and
[`mutation-transaction-execution.js`](../server/services/pptx-import/mutation-transaction-execution.js).

Imported-chart metadata is canonical policy, not a rendering hint. An imported
chart stays preserve-only/read-only unless its adapter qualification,
transaction eligibility, and level-4 promotion are all present. The current
matrix has no level-4 promotion; its chart rows and the UI enforcement live in
[`canonical-feature-matrix.js`](../server/services/pptx-import/canonical-feature-matrix.js),
[`chart-support-matrix.js`](../server/services/pptx-import/chart-support-matrix.js),
and
[`chart-properties.jsx`](../client/src/components/properties/chart-properties.jsx).

Package-backed projection saves and returned validated edited-export transaction
outcomes scope idempotency keys to the named mutation operation. Those returned
fail-closed outcomes use the canonical reason-code authority rather than
unversioned message text. HTTP request-validation and thrown execution errors
remain generic, so reason-code authority is not yet a universal public error
contract. The owners and focused assertions are
[`mutation-operation-scope.js`](../server/services/pptx-import/mutation-operation-scope.js),
[`reason-code-contract.js`](../server/services/pptx-import/reason-code-contract.js),
and
[`mutation-transaction.test.js`](../server/services/pptx-import/mutation-transaction.test.js).

### Current application contract

A normal package-backed save records a **server-owned** pending projection and
journal; it does not publish `R1`. An eligible constrained transaction can
materialize exactly one successor `R1` from that pending state. Same-key replay
returns that successor, while mixed or non-text pending edits fail closed. The
owners and focused software-contract tests are
[`generation-safe-save.js`](../server/services/generation-safe-save.js),
[`validated-edited-export-context.js`](../server/services/pptx-import/validated-edited-export-context.js),
[`mutation-transaction-execution.js`](../server/services/pptx-import/mutation-transaction-execution.js),
and
[`validated-edited-export-materialization.test.js`](../server/services/validated-edited-export-materialization.test.js).

Validator unavailability is not universal unavailability. A server-proven true
no-op may reconcile to its current package head without external validators; it
clears only its matching pending marker and does not create or validate an edited
package. The public fidelity response marks this as reconciliation availability,
not as validated editing. See
[`validated-edited-export.js`](../server/services/validated-edited-export.js),
[`fidelity-contract.js`](../server/services/pptx-import/fidelity-contract.js),
and their focused tests.

For package-backed decks, the fidelity route takes the current aggregate
generation from the package-store head rather than a compatibility JSON
projection. The normal presentation GET follows the same rule for both
projection and generation, so delayed compatibility writes cannot produce a
mixed-generation response. Export, present, save-as-template, history,
live presentation, snapshot/restore, public-share, GitHub, cloud sync, and
explore/fork sinks use the same package-backed reader; summary and sync bulk
reads reuse one store snapshot. `/pptx-original` now resolves the immutable original directly from the package
head, including recovery when an intact R0 outlives a missing successor revision.
Restore returns the restored package projection before its successor generation is
handed to the editor on covered paths; restore/delete share the history lock and
legacy restore checks a source fingerprint, while broader package/JSON interleavings
still require validation. Missing package heads
and malformed original-only state fail closed rather than falling back to stale
compatibility JSON. External fork/GitHub/sync JSON crosses the editor DTO
boundary and excludes package authority fields. That JSON is a
nonauthoritative outbox projection: its merge retains server-owned metadata and
tombstones, preserves creation/deletion timestamps, and applies the package
write's server-generated `updatedAt` timestamp. When committed authority exists,
lifecycle duplicate/restore operations rebind its projection/source-map
authority to the new identity and generation, align duplicate title/projection
changes, and reject pending package projections rather than dropping them.
Covered package-backed template PUTs reject projection-changing edits. Retained
ownership is used for creation and instantiation; pending package projections are
rejected by save-as-template and package-backed template projection edits remain
immutable. Template create/delete rollback, outbox acknowledgement, and destination
cleanup still need lifecycle hardening.
Cloud sync stages a manifest/blob bundle for package-backed decks, but it is not a
restorable package-authority archive: projected bundle authority data is incomplete.
Per-request staging and remote-wide destination serialization are implemented;
focused sync coverage also covers same-title destinations and destination-lock
aliases, with the suite rerun still intentionally skipped. Remote-path traversal
rejection, DTO/package-generation alignment, projection-to-bundle expected-head
fencing, bounded resource use, and complete referenced-media traversal remain open.
Portable import now rejects missing/conflicting revisions/blobs, clears stale
destination outbox records, and prevents cross-presentation revision-byte export
without an owner record; focused portable coverage passes. Snapshot and
duplicate/fork paths have source-head checks and keep duplicate package work before
presentation-file serialization, but final snapshot fencing, explore/fork rollback
races, retain/quarantine fencing, stale-retry cleanup, and broader outbox
interleavings remain open. Permanent-delete path/owner isolation, trashed stale-head
reconciliation, and absent-snapshot history-owner cleanup have focused regression
coverage. An empty source map still retains an explicit
supplied or rebound generation. The owners and tests are
[`presentations.js`](../server/routes/presentations.js),
[`compatibility-view.js`](../server/services/pptx-import/compatibility-view.js),
[`compatibility-outbox.test.js`](../server/services/pptx-import/compatibility-outbox.test.js),
[`lifecycle.js`](../server/services/pptx-import/package-store/lifecycle.js),
[`lifecycle.test.js`](../server/services/pptx-import/package-store/lifecycle.test.js),
and
[`source-map.test.js`](../server/services/pptx-import/source-map.test.js). The
shared sink reader is
[`package-backed-presentation-read.js`](../server/services/package-backed-presentation-read.js),
with route coverage in
[`history-package-integrity.test.js`](../server/routes/history-package-integrity.test.js),
[`presentations.test.js`](../server/routes/presentations.test.js), and
[`package-backed-presentation-read.test.js`](../server/services/package-backed-presentation-read.test.js).

The application-side native re-import path now has focused software-contract
coverage for explicit package identity, validation-private media state, and
fail-closed workspace cleanup. The owners are
[`native-reimport-validator.js`](../server/services/pptx-import/native-reimport-validator.js),
[`source-map.js`](../server/services/pptx-import/source-map.js),
[`media-dedup.js`](../server/services/pptx-import/media-dedup.js), and
[`native-reimport-workspace.js`](../server/services/pptx-import/native-reimport-workspace.js).
Focused regressions are
[`native-reimport-validator.test.js`](../server/services/pptx-import/native-reimport-validator.test.js),
[`native-reimport-containment.test.js`](../server/services/pptx-import/native-reimport-containment.test.js),
[`source-map.test.js`](../server/services/pptx-import/source-map.test.js), and
[`media.test.js`](../server/services/pptx-import/media.test.js).

These checks close the observed local identity, media-index, and cleanup
false-success paths; they do not establish strict real-package re-import,
provenance or collateral-preservation proof, or race-proof filesystem isolation. A
cleanup-and-quarantine double failure still has no durable owner or sweeper, and
loser compensation remains open. The mutable post-edit source hash is not treated
as immutable.

These are application software-contract tests. They are not evidence of successful
OfficeCLI or PowerPoint validation, Electron or Docker or provider runtime behavior,
non-Windows support, or real-package native re-import.

No release evidence records a successful OfficeCLI qualification, PowerPoint
oracle result, provider validation, or real-package strict native re-import of a
validated edited package. The application-side validator uses the NavSlides
importer; it is not Office or PowerPoint evidence. The G0–G5 gates, including G1,
remain open in the
[OfficeCLI containment journal](journals/260715-0215-officecli-containment-contract-open-native-gates.md).
The fidelity API does not promote any row to verified editable status and keeps
level 5 unavailable; see
[`fidelity-contract.js`](../server/services/pptx-import/fidelity-contract.js)
and its
[`fidelity-contract.test.js`](../server/services/pptx-import/fidelity-contract.test.js).

## Historical test-suite snapshot

| Test File                                  | Tests   | Status          |
| ------------------------------------------ | ------- | --------------- |
| `mapper-golden-master.test.js`             | 8       | ✅ Pass         |
| `corpus-baseline.test.js`                  | 2       | ✅ Pass         |
| `mapper.test.js`                           | 127     | ✅ Pass         |
| `geometry.test.js`                         | 7       | ✅ Pass         |
| `geometry-drift.test.js`                   | 5       | ✅ Pass         |
| `property-mapping.test.js`                 | 5       | ✅ Pass         |
| `group-transform.test.js`                  | 3       | ✅ Pass         |
| `generated-fixtures.test.js`               | 3       | ✅ Pass         |
| `pptx-import-e2e-flow.test.js`             | 5       | ✅ Pass         |
| `pptx-import.test.js` (route)              | 2       | ✅ Pass         |
| `pptx-export.test.js`                      | 1       | ✅ Pass         |
| `chart-output-to-navslides-mapper.test.js` | 2       | ✅ Pass         |
| `import-fidelity-properties.test.jsx`      | 2       | ✅ Pass         |
| **Total**                                  | **172** | **✅ All Pass** |

## 2026-07-09 Cook progress (Phases 01–08)

| Phase | Status                                                                                                                                                    |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01    | **Done** — zero-loss original + atomic create                                                                                                             |
| 02    | **Done (machinery)** — goldens compare + **present capture** (`test:pptx:oracle:capture` via Playwright + reveal HTML)                                    |
| 03    | **Advanced** — scene graph leaves stamped as `_pptxSource.nodeId`; node-level unmapped warnings; `PPTX_SLA_STRICT_NODES`                                  |
| 04    | **Advanced** — layout placeholder injection when slide text empty; theme/color sanitize; primitive ban list                                               |
| 05    | **Advanced** — corpus `chart-*.pptx` E2 gap 0 via OOXML inject; editable chartData                                                                        |
| 06    | **Advanced** — `ooxml-diagram-parser` + `_pptxDiagram` editable node model (corpus has no SmartArt OOXML)                                                 |
| 07    | **Advanced** — EMF/WMF → PNG via policy-guarded, hash-pinned convert (`PPTX_EMF_CONVERT=1`); strict throws if unavailable; no OS sandbox claim            |
| 08    | **Advanced** — theme/layout XML resolve; animation inventory; original-bytes export + PUT dirty flag; `test:pptx:sla-1to1` module gate (not numeric 0.99) |

**Historical oracle debt:** the 2026-07-09 milestone still used placeholder self-comparison. The 2026-08-21 run below uses Microsoft PowerPoint evidence and fails the fixed policy rather than producing a false green.  
**Not claimed:** product 1:1 visual/editable SLA.

## 2026-08-21 Release Qualification Update

- The current importer-native gate is `npm run test:pptx:importer-qualification`;
  `npm run test:pptx:strict` is its deprecated alias. A fresh manifest-bound run
  qualifies 9/11 decks and fails closed for `Bai_2_1.pptx` (8 unmapped/permanent
  placeholder nodes) and `Bai_2_5.pptx` (5).
- A local Microsoft PowerPoint evidence envelope passes oracle integrity, but
  fixed `phase08_full` qualification fails at mean SSIM
  `0.23698886751039192` and minimum `0` versus required `0.99`/`0.97`. No
  native-complete or PowerPoint 1:1 claim is authorized.
- Present-mode actual capture now passes the deterministic `960x540` viewport
  explicitly into the browser callback before applying Reveal CSS. This fixes
  the former browser-side `VIEWPORT is not defined` failure.

## 2026-07-09 Zero-Loss Original Package (Phase 01 SLA foundation)

- Successful PPTX import **atomically** persists `original.pptx` under
  `server/data/pptx-originals/{uuid}.pptx` and creates the presentation
  server-side with `pptxOriginal.{id,sha256,byteLength,uploadedAt}`.
- Job done payload includes `presentationId` (client opens that id; no
  client path bind of originals).
- `GET /api/presentations/:id/pptx-original` streams bytes. The historical Phase
  01 milestone expected permanent delete to unlink original bytes, but the current
  permanent-delete route does not call `deleteOriginalPptx`; package physical GC
  also remains disabled. Engineering milestone contract lives in
  `server/services/pptx-import/sla-contract.js` (Phase 01 requires **P1** only).
- This does **not** claim visual 1:1; later phases own SSIM/oracle and editable
  parity. Plan: `plans/archive/260709-1306-pptx-import-native-ooxml-1to1-fidelity-deep-tdd/`.

## 2026-06-17 Strict Gate And OOXML Visibility Update

- At the 2026-06-17 milestone, `test:pptx:strict` ran `test:corpus` plus the
  strict smoke browser audit; the current command ownership is documented in
  the 2026-08-21 update above.
- Strict corpus diagnostics now print threshold labels generated from the
  enforced constants. Current global gates are average semantic >= 98%, average
  production round-trip floor >= 50%, corpus size >= 10, production export only,
  per-deck semantic >= 95%, and element-class drop <= 15%.
- Latest pre-change corpus baseline was `11/11` decks, `100.0%` semantic
  fidelity, and `70.0%` average round-trip stability. The 50% round-trip floor
  is a regression floor while the per-type round-trip report remains diagnostic.
- Import now inspects OOXML slide relationship evidence for native charts
  (`ppt/charts/chart*.xml`) and SmartArt data (`ppt/diagrams/data*.xml`),
  exposes additive `stats.nativeObjectCoverage`, `stats.ooxml`,
  `nativeChartCount`, and `nativeSmartArtCount`, and warns when those native
  evidence entries are not imported as native chart/diagram elements.

## 2026-04-27 Coordinate Fidelity Hardening Update

- Added `server/services/pptx-import/geometry.js` as canonical numeric/affine
  normalization layer for import geometry.
- Mapper now uses nullish-safe coordinate reads (`0` stays valid) instead of
  `||` fallbacks for critical geometry paths.
- Line import now normalizes absolute/global endpoints into local wrapper
  endpoints deterministically.
- Image crop import now standardizes to editor-native crop model:
  `imageW/imageH/imageOffsetX/imageOffsetY`; original crop ratios preserved in
  `_pptxImportMeta.cropData`.
- Group flattening moved to matrix-based transform path; rotated/flipped nested
  groups map through corner-based bounds with stable z-order.
- Corpus harness extended with:
  - `geometryDrift.maxPx`, `geometryDrift.medianPx`, `geometryDrift.byType`
  - `propertyCoverage.overall`, `propertyCoverage.byType`
  - `elementCount.sourceByType`, `elementCount.navByType`
- Strict per-type gates added for generated fixture decks:
  - text/shape/line/image/table max drift <= 3px
  - group max drift <= 5px
  - table/chart property coverage >= 0.8
- Added focused Playwright flow `tests/e2e/pptx-import-fidelity.spec.js`
  (import -> bbox audit -> property edit -> save/reload persistence).

## 2026-05-24 Import Review TDD Update

- Added mapper golden-master snapshots for text, image, shape, line, table,
  math, group, and diagram imports.
- Added `corpus-baseline.json` plus a baseline regression test for the checked-in
  `PPTX/` corpus.
- Fixed math/latex capture scoring so math imports use latex-specific criteria
  instead of shape criteria.
- Added `--baseline-out=<path>` to the corpus tester for explicit baseline
  refreshes.
- Media persistence now returns `{ url, warning? }`, allowing import callers to
  surface MIME/sniffing warnings without hidden state mutation.
- EMF/WMF image payloads are preserved as uploaded media with limited browser
  support warnings instead of becoming image-missing placeholders.
- Added `--drift-out=<path>` per-shape geometry diagnostics. The previous large
  shape drift was a tester-side grouped-source flattening issue: grouped PPTX
  child coordinates were compared locally against absolute NavSlides coordinates.
  Applying group transforms in the tester lowered Bai_2_1/Bai_2_2/Bai_2_5
  median shape drift to `0px`.
- Added per-cell/per-side table border preservation through
  `cellStyles.borders[row][col]`, with shared present/export and client canvas
  renderers applying those borders. Table property coverage now reports 100.0%
  for Bai_2_1, Bai_2_2, and Bai_2_5.
- Hardened imported media persistence with SHA256 dedup through
  `server/data/upload-hashes.json`, UUID filenames, extension allowlist,
  dynamic `file-type` magic-byte verification, and external video/audio URL
  gating for localhost/same-origin only.
- Added parser worker ACK handling and progress IPC filtering to the shared
  worker runner. The corpus harness now uses that runner directly so worker
  control messages cannot be mistaken for parse results.
- Split the oversized mapper into focused files under
  `server/services/pptx-import/mapper/` with a directory barrel preserving
  `require('./mapper')`. Group, diagram, media, table, image, shape, text/color,
  base utility, and presentation orchestration slices now have co-located tests;
  the old `mapper.js` file is removed.
- Latest Phase 7 verification: full Vitest `181 passed / 1 skipped` files with
  `1503 passed / 9 skipped` tests; strict corpus remains `4/4` decks at
  `100.0%` semantic fidelity and `99.0%` round-trip stability.
- Replaced blocking PPTX import with async job flow:
  `POST /api/pptx/import -> 202 { jobId }`, `GET /api/pptx/jobs/:jobId`,
  `GET /api/pptx/jobs/:jobId/stream`, and `DELETE /api/pptx/jobs/:jobId`.
  Jobs enforce one running import, keep terminal state during attached SSE
  clients, clean up after TTL, and abort the parser worker on cancel.
- Parser and mapper progress events now flow through the worker runner to SSE
  and HomePage `EventSource` progress UI. Affected Playwright PPTX import
  consumers now poll job completion before using the imported presentation.
- Latest Phase 8 verification: full Vitest `182 passed / 1 skipped` files with
  `1515 passed / 9 skipped` tests; coverage summary `37.26%` statements,
  `32.03%` branches, `31.92%` functions, `38.75%` lines; strict corpus remains
  `4/4` decks at `100.0%` semantic fidelity and `99.0%` round-trip stability.
  Reviewer concerns were fixed for pre-upload concurrency reservation, cancel
  abort propagation, SSE-to-polling fallback, and route-level SSE lifecycle
  coverage.
- Phase 9 expanded the default corpus to `server/data/test-corpus/` with 10
  decks. At the time, `npm run test:corpus` enforced the final v1 acceptance gate:
  aggregate semantic >= 98%, aggregate round-trip >= 99%, no deck below 95%
  semantic, no element-class drop above 15%, and n >= 10; the current production
  round-trip floor is documented in the 2026-06-17 update above. The final run passes
  10/10 decks at `100.0%` semantic fidelity and `99.0%` round-trip stability.
  The chart decks are native PPTX chart files, but current `pptxtojson` metrics
  expose them as shape-backed content; true parser chart extraction remains a
  follow-up.
- Final reviewer-fix validation closed the remaining review concerns: table
  border CSS is sanitized before shared/client rendering, cancelled imports stay
  active until background work settles, package validation observes
  `AbortSignal`, LaTeX import strips HTML tags fully, and abort-after-write
  media files are removed before or after hash indexing. Verification passed focused
  Vitest `6 files / 60 tests`, full `npm test` `182 files / 1527 tests`, strict
  corpus `10/10` at `100.0%` semantic and `99.0%` round-trip, and production
  build.

## 2026-05-25 Unit Conversion Phase 1 Update

- Added a shared CSS length conversion contract for PPTX rich text:
  `font-size` and `letter-spacing` values in `pt`, `in`, `cm`, and `mm` are
  normalized to `px` at 96 DPI and rounded to one decimal place.
- Server PPTX import sanitization, client legacy canvas fallback sanitization,
  and shared present/export rich-text sanitization now share the same strict
  style declaration sanitizer.
- The shared sanitizer preserves editor-authored `line-height`, highlight
  `background-color`, and `tel:` links so the stricter sanitizer does not
  regress normal rich text render/export.
- Unsafe rich-text style declarations remain blocked across layers, including
  non-allowlisted properties, `expression`, `javascript`, `@import`/`import`,
  `behavior`, `binding`, and any `url(...)` usage.
- Mapper text metadata tests now assert the normalized px contract, so imported
  rich text no longer carries raw `pt` font-size metadata through mapper output.
- Verification passed: focused Vitest slice `8 files / 169 tests`, full
  `npm run test` `185 passed / 1 skipped` files with `1549 passed / 8 skipped`
  tests, `npm run test:corpus` strict corpus `10/10` at `100.0%` semantic
  fidelity and `99.0%` round-trip stability, `npm run build`, and `npm run lint`
  with 0 errors. Lint still reports 7 warnings from an unrelated untracked
  debug script in the local worktree.

## 2026-05-25 Non-Default Resolution Phase 2 Update

- Imported PPTX presentations now store canvas-pixel resolution as
  `{ width: 960, height: 540 }` regardless of source slide size, matching the
  coordinate system used by mapped elements.
- Source slide dimensions remain available in `_pptxMeta.originalSize`, and
  PPTX export uses that metadata for slide layout while continuing to scale
  elements from canvas resolution.
- Legacy persisted PPTX-imported decks with stale non-canvas `resolution` are
  normalized at read/serialization boundaries without mutating the stored JSON.
- Direct server PPTX export now also normalizes raw legacy imported decks before
  element scaling, while still using `_pptxMeta.originalSize` for emitted slide
  layout.
- Added `server/data/test-corpus/non-default-4x3-resolution.pptx` to cover 4:3
  import resolution normalization in the default corpus.
- Verification passed: post-review focused Vitest slices `5 files / 27 tests`
  and reviewer export slice `4 files / 20 tests`, full `npm run test`
  `186 passed / 1 skipped` files with `1558 passed / 8 skipped` tests,
  Playwright PPTX import endpoint spec `7/7`, strict corpus `11/11` at
  `100.0%` semantic fidelity and `100.0%` round-trip stability,
  `npm run build`, and `npm run lint` with 0 errors. Lint still reports 7
  warnings from an unrelated untracked debug script in the local worktree.

## 2026-05-25 Numeric Scale Propagation Phase 3 Update

- Added `scaleLength(value, scaleAxis, min)` for numeric PPTX point lengths,
  converting `pt` to canvas `px` via `96/72` and the source-to-canvas scale axis.
- Image borders, line/shape/custom-path SVG strokes, diagram node/connector
  strokes, and text/shape shadow offsets/blur now use scaled canvas-pixel values.
- Diagram nodes now preserve plain display text from `textList` while extracting
  sanitized rich metadata from `node.content` when present.
- Mapper golden-master and property tests were re-baselined to the new numeric
  px contract.
- Verification passed: focused mapper slices `4 files / 12 tests`,
  `4 files / 149 tests`, post-review diagram metadata slice `3 files / 138 tests`,
  full `npm run test` `186 passed / 1 skipped` files with
  `1560 passed / 8 skipped` tests, strict corpus `11/11` at `100.0%` semantic
  fidelity and `100.0%` round-trip stability, `npm run build`, and
  `npm run lint` with 0 errors. Lint still reports 7 warnings from an unrelated
  untracked debug script in the local worktree.

## 2026-05-25 SVG Path Scaling Phase 4 Update

- Diagnostic evidence in `plans/archive/260525-1450-pptx-import-unit-conversion-and-scale-fixes/reports/svg-path-scaling-diagnostic.md`
  confirmed `pptxtojson` custom path coordinates are local to source shape
  dimensions.
- Custom SVG path imports now keep the inner SVG `viewBox` in raw source
  dimensions while the outer NavSlides element remains canvas-scaled through
  `mapBox`.
- Generated custom-path SVGs include `width="100%"`, `height="100%"`, and
  `preserveAspectRatio="none"` so the child SVG fills the wrapper instead of
  relying on intrinsic SVG size.
- Custom-path `stroke-width` now uses the raw viewBox coordinate contract:
  PPTX `pt` converts to `px` once, and the viewBox/wrapper transform applies the
  source-to-canvas scale.
- Verification passed: mapper/golden-master Vitest slice `3 files / 138 tests`,
  strict corpus `11/11` at `100.0%` semantic fidelity and `100.0%` round-trip
  stability, `npm run build`, and `npm run lint` with 0 errors. Lint still
  reports 7 warnings from an unrelated untracked debug script in the local
  worktree.

## 2026-05-25 Table Typography Phase 5 Update

- PPTX table import now captures per-cell `fontSizes` and `fontFamilies` in
  `cellStyles`, with numeric font sizes converted from PPT points to canvas px
  via `96/72`.
- Imported `colWidths` and `rowHeights` are converted from source units into
  canvas px using the current import scale axes.
- Shared HTML rendering, client canvas rendering, client PPTX export, and
  server PPTX export now consume per-cell table typography plus row/column
  sizing.
- Table row/column shape edits now keep `cellStyles.*`, `colWidths`,
  `rowHeights`, and `mergedCells` aligned through a focused table-properties
  utility.
- Font family values are strictly sanitized before mapper storage and before
  PPTX export, preventing imported or legacy JSON font-family CSS injection.
- Verification passed: focused Phase 5 Vitest slice `10 files / 186 tests`,
  post-review fix slice `8 files / 50 tests`, strict corpus `11/11` at
  `100.0%` semantic fidelity and `100.0%` round-trip stability with table
  property coverage at `100.0%`, `npm run build`, and `npm run lint` with 0
  errors. Lint still reports 7 warnings from an unrelated untracked debug script
  in the local worktree.

## 2026-05-25 Shape Rich Text Phase 6 Update

- Shape renderers now prefer sanitized `textHtml` when present, using an
  SVG-compatible `foreignObject` path in both shared present/export rendering
  and the client canvas renderer.
- Plain shape text remains the backward-compatible fallback, with text content
  escaped and `textColor` sanitized before SVG output.
- `extractTextMetadata()` now selects the longest visible styled text run for
  summary fields, aggregates nested same-style text as one dominant run, and
  rejects parent aggregate candidates when visible children override
  `fontSize`, `fontFace`, or `color`.
- Shared rich-text sanitization now strips unquoted event attributes and unsafe
  unquoted `href`/`src`/`xlink:href` values while preserving quoted safe
  protocols such as `tel:`.
- Verification passed: focused Phase 6 Vitest slice `9 files / 182 tests`,
  post-review regression slice `7 files / 153 tests`, strict corpus `11/11` at
  `100.0%` semantic fidelity and `100.0%` round-trip stability,
  `npm run build`, and `npm run lint` with 0 errors. Lint still reports 7
  warnings from an unrelated untracked debug script in the local worktree.

## 2026-05-25 Text Insets Phase 7 Update

- PPTX text frame insets now convert from points to scaled canvas pixels during
  import and are stored in `_pptxImportMeta.textInsets` with
  `textInsetsUnit: 'px'`.
- Imported text elements render those insets as inner padding on
  `.slide-text-content`; legacy unmarked inset metadata still converts from pt
  to px at render time.
- Imported shape rich text applies the same inset metadata to the inner
  `foreignObject` content in both client canvas rendering and shared
  present/export SVG output.
- Insets are clamped to `min(box side / 2, 96)`, invalid values are ignored per
  side, and no generic top-level `element.padding` schema/control was added.
- Verification passed: focused Phase 7 Vitest slice `6 files / 33 tests`,
  strict corpus `11/11` at `100.0%` semantic fidelity and `100.0%` round-trip
  stability, `npm run build`, and `npm run lint` with 0 errors. Lint still
  reports 7 warnings from an unrelated untracked debug script in the local
  worktree.

## 2026-05-25 Acceptance Gate Phase 8 Update

- Added reusable PPTX import acceptance criteria covering canonical canvas
  resolution, finite length-bearing numeric fields, raw CSS unit rejection in
  rich HTML style declarations, dangerous CSS/url token rejection, and
  source-pt font-size tolerance for direct source font metadata.
- The strict corpus runner now executes the acceptance invariants for every
  imported deck before semantic and round-trip metrics are accepted.
- The new gate caught a remaining `line-height: pt` rich-text leak in
  `Bai_2_1.pptx`; rich-text CSS length conversion now normalizes `line-height`
  alongside `font-size` and `letter-spacing`.
- Added rollout checklist documentation for staging verification, rollback
  behavior, and the manual visual-baseline review gate.
- Added `tests/e2e/pptx-import-editor-visual-regression.spec.js` as the guarded
  editor-canvas regression harness. It uses the async PPTX import job flow and
  `.slide-canvas` screenshots with `maxDiffPixelRatio: 0.002`; it intentionally
  skips unless `PPTX_EDITOR_BASELINES_REVIEWED=1` is set after editor baselines
  are reviewed. These snapshots are not PowerPoint visual-fidelity evidence.
- Verification passed: acceptance criteria/unit slices, strict corpus `11/11`
  at `100.0%` semantic fidelity and `100.0%` round-trip stability.

## Coverage by Phase

This table is the historical coverage taxonomy from the earlier PPTX import
review work; the 2026-05-25 unit-conversion plan uses its own Phase 1-8 index
in `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/`.

| Phase   | Feature                     | Test Count | Status |
| ------- | --------------------------- | ---------- | ------ |
| Phase 0 | Sanitizer hardening         | 17         | ✅     |
| Phase 1 | Rich HTML/text preservation | 37         | ✅     |
| Phase 2 | Shape, line, image fidelity | 21         | ✅     |
| Phase 3 | Table full support          | 9          | ✅     |
| Phase 4 | Chart import                | 9          | ✅     |
| Phase 5 | Slide metadata              | 6          | ✅     |
| Phase 6 | Group/SmartArt flattening   | 11         | ✅     |
| Phase 7 | Fidelity harness + e2e      | 5          | ✅     |

## Fidelity Tester

**File:** `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js`

### Metrics

1. **Semantic Fidelity** (pptxtojson → NavSlides)
   - Measures how much of pptxtojson's data is captured in NavSlides schema
   - Per-element: position, size, fill, stroke, content, type
   - Per-category: text, shape, line, image, table, chart, group, diagram

2. **Round-trip Stability** (NavSlides → PPTX → NavSlides)
   - Optional via `--roundtrip`; `--strict` implies round-trip validation
   - Uses the production server export pipeline (`server/utils/server-export.js`) for validation
   - `--allow-fallback` keeps a development fallback path for non-strict runs; strict mode requires production export
   - Uses fingerprint + proximity matching with per-type breakdown and mismatch diagnostics; only exact/proximity matches count as stable, `type-only` stays diagnostic

### CLI Usage

```bash
# Run against default corpus; falls back to ./PPTX when server/data/test-corpus is empty
npm run test:corpus

# Run strict production round-trip validation
node server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js ./PPTX --roundtrip --strict

# Run with development fallback (minimal exporter allowed when production fails)
node server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js ./PPTX --roundtrip --allow-fallback

# Run against a specific directory
node server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js ./path/to/corpus
```

### Final Corpus Result

`npm run test:corpus` on 2026-05-25 used the checked-in `server/data/test-corpus/` corpus:

| Corpus                     | Files | Passed | Avg Semantic Fidelity |
| -------------------------- | ----- | ------ | --------------------- |
| `server/data/test-corpus/` | 11    | 11     | 100.0%                |

Round-trip validation status (2026-05-25):

| Mode                           | Export Method                   | Avg Round-trip Stability |
| ------------------------------ | ------------------------------- | ------------------------ |
| `--roundtrip --allow-fallback` | production (fallback available) | 99.0%                    |
| `--roundtrip --strict`         | production only                 | 100.0%                   |

Strict run guarantees:

- `--strict` always runs round-trip validation (even if `--roundtrip` is omitted)
- Export method is `production` for every deck
- Only exact/proximity matches count as stable; `type-only` remains diagnostic
- Fails if production export is unavailable
- Fails if average semantic fidelity drops below 98%; CLI diagnostics use the same constant as the gate
- Fails if average round-trip stability drops below 50%; CLI diagnostics use the same constant as the gate
- Fails if any deck drops below 95% semantic fidelity
- Fails if any tracked element class drops more than 15%
- Fails if the default corpus has fewer than 10 decks

### Adding Corpus Files

Place `.pptx` files in `server/data/test-corpus/`. Recommended naming convention:

```
server/data/test-corpus/
├── text-rich-001.pptx
├── shape-heavy-001.pptx
├── image-heavy-001.pptx
├── table-complex-001.pptx
├── chart-multi-series-001.pptx
├── smartart-diagram-001.pptx
├── mixed-content-001.pptx
└── large-deck-100slides.pptx
```

### Fidelity Targets

| Category         | Semantic Target | Round-trip Target |
| ---------------- | --------------- | ----------------- |
| Overall          | ≥ 95%           | ≥ 98%             |
| Text             | ≥ 95%           | ≥ 99%             |
| Shape            | ≥ 95%           | ≥ 99%             |
| Line             | ≥ 95%           | ≥ 99%             |
| Image            | ≥ 90%           | ≥ 99%             |
| Table            | ≥ 90%           | ≥ 95%             |
| Chart            | ≥ 85%           | ≥ 90%             |
| Group            | ≥ 90%           | ≥ 95%             |
| SmartArt/Diagram | ≥ 80%           | ≥ 90%             |

## Known Gaps

### Semantic Fidelity Gaps

- **Chart**: Series metadata (legend, axis titles) not fully mapped
- **SmartArt/Diagram**: Complex nested layouts may lose structural hierarchy
- **Group**: Rotation and flip transforms applied during flattening; nested rotation compositing may differ from PowerPoint rendering
- **Table**: Cell border styles beyond solid/dashed not preserved (pattern/gradient fills)
- **Image**: Crop data from `element.rect` (EMUs, 0-1000 scale) mapped to 0-1 ratios; precision loss possible

### Round-trip Gaps

- Round-trip pipeline now runs on server-side production export modules; strict validation requires production export and counts only exact/proximity matches as stable. Residual drift risk is concentrated in parser representation changes (e.g., vector/raster remapping), not minimal-export feature loss.
- Corpus size is now `n=10`, but should still grow with more real-world Office 365, SmartArt, and chart-heavy decks.
- Strict mode enforces production path, aggregate semantic threshold, per-deck semantic minimums, corpus size, element-class retention floors, and a baseline 50% aggregate production round-trip floor.

### Visual Baseline Gaps

- Guarded Playwright baselines now capture the editor canvas at canonical 960x540 with reviewed PowerPoint reference exports saved under `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/reports/powerpoint-reference/`.
- `Bai_2_1.pptx` still shows broad source-to-app drift from grouped background/image rendering. This is tracked as a follow-up fidelity gap outside the unit-conversion and scale-propagation scope.

## Phase 0–6 Implementation Summary

### Phase 0: Sanitizer Hardening

- Added `SAFE_STYLE_PROPS`: `text-decoration`, `vertical-align`, `letter-spacing`, `text-shadow`, `background`
- Added `ALLOWED_TAGS`: `a`, `s`, `strike`, `del`, `sub`, `sup`
- Added `ALLOWED_ATTR`: `href` with protocol whitelist (`https:`, `http:`, `mailto:`, `tel:`)
- `validateHref()` strips invalid protocol hrefs

### Phase 1: Rich HTML Preservation

- `export-pptx-html-parser.js`: Added `strike`, `sub`, `sup`, `charSpacing` parsing
- `export-pptx-text-runs.js`: Built `buildRunOptions()` supporting all 8 text run properties
- Hyperlinks preserved via `<a href>` tags with safe protocol validation

### Phase 2: Shape/Line/Image Enhancement

- `colorValue()`: handles `{type:'color'}/{type:'gradient'}/{type:'none'}/{type:'pattern'}` discriminated union
- `mapImage()`: `objectFit`, `flipH`, `flipV`, `borderColor`, `borderWidth`, `cropData`
- `mapShape()`: real `x1/y1/x2/y2` coords from pptxtojson, improved arrow detection
- `shapeName()`: 15+ shape types, `arrow` checked before `line` to avoid misclassification

### Phase 3: Table Full Support

- `mapTable()`: full rewrite with `mergedCells`, `cellStyles` (textColors, bgColors, isBold, aligns, vAligns), `colWidths`, `rowHeights`
- `vMerge`/`hMerge` continuation cells (rowSpan=0) properly skipped
- Per-cell text color, background, bold, alignment, vertical alignment preserved

### Phase 4: Chart Import

- `chart-output-to-navslides-mapper.js`: `mapChartType()`, `mapCommonChart()`, `mapScatterChart()`
- Handles both pptxtojson native `[x,y]` parallel arrays and CommonChart format
- `_pptxChartMeta` sidecar stores original type, barDir, holeSize, marker, grouping

### Phase 5: Slide Metadata

- Background: `color`/`gradient`/`image` type preserved
- Transition: `fade`/`slide`/`none` with duration and direction
- Speaker notes: sanitized HTML preserved
- `_pptxMeta` sidecar: `originalSize`, `usedFonts`, `themeColors`
- Presentation `resolution` field preserved

### Phase 6: Group/SmartArt Flattening

- `flattenGroupElement()`: recursive with `MAX_GROUP_DEPTH=10`, absolute coordinate transform, rotation matrix, flip transform
- `flattenDiagramElement()`: converts up to 50 diagram nodes to individual shapes
- Depth exceeding `MAX_GROUP_DEPTH` produces a placeholder with `importPlaceholderType: 'grouped-complex'`

## Next Steps

1. **Add true chart/SmartArt parser coverage** → current importer records native OOXML chart/SmartArt package evidence, but full native SmartArt/chart reconstruction remains parser work.
2. **Expand with more real decks** → add Office 365 and SmartArt-heavy decks beyond the initial n=10 corpus.
3. **Track per-type round-trip gates** → optionally enforce per-type round-trip targets in strict mode.
4. **Performance benchmarks** → measure 100-slide deck import + round-trip runtime.

## Semantic continuation evidence

The current implementation checkpoint is
[the semantic execution record](../.omo/drafts/pptx-semantic-execution.md);
[the integration receipt](../.omo/evidence/pptx-semantic/resume-oct20-repair-integration.json)
separates actual editor observations from source-reader diagnostics and native-corpus qualification.

Source-bound media playback authoring is owned by `shared/src/pptx-media-document.js`
and exercised by `client/src/hooks/editor-controller/editor-media-playback-authoring.test.jsx`.
Playback editing evidence does not qualify imported actions, all media formats,
or native edited-PPTX export. Those acceptance gates remain independent.

The import diagnostics panel uses the editor's theme text tokens in both light and
dark modes. The October29 correction was checked on actual desktop and phone
surfaces; dark heading/summary contrast measured14.18:1/7.98:1. The retained
[picture lifecycle observation](../.omo/evidence/pptx-semantic/oct29-integration32/picture-lifecycle.json)
proves dashboard import,0.5% occurrence crop, Undo/Redo, save/reopen and immutable
Original/siblings for one unchanged corpus deck. It does not qualify native text
layout, all image effects, or the full semantic/native acceptance matrix.

