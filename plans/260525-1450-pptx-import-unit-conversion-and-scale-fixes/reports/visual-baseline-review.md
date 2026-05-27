# Visual Baseline Review

Date: 2026-05-25

## Reference Source

- PowerPoint COM export used: `C:\Program Files\Microsoft Office\root\Office16\POWERPNT.EXE`
- Reference PNGs: `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/reports/powerpoint-reference/`
- App baselines: `tests/e2e/pptx-import-visual-fidelity.spec.js-snapshots/`
- Review montages and diff images: `plans/260525-1450-pptx-import-unit-conversion-and-scale-fixes/reports/visual-review/`
- The reviewed app baseline PNGs are part of the gate and must be committed with the Playwright spec.

## Harness Decisions

- `tests/e2e/pptx-import-visual-fidelity.spec.js` disables the first-run product tour before opening the editor.
- The harness normalizes the editor canvas to `scale(1)`, removes editor-only canvas shadow, and screenshots a 960x540 clip from `.slide-canvas`.
- Baseline activation stays guarded by `PPTX_VISUAL_BASELINES_REVIEWED=1`.

## Findings

- Initial visual review caught a real runtime regression: client sanitizer imported a new CJS named export that Vite did not expose reliably.
- Review also caught shape mapping drift: built-in `rect` and `line` shapes with `path` were being treated as raw SVG. This lost shape rich text and line semantics.
- Fixed by mapping line shapes before custom SVG path handling and by limiting raw SVG path mapping to custom/freeform geometry.
- `non-default-4x3-resolution.pptx` now renders title/body text, centered box, and bottom line at canonical 960x540 canvas size.
- `Bai_2_1.pptx` still has known broad visual drift from grouped background/image fidelity outside this unit-conversion phase. It remains useful as an app-regression baseline, not as a source-identical PowerPoint assertion.

## Commands

```powershell
$env:PPTX_VISUAL_BASELINES_REVIEWED='1'; npx playwright test tests/e2e/pptx-import-visual-fidelity.spec.js --project=chromium --update-snapshots
$env:PPTX_VISUAL_BASELINES_REVIEWED='1'; npx playwright test tests/e2e/pptx-import-visual-fidelity.spec.js --project=chromium
```

## Unresolved Questions

- Should grouped background/image fidelity for `Bai_2_1.pptx` become a separate follow-up plan?
