---
title: "Validation Checklist"
type: report
created: 2026-05-13
---

# Validation Checklist

## Summary

Use this as phase exit checklist. Do not proceed if a phase fails build or core interaction tests.

## Global Verification

- `npm run build`
- `npm run test -- --run`
- `npm run test:e2e -- tests/e2e/smoke.spec.js`
- `npm run test:e2e -- tests/e2e/visual-regression.spec.js`
- Manual desktop viewport: 1440x900 and 1024x768.
- Manual narrow viewport: 375x812 for dashboard/modals only.
- Light and dark theme review.
- Keyboard: Tab, Shift+Tab, Enter, Escape through dashboard, modal, editor toolbar.

## Visual Acceptance

- Text contrast acceptable in light and dark.
- Focus ring visible.
- Active states not color-only where destructive/selected.
- No horizontal overflow in dashboard/modals.
- Slide canvas remains 16:9 and export pipeline untouched.

## Unresolved Questions

- None blocking.
