## TL;DR

**GO for identity/timing diagnostics and a fixture repair if confirmed. NO-GO for Phase04 acceptance.** The failed assertion does not yet establish broken pause behavior: it clicks `local` but checks `paused[0]`, whose identity was not asserted, and it does not establish that selection was still pending when navigation occurred.

Counsel: `local52186/gpt-6.1-sol`, separate-context, same-model; no model-family independence. Read-only inspection; no edits, tests, browser execution, build, lint, or formatting.

## Source-derived findings

### 1. Wrong-root assertion is the first suspect

The click selects `data-ns-element-id="local"`; the assertion selects a document-order position.

- Layout resolution combines inherited fixed elements and owned elements, then orders them by position/z-index: `shared/src/slide-layouts.js:31-50`.
- HTML rendering sorts elements by z-index again: `shared/src/element-renderers.js:969-985`.
- Inherited IDs are rewritten to `layout-fixed:<layoutId>:<elementId>`: `shared/src/slide-layouts.js:4-5,40`.

**[INFERENCE]** With equal z-indices, the inherited fixed picker precedes the owned picker. Then `paused[0]` describes an untouched inherited instance, not the clicked local instance. The supplied evidence does not include the fixture’s z-indices or printed root order, so that ordering is not confirmed.

**Smallest repair if confirmed:** select state by `{effectiveSlideId, elementId}`, not array index. Do not change production ordering to satisfy the assertion.

### 2. `700ms` is valid in current source; no duration coercion is evident

The requested `shared/src/education/game-config-schemas.js` does not exist in this worktree. The current authority is:

- `game-field-rules.js:2-4`: integer `animationDuration` range **0–60000**.
- `normalize-game-config.js:24-31`: nested authored values override flat values; defaults fill missing fields.
- `browser/games/name-picker.js:53-57`: duration `0` resolves synchronously; otherwise resolution is scheduled for the configured duration.

Thus **700 is allowed**. Current source provides no basis for claiming it normalizes to zero or must be replaced with an enumerated duration.

Check the **serialized effective root config**, not merely the fixture-construction input. A conflicting nested config, wrong root, or differently served bundle remains unverified.

### 3. Selection may have completed before the leave event

The sequence crosses two browser-tool operations:

1. `page.click(...)`
2. `page.evaluate(() => Reveal.slide(0,1))`

There is no immediate post-click state or elapsed-time receipt.

**[INFERENCE]** If more than 700ms elapsed before navigation, pause cannot preserve an already completed selection. Increasing the subsequent off-slide wait does not discriminate this case.

**Smallest diagnostic:** activate the button, capture pending state, navigate, and capture immediate post-navigation state within one browser evaluation. Retain a separate native-click journey for user interaction coverage.

### 4. Current active-leaf and mount code is consistent with the intended contract

- `browser/reveal-lifecycle.js:7-14` compares `root.closest('section')` with `Reveal.getCurrentSlide()`.
- It reconciles on `slidechanged`: lines 42–43.
- `htmlGenerator.js:344-380` wraps the parent and each child in distinct inner sections. That matches nearest-section leaf ownership.
- `browser/mount.js:17-19` returns the existing API for an already mounted root.
- `runtime-session.js:65-80` preserves timer remaining time during pause and re-arms it on resume.

Calling `NavSlidesEducation.mount(root).getState()` therefore does **not** reset an existing instance in current source.

These findings reduce suspicion of a simple leaf-comparison or remount bug; they do not prove that the browser loaded this implementation or received the expected event.

### 5. Hosted artifact freshness remains unproven

Hosted HTML loads `/vendor/navslides-education/runtime.js`, not browser source directly.

- `scripts/build-education-runtime.js:7-14` bundles current source.
- `scripts/copy-vendor.js:111-119` publishes those assets through the existing vendor transaction.
- `server/index.js:239` serves that server’s vendor directory.
- `shared/tests/helpers/education-document.js:16-25` builds a fresh temporary education bundle for JSDOM tests.

Consequently, passing generated-document tests can coexist with a stale hosted bundle. The inspected on-disk bundle contains the duration-range, leaf-comparison, and mount-idempotency patterns, but that does not identify the bytes actually served through ports 55173/34102.

## Ordered diagnostic and repair checklist

1. **Record identity before asserting behavior.** Print all four `{effectiveSlideId, elementId}` tuples; locate the clicked local root by tuple.
2. **Record effective config and readiness.** Capture its serialized duration, `runtimeMode`, `Reveal.isReady()`, current leaf, nearest section, visibility, and paused CSS class.
3. **Identify the served artifacts.** Compare fetched JS/CSS bytes with the intended worktree’s published assets and manifest. Republish through the existing pipeline only if stale publication is established; reload before further behavior claims.
4. **Capture the transition atomically.** Click, capture `phase/picks/pending/generation`, navigate to the child, then capture the same root and active-leaf identity in one evaluation. Add a temporary `slidechanged` receipt with timestamps.
5. **Choose the repair from evidence.**
   - Wrong root → repair the fixture’s tuple-based assertion.
   - Completed before leave → repair sequencing and pending-state precondition.
   - Stale artifact → repair publication/loading.
   - Correct root pending at leave, current artifact, child active, but timer resolves while away → investigate lifecycle delivery and pause invocation. That is the evidence threshold for a production pause repair.

## Required before/after real-browser proof

Using real Reveal/vendor assets and the same tuple throughout:

- Before leave: local picker is `picking`, `picks === 0`, with a pending winner.
- Immediately after leave: child is the active leaf; local root is paused.
- After an off-slide interval exceeding the effective duration: pending selection, picks, exclusions, and generation remain unchanged.
- On return: same root/API and pending selection persist; resolution occurs once after the remaining active delay, not immediately or after a restarted full duration.
- Inherited parent, child, and second-parent instances remain independent; hidden override remains absent.

Retain a focused regression for whichever consumer-visible failure is confirmed. Isolated session/JSDOM timer tests remain supporting evidence, not phase acceptance.

**Avoid:** assuming the unprinted paused state, changing valid duration rules, increasing waits blindly, adding public lifecycle APIs, or rewriting the timer/session architecture before distinguishing fixture identity, timing, and served-artifact causes.