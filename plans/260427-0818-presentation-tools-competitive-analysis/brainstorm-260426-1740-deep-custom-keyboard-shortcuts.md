# Brainstorm: Custom Keyboard Shortcuts — NavSlides Editor

**Date:** 2026-04-26, **Author:** brainstormer, **Status:** Done

---

## 1. Current Implementation Analysis

### 1.1 use-keyboard.js — 146 LOC

Single createKeyboardHandler() factory + useKeyboard() hook. Pattern: keydown event -> switch on e.key -> call injected callback.

**Hardcoded shortcuts (10 total):** copy, cut, paste, duplicate, undo, redo/redo-alt, selectAll, toggleFindReplace, delete, escape.

**Guard logic:** skips when isEditing=true, skips when active element is INPUT/TEXTAREA/SELECT, uses e.ctrlKey||e.metaKey for cross-platform Mac/PC.

**Gap analysis:**
- No extensible registry — adding a new shortcut requires modifying createKeyboardHandler + useKeyboard
- No custom shortcut support — user cannot rebind
- No conflict detection
- No show shortcuts help dialog
- No per-context shortcuts (canvas vs. slide sorter)
- No keyboard-navigable menu shortcuts

### 1.2 Toolbar.jsx — 1186 LOC

Toolbar buttons have title attributes with shortcut hints (e.g., title="Bold (Ctrl+B)"), but these are hardcoded strings only — no binding to the actual shortcut system.

### 1.3 editor-store.js / ui-store.js / SettingsPage.jsx

No shortcut state in either store. SettingsPage has 3 sections (AI, Defaults, no Shortcuts). Natural place to add one.

### 1.4 Architecture Assessment

Current shortcut system is tightly coupled — callbacks injected from EditorPage into the hook. Scaling to 30+ shortcuts requires refactoring.

---

## 2. Research Findings

### 2.1 Library Comparison

hotkeys-js (~15KB gzip): High customization, built-in conflicts, tldraw uses it.
react-hotkeys-hook (~4KB): Medium customization, manual conflicts.
use-hotkey-hook (~1KB): Low customization. Custom DIY (0KB): Full control, zero deps.

**Key insight from tldraw source:** tldraw uses hotkeys-js internally. Normalizes kbd strings via getHotkeysStringFromKbd() (converts !->Shift, hBc>Cmd, ?->Alt). Supports comma-separated multi-key shortcuts. No conflict detection — silent overwrite. Shortcuts live on action/tool objects with an override pattern: TLUiOverrides.actions(editor, actions) => modified copy.

### 2.2 Figma / Notion / Tldraw Pattern Analysis

**tldraw:** Shortcuts as kbd property on actions/tools. Override via pure functions. 9 categories. Shortcuts dialog is pure composition — reads from action registry. Scopes: menus open, shape editing, shortcuts disabled all skip.

**Figma:** Separate Keyboard Shortcuts modal. Grouped by category + search. Inline editing: click -> press keys -> save. Conflict: red indicator + warning. Restore defaults per-category and global.

**Notion:** Static shortcut reference only (no customization).

### 2.3 Cross-Platform Considerations

Ctrl on Windows/Linux = Cmd on macOS (already handled via e.ctrlKey||e.metaKey). Display: show Cmd symbol on Mac, Ctrl on Windows/Linux. Use e.code (physical key) not e.key (character) for reliability across international keyboard layouts (AZERTY, etc.).

### 2.4 Build vs Buy Decision

**Recommendation: Custom implementation (DIY).** NavSlides has ~25 total shortcuts — manageable scope. Zero new dependencies. Full control over data model. tldraw pattern (shortcuts as data, not code) can be emulated without the library. Current use-keyboard.js is already 70% of the way there.

---

## 3. Proposed Data Model

### 3.1 Shortcut Definition Schema

// @typedef {canvas|text|global} ShortcutScope
// @typedef {Object} Shortcut
// @property {string} id - unique identifier
// @property {string} label - human-readable name
// @property {string} category - edit|view|navigation|tools|canvas
// @property {string} defaultKey - default key combo
// @property {string|null} userKey - user-overridden key combo, null = use default
// @property {ShortcutScope} scope - when shortcut is active
// @property {string[]} when - context conditions: [!editing, !input]

### 3.2 Key Combo Normalization

function normalizeKeyCombo(raw) {
  const s = raw.toLowerCase().trim();
  return s.replace("cmd", "ctrl").replace(/s+/g, "").split("+").sort((a,b)=>{const O={ctrl:0,shift:1,alt:2,meta:3};return(O[a]??99)-(O[b]??99)}).join("+");
}

### 3.3 Conflict Detection Algorithm

// O(n) conflict check on every user assignment
function detectConflicts(shortcuts, newCombo, excludeId) {
  const combo = normalizeKeyCombo(newCombo);
  return shortcuts.filter(s => s.id !== excludeId && normalizeKeyCombo(s.userKey || s.defaultKey) === combo);
}

### 3.4 Storage Schema (localStorage)

{
  "navslides-shortcuts": {
    "version": 1,
    "overrides": {
      "toggle-grid": "ctrl+g",
      "undo": "ctrl+z"
    }
  }
}

**Design decision:** Only store user overrides, not full registry. Defaults live in code. Reset to defaults = clear overrides object.

---

## 4. UI/UX Design

### 4.1 Settings Location

New section in SettingsPage.jsx called Keyboard Shortcuts:
- Search shortcuts... (real-time filter)
- Category tabs: Edit | Navigation | Canvas | Tools | Find/Replace
- Shortcut rows with recording capability
- Import/Export buttons
- Reset to defaults

### 4.2 Shortcut Row Component

Click shortcut badge -> enters recording mode (yellow border). User presses new key combo -> conflict check. Conflict: red border + warning tooltip. Valid: green flash + save. Escape cancels recording.

### 4.3 Display Platform Awareness

function displayShortcut(combo) {
  const isMac = navigator.platform.includes("Mac");
  return isMac ? combo.replace(/ctrl/g, "Cmd") : combo.replace(/ctrl/g, "Ctrl");
}

### 4.4 Import/Export

Export: download shortcuts.json with overrides. Import: upload shortcuts.json, merge with current. Useful for power users + team sharing.

---

## 5. Technical Implementation Plan

### 5.1 File Structure (New)



### 5.2 Implementation Phases

**Phase 1: Registry Layer (~200 LOC)**
1. Create use-keyboard-registry.js — define all default shortcuts as data
2. Add shortcutOverrides to ui-store.js (persisted to localStorage)
3. Refactor use-keyboard.js to read from registry instead of hardcoded switch
4. Add normalizeKeyCombo() and detectConflicts() helpers
5. Verify: existing 10 shortcuts work identically

**Phase 2: Settings UI (~300 LOC)**
1. Create KeyboardShortcutsPanel.jsx — category tabs + shortcut list
2. Create ShortcutRow.jsx — display + recording mode
3. Create ShortcutRecorder.jsx — key capture input
4. Add section to SettingsPage.jsx
5. Verify: user can view, search, and reset shortcuts

**Phase 3: Customization (~150 LOC)**
1. Wire up recording mode — capture keydown, build combo string
2. Implement conflict detection + warning UI
3. Save override to localStorage via ui-store
4. Add import/export buttons + Reset all to defaults
5. Verify: rebind, conflict detection, persistence

**Phase 4: Extended Shortcuts (~100 LOC, optional)**
1. Add navigation shortcuts (next/prev slide, first, last)
2. Add canvas shortcuts (zoom in/out/reset, fit, timeline toggle)
3. Verify: all new shortcuts work in correct scope

**Total: ~750 LOC** across 5-6 new files, 2 modified.

### 5.3 Default Shortcuts to Support

**Edit (12):** copy, cut, paste, delete, duplicate, undo, redo, redo-alt, select-all, find-replace, escape, copy-props
**Navigation (5 new):** prev-slide, next-slide, first-slide, last-slide, go-to-slide
**Canvas (8 new):** toggle-grid, toggle-rulers, toggle-smart-guides, zoom-in, zoom-out, zoom-reset, fit-to-screen, toggle-timeline
**Tools (8 new):** insert-text, insert-image, insert-shape, insert-table, insert-code, group, ungroup, insert-math
**Total: ~33 shortcuts** — manageable for a custom registry.

### 5.4 Scope System

const SCOPES = {
  CANVAS:  "canvas",  // element manipulation
  TEXT:    "text",    // TipTap text editing active
  INPUT:   "input",   // input/textarea focused
  GLOBAL:  "global",  // always active (except INPUT)
};

### 5.5 Migration Strategy

1. shortcutRegistry.version increments when defaults change
2. Migration function compares stored version with current
3. User overrides are preserved; new defaults adopted silently
4. After migration, set version = CURRENT_VERSION

---

## 6. Effort Estimate & Risks

### 6.1 Effort Breakdown

Phase 1 Registry: Medium, ~200 LOC
Phase 2 Settings UI: Medium, ~300 LOC
Phase 3 Customization: Medium, ~150 LOC
Phase 4 Extended: Low, ~100 LOC
Total: ~750 LOC

### 6.2 Risks

Risk: Regression: existing shortcuts break | Severity: High | Mitigation: Phase 1 refactors existing 10 shortcuts; comprehensive manual test
Risk: TipTap/ProseMirror consuming key events | Severity: High | Mitigation: Ensure text editing scope properly guards shortcuts
Risk: International keyboard layouts (AZERTY) | Severity: Medium | Mitigation: Use e.code (physical key) not e.key (character)
Risk: Conflict UI too complex | Severity: Medium | Mitigation: Simple red indicator + tooltip; detailed modal only if needed
Risk: Ctrl+G conflict (Find vs Go to Slide) | Severity: Medium | Mitigation: Choose different defaults; warn on user conflict

### 6.3 Open Questions

1. Should toolbar formatting shortcuts (Bold, Italic) be customizable? TipTap-native — harder to externalize.
2. Should shortcuts be per-presentation or global (localStorage)? Currently suggesting global. Server-side sync could be added later.
3. Should we support chorded shortcuts (e.g., Ctrl+K Ctrl+C)? Not in v1 — significant complexity.
4. **Should we use e.code (physical key) or e.key (character) for shortcut capture?** Recommend e.code for international layout reliability.
5. **What happened to use-history.js (deleted in git status)?** Verify if history is managed elsewhere or if this was a dead file.

---

## 7. Simplest Viable Option (Recommended)

Build a custom shortcut registry (no external library). Start with Phase 1 only:

1. Define all ~15 current + planned shortcuts as data in a registry module
2. Refactor use-keyboard.js to dispatch from registry
3. Add shortcutOverrides to ui-store with localStorage persistence
4. Add conflict detection helper
5. Ship with settings panel showing shortcuts (read-only for now)

This gives maximum learning/validation with minimum risk. Customization (rebinding) can be added incrementally. Zero new dependencies.

**Reject adding hotkeys-js** — 15KB for a problem we can solve with ~200 lines of custom code. The tldraw pattern (shortcuts as data, not code) is the right abstraction, but we do not need the library to get there.

---

## 8. Decision Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Library | Custom DIY | Zero deps, full control, ~200 LOC solves it |
| Data model | Action registry + user overrides map | Separates defaults (code) from customization (data) |
| Storage | localStorage | Simple, sufficient; server sync optional later |
| Conflict detection | Normalized key combo hash map | O(n) scan, warn but not block |
| Settings location | SettingsPage section | Natural home, not a separate route |
| Scope system | Simple guard flags | !editing, !input — no complex scopes for v1 |
| Platform display | navigator.platform detection | Show Cmd on Mac, Ctrl on Windows |
| Migration | Version number in localStorage | Handle defaults changes gracefully |

---

**Status:** DONE
**Unresolved Questions:** #4 (e.code vs e.key), #5 (use-history.js deletion)