# Phase 02 - Upstream Candidate Matrix

## Context Links

- [Plan](./plan.md)
- [Research report](./research/upstream-feature-audit-research.md)
- Upstream branches: `upstream/main`, `upstream/dev`, `upstream/feature/grid-and-axis-tools`

## Overview

- Priority: P0
- Status: Complete
- Estimate: 5h
- Goal: produce an auditable keep/port/adapt/skip/defer matrix before code changes.

## Key Insights

- Source commits touch structurally different files.
- Candidate value must be judged by local product fit, not upstream recency.
- Direct cherry-pick is exception, manual port is default.

## Requirements

- For each candidate, record:
  - upstream commit hash
  - topic
  - changed upstream files
  - local matching files
  - decision: `already-aligned`, `port`, `adapt`, `skip`, `defer`
  - risk
  - test gate
- Include read-only scan of `upstream/dev` and `upstream/feature/grid-and-axis-tools`.
- Explicitly skip SaaS/billing/auth unless user changes scope.

## Architecture

Matrix drives implementation order:

```text
Candidate Matrix
  -> Batch A: export/html/embed bugfixes
  -> Batch B: editor UX micro ports
  -> Batch C: media polish audit
  -> Optional Epic: timeline
  -> Optional Epic: plugin architecture
```

## Related Code Files

- Read:
  - `shared/src/htmlGenerator.js`
  - `shared/src/element-renderers.js`
  - `client/src/components/properties/common-element-controls.jsx`
  - `client/src/components/properties/media-properties.jsx`
  - `client/src/components/canvas/element-renderers/latex-element-renderer.jsx`
  - `client/src/components/canvas/canvas-element-wrapper.jsx`
  - `server/index.js`
  - `server/services/storage.js`
- Create:
  - `plans/260514-1024-upstream-feature-audit-and-port-roadmap/reports/upstream-candidate-matrix.md`
- Modify: none code.
- Delete: none.

## Implementation Steps

1. Generate source commit inventory:
   ```powershell
   git log --oneline --no-merges upstream/main -n 120
   git log --oneline --no-merges upstream/dev ^upstream/main -n 120
   git log --oneline --no-merges upstream/feature/grid-and-axis-tools ^upstream/main -n 80
   ```
2. For each candidate, inspect:
   ```powershell
   git show --stat --oneline <commit>
   git show --name-only --oneline <commit>
   git show <commit> -- <upstream-file>
   ```
3. Map upstream paths to local paths:
   - `client/src/utils/generateHTML.js` -> `shared/src/htmlGenerator.js`, `shared/src/element-renderers.js`
   - upstream monolithic `server/index.js` -> local `server/routes/*`, `server/services/*`, `shared/src/*`
   - upstream `PropertiesPanel.jsx` changes -> local `components/properties/*`
4. Mark decisions:
   - `already-aligned`: local already has same behavior.
   - `port`: small, direct fit.
   - `adapt`: useful but needs local architecture rewrite.
   - `skip`: product mismatch.
   - `defer`: good idea but new epic.
5. Require user approval before implementing `defer` items.

## Todo List

- [x] Inventory `upstream/main`.
- [x] Inventory `upstream/dev` highlights.
- [x] Inventory `upstream/feature/grid-and-axis-tools` highlights.
- [x] Write candidate matrix report.
- [x] Mark accepted batches.

## Success Criteria

- No candidate proceeds without matrix row.
- Matrix explains why each skipped/deferred feature is not in current implementation.
- Batch boundaries are small enough for review.

## Verification

- Matrix includes at least these topics:
  - HTML embed reliability
  - px/em spacing mismatch
  - LaTeX font controls
  - fragment animations
  - video playback controls
  - timeline element
  - plugin loader/Manim
  - storage abstraction
  - SaaS/billing/auth skip

## Risk Assessment

- Risk: biased toward “new = good”.
- Mitigation: require local fit and test gate per row.

## Security Considerations

- Flag any candidate that changes trusted HTML, uploads, API auth, plugin execution, or external URLs.

## Next Steps

- Proceed to Phase 03 for accepted export/html candidates.

## Unresolved Questions

- None blocking. User approval needed for optional epics.
