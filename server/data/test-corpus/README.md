# PPTX Import Test Corpus

This directory is the default corpus for `npm run test:corpus`.

All generated decks are hand-built synthetic fixtures created for NavSlides
import regression testing. The copied Vietnamese school decks come from the
existing checked-in `PPTX/` corpus and are retained here so the default corpus
has at least 10 decks.

## Fixtures

| File | Source | Coverage |
|---|---|---|
| `Bai_2_1.pptx` | Existing `PPTX/` corpus | Mixed real-world text, images, shapes, tables |
| `Bai_2_2.pptx` | Existing `PPTX/` corpus | Mixed real-world text, shapes, tables, equations |
| `Bai_2_5.pptx` | Existing `PPTX/` corpus | Mixed real-world text, images, shapes, tables |
| `STTre_Duc.pptx` | Existing `PPTX/` corpus | Larger real-world deck, text, images, shapes |
| `chart-bars-lines.pptx` | Hand-built synthetic | Bar and line charts with titles and legends |
| `chart-pie-scatter.pptx` | Hand-built synthetic | Pie and scatter charts |
| `diagram-process-flow.pptx` | Hand-built synthetic | Shape-based process diagram, arrows, brace annotation |
| `background-image-notes-footer.pptx` | Hand-built synthetic | Full-bleed image-like background, footer text, speaker notes |
| `math-rich-text.pptx` | Hand-built synthetic | Equation-like text, rich text runs, math symbols |
| `table-shapes-media.pptx` | Hand-built synthetic | Table borders, image payload, shape palette |
| `non-default-4x3-resolution.pptx` | Hand-built synthetic | 4:3 slide size, canvas-resolution normalization, export layout split |

Note: the current `pptxtojson` parser exposes the generated chart objects in
`chart-bars-lines.pptx` and `chart-pie-scatter.pptx` as shape-backed content in
the corpus metrics. The decks still contain native PPTX charts, but current
baseline counts them under `shape` until parser chart extraction improves.

## Acceptance Gate

The Phase 9 acceptance gate expects:

- at least 10 `.pptx` files in this directory
- average semantic >= 98%
- average production round-trip floor >= 50% as a regression floor
- no deck below 95% semantic fidelity
- no element-class count drop above 15%
- imported presentations satisfy the reusable PPTX acceptance invariants:
  canonical canvas resolution, finite numeric length fields, no raw CSS
  `pt`/`in`/`cm`/`mm` units in rich HTML, and no dangerous CSS/url tokens

Keep each new fixture under 5MB unless a plan explicitly needs a large-file
performance fixture.
