# PPTX semantic import continuation - 2026-10-19

## Mission and current status

Continue approved PPTX Import implementation in `C:/Work/NavSlidesEditor` using
`ak-cook --advice --tdd`. This is an implementation continuation, not a new
survey or a request to replace the approved plan.

Original starting contract:
`plans/handoffs/pptx-semantic-resume-20261013-0845.md`.
Approved plan: `.omo/plans/pptx-layout-and-semantic-editability.md`.
Execution ledger: `.omo/drafts/pptx-semantic-execution.md`.

The goal remains authored layout plus genuine component editing, save/reopen,
immutable source/Original and unrelated occurrences. Tasks1-10 are inherited
accepted: **10/29**. Finish all task11 acceptance, then tasks12-25 and F1-F4 in
the approved dependency matrix. Do not redefine success as the focused unit below.

Current focused unit:
`Propagate compound outline outer transform error budgets`.
Its two-file production fix and focused checks are complete; actual dynamic
output-scale/native editor QA is **not complete**. The latest failed observation
is recorded here because it occurred after the execution draft's checkpoint.

The user then requested a prompt for a new chat. No implementation, new test run,
server change or browser action was performed while exporting this handoff.
The handoff's own two-item todo is not the implementation backlog or evidence
that the main goal is complete.

## Scope and guardrails

- Preserve the entire inherited dirty tree, including existing deletions.
- No stage, commit, push, PR, release, reset, clean or deletion of others' work.
- Never arbitrarily kill processes, delete writer.lock, or assume old PID/nonce
  ownership remains valid. Verify command line, listener, ready record and lease
  before using the exact graceful shutdown mechanism.
- No ZIP rewrite to evade an import failure; no fidelity reduction, raster fake
  edits, source/corpus/golden or threshold changes, or self-opened native export
  gates. Keep dashboard-import, synthetic/unit and native-fidelity claims distinct.
- No weakening, skipping or changing inherited failing assertions merely to green.
- Read bounded ranges, summarize machine receipts, and do not reconstruct the
  whole historical transcript.
- Do not wait on old session child/monitor IDs or assume its JS/browser globals
  survive. Recover from files and current observable state.
- Independent implementation/research tracks may run concurrently when ownership
  is disjoint. The user prefers this over prolonged serial PPTX investigations.
- Never late-mock CommonJS StateStore/publication imports. A previous diagnostic
  accidentally advanced a real QA root. Configure fresh private roots before
  imports, and use pure source/codec diagnostics without publication calls.

## Current state

Fresh read-only Git capture during handoff:

- Root: `C:/Work/NavSlidesEditor`.
- Branch: `main`.
- HEAD: `f9ed27b299e800ba2d222c77e73f89c06ea8b111`.
- `git status --short`: 588 entries before creating this handoff.
- Existing deletion `.vscode/settings.json` and extensive client/server/shared/
  test/docs changes remain preserved. This is not a clean checkout and the
  changes are not all attributable to the most recent unit.

Current unit production paths:

- `shared/src/pptx-geometry-svg.js`.
- `shared/src/pptx-semantic-render-tree.js`.

Read their focused receipt before inspecting broader diffs:
`.omo/evidence/pptx-semantic/resume-compound-outer-budget-implementation.md`.
Run ID: `1cafc6d5-ea89-48cd-acdd-ff9583d6ba3b`.

Last verified own server, **historical identity, recheck before acting**:

- PID22440, port3170, epoch10.
- Ready:
  `.omo/evidence/pptx-semantic/resume-compound-budget-ready-1cafc6d5-ea89-48cd-acdd-ff9583d6ba3b.json`.
- The ready JSON contains exact dataDir/uploadsDir/runId/stopPath.
- Data root:
  `.omo/evidence/pptx-semantic/resume-family-data-925fe5a2-f2ce-4683-b68c-dae9f3c1b656`.
- Uploads root:
  `.omo/evidence/pptx-semantic/resume-family-uploads-925fe5a2-f2ce-4683-b68c-dae9f3c1b656`.
- Fonts last configured from
  `.omo/evidence/pptx-semantic/resume-arial-font-root-7251d123-032d-4a77-8f79-e5af9590d61e`
  and `server/vendor/katex/dist/fonts`.
- Last own monitor: `mon_AGQ8MYCNA2XBVE3J`; do not rely on it in a new session.
- Other old3161/3162 servers/data are not authorized targets merely because
  previous receipts mention them.

Frozen client:

- Manifest:
  `resume-compound-budget-client-dist-manifest-1cafc6d5-ea89-48cd-acdd-ff9583d6ba3b.json`
  under `.omo/evidence/pptx-semantic/`.
- Artifact identity:
  `562fa82a0ad4ca9ee9970689fa886fc037857081cd6fbe5084e3532514abe6b6`.
- Source input hash:
  `12830db3af19f4dc72ac72bc13b77901b899b4225b48c9efaf761093b34391c7`.
- Served `EditorPage-BoPAA1Yk.js`, last verified HTTP200/2423571bytes/SHA
  `12cc4721da5e40fad1aebffba27f42f7fc725f1cbb0c42736486c10445a99a92`.

Latest native scene deck:
`c3ad6919-575f-4744-8591-fe22f0025289`.
Last browser route:
`http://127.0.0.1:3170/editor/c3ad6919-575f-4744-8591-fe22f0025289`.
It was1440x900/light, changed fromDPR1 toDPR2, source ellipse unselected.
Do not upload it again if the existing persisted deck is available.

## Decisions and rationale

### Outer precision correction

The outline kernel already budgets its path transform, but the SVG caller
omitted outer occurrence/output magnification. The bounded fix uses:

```text
sigmaMax([a,b,c,d]) =
  (hypot(a+d,b-c) + hypot(a-d,b+c)) / 2
maxScale = max(1, outputPixelScale * sigmaMax(occurrenceLinear))
```

Every geometry-backed compatibility element now receives its composed occurrence
matrix, including solid stroke-only shapes. Do not double-count the internal
path projection/EMU conversion. No change to the0.02threshold, kernel algorithm,
profile support, source records, storage policy or export gate was made.

### Two ten-slide witnesses remain unadmitted

Extended native source:
`resume-native-compound-extended-reference/native-compound-outlines.pptx`,
52655bytes, SHA
`47015a1bcc52a586cc945ce7bf60a4d4699459dd9a2b9ba204e0b2084f7217e8`.

Actual unique dashboard File event failed:

```text
Failed to import PPTX: Invalid geometry style links: expanded semantic byte budget
```

The first error observer used a wrong selector and timed out; actual subsequent
DOM feedback at `app-feedback-message` established the real failure. No native
editor route or render pass followed. At that time four presentations and
root generation26/state hash were unchanged.

Pure source-only measurement:
100contexts expand to8170517bytes; non-text geometry styles745003bytes;
their lower bound8915520 exceeds unchanged8388608 by526912 before other semantic
records. All compact/decode contexts deeply match. Removing pool overhead alone
cannot admit the source. No compliant local admission correction was established.
See `resume-compound-native-admission-limit.md` and
`resume-compound-context-diagnostic-29896f20-de7e-4d39-bacd-c7c8e4e8cd5b/context-byte-counts.json`.
The speculative admission task was abandoned, not reported implemented.
Do not silently weaken expanded-data accounting to make it pass.

The distinct existing original rectangle/line ten-slide48610byte witness was
also attempted exactly once and received the same expanded-byte error. Do not
report it admitted or retry without a materially justified change. No new
numeric lower-bound measurement for that second source was captured.
After a separate valid two-slide import and that second failure, actual listing
had five presentations/root generation28; that observation is not a before/after
root-equality proof for the second failure.

### Independent new native scene is a targeted witness only

A fresh one-slide scene was authored by PowerPoint, not by modifying/subsetting
either rejected ZIP. It does not replace either source or qualify the corpus.
Its authoring script:
`.omo/evidence/pptx-semantic/author-compound-budget-native-scene.ps1`.

Directory:
`.omo/evidence/pptx-semantic/resume-compound-budget-native-1cafc6d5-ea89-48cd-acdd-ff9583d6ba3b/`.
Files: `native-receipt.json`, `native-compound-budget-scene.pptx`,
`native-compound-budget-scene.png` and browser captures below.

- PowerPoint16.0/build10417; native author/capture monitor exit0.
- Source36111bytes/SHA
  `5b615181a6712ef2cf95d87134882e26c35be4a74e0809e84cbe26197f992161`.
- Native PNG2880x1620/SHA
  `c5c435931acae2511442f538a313513cce9c7a33314948c02c36fa60753c1115`.
- Authored page960x540points; do not mislabel the capture as3xCSS.
- Blue ellipse with black double outline, plus blue rectangular control, grouped
  with anisotropic1.2/0.8scaling and horizontal reflection.
- COM reports actual rotation343degrees after the flip, not17.
- Group bounds points `[120,130,672,216]`.
- Only the new own presentation was closed. No Application.Quit.
  At capture, PowerPoint PID28204 existed; it is not permission to kill it.
- Source bytes were unchanged after native capture.
- Exactly one actual dashboard File event imported this scene and reached the
  existing deck above. Canonical GET200/schema2/one slide.
- Source group4, ellipse2, control3. Ellipse geometry is preset with
  moveTo + four arcTo + close, not a straight synthetic polygon.
- Source ellipse instance:
  `ppt/slides/slide1.xml@ppt/slides/slide1.xml#ppt/slides/slide1.xml#shape:2`.
- Real SVG has blue fill and black nonzero-filled compound outline. Three
  source DOM objects (group plus two shapes); no render diagnostic.

## Work performed

Inherited completed work must not be reimplemented:

- Genuine connector detach/edit/reattach, target/group propagation, history,
  save/reopen and Original/source/sibling evidence.
- Genuine reflected freeform point lifecycle.
- Group canonical/source ownership, clipboard remapping, persisted history
  tombstones, native image owner frames.
- Sparse gradients/provider/copy/history/save/reopen units.
- Pattern coverage/alpha/owner/output-scale units; native placement/nativeExtent.
- Compound outlines, ordered effects and typed family editing groundwork.
- Physical fonts, OMML inheritance/provider lifecycle and static canonical OMML
  thumbnail unit; publication serialization.
- Chart host-theme typography, persisted read/journal admission and real lifecycle.
- Arbitrary nonnumeric part parser bridge with pinned runtime attestation and
  unchanged-source actual dashboard/manual-save/cold-reopen/Original proof.
- Recent shaded-gradient/snapshot admission and shared-context cold authority
  units recorded in the current execution draft.

The last failed live DPR experiment:

1. Actual unoccluded desktop1440x900/DPR1/light was captured and visually inspected.
   Ellipse orientation/control and double bands are visible; no overflow/diagnostic.
2. Browser ink:2762826characters,120746 `L` commands, SHA
   `87cd07769d5f292e4e6acf8f136f6df75ff58ece6c6d9de37369255b422dccff`.
3. A MutationObserver was armed on actual outline `d` before CDP
   `Emulation.setDeviceMetricsOverride` with1440x900/deviceScaleFactor2/mobilefalse.
4. The bounded30s observer expected ink length to change and rejected:
   `Native compound DPR ink did not refine`.
5. Follow-up actual state: devicePixelRatio2, viewport1440x900, same ink length/
   line count, one SVG, no unsupported/unavailable/complexity diagnostic.
6. Read-only React fiber observation found the two minified paint/wrapper
   functions `km` and `zT` both with memoized and alternate
   `outputPixelScale=0.7625`, despite devicePixelRatio2. The2dppx media query matched.
7. **Root cause not proven.** It may involve native browser/CDP event delivery
   versus hook subscription or another producer issue. Unchanged subdivision
   alone is not a valid proof of geometric failure; dyadic refinement thresholds
   can matter. No hook/kernel fix or new regression test was written.

Relevant source inspected:

- `client/src/hooks/use-output-pixel-scale.js`: initializes from
  window.devicePixelRatio; listens to resize and rearmed resolution matchMedia.
- `client/src/components/SlideCanvas.jsx`: calls useOutputPixelScale(scale),
  forwards its result into CanvasElement.
- `client/src/components/canvas/canvas-element-wrapper.jsx`: forwards to ShapeRenderer.
- `client/src/components/canvas/element-renderers/shape-element-renderer.jsx`:
  passes outputPixelScale and pptxOccurrenceMatrix to geometrySvgPathsString.
- `client/src/components/canvas/canvas-semantic-instance-tree.jsx`: no memoized
  render closure; builds current tree and calls the supplied renderElement.
- `shared/src/pptx-geometry-outline.js`: maxScale participates in localTolerance;
  fixed conservative native-unit refinement may already be large. Do not raise
  its point budgets or change the tolerance based on this unresolved experiment.

Browser captures in the new native directory:

- `desktop-light-dpr1.png`: import completion modal obscures canvas. Retained,
  but **not** an unobstructed visual pass.
- `desktop-light-dpr1-unobstructed.png`: visually inspected valid scene,
  SHA `84267206220152fa437e327042c14ed92d0afa83ac72778f1c754fad6cd4e39e`.
- No DPR2 completed capture, no mobile/dark pair, no scene edit/history/manual
  save/reopen/Original lifecycle proof from this latest unit.

## Verification

Focused outer-budget correction:

- Initial RED contained a native-EMU fixture error; it is not target-bug evidence.
- Corrected RED:11fail/14pass before production edits.
- Final focused199tests/10files, exit0.
- Strict three-file ESLint, exit0/zero warnings.
- Build/vendor3051modules/4.40s/105files, exit0.
- Manifest/current source/both locks verified, exit0.
- Independent bounded source review: no actionable regression; not native QA.
- LSP unavailable; no installation/config change.
- Kongming unavailable; advice not falsely attributed to it.

Latest selected broad447file run:6324passed,2failed,2existing skips.
Monitor timed_out rather than exit0; **not GREEN**.
Two unchanged direct-reader contract mismatches:

- `ooxml-semantic-blur.test.js`: expects blur+softEdge rejection, while current
  ordered effect program admits distinct effects in order.
- `ooxml-semantic-text-list-style.test.js`: expects Latin pitchFamily0 rejection,
  while current font descriptor accepts/retains valid0.

Do not weaken them or assert they were tested against pristine HEAD. Earlier
`resume-nonnumeric-broad-findings.md` records exact findings.

Earlier native PNG pattern investigation: truecolor BMP/TIFF targets match while
indexed PNG F/I differs37pixels/max20. Alpha control exported opaque and was
inconclusive; equalizing foreground bounds did not remove the PNG mismatch.
No complete native sampler correction or native/corpus qualification follows.
Read the specific reports rather than reopening the same probes.

## Open risks and blockers

- Main ledger remains10/29; task11 is open.
- Live DPR2 producer/refinement qualification above is unresolved, not a confirmed
  production bug and not a pass.
- Both ten-slide compound witnesses remain outside current expanded-byte admission.
  A future accepted representation/contract decision may be needed; no such
  decision was made and no new approval was inferred.
- Compound/inset non-none line ends, shaded pattern/image fills, preset shadow
  envelope combinations, gradient rotation/flip declarations and remaining
  source-bound happy/failure receipt assembly remain in the implementation backlog.
- Full browser import/edit/save/reopen, native corpus, compatibility and F1-F4
  qualification are separate obligations. Do not substitute focused receipts.
- Existing shared-shell/mobile/F3 findings are not closed by a desktop screenshot.

Immediately before handoff-only todo reset, the implementation list had
14completed,3dropped/superseded and28open (17/45closed, not17accepted).
Two aggregate dropped placeholders were replaced by enumerated tasks; the third
was the speculative native-admission task above. No requested scope was removed.
Recover these28open labels into an end-to-end phased implementation todo:

Implementation:

- Complete remaining task eleven editing acceptance criteria
- Preserve pictures vectors crop and visual effects
- Implement native text layout across render surfaces
- Resolve masters themes and inherited object editing
- Import typed tables charts diagrams equations and media
- Provide semantic merged table and rich cell editing
- Provide editable source bound chart visual models
- Implement SmartArt logical editing and authored layout
- Implement OMML semantic equation editing and rendering
- Integrate media actions timing with semantic saves
- Qualify full browser import edit save reopen
- Qualify source bound fidelity across native corpus
- Verify compatibility integrity and unchanged native claims
- Close semantic gaps and truthful product documentation
- Run integrated checks and executable completion ledger
- Reconcile compound arrows and paint effect combinations
- Render shaded pattern and source image fills
- Support compound and inset stroke line ends
- Complete preset shadow source ink envelope combinations
- Preserve gradient rotation and flip declarations
- Propagate compound outline outer transform error budgets

Qualification:

- Execute dependency matrix and native fidelity checks
- Audit F1 compliance with approved implementation plan
- Review F2 code quality across completed changes
- Execute F3 real manual acceptance QA
- Verify F4 ideal state fidelity against evidence

Delivery:

- Update execution evidence and accepted progress ledger
- Report verified outcomes and unresolved external blockers

## Exact next actions

1. **First safe step**: read this handoff, root README/CLAUDE guidance, the approved
   plan and bounded current execution checkpoint; verify branch/HEAD/dirty tree
   against Current state without reverting anything. Restore the full remaining
   todo, not just the output-scale unit.
2. Verify current own server process/listener/lease and frozen artifact from its
   ready/manifest files. Old monitor/browser globals are not resumption contracts.
   If restart is needed, use the exact verified graceful mechanism and preserved
   roots; never clear locks to force it.
3. Reopen existing `c3ad6919-575f-4744-8591-fe22f0025289`; do not re-upload or API-seed.
   Reproduce/inspect current DPR and output scale using bounded observable data.
4. Distinguish event delivery from production logic: compare an initial DPR2
   mount/reload and real viewport/zoom changes with the DPR-only emulation case.
   Observe actual hook/caller values and relevant events before changing code.
   Do not inject fake resize events or responses to label the old experiment green.
   Do not require an exact ink string/point-count change without establishing
   sensitivity on this native fixture.
5. If a production defect is proved, use focused advice and RED-first regression
   where neighboring tests live, minimal correction, focused checks and build.
   If the discrepancy is only environment/event delivery, document that limit
   honestly and use a supported real interaction for observable qualification.
6. Complete actual renderer view checks and any applicable source-local edit/
   history/manual-save/reopen/Original checks, comparing definitions/styles/
   siblings/other occurrences. Keep the new scene's narrow scope explicit and
   leave both failed ten-slide witnesses unqualified.
7. Update `.omo/drafts/pptx-semantic-execution.md` with the post-checkpoint scene/
   DPR findings and subsequent results. Do not promote accepted10/29 prematurely.
8. Finish remaining task11 contracts and genuine happy/failure receipts, then
   tasks12-25 and F1-F4 in the approved dependency matrix. Stop only on the full
   accepted outcome or an honestly established external decision/blocker.

## Source pointers

All receipt basenames below are under `.omo/evidence/pptx-semantic/`:

- `resume-compound-outer-budget-implementation.md`
- `resume-compound-native-admission-limit.md`
- `resume-compound-paint-current-gap-map.md`
- `resume-task11-current-gap-map.md` (older geometry gaps may be superseded)
- `resume-genuine-native-freeform-point-lifecycle.md`
- `resume-native-visibility-connector-app-proof.md`
- `resume-nonnumeric-current-app.md`
- `resume-nonnumeric-independent-review.md`
- `resume-nonnumeric-broad-findings.md`
- `resume-pattern-native-format-context-report.md`
- `resume-pattern-alpha-bounds-context-report.md`

The broader authoritative source remains the approved plan plus current execution
draft. Read individual receipts only for the contract being continued. Do not
replay completed connector/chart/gradient/native-format investigations.
