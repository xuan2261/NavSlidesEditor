# Implementation Evidence

## D1 Markdown print renderer parity

- Red test: `shared/tests/markdown-reveal-textcolor-fontsize.test.js` added print-branch Markdown rendering and unsafe payload assertions.
- Green intent: print output now uses synchronous sanitized Markdown HTML instead of escaped raw Markdown text.

## D2 Table selected-cell bounds safety

- Red tests: `table-properties-utils.test.js` covers cell clamping, `table-properties.test.jsx` uses a stateful harness across row/column deletion.
- Green intent: selected cell is clamped to the nearest existing cell before reads/writes.

## D3 Line marker identity parity

- Red test: `line-element-renderer.test.jsx` covers same-prefix and hostile IDs in one DOM.
- Green intent: canvas marker IDs use deterministic full-ID FNV-1a hash tokens.

## D4 Resolution-aware ribbon alignment

- Red test: `ribbon-format-tab-element-position-size-rotation-controls.test.jsx` covers custom slide width and mixed X placeholder.
- Green intent: center/right alignment uses `slideWidth` or `presentation.resolution.width`, falling back to `CANVAS_WIDTH`.

## D5 QR preview error and race handling

- Red test: `qrcode-element-renderer.test.jsx` covers reject clearing stale image and latest-request-wins behavior.
- Green intent: QR preview clears data on new requests, shows an error fallback on current reject, and ignores stale promise results.

## D6 Offline runtime and script-breakout parity

- Red tests: `chart-element-renderer.test.jsx`, `latex-element-renderer.test.jsx`, `server/vendor-assets.test.js`, and `tests/e2e/element-preview-offline-runtime.spec.js`.
- Green intent: Chart, KaTeX, and TikZJax preview runtimes use local `/vendor` paths, required vendor paths are asserted, and generated script boundaries escape `</script>` payloads.

## Validator status

- Targeted Vitest: passed, 9 files and 38 tests.
- Playwright offline runtime smoke: passed, 1 test.
- `npm run lint`: passed with 0 errors and 16 pre-existing warnings.
- `npm run build`: passed.
- `npm run test`: passed with an 1800s timeout, 324 files passed and 1 skipped, 2747 tests passed and 1 skipped, duration 697.15s.