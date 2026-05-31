# Phase 06 - Timeline Element Feasibility Gate

## Context Links

- [Plan](./plan.md)
- Relevant upstream commits: `9d3288ea`, `78b62e53`, `a6f42a8b`, `778a7646`, `fe5deaae`, `2ba20cd3`, `3471ab66`, `56067fde`, `2e280692`

## Overview

- Priority: P2 optional
- Status: Complete
- Estimate: 3h planning gate, 10h+ if implemented later
- Goal: decide whether upstream timeline element should become a NavSlidesEditor feature.

## Key Insights

- Local `AnimationTimeline.jsx` is fragment sequencing UI, not a content element.
- Upstream timeline is a slide element with events, date range, images, labels, export.
- Name collision and schema expansion risk are high.

## Requirements

- This phase is a gate, not implementation by default.
- Produce a mini-design if accepted:
  - element type name
  - data model
  - renderer
  - properties panel
  - export behavior
  - tests
- User approval required before implementation.

## Architecture Option If Accepted

```text
shared/types presentation.js
  -> TimelineElement
client/data/element-defaults.js
  -> default timeline object
client/components/canvas/element-renderers/timeline-element-renderer.jsx
  -> editor renderer
client/components/properties/timeline-properties.jsx
  -> event/date/image controls
shared/src/element-renderers.js
  -> present/export renderer
```

## Related Code Files

- Potential modify:
  - `shared/src/types/presentation.js`
  - `client/src/data/element-defaults.js`
  - `client/src/components/canvas/element-renderers/registry.js`
  - `client/src/components/InsertMenu.jsx`
  - `client/src/components/properties/timeline-properties.jsx`
  - `client/src/components/canvas/element-renderers/timeline-element-renderer.jsx`
  - `shared/src/element-renderers.js`
- Create if implemented:
  - timeline renderer/properties/tests.
- Delete: none.

## Implementation Steps

1. Feasibility only:
   - inspect upstream timeline commits.
   - map schema to local element model.
   - check overlap with existing charts/tables/callouts.
   - estimate file count and test count.
2. Write decision:
   - `defer`
   - `accept as new P2 element`
   - `reject`
3. If accepted, create separate plan:
   - do not mix with sync bugfix phases.

## Todo List

- [x] Inspect upstream timeline series.
- [x] Draft local schema proposal.
- [x] Estimate implementation/test cost.
- [x] Ask user for go/no-go.

## Success Criteria

- Clear go/no-go decision.
- No accidental timeline implementation inside sync branch.
- If accepted, separate plan exists.

## Verification

Planning gate only:
```powershell
git diff --stat
```

If implemented later, likely gates:
```powershell
npm run lint
npm run build
npm run test -- shared/tests/element-renderers.test.js
npm run test:e2e -- tests/e2e/element-properties.spec.js
npm run test:e2e -- tests/e2e/export.spec.js
```

## Risk Assessment

- Risk: UI complexity and schema debt.
- Mitigation: separate plan, explicit user approval.

## Security Considerations

- Timeline images/links follow existing image/media URL safety rules.

## Next Steps

- Proceed to plugin architecture feasibility gate.

## Unresolved Questions

- User decision: defer to separate P2 plan.
