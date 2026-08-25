---
title: "Phase 12: Integrated Release, Documentation, and Rollback Gates"
status: completed
---

# Phase 12: Integrated Release, Documentation, and Rollback Gates

## Goal

Prove the combined migration and feature set end to end, reconcile capability claims/docs, remove transitional scaffolding, and leave explicit rollback boundaries.

## Dependencies

- Phases 02, 06, 07, 08, 10, and 11 complete.
- Phase 03 is transitively required by media/action/layout render paths.

## Accepted Phase 06–11 Capability Evidence

These are editor-core executable contract-layer smoke capabilities. Their behavioral tests use `[cap:<id>]` annotations; the feature inventory/matrix is generated from canonical sources and must not be hand-edited.

| Capability | Contract claim |
| --- | --- |
| `media.accessibility` | Browser semantics for image alternatives and media metadata; explicit PPTX limits. |
| `action.element-runtime` | Validated action dispatch outside edit mode; unsafe or unresolved actions inert. |
| `connector.smart-geometry` | Resolved same-slide connector endpoints retain finite fallback coordinates. |
| `layout.master-resolution` | Shared effective layout/master resolution across editor and rendering paths. |
| `control.ribbon.responsive` | Compact, standard, and wide Ribbon/workspace behavior with coarse-pointer support. |
| `runtime.reveal6-assets` | Canonical Reveal.js 6.0.1 manifest-owned `/vendor/reveal.js/dist` asset closure. |
| `export.action-pptx` | Browser-only action omitted and warned; no native-action assertion. |
| `export.connector-pptx` | Resolved native line plus attachment-semantics warning. |
| `export.layout-pptx` | Resolved layout objects flatten and warn; no native master is synthesized or claimed. |
| `export.media-pptx` | Image alt native when supported; semantic/fallback warnings for unsupported media behavior. |

Cleanup audit fact: no obsolete native prompt, temporary feature flag, migration debug branch, test-only production hook, or dual Reveal runtime path was found. Compatibility migrations and explicit fallbacks remain intentional.

The earlier absent literal July plan references map, without rewriting history, to `plans/archive/260709-0917-verified-element-control-interaction-defects-deep-tdd/` and `plans/archive/260705-1430-element-capability-source-of-truth-remediation-deep-tdd/`.

## Integration Matrix

### State and persistence

- Legacy/current package-store startup, writer reclaim, predecessor fallback, all publish fault points, second restart, outbox drain ordering.
- Legacy/new presentation JSON, malformed metadata, server validation, autosave/reload, conflict recovery, archive round-trip.

### Editor behavior

- Every canonical element type in Properties and Format.
- Keyboard ownership, prompts, labels/help, locks, groups, multi-selection, duplicate/copy/paste/delete, undo/redo.
- Parent and vertical child slides for media, actions, connectors, and linked layouts.
- Master edit/apply/change/detach and responsive Ribbon at 320/768/1024/coarse pointer.

### Runtime/export

- Reveal 6 present, preview iframe, share, live navigation, notes, fragments, themes, optional plugins, overview/scroll/auto-slide.
- Offline HTML with network disabled.
- PDF/raster and PPTX native/flattened/warned paths.
- Electron prepared runtime closure and version receipt.

### Security/accessibility

- Unsafe URL/media/action corpus, missing references, escaped generated HTML, opener isolation, no arbitrary selectors/scripts.
- Keyboard-only complete authoring/presentation flows, unique accessible names, focus trap/restore, hotspot focus visibility, captions/alt semantics, reduced motion.

## RED / Release Claim Tests

- [x] Extend feature inventory and compatibility matrices before implementation claims: Action/Hotspot, Smart Connector, media accessibility, layout/master flattening, and Reveal 6 assets must initially fail completeness gates.
- [x] Add explicit export claim rows that distinguish native, rendered, flattened, warned, and unsupported behavior.
- [x] Add a runtime closure gate that fails on stale Reveal 5 path/version or missing Reveal 6 plugin asset.
- [x] Add an end-to-end deck fixture combining all new metadata so cross-feature ID/ordering/URL/vertical-slide interactions are exercised.

## GREEN

- [x] Update `scripts/feature-inventory/*` sources and generated matrix artifacts from canonical registries; do not hand-edit generated output.
- [x] Update `README.md`, `docs/codebase-summary.md`, `docs/system-architecture.md`, `docs/design-guidelines.md`, and the existing changelog with the accepted Phase 06–11 behavior and limits.
- [x] Document the exact Reveal version/asset layout, action URL policy, connector flattening, layout/master limitations, media accessibility behavior, browser/touch contracts, and the package-store forward-only boundary.
- [x] Record the cleanup audit; retain intentional compatibility migrations and explicit fallbacks.
- [x] Reconcile the overlapping July references to their archived evidence paths without rewriting historical completion evidence.

## Required Commands

Focused phase suites run first, then the integrated gates:

```bash
npm test
npm run matrix:gate
npm run test:audit
npm run lint
npm run build
npm run docs:build
npm run vendor
npm run runtime:verify
```

Run focused browser suites for editor interactions, actions, connectors, layouts, Reveal presentation/offline, accessibility, and touch. Then run the repository E2E suite where the environment supports its declared prerequisites.

Run applicable PPTX package/export smoke and browser audit. External Docker/LibreOffice/PPTX-oracle prerequisites owned by `plans/260820-0235-full-codebase-review/` remain separate; do not claim them green unless actually executed.

## Manual/Browser Proof

- [x] Headed desktop: create one deck using every new control, present it, reload it, export offline, and inspect PPTX warnings/output.
- [x] Headed tablet/narrow: keyboard and touch through Ribbon, Properties, prompts, layout manager, action editor, connector controls, and media track rows.
- [x] Network-disabled offline and packaged runtime: no required external Reveal/plugin/media-track fetch.
- [x] Accessibility tree inspection: dialogs, tab list, repeated fields, action hotspot, connected line status, master/layout state, image/media descriptions.
- [x] Corrupt/missing target drills: invalid action, deleted connector target, missing layout, malformed track, and legacy state root all produce the specified safe behavior.

## Rollback Deliverables

- [x] Deployment notes state that package-store version-2 publication is forward-only; rollback binary must retain the v2 reader.
- [x] Reveal rollback is atomic across dependency, lock, vendor manifest/assets, generated paths, and Electron closure.
- [x] Presentation features are additive: older binaries may ignore metadata but must not strip it. Document which exports flatten or warn.
- [x] Keep fixture backups and generated package receipts out of production data paths.

## Success Criteria

- [x] All commands and focused browser scenarios above pass with recorded evidence.
- [x] No stale Reveal 5 asset or dual Reveal runtime path remains in the shipped-runtime contract; Reveal 6.0.1 is manifest-owned under `/vendor/reveal.js/dist`.
- [x] The combined deck survives save/reload/archive/offline/PPTX flows without silent data loss.
- [x] Every feature/capability claim has a matching behavioral test and matrix row.
- [x] Documentation records observed behavior and limitations without external PPTX-oracle claims.
- [x] Historical July plan names are reconciled to the two archived evidence paths without rewriting their completion evidence.
- [x] Cleanup audit found no obsolete native prompt, temporary feature flag, migration debug branch, test-only production hook, or dual Reveal runtime path; intentional compatibility migrations/fallbacks remain.

## Risks / Rollback

- Cross-feature failures will cluster around shared element IDs, URL policy, effective-element resolution, and export flattening. Diagnose at those boundaries instead of adding per-feature exceptions.
- Full test success does not prove visual/touch behavior; headed browser evidence is mandatory.
- Environment-blocked external oracle checks must remain explicitly unresolved in the broader release plan, not converted into inferred success.