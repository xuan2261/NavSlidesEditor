---
phase: 7
title: "Slide Master Validation And Hybrid Design"
status: pending
priority: P2
effort: "3-5d validation, 2-3w follow-up if approved"
dependencies: [4]
---

# Phase 7: Slide Master Validation And Hybrid Design

## Context Links

- Brainstorm Feature 3: Hybrid Slide Master recommended.
- Audit correction: strategically strong but demand-unproven; validate before 5-week build.
- Code: `client/src/pages/EditorPage.jsx` has reserved `showMasterPanel` state.
- Code: `client/src/data/slide-templates.js`

## Overview

Validate whether Slide Master is worth building now. Produce a hybrid data model
and a small resolver prototype only if demand passes the gate.

## Key Insights

- Built-in templates may satisfy casual users; full master UI is expensive.
- Canvas decomposition should happen first to avoid compounding renderer/data-flow complexity.
- Export impact can be low if master content resolves before HTML/PPTX/PDF export.
- Hybrid model is safer than full PowerPoint parity.

## Requirements

- Functional: validate demand with concrete user/job stories before production build.
- Functional: define master/layout/override model and resolver behavior.
- Functional: if approved, prototype resolver with tests before UI.
- Non-functional: no full 5-week implementation in this phase without explicit go decision.
- Non-functional: preserve existing templates and standalone slides.

## Architecture

Proposed model for approved follow-up:

```text
presentation.slideMasters[]
  -> master default elements/background/theme
  -> layouts[]
slide.masterId + slide.layoutKey + slide.overrides
  -> resolveSlideContent(slide, presentation)
  -> editor/render/export receive resolved content
```

Z-index policy: master elements use low layer range; slide elements use normal
or higher layer range so user content remains editable on top.

## Related Code Files

- Read: `client/src/data/slide-templates.js`
- Read: `client/src/pages/EditorPage.jsx`
- Read: `shared/src/types/presentation.js`
- Read: `shared/src/htmlGenerator.js`
- Optional create after validation: `shared/src/slide-master-resolver.js`
- Optional create after validation: `shared/tests/slide-master-resolver.test.js`
- Optional modify after validation: `server/middleware/schemas.js`
- Optional modify after validation: `client/src/pages/EditorPage.jsx`
- Optional create after validation: `client/src/components/SlideMasterPanel.jsx`
- Delete: none.

## Implementation Steps

1. Define validation criteria: target users, repeated layouts pain, expected frequency, template insufficiency.
2. Review existing template usage and any user feedback/issues before coding.
3. Decide: `no-go`, `defer`, `resolver-only`, or `full follow-up plan`.
4. If no-go/defer, update roadmap with rationale and stop this phase.
5. If approved, write schema RFC for `slideMasters`, `layouts`, `masterId`, `layoutKey`, `overrides`, `brokenFromMaster`.
6. Prototype `resolveSlideContent()` as a pure shared helper.
7. Add resolver tests for inherit, override, break-from-master, missing master, z-index ordering.
8. Verify HTML/PPTX export can consume resolved slides without changing export internals.
9. Define UI follow-up plan: panel, master edit mode, layout tabs, break/reset controls.
10. Do not ship full UI until resolver and migration decisions are accepted.

## Todo List

- [ ] Demand validation completed.
- [ ] Go/no-go decision recorded.
- [ ] Hybrid data model documented if approved.
- [ ] Resolver tests written if prototype approved.
- [ ] Follow-up implementation plan created only if demand is real.

## Verification & Tests

If validation only:

```bash
npm run lint
npm run build
```

If resolver prototype is approved:

```bash
npm run test -- shared/tests/slide-master-resolver.test.js shared/tests/element-renderers.test.js
npm run build
```

If UI prototype is approved later:

```bash
npx playwright test tests/e2e/templates.spec.js tests/e2e/editor.spec.js tests/e2e/export.spec.js
```

## Success Criteria

- [ ] Slide Master is either explicitly deferred or approved with evidence.
- [ ] No large UI build starts without demand validation.
- [ ] Resolver behavior is deterministic and export-transparent if prototyped.
- [ ] Existing templates and exports remain unaffected.

## Risk Assessment

- Risk: building full Slide Master distracts from P0 refactor.
- Mitigation: dependency on Phase 4 and explicit go/no-go gate.
- Risk: data model creates migration complexity.
- Mitigation: add optional fields only; old decks load as standalone slides.

## Security Considerations

- Master elements must use same content safety rules as normal slide elements.
- No new remote resource loading in master backgrounds beyond existing image behavior.

## Next Steps

If approved, create a separate implementation plan for the full Slide Master UI.

## Unresolved Questions

- Do users actually need Slide Master now, or are templates enough?
- Should master elements be editable from normal slide mode or only master edit mode?
