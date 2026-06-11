---
title: "Element and Control Functional Fixes (TDD)"
status: pending
created: 2026-06-09
mode: deep
tdd: true
scope: project
blockedBy: []
blocks: []
---

# Element and Control Functional Fixes (TDD)

## Goal

Fix the element/control functional defects found by the 2026-06-09 read-only
audit (3 streams: element×control matrix, E2E coverage gaps, control→export
fidelity). Every defect carries file:line evidence from the audit reports. TDD:
each phase writes failing tests first, then fixes until green.

## Source of Truth

- Backlog + locked decisions: `plans/260609-0730-element-control-functional-audit/audit-summary-and-backlog.md`
- Stream reports: same dir `/reports/` (A=matrix, B=e2e, D=export).
- Reconciled finding: opacity is a **real** global no-op (Stream D correct,
  Stream A miscited) — verified at `canvas-element-wrapper.jsx:96-114` (no
  `opacity` key). Stream A's "Opacity WORKS" row is retracted.

## Locked Decisions (user, 2026-06-09)

1. **video `src`/`videoUrl` → unify to `src`** with back-compat read
   (`videoUrl || src`) + load-time migration. [Phase 2]
2. **markdown fontSize/textColor → genuine gap**, wire renderer + controls. [Phase 2]
3. **timeline `connectorOffset` → missing**, add control, LOW priority. [Phase 4]
4. **indeterminate → build read-side plumbing ONCE**, apply to high-impact
   controls first (opacity, X/Y, W/H, rotation, colors); rest fast-follow. [Phase 3]
5. **6 inherent export limits → document only**, no workarounds; only the 13
   fixable mapping gaps are in scope. [Phase 5]

## Phases

| # | Phase | Defects | Priority | Status |
|---|-------|---------|----------|--------|
| 1 | [Global Render-Mapping Fixes](phase-01-global-render-mapping-fixes.md) | opacity (content-layer), code-radius, image flip | P0 | completed |
| 2 | [Dead and Wrong Controls](phase-02-dead-and-wrong-controls.md) | line-fill (ribbon), video-src unify, markdown hardcode (canvas+reveal) | P0 | completed |
| 3 | [Indeterminate Multi-Select State](phase-03-indeterminate-multi-select-state.md) | systemic mixed-value read-state | P0 | completed |
| 4 | [Missing Property Controls](phase-04-missing-property-controls.md) | saturation, chart area/stacked, table hdr/border, svg edit+harden, timeline connector, panel-opacity | P1 | completed |
| 5 | [Export Fidelity and Documented Limits](phase-05-export-fidelity-and-documented-limits.md) | image border reveal, table merge (shared resolver) + docs (incl. chart-rotation inherent) | P1 | completed |
| 6 | [E2E Safety Net](phase-06-e2e-safety-net.md) | 5 browser specs for shipped fixes | P1 | completed |

## Execution Order

1 (one-line wins, broad impact) → 2 (dead/wrong) → 3 (indeterminate plumbing) →
4 (missing controls, adopt Phase-3 pattern) → 5 (export + docs) → 6 (E2E).

**Coupling note:** Phases 2 (markdown) and 4 ADD controls; Phase 3 establishes
the indeterminate read-side pattern. New controls from 2/4 must adopt that
pattern. Since 2 lands before 3, the markdown controls get indeterminate in
Phase 3's high-impact sweep (or noted fast-follow). Phase 4 controls (after 3)
adopt it directly.

## Key Dependencies

- Vitest + @testing-library/react — already in repo.
- Renderers: canvas `client/src/components/canvas/element-renderers/` + wrapper
  `canvas-element-wrapper.jsx`; reveal `shared/src/element-renderers.js`; pptx
  `client/src/utils/export-pptx-basic-renderers.js`.
- Controls: `client/src/components/PropertiesPanel.jsx` (router 19-49) + sub-panels
  `client/src/components/properties/*` + ribbon `components/ribbon/*`.

## Global Success Criteria

- [ ] Every P0/P1 backlog item has a failing-first test then a fix (or documented non-fix for inherent limits)
- [ ] `npm run test` green; `npm run lint` clean; `npm run build` succeeds
- [ ] No double-applied props (opacity on shape) and no regression to single-select edits
- [ ] 6 inherent export limits documented in `./docs`; not attempted as fixes
- [ ] 5 new/extended E2E specs added (autosave-flush first)
