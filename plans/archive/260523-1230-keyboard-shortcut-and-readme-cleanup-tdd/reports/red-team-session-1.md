# Red Team Review - Session 1

**Plan:** plans/260523-1230-keyboard-shortcut-and-readme-cleanup-tdd/
**Date:** 2026-05-23
**Reviewer:** brainstormer (adversarial mode)

## Summary

Total findings: 11 (Critical 2, High 4, Medium 3, Low 2)

Plan is mostly solid TDD scaffolding but ships two real bugs and several false claims. Two findings touch user intent (Ctrl+M, README prose) and require user confirmation before silently applying.

## Findings

### F1 - CRITICAL - Phase 3 zoom clamps conflict with store-native actions

editor-store.js:71-75 has setZoom (clamps 0.25-4), plus zoomIn/zoomOut (0.25 step) and resetZoom. Phase 3 step 3.2 hard-codes 0.1 step, 0.2-3 range matching canvas-controls.jsx:74,83,92 (ribbon) NOT the named store actions. Store actions exist but unused. **Mitigation:** call store.zoomIn() / zoomOut() / resetZoom() directly OR explicitly comment ribbon-clamp parity (and document divergence).

### F2 - CRITICAL - Annotation callbacks have the same forwarding bug, plan misses them

EditorPage.jsx:1180-1183 passes onPenTool, onLaserPointer, onHighlighterTool, onEraseAnnotations into useKeyboard. use-keyboard.js:94-132 does NOT destructure them. Annotation shortcuts (registry 58-61) are scoped presentation so the contract test (editor+canvas filter) does NOT catch them. Plan Out of Scope line 99 claims annotation callbacks excluded but verified - NO verification in code. They are broken right now. **Mitigation:** widen Phase 2 to forward 4 annotation callbacks AND widen contract test to include presentation scope - one regression guard for entire bug class.

### F3 - HIGH - Phase 1 expected RED count of 8 is not justified explicitly

Plan line 146 says exactly 8 failures. The contract filter picks up 17+ scoped shortcuts. Pre-fix hook destructures 11 already-wired callbacks (copy/cut/paste/undo/redo/selectAll/duplicate/toggleFindReplace/commandPalette/escape/delete). **Mitigation:** enumerate the 8 IDs by name in the test docblock so maintainers verify quickly.

### F4 - HIGH - README researcher 19 claim is correct but prose enumeration is wrong

ELEMENT_DEFAULTS verified: text, image, shape, code, latex, html, markdown, chart, video, audio, table, icon, callout, qrcode, drawing, line, svg, timeline, game = 19. README:36 prose enumerates ~21 items including divider and inline math which are NOT in ELEMENT_DEFAULTS. Plan Phase 4 only fixes headline 20 to 19; prose still wrong. **Mitigation:** Phase 4 must drop divider and inline math from enumeration AND surface to user - they may have wanted divider as a real element.

### F5 - HIGH - Ctrl+M intent: open template modal OR insert blank slide?

EditorPage.jsx:1102 (command palette) and :1451 (Add button) both call setShowTemplateModal(true). So modal IS canonical. But registry label is Insert Slide - naive user expects a blank slide to appear. No bug, but UX lock-in without user input. **Mitigation:** ask user explicitly: open picker, insert blank, or both?

### F6 - HIGH - parseChord round-trip verified for all 8 chords (audit OK)

parseChord does not exist in src; inline in Phase 1 test. Walked all 8 chords (Ctrl+M, Ctrl+G, Ctrl+Shift+G, Ctrl+], Ctrl+[, Ctrl+0, Ctrl+=, Ctrl+-) through parseChord then normalizeKey - all round-trip correctly. Plan Q1.B JSDOM-divergence risk is unfounded. **Mitigation:** mark Q1.B resolved; drop the e.code fallback language.

### F7 - MEDIUM - No CI guard for element-defaults count drift

Phase 4 contributing note is a polite reminder only. **Mitigation:** add a 5-line vitest test asserting Object.keys(ELEMENT_DEFAULTS).length === 19. Fails in CI when someone adds a key without updating README. Cheap, deterministic.

### F8 - MEDIUM - useMemo deps must include all 8 onCallbacks or stale closure

Phase 2 step 2.4 lists 8 names in dep array. Good. **Mitigation:** call out explicitly in Phase 2 success criteria - missing this dep produces silent stale closure when EditorPage re-renders with new zoom value.

### F9 - MEDIUM - Phase 1 step 1.2 wiring smoke test is dead weight

Smoke test only asserts renderHook does not throw when 8 callbacks passed. JS does not throw on extra props so test passes BEFORE Phase 2. Not a tripwire. **Mitigation:** delete it OR change to source-text grep on use-keyboard.js asserting destructure block contains the 8 names.

### F10 - LOW - Phase 3 redundant setZoom add path

Phase 3 step 3.1 says ADD setZoom if absent. setZoom IS present at editor-store.js:72 with clamp. Plan hedge is wrong; risk: author overwrites clamped version with unclamped. **Mitigation:** delete the conditional add path from Phase 3 step 3.1.

### F11 - LOW - Plan claims LiveView uses useKeyboard - it does not

Phase 2 risk row line 151 says only EditorPage, LiveViewPage use this hook. Glob: ONLY EditorPage.jsx. LiveView does not import useKeyboard. Harmless wrong claim; clean up before commit.

## Recommendations

- Block Phase 2/3 merge until F1 (zoom clamps) and F2 (annotation callbacks) resolved or waived.
- F4 (README prose) requires user confirmation.
- F5 (Ctrl+M intent) requires user confirmation.
- F7 (count test) recommended cheap CI guard.
- F9, F10, F11 are 1-line plan edits.

## Unresolved Questions

1. Ctrl+M: open template modal OR insert blank slide directly? (F5)
2. README prose: drop divider and inline math to match 19, OR add them as ELEMENT_DEFAULTS to match 20? (F4)
3. Should annotation callbacks be wired in Phase 2 OR deferred to a separate plan? (F2)
4. Should contract test scope widen to presentation as permanent forwarding regression guard? (F2)
5. Keyboard zoom: track ribbon clamps (0.1 / 0.2-3) OR store-action clamps (0.25 / 0.25-4)? (F1)
