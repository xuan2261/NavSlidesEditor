---
type: red-team-report
plan: plans/260705-0001-template-gallery-polish-deep-tdd/plan.md
date: 2026-07-05
status: completed
---

# Red-team review: TemplateGallery and Templates polish plan

## Summary

Plan is directionally good and KISS/YAGNI aligned. It correctly avoids a marketplace rewrite and focuses on TDD, refactor safety, metadata contracts, UX states, thumbnail reuse, backend hardening, and E2E regression. It is implementable, but should be tightened before `/ck:cook` so phases cannot drift into broad UI churn or duplicate test work.

## Verdict

**Pass with revisions recommended.** No blocker that invalidates the plan. Important refinements below should be incorporated before implementation.

## Critical Findings

None.

## Important Findings

### 1. Phase 03 may create too many tiny files too early

**Risk:** The proposed split creates 6 new modules in one phase. That can improve maintainability, but also risks "component confetti" if the abstractions are not stable.

**Affected files:** `phase-03-template-gallery-component-split.md`

**Recommendation:** Add a constraint: extract only when each component has a clear prop contract and at least one behavior/test reason. Start with `TemplateGalleryCard`, `TemplateGallerySidebar`, and `use-template-gallery-data.js`; defer `Grid/Header/EmptyState` extraction if it produces pass-through wrappers.

### 2. Phase 02 normalization boundary is underspecified

**Risk:** The plan says `TemplateGallery`, `HomePage`, and tests should normalize "where practical". That can lead to mixed normalized/raw data paths.

**Affected files:** `phase-02-template-metadata-normalization.md`

**Recommendation:** Define exact boundary:

- Normalize immediately after successful fetch in `use-template-gallery-data.js`.
- Normalize `HomePage` marketplace templates inside the existing marketplace `useMemo` or fetch setter.
- Keep backend responses unchanged.
- Ensure `filterMarketplaceTemplates` accepts raw input but internally normalizes each item.

### 3. Phase 04 language rule needs stronger acceptance tests

**Risk:** The plan now says UI chrome/action labels remain English while metadata can be Vietnamese. Good decision, but the tests should lock it.

**Affected files:** `phase-04-search-filter-empty-state-ux-polish.md`

**Recommendation:** Add success criteria:

- `Template Gallery`, `Loading...`, `Newest`, `Difficulty`, `Slide count`, `Close` stay English.
- Category names still render from `cat.name`.
- Template title still prefers `titleVi || title`.

### 4. Phase 05 thumbnail extraction should include accessibility and trust-boundary notes

**Risk:** `TemplateSlideThumbnail` uses trusted HTML rendering for text. This is acceptable per README trust model, but the plan should explicitly say not to sanitize/escape text content in thumbnail in a way that changes presentation fidelity.

**Affected files:** `phase-05-template-preview-thumbnail-extraction.md`

**Recommendation:** Add acceptance criteria:

- Preserve trusted-author `dangerouslySetInnerHTML` behavior for text previews.
- Ensure decorative thumbnails use `aria-hidden` or accessible labels where used as buttons/cards.
- Keep image `alt=""` unless the thumbnail itself is the accessible label wrapper.

### 5. Phase 07 E2E scope is still slightly vague

**Risk:** "Create-from-template path if helper is stable" is optional and may get skipped even though it is the most important user flow.

**Affected files:** `phase-07-e2e-and-regression-gate.md`

**Recommendation:** Make the create-from-template E2E mandatory unless the existing test is already covering it. If skipped, require a written reason in implementation notes.

## Minor Findings

### 1. Plan status could mention known existing unrelated changes

The repo currently has other modified/untracked files unrelated to this plan. Add a pre-implementation checkpoint to run `git status --short` and avoid mixing changes.

### 2. Phase 06 overlaps with already-completed backend hardening

Some Phase 06 items have already been implemented in prior fixes. Keep it as a verification/hardening pass, but mark steps as "confirm or add missing coverage" instead of assuming all are absent.

### 3. Validation strategy should include exact focused command for all affected frontend files

Add this focused command to the overview:

```powershell
npx vitest run client/src/components/dashboard/TemplateGallery.test.jsx client/src/components/dashboard/TemplateSlideThumbnail.test.jsx client/src/utils/template-filters.test.js server/routes/marketplace.test.js server/routes/templates.test.js server/routes/presentations.test.js
```

## Red-team recommendation

Before implementation, update phase files with the five Important refinements. After that, the plan is safe to hand to `/ck:cook --tdd`.

## Unresolved Questions

None.
