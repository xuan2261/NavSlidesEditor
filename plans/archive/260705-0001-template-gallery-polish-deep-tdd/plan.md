---
title: "TemplateGallery and Templates polish, refactor, and hardening"
status: pending
mode: deep
tdd: true
created: 2026-07-05
priority: P2
blockedBy: []
blocks: []
scope:
  - client/src/components/dashboard/TemplateGallery.jsx
  - client/src/components/dashboard/TemplatePreview.jsx
  - client/src/components/TemplatePickerModal.jsx
  - client/src/utils/template-filters.js
  - server/routes/marketplace.js
  - server/services/template-normalization.js
  - server/routes/templates.js
  - server/routes/presentations.js
---

# TemplateGallery and Templates polish, refactor, and hardening

## Overview

Deep TDD plan to polish the Templates experience without growing scope into a marketplace platform. The plan focuses on maintainability, stable data contracts, clearer UX, thumbnail reuse, and coverage across frontend and backend template flows.

## Problem Statement

Recent fixes made Templates safer, but the code still has structural debt:

- `TemplateGallery.jsx` owns fetch, favorites, filters, sorting, layout, badges, cards, and empty/loading UI.
- Template metadata is normalized defensively in multiple frontend places instead of having a single contract.
- `TemplatePreview.jsx` contains a private lightweight `SlideThumbnail` renderer that cannot be reused or tested directly.
- TemplateGallery UI labels and marketplace content language are mixed without a clear boundary.
- Tests cover critical regressions but not enough UX states such as favorites, clear search, empty state variants, thumbnail rendering, and card selection.

## Scope

### In scope

- Refactor TemplateGallery into smaller presentational components and one data hook.
- Add a shared frontend template metadata normalization helper.
- Improve TemplateGallery search/filter/loading/empty states.
- Extract reusable `TemplateSlideThumbnail`.
- Add TDD coverage per phase.
- Keep backend fixes compatible with current API shape.

### Out of scope

- Remote marketplace service.
- Pagination, analytics, ranking, popular/recommended templates.
- AI recommendation.
- Full visual redesign of dashboard.
- Changing trusted-author content model.
- Rewriting full `HomePage.jsx` template sections.

## Existing Context

| Area | Current state |
|---|---|
| Frontend | React 18, Vite, RTL/Vitest, Tailwind classes, dashboard components under `client/src/components/dashboard/` |
| Backend | Express, file-backed JSON storage, template marketplace route under `server/routes/marketplace.js` |
| Current safeguards | `withTemplates`, template validation schemas, built-in normalization, category-or-tag filter, live deleted guard |
| Relevant tests | `TemplateGallery.test.jsx`, `template-filters.test.js`, `marketplace.test.js`, `templates.test.js`, `presentations.test.js`, `socket-handler.test.js` |

## Recommended Approach

Use a small, layered refactor:

1. Stabilize metadata contract first.
2. Extract UI components and hook without changing behavior.
3. Polish UX states.
4. Extract thumbnail renderer.
5. Add integration/e2e coverage only after unit coverage is stable.

This follows KISS: improve the current model, do not invent a marketplace subsystem.

## Phase Roadmap

| Phase | Title | Priority | Dependencies | Goal |
|---|---|---:|---|---|
| 01 | Baseline contracts and characterization | P1 | [] | Lock current behavior before refactor |
| 02 | Template metadata normalization | P1 | [01] | Centralize frontend metadata defaults |
| 03 | TemplateGallery component split | P1 | [02] | Reduce component responsibility safely |
| 04 | Search, filter, and empty-state UX polish | P2 | [03] | Make user states clear and testable |
| 05 | Template preview thumbnail extraction | P2 | [03] | Reuse lightweight slide preview safely |
| 06 | Backend contract hardening pass | P2 | [02] | Ensure API normalization stays stable |
| 07 | E2E and regression gate | P2 | [04, 05, 06] | Validate user workflows end-to-end |

## Validation Strategy

Pre-implementation checkpoint:

```powershell
git status --short
```

Do not mix this plan's files with unrelated in-flight changes.

Run after each phase:

```powershell
npx vitest run <phase-specific-tests>
npm run lint -- --quiet
```

Main focused suite:

```powershell
npx vitest run client/src/components/dashboard/TemplateGallery.test.jsx client/src/components/dashboard/TemplateSlideThumbnail.test.jsx client/src/utils/template-filters.test.js server/routes/marketplace.test.js server/routes/templates.test.js server/routes/presentations.test.js
```

Run before completion:

```powershell
npm run test
npm run lint -- --quiet
```

Phase 07 / release gate:

```powershell
npx playwright test tests/e2e/templates.spec.js
```

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Refactor changes gallery behavior | Template selection/favorites break | Characterization tests first |
| Metadata normalization hides bad data | Silent template quality regressions | Backend schema tests + visible fallback rules |
| Thumbnail extraction loses visual parity | Preview cards become misleading | Dedicated thumbnail renderer tests |
| UI language changes surprise users | Mixed app language expectations | Keep chrome/action labels in existing app English; preserve Vietnamese metadata fields |
| Full test suite is slow | Slows iteration | Focused tests per phase, full suite at milestone |

## Success Criteria

- [ ] `TemplateGallery.jsx` becomes a coordinator, not a monolith.
- [ ] All template metadata rendering uses a normalized shape.
- [ ] Search/filter/favorites have tests for happy path and edge cases.
- [ ] Preview thumbnail renderer is reusable and tested.
- [ ] Backend marketplace/custom template API contracts remain backward compatible.
- [ ] Focused tests pass after every phase.
- [ ] Full `npm run test` and `npm run lint -- --quiet` pass before implementation is considered complete.

## Open Questions

None. Default TemplateGallery chrome/actions to existing app English labels, while preserving Vietnamese marketplace data fields such as `name` and `titleVi` when provided.
