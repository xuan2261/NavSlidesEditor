## TL;DR — NO-GO for phase04 completion

One acceptance gap remains: **native Try does not pause pending local work when its document becomes hidden**. The generated Reveal lifecycle implements that behavior; the native adapter never invokes it. The supplied receipts otherwise support the bounded standalone name-picker integration—not all-ten gameplay or release.

## Findings

### 1. Blocking — native Try bypasses document-visibility lifecycle

**Source facts:**
- `client/src/components/education/native-game-try-adapter.jsx:11–15` mounts the local runtime and destroys it on cleanup. It registers no visibility handler.
- `shared/src/education/browser/mount.js:62–64` exposes internal pause/resume hooks, but does not itself observe visibility.
- Only `browser/reveal-lifecycle.js:7–14,43` connects `document.hidden` to those hooks.
- `runtime-session.js:12,27–34` starts unpaused; scheduled callbacks check that internal flag, not document visibility.
- `browser/games/name-picker.js:57` schedules winner resolution through that session.

**[INFERENCE — not browser-reproduced in this advisory]:** start a nonzero-duration pick in native Try, then hide the editor tab before resolution. Background scheduling can resolve it while hidden, or immediately on return, rather than preserving the remaining active delay.

This conflicts with the phase04 requirement that local hide/leave pauses pending feedback. `phase04-native-try-receipt.json` proves gameplay and unchanged saved JSON, but contains no native visibility transition.

**Recommended repair:** connect the native adapter to the existing internal lifecycle hooks; own/remove its visibility listener and reconcile initial visibility. Preserve the public `{getState, reset, destroy}` API and the single runtime state owner.

**Qualification scenario:** native Try pending pick → hide before its deadline → remain hidden beyond the duration → return with unchanged pending state → resolve once after the remaining active delay. Closing or resetting must still invalidate that work.

### 2. Nonblocking — duplicate dice DOM construction

`shared/src/education/browser/games/name-picker.js:31,44` constructs the dice subtree twice when entering dice mode; the second immediately replaces the first.

The concurrent simplifier’s finding is confirmed. Retain one construction path; no abstraction or behavior change is needed.

## Acceptance evidence that holds

| Boundary | Inspected evidence |
|---|---|
| **Same reachable implementation** | Native adapter calls shared `mount`; generated HTML loads the education IIFE. Native, hosted Present/Preview/Share, and portable receipts record actual winner/reset transitions. Try records identical before/after saved-deck SHA256. |
| **Reset, isolation, pending guards** | `runtime-session.js:16–19,27–34,58–83` guards dispatch/timers by lifetime, generation and timer ticket, and clears resources. `mount.js:17–19,44–58` preserves mount idempotency and root-scoped reset/destroy. Generated multi-root evidence records pending leave/resume, reset invalidation and independent inherited copies. Native visibility is the exception above. |
| **Inherited identity and allocation lifetime** | Generator and bootstrap use `collectEffectiveGameDescriptors`. `presenter-game-allocations.js:11–43` binds allocations to the live-room object/deck/content lineage, reuses unchanged allocations and retires records against the actual cleaned room. The accepted distinction between admission freshness and allocation lineage preserves reconnect state without raw-ID fallback. |
| **Public audience and fallbacks** | `element-renderers.js:897–916` selects explicit public projection for audience configs. `mount.js:21–35` validates audience data without private normalization and forces observer-only runtime. `socket-handler.js:79–88,114–128,224–246` funnels initial/fallback HTML through audience serialization with recipient and generation freshness checks. Bootstrap admission is rechecked after the authoritative read. Actual socket receipts record the role/notes boundary and replacement generation. |
| **Packaging, offline and CSP** | Required asset lists include both education files; the builder joins existing atomic vendor publication. Current manifest hashes match the multi-root receipt, and Reveal metadata is `6.0.2`. Portable evidence records wheel/dice/button play with zero HTTP/WS attempts. Correlated Electron 200-response headers and enforced violations prove ordinary renderer CSP enforcement—not packaged startup. |

The reduced-motion receipt is non-vacuous: 38 picking frames across the authored 700ms run, one identity transform throughout picking, and zero painted confetti frames during the subsequent observation. The four captures visually agree. This supports **no continuous rotation/confetti motion**, not `animationName === 'none'`.

The supplied verification remains **14 files / 84 tests passed**. Four distinct Playwright cases passed across two commands; not one four-case run. I did not rerun them.

## What to do next

1. Close the native visibility-lifecycle gap and exercise the native scenario above.
2. Preserve the existing generated/file, reset, keyboard and audience-boundary evidence.
3. Resolve the small duplicate-dice construction independently; it does not explain the acceptance gap.

Do not repair this by changing valid durations, relaxing CSP, introducing another state owner, or exempting native Try without an explicit contract change.

## Next phase05 risk

**Exactly-once scoring and turn advancement across deadlines, feedback and replay.** Name-picker does not yet prove accepted-command identity for Jeopardy adjudication, Relay timeout/pass, or Trivia buzz-plus-answer awards. Phase05 must preserve each game’s policy while reusing this runtime, then remove obsolete React play branches after equivalent reachable behavior is demonstrated.

## Review limits

Same-model separate-context review on `local52186/gpt-6.1-sol`; **not model-family-independent**. Read-only source, test, receipt and image inspection; no execution or edits.

I do **not** promote the retired-socket callback concern to a blocker: inspected Socket.IO teardown removes packet subscriptions, and no real late-delivery failure was established. The native missing visibility hook is source-confirmed; its browser timing consequence remains explicitly unexercised here.