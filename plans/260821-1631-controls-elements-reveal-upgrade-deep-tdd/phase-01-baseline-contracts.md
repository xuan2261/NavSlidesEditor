---
title: "Phase 01: Baseline, Fixtures, and Contract Lock"
status: completed
---

# Phase 01: Baseline, Fixtures, and Contract Lock

## Goal

Freeze the observable legacy contracts and reusable fixtures before any schema, runtime, or UI migration. This phase prevents later green tests from accidentally proving a narrowed or rewritten behavior.

## Dependencies

- None.

## Files and Artifacts

- Modify focused existing tests only where a missing characterization is required.
- Add reusable fixtures under existing test fixture directories, not production data directories.
- Record baseline commands/results in the implementation journal configured by the repository; do not place generated binaries in the plan directory.
- Reference, do not rewrite: `plans/reports/260713-elements-controls-interactions-audit-report.md`.

## RED: Characterization Gaps

- [x] Add a package-store fixture representing a valid historical root/index/head chain that predates `matrixAuthorityEpoch` but has correct hashes and predecessor metadata.
- [x] Add corrupt/ambiguous variants: bad hash, missing required structural field, mixed authority values, unsupported future version, and predecessor chain containing both legacy and current shapes.
- [x] Add generated-HTML fixtures covering horizontal/vertical slides, fragments, notes, highlight, themes, presenter tools, iframe preview, and optional Reveal plugins.
- [x] Add presentation fixtures with every canonical element type, vertical child media, groups, locks, rich links, free lines, and legacy slides without action/layout/media-accessibility fields.
- [x] Add behavior characterization for ELC-001 and ELC-005 that fails against the current source for the documented reason.
- [x] Add browser smoke seeds for keyboard-only editor control traversal and narrow Ribbon navigation; do not assert the proposed fix yet.

## GREEN: Baseline Harness

- [x] Create deterministic fixture builders for slide IDs, element IDs, package-store hashes, and fault injection.
- [x] Reuse the same fixture builders across unit, browser, offline, PPTX, and recovery suites.
- [x] Verify current passing behavior for unaffected legacy decks and exports before upgrading dependencies.
- [x] Pin the exact Reveal source version in fixture receipts so later tests distinguish project code changes from runtime changes.

## REFACTOR

- [x] Remove duplicate ad hoc test object builders when the shared fixture covers the same contract.
- [x] Keep fixtures minimal: no captured secrets, user data, oversized binaries, or current `server/data` copies.
- [x] Document which fixtures are normative contracts versus adversarial input.

## Focused Verification

Run the smallest relevant files while establishing each fixture, then:

```bash
npm test -- server/services/pptx-import/package-store/package-store.test.js server/services/pptx-import/package-store/state-root-bounded-chain.test.js
npm test -- client/src/utils/element-update-fanout.test.js client/src/components/SlideCanvas.test.jsx
npm test -- shared/tests/htmlGenerator.test.js shared/tests/element-renderers.test.js client/src/utils/offlineExport.test.js
```

If an exact path differs, resolve it from the existing suite and update this phase before implementation; do not create a parallel duplicate suite.

## Success Criteria

- [x] Every later phase has a named legacy, positive, negative, and cross-surface fixture.
- [x] ELC-001 and ELC-005 are reproducibly RED.
- [x] Legacy unaffected presentation/render/export behavior is captured and green.
- [x] Fixture hashes and IDs are deterministic across Windows CI and local runs.
- [x] No production source or dependency version changes occur in this phase.

## Risks / Rollback

- Over-broad snapshots create brittle tests. Assert semantic DOM, generated attributes, state transitions, package contents, and warnings instead of entire HTML/binary equality.
- A current green test may expose an inaccurate audit claim. Treat runtime/source evidence as authoritative and amend the plan contract before proceeding.
- Rollback is deletion of the new fixtures/tests only; no persisted state is touched.

## Work Log

- Fixtures: deterministic legacy package-state hashes/IDs, all 19 element types, vertical child media, groups/locks/rich links/free lines, legacy metadata absence, and 320/768/1024 Ribbon seeds.
- RED: `npx vitest run client/src/components/SlideCanvas.test.jsx client/src/utils/element-update-fanout.test.js` — 5 intended failures: `select`, `button`, contenteditable, and media controls lose Delete ownership; fresh image optional fields fan out as `[]`.
- Baseline: `npx vitest run client/src/data/editor-contract-fixtures.test.js shared/tests/html-generator-contract-fixtures.test.js` pins installed Reveal `5.2.1` and generated horizontal/vertical/notes/fragments/highlight/presenter-plugin semantics.
