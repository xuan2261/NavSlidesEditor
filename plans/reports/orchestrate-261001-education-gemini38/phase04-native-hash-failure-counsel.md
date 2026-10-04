## TL;DR

**NO-GO for Phase04 completion; GO only for a narrowly scoped evidence-collection run.** The ownership receipt proves the UI behavior, but saved authored-deck isolation remains unproved. Do not make another production edit or rewrite game timers.

Counsel: `local52186/gpt-6.1-sol`, same-model separate-context—not model-family-independent. Read-only inspection; no execution, edits, or delegation.

## Reframed problem

The failed comparison spans **pre-HMR saved state → document refresh/recovery → successful native interactions**. It does not isolate which interval changed the API representation.

The missing acceptance evidence is unchanged saved authored content—not another demonstration of reset, Escape, or stale-callback behavior.

## Verified evidence

### Existing successes stand

`phase04-native-ownership-after.json` records:

- Pending pick → Reset → zero picks immediately and after approximately 910ms.
- Focused first Escape → Inspector remains, game roots reach zero, focus returns to **Try game**.
- Second Escape → Inspector closes.
- Reopened session → zero picks beyond the destroyed session’s 700ms deadline.
- New pick → exactly one result; unchanged after approximately 909ms.
- Every mounted root retains `parent/local` and the recorded authored configuration, including 700ms duration.

The prompt reports the focused RED and subsequent **2 files / 7 tests GREEN**; neither was rerun here. These results do not prove persistence isolation, but the hash failure does not invalidate them.

### Persistence source facts

- `server/routes/presentations-crud.js:279–285` reads authoritative state, normalizes notes, and returns an editor DTO. **There is no read/open timestamp assignment in this handler.**
- `server/services/presentation-finder.js:48–52` obtains the stored deck through `readPresentations`; `server/services/storage.js:166–169` reads JSON under a lock.
- `server/services/package-backed-presentation-read.js:124–137` resolves normalized compatibility/package authority. `package-store-runtime.js:66–72` returns the active store for ordinary runtime reads.
- Read normalization can change the returned representation: legacy PPTX resolution normalization, notes normalization, and DTO authority filtering. The inspected implementations do not introduce a clock-based read timestamp.
- Conversely, a non-package PUT merges editable request fields and assigns `updatedAt` (`presentations-crud.js:335–355`). **An apparently metadata-only save is possible, but a PUT can also change authored content.**

### Recovery source facts

- **Use Remote** maps to `dismissSaveRecovery` (`client/src/components/editor/editor-page-chrome.jsx:137–141`).
- That callback clears the matching local draft and dismisses recovery; it does not schedule a server save (`use-editor-recovery-controller.js:18–29`). Draft clearing targets local storage/IndexedDB (`editor-draft-store.js:216–228`).
- The loader installs the migrated remote object and suppresses autosave for that exact object (`use-editor-persistence-controller.js:103–117,150–157`).
- The persistence controller also flushes pending saves during cleanup (`:160–169`); the save controller can issue keepalive PUTs (`use-editor-save-controller.js:217–237`).

**[INFERENCE]** Refresh/teardown could have dispatched a pending save. This is a source-supported possibility, not evidence that it happened—or that its payload was harmless.

## What the mismatch establishes

The recorded hashes differ:

- Before: `1b142d5c…e847126`
- After: `1446feaa…e8d037a`

The check hashes `JSON.stringify(await response.json())`, not the original HTTP bytes. It is sensitive to object-key order as well as values.

The original parsed response was not retained. Therefore:

- No exact historical field diff is available.
- Timestamp drift, key-order changes, recovery effects, and authored mutation remain unproved explanations.
- The first receipt’s `post-repair-HMR-recovery` label does not establish a fresh post-recovery baseline: the supplied provenance places that hash before HMR.
- Unchanged mounted game configuration covers only that configuration—not all saved slides, children, notes, masters, or deck settings.

**Do not classify this as harmless read/open metadata drift. The inspected GET path provides no such explanation.**

## Minimum next receipt

1. **Preserve the current recovered document and authored inputs.** No production edits, reload, navigation, resize, fixture replacement, manual save, or authored configuration change.

2. **Establish a new, explicitly scoped boundary.** Observe save/network activity before taking the baseline. Account for the 1500ms autosave debounce and any outstanding write completion; elapsed time alone is insufficient if a write remains active. Retain any observed deck-write request, payload, response, and timing.

3. **Persist a complete fresh baseline before interaction.** Store the entire parsed GET response, its exact serialized representation, SHA256, deck ID, document identity, visibility, effective tuple, and authored configuration. The baseline must precede the new qualification sequence—not reuse the historical hash.

4. **Repeat only the ownership/isolation sequence within that boundary:** pending pick → Reset → settled zero; pending pick → focused Escape; Inspector preserved; second Escape closes Inspector; native reopen; zero beyond the old deadline; new pick → exactly one → settled without duplication. Emit each checkpoint before advancing. **Do not repeat the already-qualified hidden case.**

5. **Retain the complete final GET response and write activity through the settled observation.** Apply the same full-response comparison. On mismatch, emit concrete changed paths and values. A recursively key-sorted comparison, preserving array order and every field, may distinguish ordering from value changes—but must remain diagnostic, not silently replace the original gate.

6. **Keep the historical failure explicitly unresolved.** A successful new receipt proves isolation for its stated post-recovery interval. It cannot retrospectively establish that the pre-HMR deck was unchanged.

## Alternatives and trade-offs

- **Recommended: fresh, full-response-bracketed native receipt.** Smallest reachable proof of isolation without changing product code. Assumes the recovered deck remains an eligible authored input; fails if writes cannot settle or the response changes.
- **Historical reconstruction:** meaningful only if an actual contemporaneous baseline body exists. A fixture, snapshot, or newly fetched response cannot recover a hash’s missing input or prove the old comparison.
- **Dropping timestamps or comparing only `gameConfig`: reject.** This would conceal possible saves and narrow the acceptance criterion without evidence.

Better approach: retain full boundary responses and write provenance alongside hashes. It adds evidence, not a second persistence convention.

## Success metrics / stop conditions

Completion requires the existing UI successes **plus** a fresh saved-deck isolation receipt, with the complete deck unchanged across the qualified sequence. Any differing value or unexplained write keeps the checkpoint blocked and becomes the next counsel input before production diagnosis or edits.

Assumptions: **high confidence** that the supplied hash provenance is authoritative; **unresolved** whether the historical mismatch affected authored content. No assumption that timestamp drift is benign.