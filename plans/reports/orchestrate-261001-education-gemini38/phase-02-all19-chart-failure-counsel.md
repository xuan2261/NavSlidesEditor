## Decision

**Keep Phase02 unapproved. No repair is justified yet.** The timeout establishes that the selected frame never satisfied the Chart-instance predicate; it does not distinguish parse failure, dependency execution failure, construction failure, or incorrect frame/context selection.

Read-only inspection only. No edits, checks, browser actions, delegation, or model switching.

## Evidence

Saved `.playwright/phase02-manual/all19-final-portable.html` contains:

- **Line 112:** chart-position iframe identified as `data-offline-id="__offline_iframe_1"`.
- **Line 1190:** corresponding base64 payload, beginning with HTML containing an **inlined `/vendor/chart.js/dist/chart.umd.js` script**. A wholly missing chart payload is not supported by this artifact.
- **Lines 1195–1239:** restoration decodes that payload and assigns `el.srcdoc` under `file:`. This matches the current generator’s loading branch.

Current source:

- `shared/src/element-renderers.js:517–523` emits the Chart dependency, `canvas#c`, then synchronous `new Chart(...)`.
- `client/src/utils/offlineExport.js:191–209` performs vendor-script inlining inside decoded iframe HTML.
- `client/src/utils/offlineExport.js:355–500` serializes iframe payloads and restores them using `srcdoc` for `file:`.

**Limit:** I inspected the saved encoded payload’s prefix and restoration code, not its fully decoded scripts or browser execution. These observations do not establish that the complete Chart library parsed, that construction ran, or that the wait targeted the restored chart frame. They also do not establish whether every generated field came from the latest Vite module.

The reported focused two-frame PASS remains valid for that bounded scenario, not the full all19 consumer path.

## Next: minimal owner diagnostic

Instrument **one diagnostic execution of the same saved file, network-blocked**, without changing export routes or content:

1. **Attach before navigation.** Capture:
   - CDP `Runtime.exceptionThrown`
   - `Debugger.scriptParsed` and `Debugger.scriptFailedToParse`
   - execution-context/frame associations
   - Playwright `pageerror`, console errors, and failed requests

   Print captured diagnostics in `finally`, including on timeout.

2. **Resolve the actual chart frame by its owning iframe:**
   ```text
   iframe[data-offline-id="__offline_iframe_1"]
   ```
   Record the owning attribute, frame URL, and execution-context/frame IDs. Do not assume frame-array order or select the first canvas-bearing frame.

3. **In that frame, record:**
   - `document.readyState`
   - presence of `canvas#c`
   - `typeof window.Chart`
   - `typeof window.Chart?.getChart`
   - instance presence, only when the method exists
   - script count, script `src` values, and the chart-construction script text

4. **Retrieve script source at the reported exception/parse location.** Compare the fully decoded saved chart payload with the current serializer’s expected construction script.

### How to distinguish the causes

| Observation | Conclusion supported |
|---|---|
| Failed parse or exception located in the embedded vendor script | Dependency parse/execution failure |
| Chart exists; exception located in `new Chart(...)` | Construction failure; inspect that exact configuration and stack |
| An instance exists in the chart-owned frame but the original wait remains unsatisfied elsewhere | Incorrect frame/context selection |
| Decoded saved construction differs from current generator output | Generated-artifact discrepancy; determine stale module versus differing saved input |
| No captured error and no instance | Still unresolved; confirm construction script parsing/execution before editing |

Do not suppress errors, add initialization retries, or substitute another export. Preserve the separate Markdown/offline-regex **2FAIL → PASS** counter; this Chart failure is a distinct unresolved Verify result. Chart values, LaTeX, media, and QR remain **not reached**, not failed.

## Owner diagnostic disposition
CDP same saved file, network blocked: restored iframe __offline_iframe_1 has canvas#c, window.Chart function, getChart function, instance present. No Runtime exceptions, failed script parses, pageerrors, console errors or failed requests. A second frame __offline_iframe_2 also contains canvas#c, but Chart is undefined. The throwaway smoke iterated all frames and overwrote chartFrame with this later non-Chart frame. Evidence artifact://373 and artifact://375. Fix the smoke target using the observed chart-owning iframe; no application edit warranted. Remaining matrix assertions still need execution.
