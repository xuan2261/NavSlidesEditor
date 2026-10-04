## Decision

**Continue the scoped diagnosis and evidence-backed repairs under the existing authorization. This is not Phase02 approval or a GREEN checkpoint.** Preserve the playback requirement; do not replace it with transcript persistence or successful source entry.

Read-only source inspection performed. No edits, runtime/API/browser access, checks, delegation, or model switching.

## Source evidence

The inspected boundaries **explicitly support audio data URLs**; they do not establish that this particular URL reached the player intact.

| Boundary | Evidence |
|---|---|
| URL entry | `client/src/utils/url-safety.js:15–35` trims, checks shared media safety, and enforces the requested data-media kind. `data:audio/wav;base64,…` satisfies the declared kind. |
| Shared whitelist | `shared/src/content-safety.js:4–8,36–50` allows base64 `image/audio/video` data URLs, including subtype `wav`. No URL-length cap here. Whitespace/control characters are rejected before the data regex. |
| Audio input | `client/src/components/properties/media-properties.jsx:35–44` is controlled by `element.src`; accepted changes call `onUpdate({src: next.value})`. Rejected nonempty input silently does not update the source. |
| Input wrapper | `client/src/components/ui/Input.jsx:4–16` forwards attributes; neither it nor the audio field specifies `maxLength`. |
| Element mutation | `client/src/hooks/editor-controller/use-editor-element-controller.js:18–39` blocks updates to locked slides/elements. Successful updates merge the source patch. |
| Normalization | `shared/src/media-accessibility.js:55–67` preserves `src` via object spread; limits apply to descriptions, not the audio URL. Client reload migration invokes this normalizer in `client/src/utils/editor-presentation-migration.js:25–40`. |
| Save boundary | `server/middleware/schemas.js:32–44` passes through type-specific fields such as `src`. The recursive authority sanitizer preserves primitive `src` strings. The non-package PUT branch merges the submitted data in `server/routes/presentations-crud.js:332–355`. Request-body limit is `50mb` in `server/index.js:172`. |
| Canvas | `client/src/components/canvas/canvas-element-wrapper.jsx:656–664` renders `<audio src={sanitizeMediaSrc(media.src)}>`. No audio fragment rewriting or explicit source-loading effect in that branch. |
| Export | `shared/src/element-renderers.js:633–644` also sanitizes the normalized audio source before rendering. |

**No length restriction or data-URL prohibition was found in these inspected boundaries.** Package-backed authority/DTO handling is not fully traced; do not assume that route applies to this temporary deck.

The clipboard helper’s `{"source":"page"}` does **not** prove successful authoring. The description/transcript text proves metadata rendering, not source identity.

## WAV arithmetic

The described construction is internally consistent, **conditional on the actual bytes matching it**:

- Samples: `16000`; mono, signed 16-bit PCM.
- Payload: `16000 × 2 = 32000` bytes.
- Total: `44 + 32000 = 32044` bytes.
- RIFF size at offset 4: `32044 − 8 = 32036`.
- Format chunk length: `16`; PCM format: `1`.
- Block alignment: `1 × 16/8 = 2`.
- Byte rate: `8000 × 2 = 16000`.
- Data chunk length: `32000`.
- Duration: `16000/8000 = 2` seconds.
- Base64 length: `4 × ceil(32044/3) = 42728`.
- Complete URL length with the 22-character prefix: **42750**.
- Sample amplitude ±8000 fits signed int16. Both 440 Hz and 660 Hz are below the 4000 Hz Nyquist frequency.

Writing `WAVEfmt ` at offset 8 correctly places `WAVE` at 8–11 and `fmt ` at 12–15. No mathematical header defect is apparent. **Actual encoded bytes and browser decoding remain unobserved.**

## Next diagnostic sequence

### 1. Preserve and inspect the failed state before changing anything

Parent should collect, for the exact `audio-source` element:

- Audio input value and exact equality to expected B.
- Live editor element `src`, plus slide/element lock state.
- Audio `getAttribute('src')`, `.src`, and `.currentSrc`.
- `readyState`, `networkState`, `error?.code`, `error?.message`, `duration`, `paused`, `ended`, `currentTime`.
- Saved source from the completed save response and a fresh presentation read.
- Existing console/CSP/resource errors.

Compare full strings against B; report lengths/prefixes or digests rather than dumping the base64. `currentSrc` can be empty before resource selection, so interpret it alongside the literal attribute and media state.

**Do not reload or call `load()` first:** both discard useful evidence about the failed state.

### 2. Classify the first divergence

- **Input/live state is A, empty, or different from B:** investigate paste replacement, selection, validation, or lock rejection. Not a codec conclusion.
- **Live state is B; DOM attribute differs:** investigate canvas props, normalization, or stale rendering.
- **DOM is B; saved/read source differs:** investigate save completion, stale snapshot, or the observed server read path.
- **All sources equal B:** investigate actual bytes, browser decoding, loading, and runtime policy.

The observed `NotSupportedError` establishes failed source playback, **not which boundary caused it**. `readyState:0` and JSON `duration:null` do not establish malformed WAV bytes.

### 3. Isolate fixture from application behavior

Once source identity is captured:

1. Decode the **actual failed data URL**, not a freshly regenerated replacement. Inspect byte length and every header field above.
2. Try those exact bytes in a minimal native audio control in the same browser document, independent of the editor.
3. If needed, compare that data URL with an `audio/wav` Blob URL made from the same bytes.
4. Use an independently validated WAV as the decoder control.

Interpretation:

- Incorrect decoded header/payload → **fixture construction or transfer defect**.
- Exact B plays independently but not in canvas → **product integration/loading inconsistency**.
- Same bytes play as Blob/upload but not as data URL → investigate browser/policy/data handling. An upload proves a supported playback path; **it does not resolve the declared data-URL contract**.
- Correct-looking bytes fail everywhere → decoder/runtime investigation remains open; arithmetic alone cannot certify the fixture.

Do not broaden the whitelist, bypass sanitization, add an unconditional `load()` workaround, or change MIME type without discriminating evidence.

## Repair and acceptance sequence

Repair only the demonstrated boundary. For a product defect, preserve a meaningful failing-before/passing-after regression where practical; coordinate with the two source workers before touching overlapping files.

Then exercise the actual editor path:

1. Author A; save and reload; verify exact persisted A and advancing playback.
2. Replace A with B through **Audio source URL**; verify live state and DOM become B.
3. Save, await completion, reload, and verify persisted source and rendered source are exactly B.
4. Play B; observe `currentTime` at two successive points with a positive increase, `paused === false`, and no media error. Expected duration is approximately two seconds.
5. Verify the description/transcript survived that same reload.

Exact B identity matters: advancing time alone could still be playback of A.

**Permission to resume scoped diagnosis and proven repairs: yes. Phase02/all-19 approval: no; playback and pending integrated verification remain outstanding.**