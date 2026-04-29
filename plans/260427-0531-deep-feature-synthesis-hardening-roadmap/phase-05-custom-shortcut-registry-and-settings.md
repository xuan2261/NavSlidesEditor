---
phase: 5
title: "Custom Shortcut Registry And Settings"
status: pending
priority: P1
effort: "3-5d"
dependencies: [2, 4]
---

# Phase 5: Custom Shortcut Registry And Settings

## Context Links

- Brainstorm Feature 2: custom shortcuts with registry, conflict detection, Settings UI.
- Audit correction: `e.code` is not automatically better than `e.key`; product decision required.
- Code: `client/src/hooks/use-keyboard.js`, `client/src/pages/SettingsPage.jsx`, `tests/e2e/keyboard-shortcuts.spec.js`

## Overview

Replace hardcoded shortcut switching with a registry and minimal Settings UI for
custom overrides. Keep defaults stable; store only user overrides.

## Key Insights

- Current shortcut hook uses `e.key.toLowerCase()` and a switch.
- Toolbar titles and UI labels can drift if they hardcode shortcuts.
- Localized keyboards may prefer logical `e.key`; physical `e.code` can surprise users.
- A DIY registry is enough; no new hotkey dependency needed for current scope.

## Requirements

- Functional: default shortcuts continue to match README unless changed deliberately.
- Functional: user can view shortcuts, record an override, detect conflicts, reset one/all.
- Functional: overrides persist in `localStorage` only.
- Functional: Settings UI is keyboard accessible and works in dark/light themes.
- Non-functional: no dependency unless a concrete limitation appears.
- Non-functional: no import/export JSON in MVP unless time remains after core UX is stable.

## Architecture

```text
shortcut-registry.js
  -> default shortcut definitions
shortcut-storage.js
  -> localStorage overrides only
use-keyboard.js
  -> resolves active binding and dispatches command id
SettingsPage.jsx
  -> shortcut manager section
Toolbar/menu labels
  -> read display shortcut from registry
```

Recommended default: keep logical `e.key` matching for existing shortcuts. If a
physical-key decision is made, add an explicit binding mode instead of silently
switching all users.

## Related Code Files

- Modify: `client/src/hooks/use-keyboard.js`
- Create: `client/src/utils/shortcut-registry.js`
- Create: `client/src/utils/shortcut-storage.js`
- Create: `client/src/utils/shortcut-normalizer.js`
- Modify: `client/src/pages/SettingsPage.jsx`
- Modify: toolbar/menu components that display shortcut labels if hardcoded.
- Modify: `client/src/hooks/use-keyboard.test.js`
- Create: `client/src/utils/shortcut-registry.test.js`
- Create: `client/src/utils/shortcut-storage.test.js`
- Modify: `tests/e2e/settings.spec.js`
- Modify: `tests/e2e/keyboard-shortcuts.spec.js`
- Delete: none.

## Implementation Steps

1. Define shortcut schema: id, label, category, defaultKey, scope, guard, commandId.
2. Add normalizer tests for Ctrl/Cmd, Shift, Alt, key casing, and reserved invalid inputs.
3. Update `useKeyboard()` to resolve active bindings from registry and overrides.
4. Keep command callbacks from Phase 2 as the execution layer.
5. Add conflict detection: same scope + same normalized chord + overlapping guard.
6. Add Settings shortcut section with categories, current binding, record mode, reset.
7. Persist only overrides, not defaults.
8. Replace hardcoded displayed shortcut strings where practical.
9. Add E2E: change duplicate shortcut, verify it works, reset, verify default works.
10. Update README shortcut table only if defaults or UX changed.

## Todo List

- [ ] Registry schema and default shortcut list.
- [ ] Normalizer and conflict detection tests.
- [ ] `useKeyboard()` dispatches by command id.
- [ ] Settings UI for record/reset.
- [ ] E2E for override persistence.
- [ ] README/docs updated if needed.

## Verification & Tests

```bash
npm run test -- client/src/hooks/use-keyboard.test.js client/src/utils/shortcut-registry.test.js client/src/utils/shortcut-storage.test.js
npx playwright test tests/e2e/settings.spec.js tests/e2e/keyboard-shortcuts.spec.js
npm run lint
npm run build
```

Manual smoke:

- Override Duplicate from Ctrl+D to Ctrl+Shift+D.
- Try conflicting Copy/Paste chord and confirm UI blocks or warns.
- Reload app and confirm override persists.
- Reset all and confirm README defaults work.

## Success Criteria

- [ ] Shortcut registry is the single source for default keys and labels.
- [ ] Conflict detection prevents ambiguous active shortcuts.
- [ ] Overrides persist and reset cleanly.
- [ ] Existing command behavior remains unchanged with no overrides.
- [ ] No bundle dependency added without documented reason.

## Risk Assessment

- Risk: custom shortcuts break accessibility or browser-reserved keys.
- Mitigation: reject reserved chords and provide clear inline error.
- Risk: localized keyboard users are surprised by physical key matching.
- Mitigation: keep logical default unless product decision says otherwise.

## Security Considerations

- Treat localStorage JSON as untrusted; validate shape before use.
- Do not allow shortcuts to trigger privileged actions outside existing UI capabilities.

## Next Steps

PPTX Phase 6 can run after Phase 1, but should not be mixed with shortcut files.

## Unresolved Questions

- Product decision: logical `e.key` default, physical `e.code`, or explicit per-shortcut mode?
