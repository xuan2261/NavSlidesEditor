# Fix Tailwind Migration Regressions — Complete Remediation

## Overview

Khắc phục toàn bộ 21 issues phát sinh sau Tailwind CSS migration, bao gồm: mất CSS definitions (5 components), invalid Tailwind tokens (~15 files), logic bugs (1), overflow clipping (2), và spacing issues (1).

**Source:** [Comprehensive Audit Report](file:///C:/Users/Z10PAD8C_Xuan2261/.gemini/antigravity/brain/5ae33091-c669-49f0-8098-b275fb8203e2/comprehensive_code_audit.md)

## Phases

| Phase | Name | Status | Priority | Files |
|-------|------|--------|----------|-------|
| 1 | [Convert Broken Components to Tailwind](./phase-01-convert-broken-components.md) | Pending | P1 | SlideSorterView, TransitionPreview, SlidePanel |
| 2 | [Fix Logic Bugs & Overflow Issues](./phase-02-fix-logic-and-overflow.md) | Pending | P1 | EditorPage, InsertMenu, SlidePanel |
| 3 | [Standardize Tailwind Tokens](./phase-03-standardize-tailwind-tokens.md) | Pending | P2 | ~15 files |
| 4 | [Fix Minor CSS & Animation Issues](./phase-04-fix-minor-css-animations.md) | Pending | P3 | Toolbar, HomePage, TemplatePickerModal |
| 5 | [Verification & E2E Testing](./phase-05-verification-testing.md) | Pending | P1 | All |

## Dependencies

- `blockedBy: [20260421-1920-tailwind-full-migration]` (completed)
- Phase 5 depends on Phase 1-4

## Risk Assessment

- **Low:** Most fixes are CSS class replacements — no logic changes
- **Medium:** InsertMenu overflow fix requires structural JSX change
- **Medium:** SlideSorterView has drag-and-drop states that need Tailwind conditional classes
