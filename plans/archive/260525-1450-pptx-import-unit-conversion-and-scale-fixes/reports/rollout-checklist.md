# Rollout Checklist — PPTX Import Unit Conversion And Scale Fixes

## Preconditions

- `npm run lint` passes with 0 errors.
- `npm run test` passes.
- `npm run test:corpus` passes strict corpus gates with production round-trip export.
- Focused PPTX import endpoint round-trip E2E passes.
- Visual regression baselines are reviewed before release tagging if new screenshots are generated.
- `PPTX_VISUAL_BASELINES_REVIEWED=1 npx playwright test tests/e2e/pptx-import-visual-fidelity.spec.js --project=chromium` passes after reviewed baselines are present.

## Deployment Steps

1. Merge the completed plan branch into `master`.
2. Deploy to staging.
3. Import `Bai_2_1.pptx`, `Bai_2_5.pptx`, and `non-default-4x3-resolution.pptx` on staging.
4. Manually verify imported text size, line-height, table typography, shape rich text, SVG paths, and 4:3 export aspect ratio.
5. Run strict corpus against the staged build where applicable.
6. Run visual regression in the same environment used for accepted baselines.
7. Tag the next release after staging verification.
8. Monitor PPTX import failure rate and user reports for 24 hours after production deployment.

## Rollback

- Prefer reverting the merge commit only after confirming 4:3 PPTX export compatibility.
- Decks imported after this change store canvas `resolution: 960x540` and preserve source slide dimensions in `_pptxMeta.originalSize`.
- If rollback is required, keep the export-layout compatibility behavior until post-fix imported decks can still export at their original aspect ratio.

## Known Manual Gate

- Playwright visual baselines require human review against source PPTX/PowerPoint or LibreOffice reference output before they are accepted as release evidence.
- The visual-fidelity Playwright spec is intentionally skipped unless `PPTX_VISUAL_BASELINES_REVIEWED=1` is set, preventing unreviewed app-rendered screenshots from becoming an implicit source of truth.
- This local environment did not expose `soffice`, `libreoffice`, or `powerpnt` in PATH during implementation; run the reference export/review step in an environment with PowerPoint or LibreOffice installed.
