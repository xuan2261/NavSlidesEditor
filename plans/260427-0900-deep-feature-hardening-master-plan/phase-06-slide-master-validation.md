---
phase: 6
title: "Phase 7: Slide Master Validation & Hybrid Design"
status: deferred
priority: P2
effort: "2d validation, 2-3w follow-up if approved"
dependencies: [3]
reason: "showMasterPanel reserved but never wired; 20 slide layouts exist; demand not validated"
---

# Phase 6: Slide Master Validation & Hybrid Design

## Context Links

- Predecessor: Phase 3 (canvas decomposition) — canvas decomposition should be stable before adding master/layout complexity
- Code: `client/src/pages/EditorPage.jsx` (has `showMasterPanel` state — reserved for this feature)
- Code: `client/src/data/slide-templates.js`
- Docs: `docs/project-roadmap.md`

## Overview

Validate whether Slide Master is worth building now. Produce a hybrid data model
and a small resolver prototype **only if demand passes the gate**. No full UI build
without explicit go decision.

**Priority: P2** — gated until Phase 3 completes.

## Key Insights

- Built-in templates may satisfy casual users; full master UI is expensive (2-3w).
- Canvas decomposition must happen first to avoid compounding renderer/data-flow complexity.
- Export impact can be low if master content resolves before HTML/PPTX/PDF export.
- Hybrid model (master + layouts + overrides) is safer than full PowerPoint parity.

## Decision Gate

This phase produces a **validation decision**, not a feature:

| Decision | Action |
|----------|--------|
| **no-go** | Document rationale, mark deferred in roadmap, stop |
| **defer** | Document why, set revisit trigger |
| **resolver-only** | Prototype `resolveSlideContent()` with tests; no UI |
| **full** | Create separate implementation plan with full scope |

## Requirements (Validation Phase)

- Functional: define target users and pain points with evidence (issues, support requests, user feedback).
- Functional: define master/layout/override model and resolver behavior.
- Functional: if approved, prototype resolver with tests before any UI.
- Non-functional: no full 5-week implementation without explicit go decision.
- Non-functional: preserve existing templates and standalone slides.

## Architecture (if Approved)

Proposed model for resolver prototype:

```js
// shared/src/slide-master-resolver.js
presentation.slideMasters = []
  // master default elements/background/theme
  // layouts[]

slide.masterId + slide.layoutKey + slide.overrides
resolveSlideContent(slide, presentation)
  // returns resolved content for editor/render/export

// Z-index policy:
// master elements: low layer range
// slide elements: normal or higher layer range
// user content always editable on top
```

## Related Code Files

- Read: `client/src/data/slide-templates.js`
- Read: `client/src/pages/EditorPage.jsx` (find `showMasterPanel`)
- Read: `shared/src/types/presentation.js`
- Read: `shared/src/htmlGenerator.js`
- Optional create: `shared/src/slide-master-resolver.js` (if approved)
- Optional create: `shared/tests/slide-master-resolver.test.js` (if approved)

## Implementation Steps

### Validation Only (Phase 6 itself)

1. Define validation criteria:
   - Target users: who needs repeated layouts? (corporate, education, recurring decks)
   - Pain frequency: how often do they copy-paste slides vs use templates?
   - Current workaround: are they already using copy-paste master slides?
   - Template insufficiency: what can templates NOT do that masters would?

2. Review evidence:
   - GitHub issues tagged with "slide master", "layout", "template"
   - User feedback in discussions
   - Template usage analytics if available

3. Make decision: no-go / defer / resolver-only / full

4. Document decision and rationale in roadmap.

### If Approved (Resolver Prototype)

5. Write schema RFC for: `slideMasters`, `layouts`, `masterId`, `layoutKey`, `overrides`, `brokenFromMaster`.

6. Prototype `resolveSlideContent()` as pure shared helper:
   - Input: slide + presentation (with masters/layouts)
   - Output: resolved elements array
   - Handle: inherit from master, inherit from layout, override in slide, break-from-master

7. Add resolver unit tests:
   - Inherit: element appears from master
   - Override: slide-level override wins
   - Break: `brokenFromMaster: true` removes master element
   - Missing master: graceful fallback to standalone slide
   - Z-index ordering: master below slide content

8. Verify HTML/PPTX/PDF export can consume resolved slides without changing export internals.

9. Define UI follow-up plan: panel, master edit mode, layout tabs, break/reset controls. Do NOT implement in this phase.

## Todo List

- [ ] Demand validation completed (target users, pain frequency, evidence)
- [ ] Decision made: no-go / defer / resolver-only / full
- [ ] Decision documented in roadmap
- [ ] Schema RFC written if approved
- [ ] Resolver prototype created if approved
- [ ] Resolver unit tests written if approved
- [ ] Export transparency verified if approved

## Verification Commands

Validation only:
```bash
npm run lint
npm run build
```

If resolver prototype approved:
```bash
npm run test -- shared/tests/slide-master-resolver.test.js
npm run build
```

If UI prototype approved later:
```bash
npx playwright test tests/e2e/templates.spec.js tests/e2e/editor.spec.js tests/e2e/export.spec.js
```

## Success Criteria

- [ ] Slide Master is either explicitly deferred or approved with evidence
- [ ] No large UI build starts without demand validation
- [ ] Resolver behavior is deterministic and export-transparent if prototyped
- [ ] Existing templates and exports remain unaffected

## Risk Assessment

- Risk: building full Slide Master distracts from P0 refactor.
  - Mitigation: explicit P2 gate and dependency on Phase 3.
- Risk: data model creates migration complexity.
  - Mitigation: add optional fields only; old decks load as standalone slides.

## Security Considerations

- Master elements must use same content safety rules as normal slide elements.
- No new remote resource loading in master backgrounds beyond existing image behavior.

## Next Steps

If approved, create a separate implementation plan for full Slide Master UI.
If not approved, proceed to Phase 7 (PDF import spike).
