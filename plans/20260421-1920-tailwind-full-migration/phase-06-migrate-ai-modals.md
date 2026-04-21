---
phase: 6
title: "Migrate AI Modals"
status: pending
priority: P2
effort: "3h"
dependencies: [1]
---

# Phase 6: Migrate AI Modals

## Overview
Migrate the complex AI-driven modal interfaces (`AICopywriterModal`, `AIGeneratorModal`, `AITranslateModal`) from `modals.css` to TailwindCSS.

## Requirements
- Functional: Chat interfaces, settings toggles, and generation preview areas inside these modals must maintain their complex layouts.
- Non-functional: Adhere to standard modal overlays and shadow depths defined in Tailwind tokens.

## Architecture
- Replace `.modal-overlay`, `.modal-wrapper`, `.modal-content` with a centralized or reusable Tailwind pattern (e.g., `fixed inset-0 z-50 flex items-center justify-center bg-black/50`).
- Ensure all forms inside modals use the Phase 1 UI components.

## Related Code Files
- Modify: `client/src/components/AICopywriterModal.jsx`
- Modify: `client/src/components/AIGeneratorModal.jsx`
- Modify: `client/src/components/AITranslateModal.jsx`

## Implementation Steps
1. Refactor the wrapper `div`s in the three AI modals to standard Tailwind overlay and container classes.
2. Convert their internal layouts (headers, text areas, action buttons) to Tailwind.
3. Update specific AI UI elements (e.g., chat bubbles, loading spinners) to use Tailwind utilities.

## Verification & Testing
- **Test:** Run unit/integration tests for modal open/close state.
- **Browser Subagent:** Trigger the AI Generator Modal from the UI. Capture a screenshot to verify overlay opacity, modal centering, and internal padding in Dark Mode.

## Success Criteria
- [x] AI Modals render perfectly without relying on `modals.css`.

## Risk Assessment
- **Risk:** Z-index conflicts making the modal appear behind other UI elements like toolbars.
- **Mitigation:** Standardize a `z-50` for overlays and `z-[60]` for modal content.

