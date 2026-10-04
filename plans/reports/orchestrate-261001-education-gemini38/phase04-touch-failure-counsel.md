## TL;DR

**GO for one instrumented diagnostic run; NO-GO for Phase04 acceptance.** Separate document reload, runtime bootstrap, and control replacement before choosing a fix. The supplied failure does not establish a production defect.

Counsel: `local52186/gpt-6.1-sol`, separate-context, same-model—not model-family-independent. Read-only inspection; no edits or execution performed.

## Reframed problem

Determine **which helper acquired a node that became detached, and what detached it**. Preserve real touch input, reduced-motion emulation, both widths, and the existing targetability assertion.

### Verified evidence

- Installed Puppeteer is **25.3.0**. Its `cdp/Page.js:818–823` awaits a reload when viewport emulation requests one. `cdp/EmulationManager.js:345–350` requests that reload when `isMobile` or `hasTouch` changes—not merely when width changes.
- `api/Frame.ts:1078–1085,1147–1150` resolves a fresh selector handle for each `click`/`tap`. The supplied sequence does not explicitly reuse an old handle.
- `api/ElementHandle.js:720–724,905–908` checks/scrolls the element before dispatching mouse or touch input. The reported `assertConnectedElement` failure is compatible with either helper; it does not identify which.
- Reset intentionally replaces controls: `shared/src/education/browser/mount.js:44–50` resets the session and reinstalls the presenter; `browser/games/name-picker.js:16–17` replaces/clears the UI children.
- Ordinary mode changes and pick rendering retain the controls and replace visual content instead (`browser/games/name-picker.js:19–53`).
- Bootstrap attaches the lifecycle on DOM/Reveal readiness (`browser/runtime-entry.js:5–15`). Reveal reconciliation pauses/resumes existing instances rather than reinstalling their controls (`browser/reveal-lifecycle.js:7–16`).

**[INFERENCE]** A desktop-to-touch viewport change can reload the retained tab. However, `setViewport()` awaits that reload, so observing a reload alone would **not** prove the later detached-node failure.

## What to do / work checklist

1. **Instrument the original sequence without changing its actions.**
   Wrap every awaited operation with a named phase:
   `viewport`, `reduced-motion`, `slide`, `reset-click`, `select-button`, `pick-tap`, `wait-result`, `receipt`.
   Emit width and phase before/after each operation. On failure, emit the complete stack and accumulated receipts, then rethrow.

   Emit each width’s receipt immediately. A final `return receipts` loses visibility into earlier iterations when a later operation throws.

2. **Trace document identity across viewport changes.**
   Before `setViewport`, attach Node-side `framenavigated`—filtered to the main frame—`domcontentloaded`, `load`, `console`, and `pageerror` listeners. Install a per-document probe both in the current document and through `evaluateOnNewDocument`.

   Give each document a unique token. Record that token plus `performance.timeOrigin`, URL, readiness, viewport, touch points, and reduced-motion match at phase boundaries. URL alone cannot distinguish a same-URL reload.

3. **Trace control identity and input ordering.**
   Use diagnostic-only `WeakMap` identities for the game root, UI container, reset button, select, and pick button. Observe child-list changes, including removal of their ancestors, under `.reveal .slides`.

   Capture `pointerdown/up`, `touchstart/end`, `mousedown/up`, `click`, `input`, and `change`; record target identity, command, `isTrusted`, connection status, and timestamp. Record game generation/state after bootstrap without mounting from an early diagnostic snapshot.

   This separates:
   - a new document;
   - replacement of controls inside the same root;
   - replacement/remounting of the root;
   - failure before any input;
   - replacement following reset’s click.

4. **Choose only the demonstrated repair.**
   - **Harness/bootstrap defect:** if the trace establishes incomplete post-reload initialization or a stale harness handle, wait for explicit Reveal/runtime/control readiness and reacquire current controls. Configure mobile/touch before navigation in the corrected smoke setup.
   - **Renderer defect:** if controls disappear during an otherwise settled interaction, fix the demonstrated lifecycle/replacement trigger—not Puppeteer’s error handling.
   - **Intentional reset replacement only:** reacquire controls after reset. The supplied selectors already do this, so replacement alone is insufficient evidence for a repair.

## What to avoid

- Unconditional sleeps, retrying `tap`, or catching-and-ignoring detachment.
- Replacing native touch with `evaluate(() => button.click())`.
- Treating reset’s expected control replacement as proof of a bug.
- Treating viewport reload as the diagnosis without linking it to the failing handle.
- Weakening or bypassing the button-center hit-test assertion.

## Alternatives & trade-offs

A **fresh, preconfigured page per width** isolates harness state, but use it after capturing the original failure path; otherwise it can hide a retained-tab defect.

**Production control reuse across reset** would avoid intentional replacement, but changes lifecycle behavior without evidence that replacement caused this failure. Do not choose it provisionally.

## Success metrics

For **both 320 and 768**, require and assert:

- `innerWidth === requestedWidth`;
- `navigator.maxTouchPoints > 0`;
- reduced-motion media query matches;
- one native pick tap resolves to `picks === 1`;
- Reveal remains at `h === 0`, `v === 0`;
- every button passes the existing center-point targetability assertion.

Recording touch/reduced-motion values without asserting them is insufficient. Button-mode interaction under reduced motion proves that scenario—not wheel/confetti motion behavior.

## Assumptions

**[INFERENCE, medium confidence]** The inspected global Puppeteer files are the implementation used by the failing process: the stack names that installation. If installation contents changed after the failure, use the process-loaded version for the trace. The exact failing helper and retained tab’s prior emulation state remain unknown.