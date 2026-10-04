## TL;DR — Phase04 remains NO-GO

The 30-second timeout is **unlocalized verification failure**, not evidence that the visibility repair is wrong. The inspected adapter correctly connects native Try to the existing pause/resume lifecycle; no independent blocking source defect was found in that path. Recover with a freshly loaded native surface and checkpointed headed-browser proof—not another production edit or a larger global timeout.

Counsel: `local52186/gpt-6.1-sol`, same-model separate-context; **not model-family-independent**. Read-only inspection; no execution, edits, or delegation.

## Reframed problem

Two separate facts must remain separate:

- **Confirmed original defect:** `phase04-native-visibility-before.json` records a genuinely hidden document, `paused:false`, and a transition from Picking/0 picks to Chi/1 pick during approximately 1813ms hidden. This is valid expected RED evidence.
- **Unconfirmed repair outcome:** the after-run produced no intermediate checkpoints or receipt. Nothing identifies whether it stalled during setup, interaction, visibility switching, resolution observation, or cleanup.

HMR changing the modal or selection is **[INFERENCE]**, not an established diagnosis.

## Source assessment

### Remaining-delay logic is sound for this scenario

- `native-game-try-adapter.jsx:12–24` captures the root’s `ownerDocument`, mounts first, registers `visibilitychange`, and immediately reconciles initial visibility.
- `browser/mount.js:34,62–65` uses the existing local session and exposes internal lifecycle hooks; the public API remains `{getState, reset, destroy}`.
- `runtime-session.js:65–80` saves `max(0, due − now)` on pause, invalidates the armed callback’s ticket, and re-arms only that remaining delay on resume.
- `runtime-session.js:27–34` rejects callbacks with stale lifetime, generation, ticket, or timer membership.

An initially hidden mount also works: pause occurs before interaction; subsequently scheduled work remains unarmed until resume. Repeated pause/resume calls are guarded.

The adapter regression specifically checks **150ms active + 2000ms hidden + 850ms resumed** for a 1000ms selection. The supplied **3 files / 15 tests passed** result supports this logic; I did not rerun it.

### Teardown is sound

- `native-game-try-adapter.jsx:25–28` removes the document listener **before** destroying the mounted instance.
- `game-try-launcher.jsx:11–13` conditionally renders the modal, so closing Try unmounts the adapter rather than merely hiding its DOM.
- `browser/mount.js:51–59` destroys session resources, removes instance ownership, and clears the paused class.
- `runtime-session.js:50–58,81–86` invalidates and clears scheduled work and owned resources.
- The second adapter test covers initially hidden mounting and closing/reopening without old work resolving into the reopened session.

**Finding:** no independent blocking correctness gap is visible in the reviewed adapter/session/teardown path. This does not establish that the failed browser run loaded and exercised that implementation.

## What to do — ordered recovery sequence

### 1. Establish a clean, current native surface

Use the same dedicated headed Chrome setup that produced real visibility transitions—not the managed Chromium already observed to remain visible.

Freshly navigate or reload the native editor after the source change, then explicitly reselect the intended game and reopen Try. At the actual viewport, handle **Skip Tour** and **Open inspector** if required.

Before timing begins, record:

- Browser/version, URL and viewport.
- Exactly one intended Try dialog and native game root.
- Root `{effectiveSlideId, elementId}`.
- Serialized effective configuration, including the authored **700ms** duration.
- `document.hidden:false`, `visibilityState:"visible"`.
- Ready state, 0 picks, enabled reset/mode/pick controls.
- Evidence that the served native adapter contains the visibility repair.

Do not assume an existing modal survived HMR unchanged. Do not rebuild the unrelated generated-runtime bundle merely because this native verification timed out.

### 2. Localize the harness before running the timed case

Create the auxiliary tab **before starting a pick**. Exercise only the real tab-switch mechanism:

1. Native tab to front.
2. Auxiliary tab to front.
3. Observe native `hidden:true` and `visibilityState:"hidden"`.
4. Native tab to front.
5. Observe native visible again.

Use short, explicit operation timeouts and emit a checkpoint before and after each awaited operation. If this fails, the blocker is visibility/harness setup; no product timing conclusion follows.

### 3. Capture the timed behavior inside the page

Install a temporary, timestamped recorder before the pick. Record visibility events and winner/progress DOM changes, including the paused class and root identity. Capture visibility state **after the adapter’s handler has reconciled it**, rather than relying on listener registration order.

Then execute the original qualification:

| Checkpoint | Required observation |
|---|---|
| Reset and select button mode | Ready; 0 picks; effective duration still 700ms |
| Immediately after native click | Picking; 0 picks; intended root unchanged |
| Actual hide transition | Still pending; `hidden:true`; paused class present |
| After approximately 1800ms hidden | Still Picking/0 picks; no winner resolution |
| Actual visible transition | Pending state preserved; paused class removed |
| Resolution | One winner and exactly 1 pick after remaining active delay |
| Later settled observation | Still 1 pick; no second resolution |

Use event timestamps and a page-side resolution record. **A delayed tool response can arrive after a correct resumed selection has already resolved**, so a late “still pending” sample must not be mistaken for immediate-on-return resolution.

Likewise, the requested 100ms wait is not proof of 100ms active elapsed time. Confirm the pick was still pending at the actual hide event. If switching consumed the full duration, that attempt is inconclusive—not a repair failure.

### 4. Make failures survivable and attributable

Persist or emit each checkpoint as it occurs; do not write the only receipt after successful completion.

Bound cleanup separately and preserve the primary failure. A stalled `bringToFront()` or auxiliary-tab close in `finally` must not obscure where the behavioral sequence failed. Do not assume the timed-out invocation finished or cleaned up before reusing its page.

### 5. Complete the native acceptance record

After the visibility case passes, exercise native pending close/reopen and reset invalidation with the same checkpoint discipline. Combine that evidence with the existing regression result, then obtain completion counsel.

## What to avoid

- Treating the timeout as a product bug or as completed-change proof.
- Replacing real visibility transitions with synthetic `visibilitychange` or an overridden `document.hidden`.
- Accepting the paused CSS class alone; pending state must remain unchanged beyond the original deadline.
- Increasing valid authored duration, restarting the full delay on return, exposing new public lifecycle APIs, or adding another state owner.
- Blindly increasing the global timeout or repeatedly running the same opaque sequence.
- Repeating the successful RED reproduction merely to reconfirm it.

## Blocker and success criteria

**Current blocker:** missing actual headed-browser after-proof; the stalled operation is unknown. No source change is justified by the timeout alone.

**GO threshold:** a receipt shows the same native root pending before hide, genuinely hidden and paused beyond 700ms, pending at visibility return, resolving once after its remaining active delay, and remaining settled; native reset/close ownership evidence and completion counsel also pass.

**Assumptions:** the timed-out browser call may have left its page or auxiliary tab in an altered state (**medium confidence**); fresh navigation and explicit checkpoints remove reliance on that assumption. HMR involvement remains unproven.