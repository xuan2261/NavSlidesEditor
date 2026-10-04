## TL;DR

**Reuse `alignElements` for multi-selection geometry; do not reuse coordinate fanout for alignment.** Correct the baseline’s `x=0` expectation to selection bounds—it contradicts the accepted contract, not the implementation target. The reported REDs support proceeding with Phase02 repair, but **Phase01’s unconditional PASS and Phase02 completion are not substantiated by the current evidence.**

Read-only counsel. No edits, delegation, checks, or model switching.

## Reframed problem

The decision is not whether to invent another alignment algorithm. It is whether Format can use the existing operation **without losing mutation guards, effective-slide routing, connectors, or history**, while preserving numeric X/Y delta behavior and completing the named all19 audit.

The new `editor-controls-behavior.test.jsx` exercises the real Format component and alignment hook, but uses local React state and a custom apply function (`:14–38`). Its description case calls `buildSelectionUpdates` directly (`:69–77`). These are useful geometry/ownership regressions—not controller, persistence, undo, or generated-document proof.

## What to do

### 1. Correct the wrong baseline expectation without weakening it

`tests/e2e/education/editor-protections.spec.js:118–152` selects shapes at X=100 and X=280, then requires both X=0. Phase02 explicitly requires multi-selection bounds.

For that existing, unrotated fixture:

- Require selected positions **`[100,100]`**.
- Require Y, dimensions, IDs, and styles unchanged.
- Require the unselected third shape to remain at X=580.
- Remove the erroneous title/comments about aligning multi-selection to slide origin.
- Preserve the historical observed `[-180,0]` failure; identify the old expectation as a contract error.

This remains discriminating: the current delta path does not produce `[100,100]`. Do not move the fixture to the origin, weaken assertions to equality alone, or accept any common X.

The new three-shape cases correctly require:

| Action | Expected X |
|---|---|
| Left | `[100,100,100]` |
| Center | `[200,250,260]` |
| Right | `[300,400,420]` |
| Numeric X=0 | `[-150,150,0]` |

Those expectations match existing hook tests in `use-slide-operations-align-group-distribute.deep.test.js:42–61`.

If implementation has already advanced, do not manufacture another “before” run. Preserve the supplied RED receipts and distinguish subsequent corrected-test verification.

### 2. Narrow Phase01 claims to what was actually proved

The reported **40 Vitest passes and 4 browser passes/5 failures remain observations**. Their classification needs correction:

| Claim | Evidence and correction |
|---|---|
| Alignment baseline is a “genuine desired-contract RED” | False as written: assertions require X=0 (`editor-protections.spec.js:151–152`). Record a reproduced defect with a mistaken desired expectation. |
| No long-description authoring control exists | Contradicted by `image-properties.jsx:123–129`. A selector visibility failure does not establish field-ownership failure. **[INFERENCE]** Stale production assets or contextual visibility could explain it; neither is established. |
| TipTap lineHeight preservation is proved | `editor-protections.spec.js:101–102` asserts only a positive computed value. It neither authors lineHeight nor compares the intended ratio after reload. The fixture was API-seeded. |
| Shape protection proves the full render/export path | The test authors text, size, and color; checks canvas text/size and persisted color (`:34–74`). It does not inspect generated color or export. Keep that narrower claim. |
| Offline failure proves the portable exporter/runtime boundary | The helper fetches `/api/presentations/:id/export` (`present-offline-helpers.js:27`). That route sends raw `generateRevealHTML` output (`server/routes/presentations-pptx.js:234–247`), bypassing `onExportOffline` and its asset closure (`use-export-actions.js:202–215`). The observed Reveal timeout precedes gameplay. |
| Present identity passes prove runtime mounting | Assertions establish attached subtype markers and child navigation (`presentation-baseline.spec.js:152,173–174`), not interactive runtime instances or independent state. |
| “fanout (37 tests)” and “git status clean” | The 37 reported passes combine fanout **and defaults** suites. The report also explicitly records untracked files. Use exact suite totals and distinguish clean tracked baseline from an entirely clean worktree. |

These affect `reports/baseline-evidence.md:70–80,105–114`. Keep the useful evidence; retract the blanket “every failure is at the planned feature boundary.”

At this scout, `ELEMENT_DEFAULTS.image.longDescription` **already exists** (`element-defaults.js:25`). Historical missing-field RED is not current GREEN evidence.

### 3. Reuse alignment, with explicit safety boundaries

**Geometry reuse is correct.** `use-slide-operations.js:204–295` already handles rotated AABBs, filters locked elements, preserves the fewer-than-two-free-elements no-op, and updates dependent connectors in the same mutation.

Routing already exists:

- `editor-ribbon.jsx:38` supplies `onAlignElements`.
- `ribbon-panel.jsx:49` forwards props.
- Format’s signature omits that prop, and its alignment handlers emit coordinate updates (`ribbon-format-tab-element-position-size-rotation-controls.jsx:212,352–380`).

The minimal correction is at Format: dispatch multi left/right directly and map center to `center-h`; retain the single-selection path and manual numeric delta path. No extra wrapper convention or second geometry algorithm.

| Risk | Required boundary |
|---|---|
| **Double application** | One gesture invokes either alignment or coordinate fanout—not both. Prove pointer and Enter/Space outcomes against state, including one undo restoring the entire selection. |
| **Locks / lone survivor** | Preserve hook no-op after filtering below two free elements (`:206–217`). A multi-selection leaving one free element must not fall back to single slide-edge alignment. |
| **Groups** | Alignment lacks the `hasBlockedGroupMutation` check used by controller fanout and other operations. UI availability blocks locked/hidden groups (`editor-command-availability.js:19–29`), but direct operation reuse bypasses controller protection. Prove every activation retains that boundary; if an actual bypass is reproduced, reuse the existing group guard rather than inventing new group semantics. |
| **Group interpretation** | Current alignment works on individual selected members, not group bounding boxes. Do not silently change it to whole-group translation or a new group alignment policy. |
| **Master / vertical routing** | Keep `mapAuthoringTarget` and `getAuthoringSlide` supplied by `EditorPage.jsx:343–352`. Prove child edits leave parent/siblings unchanged and master edits target `layoutMasters.fixedElements`, not ordinary slide elements. |
| **Master locks** | Master authoring deliberately projects elements unlocked; its mapper writes transformed unlocked copies (`use-editor-layout-controller.js:56–64,105–119`). Normal lock filtering does not prove master lock preservation. Record actual persistent and unselected-element behavior; do not silently alter that policy. |
| **History / stale selection** | History captures presentation snapshots with 500ms coalescing (`use-editor-history-controller.js:55–75`). One setter call alone does not prove one undo unit. Exercise undo/redo, subsequent selection changes, and save/reload with real history. |
| **Single / rotated / connectors** | Retain actual resolution-aware single alignment. Qualify rotated and off-canvas behavior, plus connector endpoint updates and undo; do not infer these from unrotated X assertions. |

## Minimal all19 audit

“All19” cannot mean one unchanged fixture per type or alignment/description alone.

For **each canonical type**, record the Phase02 field groups through:

**actual control write → defaults ownership or rich-content ownership → stored JSON → undo/redo and save/reload → canvas → generated Present and applicable HTML export.**

Minimum receipts:

- Enumerate from `Object.keys(ELEMENT_DEFAULTS)`; retain 19 canonical discriminators.
- Identify control labels/test IDs, changed values, owning field, and observable rendered outcome. API-seeded fixtures establish setup—not control authoring.
- Cover every field group named in Phase02. Mark genuinely inapplicable paths explicitly; do not substitute renderer-internal defaults.
- Include heterogeneous/legacy ownership negatives, locks, decorative image clearing and valid description associations.
- Preserve TipTap marks/paragraph attributes, shape rich labels/style/geometry, table nested structures, timeline legacy dates, game nested config, and line connections.
- Prove audio with a real changed resource, reloaded `currentSrc`, and observable playback—not URL text alone.
- Exercise actual Present, preview, authorized fixture share, and supported portable export. Record known future-phase runtime limits without claiming parity.
- Cover 320/768/desktop, keyboard and touch with targetable controls and geometry receipts.
- Keep new/split production modules below 200 LOC. Update proved docs/changelog after smoke. `docs/feature-coverage-matrix.md` is generated by `scripts/feature-inventory/build-matrix.mjs:184–192`; do not hand-promote cells.

## What to avoid / alternatives

- **Avoid:** changing `buildSelectionUpdates` X/Y semantics to fix alignment. That breaks numeric edits and relative layout.
- **Avoid:** putting `longDescription` in `COMMON_KEYS`, recreating existing Shape/TipTap controls, or treating callback dispatch assertions as behavioral proof.
- **Preferred:** minimal Format routing into the existing operation.
- **Rejected alternative:** a second alignment algorithm. It duplicates rotation, connectors, lock filtering, and effective-slide behavior.
- **Conditional alternative:** harden the existing operation’s group guard only for a demonstrated boundary failure; do not broaden the slice speculatively.

## Work checklist and go/no-go

**GO for continued Phase02 correction:** accepted bounds contract, supplied intentional REDs, existing geometry operation, and identified Format routing gap.

**Before accepting Phase01’s baseline gate:** correct the contradictory expectation and inaccurate evidence classifications. This is evidence repair, not a waiver.

**NO-GO for Phase02 acceptance** until corrected geometry, ownership, single-resolution behavior, group/lock boundaries, master/child routing, history, all19 receipts, and actual generated/export smoke are satisfied. Missing required cells stay unmet—not “limitations” that permit completion.

Expected preimplementation REDs are not failed-GREEN events. Unexpected failure after claiming the change ready requires exact command/output and owning-boundary analysis, not suppression or narrowed acceptance.

## Assumptions

- **High confidence:** selection bounds are authoritative; Phase02 and execution contracts explicitly agree.
- **High confidence:** reported run outcomes are accepted observations; no checks were rerun.
- **Medium confidence:** source is changing during orchestration. These citations describe the inspected snapshot, not a frozen implementation or verified GREEN revision.