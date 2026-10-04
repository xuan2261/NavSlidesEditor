## TL;DR

Recover through **Open inspector → Try game**, inspecting eligibility first and preserving the same document and authored inputs. There is a **source-confirmed nested Escape ownership defect** in the drawer path—not evidence of a timer defect. Phase04 remains blocked pending the native ownership receipt and resolution of that keyboard-close boundary; the successful hidden-case receipt stands.

Counsel: `local52186/gpt-6.1-sol`, same-model separate-context; not model-family-independent. Read-only inspection; no execution, edits, or delegation.

## Source finding

The drawer can consume Escape **before the Try modal’s close handler receives it**:

- `client/src/components/PropertiesPanel.jsx:195` renders `GameTryLauncher` inside the inspector.
- `education/game-try-launcher.jsx:9–13` renders `ModalShell` inline, not through a portal.
- `ui/ModalShell.jsx:42–45,84–97` handles Tab locally; Escape closure comes from `useEscapeClose`.
- `lib/utils.js:7–12,34–35` routes Escape through a document-level bubbling listener.
- `editor/editor-inspector.jsx:17–21` unconditionally closes the overlay on descendant Escape and stops propagation.
- `editor/editor-inspector.jsx:11` returns `null` when hidden. `editor/editor-workspace.jsx:70–73` ties visibility to the active inspector overlay. Closing that drawer therefore unmounts the launcher and Try together.
- `editor/editor-workspace.jsx:21–25` also closes an active workspace overlay on Escape without checking nested modal ownership.

**Conclusion:** game-root count reaching zero does not distinguish “Try closed correctly” from “its owning inspector was unmounted.” The supplied failure is consistent with the latter, but its actual event target and inspector state were not recorded; that causal attribution remains **[INFERENCE]**.

This is a real ownership gap in the reachable native UI. Existing coverage does not clear it: `ModalShell.test.jsx:98–125` dispatches Escape directly at `document`; `editor-workspace-overlay.test.jsx` mocks the inspector; adapter tests omit the launcher/drawer ancestry.

## Conservative recovery and proof

1. **Keep the current page.** Do not reload, resize to dock the inspector, change duration, or replace authored inputs. Those actions could erase pending-work evidence or bypass the failing boundary.

2. **Start an emitted receipt immediately.** Record saved-deck SHA256 before the new sequence; viewport, document visibility, root/dialog counts, selected effective tuple, and serialized authored configuration.

3. **Inspect recovery eligibility.** Emit visible/enabled counts for exact **Open inspector** and **Try game**, plus Inspector/Try dialog presence.
   - If Try is visible, use it.
   - If Try is absent and Open inspector is eligible, click Open inspector; confirm the intended selection/configuration and exactly one eligible Try button, then click Try.
   - If neither is eligible, emit the actual UI state and stop that attempt rather than forcing a DOM click.

4. **Repeat only the incomplete ownership sequence, with checkpoints:**
   - Reset and choose button mode through actual controls.
   - Pick; record **Picking/0** before Reset.
   - Reset; record Ready/0 immediately and after 900ms.
   - Pick again; record **Picking/0** before Escape.
   - Press Escape from the actual focused control; immediately record focus, Inspector/Try presence, root count, and both launcher eligibility states.
   - Recover through the eligible UI path above **without navigation**.
   - Record the fresh root and Ready/0; wait beyond the old 700ms deadline and require unchanged 0 picks.
   - Make a new pick; require exactly one result and one pick, then a settled observation with no duplicate.
   - Record saved-deck SHA256 afterward and require equality.

Emit every checkpoint before advancing; the previous invocation’s unprinted assertions are reported successes, not a completed receipt.

## Blocking decision / what to avoid

The recovery can prove reset/destroy isolation even if Escape removed the entire drawer. **It cannot prove correct topmost-modal dismissal.** Record that distinction explicitly.

If the focused Escape checkpoint confirms inspector teardown, make the narrow ownership repair using the existing modal-close convention, then qualify **first Escape closes Try while Inspector remains; subsequent Escape closes Inspector**. Do not suppress Escape globally or replace this acceptance path with **Close Try game**. That button is useful only as a diagnostic alternative.

No timer rewrite is justified: adapter cleanup removes its visibility listener before destruction (`native-game-try-adapter.jsx:25–28`), and session reset/destroy invalidate generations and scheduled work (`runtime-session.js:50–86`). The inspected visibility GREEN receipt already proves the repaired hidden behavior; do not rerun it merely to reconfirm.