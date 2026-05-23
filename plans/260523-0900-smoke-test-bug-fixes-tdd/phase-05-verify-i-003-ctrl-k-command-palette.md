---
phase: 5
title: "Verify I-003 Ctrl+K Command Palette"
status: pending
priority: P2
effort: "1-2h"
dependencies: [1]
---

# Phase 5: Verify I-003 — Ctrl+K Command Palette (GREEN or CLOSE)

## Overview

The smoke test reported Ctrl+K did not open the command palette in editor. This phase first confirms whether the bug is real (code) or a snapshot artifact (agent-browser key dispatch / focus). Don't fix what isn't broken.

## Severity & Scope

- **Severity:** Low (one keyboard shortcut among many; command palette is also reachable from a button)
- **Inspection points:**
  - `client/src/utils/default-keyboard-shortcut-definitions-registry.js:52` — `{ id: 'commandPalette', defaultKey: 'Ctrl+K', scopes: ['editor'] }` + inline NOTE documenting YAGNI choice
  - `client/src/pages/EditorPage.jsx:1185` — `onCommandPalette: () => setShowCommandPalette((v) => !v)` (handler is correct)
  - `client/src/extensions/` and `client/src/hooks/use-keyboard*.js` — focus-routing layer (real bug surface, if any)
- **Hypothesis A (real bug):** TipTap rich-text frame's prosemirror keymap consumed `Ctrl+K` before the window-level shortcut listener received it (focus-routing bug, NOT scope)
- **Hypothesis B (infra noise):** agent-browser's key dispatch landed on a focused element that intercepted Ctrl+K; real browser works fine

## Requirements

### Functional
- Press Ctrl+K with editor visible and no input focused → command palette opens.
- Press Ctrl+K with command palette open → palette closes (per existing handler).
- If Hypothesis B is confirmed (real browser works fine), document the finding and close I-003 as not-a-bug.

### Non-functional
- Do not regress other shortcuts (Ctrl+F find/replace, Ctrl+M insert slide, etc).
- Decision is observable: either commit a fix, or commit a doc note + close I-003.

## Architecture

```
KeyboardEvent (real browser)
  → window listener (scope manager)
  → scope check: 'editor' scope active? (yes — editor route is mounted)
    └ focus check: contenteditable / input / textarea has focus?
       ├ yes → prosemirror/TipTap keymap may consume the event first
       └ no  → invoke 'commandPalette' handler → setShowCommandPalette(true)
```

Scope is NOT the bug — the registry NOTE in `default-keyboard-shortcut-definitions-registry.js` explicitly documents `commandPalette: scopes: ['editor']` as a YAGNI decision, and other `editor`-scoped shortcuts (Ctrl+M, Ctrl+G, Ctrl+]) work. The bug, if real, lives in the focus-routing layer: a TipTap rich-text frame's keymap consuming the event, OR the window listener missing a `preventDefault`. Step 5.1 real-browser repro determines which hypothesis applies.

## Related Code Files

- Read for context: `client/src/utils/default-keyboard-shortcut-definitions-registry.js`, `client/src/pages/EditorPage.jsx`, the keyboard listener implementation (find via grep below), `client/src/hooks/use-keyboard.js`
- Modify (conditional): one of above, depending on root cause
- Tests: `tests/e2e/regression-smoke-fixes.spec.js` I-003 case from Phase 1.3

## Implementation Steps

### Step 5.1 — Repro in a real browser (NO agent-browser)

1. Run `npm run dev`.
2. Open Chrome at http://localhost:5174.
3. Create a new presentation, land on `/editor/:id`.
4. Click the empty area of the canvas to ensure no input is focused.
5. Press Ctrl+K.
6. **Observe:** does the command palette open?

If **yes** → Hypothesis B confirmed. Skip to Step 5.6.
If **no** → Hypothesis A confirmed. Proceed to Step 5.2.

### Step 5.2 — Identify the keyboard listener

```powershell
# Find the file that wires the shortcut registry to keyboard events
grep -rn "useKeyboardShortcuts\|window.addEventListener.*keydown\|currentScope" client/src/hooks/ client/src/utils/
```

Likely candidate: `client/src/hooks/use-keyboard-shortcut-handler-with-scope-resolution-and-conflict-detection.js` or similar (file naming convention in repo is verbose). Read it to understand scope determination — what `currentScope` is set to when canvas is clicked vs ribbon is hovered.

### Step 5.3 — Decide fix shape

**Red Team Finding 5 removed the original Option A (widen `scopes: ['editor', 'canvas']`)** — it was causally unrelated to the actual smoke-test miss. The keyboard shortcut registry's scope filter already runs all `editor`-scoped shortcuts when the editor route is mounted. Other `editor`-scoped shortcuts (Ctrl+M, Ctrl+G, Ctrl+]) work fine, which proves scope is not the problem. The registry also carries an inline NOTE explicitly documenting the YAGNI choice that `commandPalette` is editor-only — reversing that without evidence would be a backwards step.

**Real candidates (after Step 5.1 confirms a real-browser repro):**

| Option | Edit | When to pick |
|---|---|---|
| A. Focus suppression — TipTap editor swallows Ctrl+K | Add a TipTap keyboard handler in `client/src/extensions/` or check `editor.isEditing` before routing the shortcut | When repro shows Ctrl+K is intercepted by an active rich-text editor (most likely real cause) |
| B. `event.preventDefault()` missing for Ctrl+K | Inspect the scope's keyboard-handler dispatch — does it call `preventDefault` for `commandPalette`? Compare to working shortcuts like Ctrl+F | When browser address-bar focus takes over |
| C. Close as agent-browser infra noise | Document + add Playwright regression spec as proof | When Step 5.1 real-browser repro PASSES with no code change |

**Recommendation:** Run Step 5.1 first — for any non-text-editing focus, Ctrl+K likely works. The hypothesis that aligns with the existing NOTE in the registry is that smoke test triggered Ctrl+K while a TipTap text frame was focused, where the prosemirror keymap intercepts before our window listener runs.

**Investigation commands:**

```powershell
# Find the keyboard listener
grep -rn "useKeyboardShortcuts\|window.addEventListener.*keydown" client/src/hooks/ client/src/utils/

# Find TipTap keymap registrations
grep -rn "Mod-k\|Ctrl-k\|Ctrl\\+K" client/src/extensions/

# Inspect focus-state checks in the dispatcher
grep -rn "document.activeElement\|isEditing\|tagName" client/src/hooks/use-keyboard*.js
```

If a TipTap node-view consumes Ctrl+K via `editorProps.handleKeyDown` returning `true`, the fix is to either:
- Add an explicit pass-through there (`if (event.key === 'k' && (event.ctrlKey || event.metaKey)) return false`), OR
- In the window-level listener, check `event.defaultPrevented === false` AND `document.activeElement?.closest('[contenteditable="true"], input, textarea')` to decide whether to fire shortcuts that should bypass text-editing focus.

Do NOT widen `scopes: ['editor', 'canvas']` — it's dead-weight and reverses a documented YAGNI decision.

### Step 5.4 — Run Phase 1 RED → GREEN

```powershell
npx playwright test tests/e2e/regression-smoke-fixes.spec.js --grep "I-003"
```

Expected: command palette dialog visible after Ctrl+K. Capture green output.

### Step 5.5 — Regression check on other editor shortcuts

Quick manual checklist (5 minutes):

- [ ] Ctrl+F opens find/replace
- [ ] Ctrl+M inserts slide
- [ ] Ctrl+G groups (with selection)
- [ ] Ctrl+] brings forward
- [ ] Ctrl+Z undo

If any regress, revert and re-evaluate Options A/B/C from Step 5.3.

### Step 5.6 — Alternative: Close as infra noise

If Step 5.1 confirms Hypothesis B (real browser works):

1. Update `plans/260523-0500-upstream-parity-verification-tdd/reports/smoke-test-findings.md` I-003 entry with the proof note.
2. In `tests/e2e/regression-smoke-fixes.spec.js`, the I-003 case will pass naturally — verifies real-browser behavior is correct.
3. Add a code comment ONLY if a smoke-test re-run might regress; otherwise rely on the Playwright test as the regression guard.

### Step 5.7 — Commit

If Step 5.3 fix applied (one of the Options A/B from the revised list — TipTap focus pass-through or window-level `activeElement` check):
```text
fix(shortcuts): bypass TipTap focus interception for Ctrl+K (I-003)

Smoke test could not invoke the command palette because the user's
focus was on a TipTap rich-text frame whose prosemirror keymap
consumed Ctrl+K before the window-level shortcut listener received
the event. Routing now bypasses contenteditable/input/textarea focus
for the commandPalette shortcut while leaving other text-editing
shortcuts untouched.
```

If closed as infra noise:
```text
docs(smoke): mark I-003 as agent-browser focus artifact (verified manually)

Ctrl+K opens the command palette in real Chrome / Firefox. The smoke
test miss is reproducible only via agent-browser key dispatch when
canvas is not focused. Playwright regression test guards against
real regression.
```

## Success Criteria

- [ ] Real-browser repro performed and outcome recorded
- [ ] Either Step 5.3 fix applied OR Step 5.6 docs note + green Playwright test
- [ ] Phase 1.3 I-003 test passes
- [ ] No regression in other editor shortcuts (Step 5.5 checklist)
- [ ] Smoke report I-003 entry updated with resolution

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Burning time on a non-bug | Step 5.1 short-circuits the entire investigation when Hypothesis B holds |
| Focus-routing change breaks find/replace or other text-shortcut behavior | Step 5.5 manual sweep + Playwright regression spec; targeted to `commandPalette` only, not all editor shortcuts |
| TipTap keymap or window listener structure differs from assumption | Step 5.2 grep first to identify actual file; commit only against verified code |

## Security Considerations

- Pure UX/shortcut change. No data or auth surface affected.

## Red Team Adjustment

### Session 2 — 2026-05-23 (post-draft review)

| Finding | Severity | Disposition | Applied |
|---|---|---|---|
| 5. Original Option A (widen `scopes: ['editor', 'canvas']`) was causally unrelated to the smoke-test miss. Registry NOTE explicitly documents the YAGNI choice; reversing it would be a regression. Other `editor`-scoped shortcuts (Ctrl+F, Ctrl+M, Ctrl+G) work fine, proving scope is not the bug | High | Accept | Step 5.3 rewritten: Options A/B/C now focus on TipTap focus interception, `preventDefault` missing, or infra-noise closure. Scope widening explicitly forbidden |

The smoke-test miss most likely happened with a focused TipTap rich-text node; the editor's prosemirror keymap intercepted Ctrl+K before the window-level shortcut listener received the event. Verify with Step 5.1 real-browser repro, then pick the targeted fix.

## Next Steps

Phase 7 picks up this fix or closure in the regression sweep.
