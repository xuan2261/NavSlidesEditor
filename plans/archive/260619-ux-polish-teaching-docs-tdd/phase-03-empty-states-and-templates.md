---
phase: 3
title: "Empty States And Templates"
status: completed
priority: P1
effort: "1.5-2d"
dependencies: [1]
---

# Phase 3: Empty States And Templates

## Overview

Polish dashboard/editor entry points so users can quickly start with teaching-friendly content and recover from empty/search/no-template states.

## Requirements

- Functional: dashboard empty states provide one primary CTA and one secondary route at most.
- Functional: search-empty, loading, error, trash-empty, template-empty, and marketplace-empty states remain visually/semantically distinct.
- Functional: template cards are keyboard activatable and screen-reader understandable.
- Functional: highlight existing interactive simulation/quiz/teaching templates without changing template schema.
- Non-functional: avoid backend changes; use current template data where possible.

## Architecture

HomePage owns dashboard state and template views. This phase should prefer component extraction only if tests reveal repeated empty-state UI; otherwise keep changes local and small.

## Related Code Files

- Modify: `client/src/pages/HomePage.jsx`
- Modify: `client/src/data/slide-templates.js`
- Modify: `client/src/data/slide-templates.test.js`
- Avoid: `server/data/templates.json` unless the user explicitly approves a separate data-only scope
- Modify: HomePage component tests or add focused tests under `client/src/pages/__tests__/`
- Modify: targeted dashboard Playwright tests if existing patterns support it

## Implementation Steps

1. Add failing tests for empty vs loading vs search-empty dashboard/template states.
2. Add failing keyboard activation test for template cards.
3. Improve copy/CTA hierarchy for no decks, no custom templates, no marketplace results, and search-empty.
4. Surface existing teaching/interactive template category labels without schema migration or server data edits.
5. Verify create-from-template and create-blank flows are unchanged.

## Success Criteria

- [x] Empty states show clear next action and do not mask loading or errors.
- [x] Template cards can be reached and activated by keyboard.
- [x] Existing template creation behavior is unchanged.
- [x] No server data migration is required.
- [x] No default server template data changes are made without explicit approval.

## Risk Assessment

Risk: HomePage is large and brittle. Mitigation: keep changes local or extract one small presentational component only if it reduces duplication.

Risk: template metadata drift. Mitigation: do not require new persisted fields; infer from existing categories/titles where possible.
