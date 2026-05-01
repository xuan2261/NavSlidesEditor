---
phase: 4
title: "Phase 5: Custom Shortcut Registry & Settings"
status: completed
priority: P1
effort: "3-5d"
dependencies: [1]
completed: "2026-04-27"
---

# Phase 4: Custom Shortcut Registry & Settings

## Context Links

- Predecessor: Phase 1 (command layer unified) — shortcut registry builds on the command callback pattern
- Predecessor: Phase 3 (canvas decomposition) — registry dispatches to canvas commands
- Code: `client/src/hooks/use-keyboard.js` (current: hardcoded switch, dispatches command callbacks)
- Code: `client/src/pages/SettingsPage.jsx`
- Tests to create: `client/src/utils/shortcut-registry.test.js`, `client/src/utils/shortcut-storage.test.js`

## Overview

Replace the hardcoded shortcut switch in `use-keyboard.js` with a registry that supports
user-defined overrides stored in `localStorage`. Add minimal Settings UI for viewing,
recording, and resetting shortcuts.

## Key Insights

- `useKeyboard` already dispatches command callbacks — registry just changes the dispatch source.
- Logical `e.key` is the current default — keep it unless product decision says otherwise.
- Store only user overrides, not defaults — defaults live in the registry definition.
- Conflict detection: same scope + same normalized chord + overlapping guard blocks registration.

## Architecture

```
client/src/utils/
  shortcut-registry.js      # Default shortcut definitions
  shortcut-storage.js        # localStorage overrides
  shortcut-normalizer.js     # Key chord normalization

client/src/hooks/
  use-keyboard.js            # Resolves from registry, dispatches command callbacks

client/src/pages/
  SettingsPage.jsx           # Shortcut manager section
```

**Shortcut schema:**
```js
{
  id: string,           // unique command id (e.g. 'copy', 'paste', 'undo')
  label: string,       // display name (e.g. 'Copy')
  category: string,    // 'clipboard' | 'editing' | 'navigation' | 'view'
  defaultKey: string,  // e.g. 'Ctrl+C', 'Ctrl+Shift+Z'
  scopes: string[],    // 'canvas' | 'editor' | 'global'
  guard?: string,      // optional guard condition
}
```

## Related Code Files

- Modify: `client/src/hooks/use-keyboard.js`
- Create: `client/src/utils/shortcut-registry.js`
- Create: `client/src/utils/shortcut-storage.js`
- Create: `client/src/utils/shortcut-normalizer.js`
- Modify: `client/src/pages/SettingsPage.jsx`
- Modify: toolbar/menu components displaying shortcut labels (if hardcoded)
- Create: `client/src/utils/shortcut-registry.test.js`
- Create: `client/src/utils/shortcut-storage.test.js`
- Modify: `tests/e2e/settings.spec.js`
- Modify: `tests/e2e/keyboard-shortcuts.spec.js`

## Implementation Steps

### 1. shortcut-normalizer.js

Create `client/src/utils/shortcut-normalizer.js`:
- Normalize key chords: `'ctrl+c'` -> `'Ctrl+C'`, `'CMD+v'` -> `'Ctrl+V'` (macOS)
- Validate: reject reserved chords (Ctrl+Alt+Del, browser-reserved keys)
- Unit tests: cover Ctrl/Cmd, Shift, Alt, key casing, invalid inputs

```js
export function normalizeKey(e) {
  const mods = []
  if (e.ctrlKey || e.metaKey) mods.push(navigator.platform.includes('Mac') ? 'Ctrl' : 'Ctrl')
  if (e.shiftKey) mods.push('Shift')
  if (e.altKey) mods.push('Alt')
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
  return [...mods, key].join('+')
}

export function isReservedChord(chord) {
  // e.g. Ctrl+W (close tab), Ctrl+T (new tab), Ctrl+N (new window)
  return false // placeholder
}
```

### 2. shortcut-registry.js

Create `client/src/utils/shortcut-registry.js`:

```js
export const DEFAULT_SHORTCUTS = [
  { id: 'copy',        label: 'Copy',        category: 'clipboard',  defaultKey: 'Ctrl+C', scopes: ['canvas'] },
  { id: 'cut',         label: 'Cut',          category: 'clipboard',  defaultKey: 'Ctrl+X', scopes: ['canvas'] },
  { id: 'paste',      label: 'Paste',         category: 'clipboard',  defaultKey: 'Ctrl+V', scopes: ['canvas'] },
  { id: 'duplicate',   label: 'Duplicate',    category: 'clipboard',  defaultKey: 'Ctrl+D', scopes: ['canvas'] },
  { id: 'delete',     label: 'Delete',        category: 'clipboard',  defaultKey: 'Delete', scopes: ['canvas'] },
  { id: 'undo',        label: 'Undo',         category: 'clipboard',  defaultKey: 'Ctrl+Z', scopes: ['canvas', 'editor'] },
  { id: 'redo',        label: 'Redo',         category: 'clipboard',  defaultKey: 'Ctrl+Y', scopes: ['canvas', 'editor'] },
  { id: 'selectAll',   label: 'Select All',   category: 'clipboard',  defaultKey: 'Ctrl+A', scopes: ['canvas'] },
  { id: 'escape',     label: 'Deselect',     category: 'navigation',  defaultKey: 'Escape', scopes: ['canvas', 'editor'] },
  { id: 'find',        label: 'Find/Replace', category: 'view',       defaultKey: 'Ctrl+F', scopes: ['canvas'] },
  // ... toolbar/insert shortcuts if they exist
]

export function getShortcuts(overrides) {
  return DEFAULT_SHORTCUTS.map(s => ({
    ...s,
    activeKey: overrides[s.id] ?? s.defaultKey,
  }))
}
```

### 3. shortcut-storage.js

Create `client/src/utils/shortcut-storage.js`:

```js
const STORAGE_KEY = 'navslides-shortcuts'

export function loadOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function saveOverride(id, key) {
  const overrides = loadOverrides()
  overrides[id] = key
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
}

export function resetOverride(id) {
  const overrides = loadOverrides()
  delete overrides[id]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
}

export function resetAll() {
  localStorage.removeItem(STORAGE_KEY)
}

export function detectConflict(id, key, allShortcuts) {
  return allShortcuts.some(s => s.id !== id && s.activeKey === key)
}
```

### 4. Update use-keyboard.js

Modify `useKeyboard` to resolve from registry:

```js
export function useKeyboard({ onCopy, onCut, onPaste, onDuplicate, onUndo, onRedo,
  onDelete, onSelectAll, onToggleFindReplace, onEscape, isEditing }) {

  const overrides = useMemo(() => loadOverrides(), [])
  const shortcuts = useMemo(() => getShortcuts(overrides), [overrides])

  const handleKeyDown = useMemo(() => createKeyboardHandler({
    onCopy, onCut, onPaste, onDuplicate, onUndo, onRedo,
    onDelete, onSelectAll, onToggleFindReplace, onEscape, isEditing,
    shortcuts,
  }), [isEditing, onCopy, onCut, ...shortcuts])

  // ...
}
```

Update `createKeyboardHandler` to use `shortcuts` map instead of hardcoded switch:

```js
export function createKeyboardHandler({ shortcuts, isEditing, getActiveElement, ...callbacks }) {
  return (e) => {
    if (isEditing) return
    const chord = normalizeKey(e)
    const shortcut = shortcuts.find(s => s.activeKey === chord)
    if (shortcut) {
      callbacks[`on${capitalize(shortcut.id)}`]?.()
      e.preventDefault()
    }
  }
}
```

### 5. Settings UI (shortcut manager section)

Add a "Keyboard Shortcuts" section to SettingsPage:
- List shortcuts grouped by category
- Show current binding next to each label
- Click "Record" button → next keypress sets override
- Show conflict warning if new chord conflicts with existing shortcut
- "Reset" button per shortcut and "Reset All" button
- Shortcuts persist in localStorage

### 6. Toolbar/menu shortcut labels

Find all components that hardcode shortcut strings (e.g. `"Copy (Ctrl+C)"`).
Update them to read from registry:

```jsx
// Instead of hardcoded:
<span>Copy (Ctrl+C)</span>

// Use registry:
<span>Copy ({shortcuts.find(s => s.id === 'copy')?.activeKey})</span>
```

### 7. Tests

Create unit tests:
- `shortcut-registry.test.js`: default list, `getShortcuts`, override merging
- `shortcut-storage.test.js`: load/save/reset with localStorage mocking
- `shortcut-normalizer.test.js`: chord normalization, reserved key detection

## Todo List

- [ ] `shortcut-normalizer.js` created with unit tests
- [ ] `shortcut-registry.js` created with default shortcut definitions
- [ ] `shortcut-storage.js` created with localStorage persistence
- [ ] `use-keyboard.js` updated to resolve from registry
- [ ] Conflict detection added
- [ ] Settings UI shortcut manager section created
- [ ] Toolbar/menu shortcut labels updated to use registry
- [ ] `shortcut-registry.test.js` created
- [ ] `shortcut-storage.test.js` created
- [ ] `npm run test` passes for shortcut files
- [ ] E2E override persistence test passes

## Verification Commands

```bash
npm run test -- client/src/utils/shortcut-registry.test.js client/src/utils/shortcut-storage.test.js client/src/utils/shortcut-normalizer.test.js
npx playwright test tests/e2e/settings.spec.js tests/e2e/keyboard-shortcuts.spec.js
npm run lint
npm run build
```

## Manual Smoke

- Override Duplicate from Ctrl+D to Ctrl+Shift+D — verify it works
- Try conflicting Copy/Paste chord — verify UI blocks or warns
- Reload app — verify override persists
- Reset one shortcut — verify default works
- Reset All — verify all defaults restored

## Success Criteria

- [ ] Shortcut registry is single source for default keys and labels
- [ ] Conflict detection prevents ambiguous active shortcuts
- [ ] Overrides persist in localStorage and reset cleanly
- [ ] Existing command behavior unchanged with no overrides
- [ ] Settings UI accessible and keyboard-accessible
- [ ] No bundle dependency added

## Risk Assessment

- Risk: shortcut changes break accessibility.
  - Mitigation: reject reserved browser chords; clear error message.
- Risk: localized keyboard users surprised by physical key matching.
  - Mitigation: keep logical `e.key` default.

## Security Considerations

- Validate localStorage JSON shape before use — treat as untrusted.
- Do not allow shortcuts to trigger privileged actions beyond existing UI capabilities.

## Next Steps

Phase 5 (PPTX import fidelity) can run in parallel with this phase — it does not depend on canvas decomposition.
