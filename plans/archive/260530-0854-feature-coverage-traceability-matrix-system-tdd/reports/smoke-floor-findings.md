# Smoke Floor Findings — editor-core GAP closure

Smoke tests give each GAP capability a baseline: it constructs/renders, its
primary op runs, and (for elements) state round-trips. Targets the GAP rows the
Phase 3 retrofit could not honestly tag. Per the duplicate-work rule, elements
already PASS via tagged tests are NOT re-smoked.

## Smoke tests added (GAPs → PASS)

| Batch | Test file | Caps covered |
|---|---|---|
| Elements (factory + round-trip) | canvas/element-renderers/element-factory.smoke.test.js | element.{text,image,shape,code,latex,html,markdown,chart,video,audio,icon,callout,qrcode,drawing,line,svg,timeline} (17) + unknown-type throw |
| Format controls (command dispatch) | ribbon/controls/ribbon-text-formatting-controls.smoke.test.jsx | control.format.{bold,italic,underline,fontSize,fontFamily,fontWeight} (6) |
| Canvas resize (box math) | canvas/canvas-geometry-ops.smoke.test.js | canvas.resize |

**24 GAP capabilities closed with REAL assertions.** Smoke contract honored:
elements assert factory defaults + JSON round-trip; controls assert the
dispatched command fires; resize asserts the targeted geometry change.

## Real findings (recorded, not papered over)

| Finding | Location | Severity | Action |
|---|---|---|---|
| `startSlideshow` command action is a `console.log` stub | EditorPage.jsx:912 | low | Real wiring gap. command.startSlideshow is NOT smoke-faked green — routed to Phase 6 allowlist with this reason. Fix = wire the action (separate bug-fix budget). |

**No crashes or logic bugs surfaced** while writing element/control/resize smoke
tests — the floor confirmed these capabilities are structurally sound.

## Deliberately NOT smoke-tested (→ Phase 6 dated allowlist)

These GAPs have no clean, non-tautological test seam today. Writing a passing
test for them would either (a) assert nothing real (the "tag-lies" anti-pattern
this system exists to kill) or (b) require restructuring source purely for a
test seam (forbidden by the plan). Each is routed to the warn-first allowlist
with an honest reason instead of a fake green.

| Capability | Why no smoke test | Close path |
|---|---|---|
| canvas.move | drag-delta applied inside pointer-interaction hook; no pure export | extract a move helper |
| canvas.lock | lock toggle is inline in component state | extract/expose a lock action |
| canvas.zorder | inline in EditorPage.jsx:726 (see deep-test-findings) | extract reorderByZ |
| flow.undo-redo | historyRef + debounce in EditorPage (see deep-test-findings) | extract pushHistory |
| flow.autosave | save effect bound to component lifecycle | extract a debounced-save helper |
| command.{insertSlide,insertLink,group,ungroup,startSlideshow} | actions are inline closures in EditorPage commands array; group/ungroup ARE covered via shortcut tests, the rest need the array extracted | extract command handlers (couples to 260529-2256 refactor) |
| control.{insert.text,insert.shape,view.selectionPane,view.smartGuides,file.menu,format.position} | controls lack a stable isolated render seam or dispatch through deep component trees | add data-testid + isolated control tests |
| shortcut.{insertSlide,group,ungroup,bringForward,sendBackward,penTool,laserPointer,highlighterTool,eraseAnnotations} | no asserting keypress→action test; editor/annotation wiring not unit-covered | smoke test the handler wiring or allowlist |

## Bug-fix budget

Per plan, bug fixes are charged SEPARATELY from test-writing. Only one real
finding (startSlideshow stub) surfaced; it is recorded, not fixed in this phase,
and not hidden behind a passing test.

## Open questions

- The largest allowlist cluster (commands + canvas.zorder + undo-redo) all live
  in `EditorPage.jsx` and all close via the same extraction the parallel
  `260529-2256-editorpage-hardening` epic performs. Recommend coordinating: when
  that refactor extracts the command array + history + zorder helpers, this
  matrix auto-flips them from allowlisted to testable.
