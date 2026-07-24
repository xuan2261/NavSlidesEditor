# PPTX Secondary Parser Evaluation (Eval Only)

**Date:** 2026-07-24  
**Plan phase:** 8  
**Decision:** **Do not implement** a second production parser in this plan.

## Current baseline

- Production parse path: `parse-worker.js` → **pptxtojson only**.
- Import remains best-effort projection + package authority for package-backed decks.
- Corpus metrics (11-deck) and qualification lanes already separate intentional failures (adversarial lane post phase 6).

## Evaluation dimensions

| Dimension | Observation | Implication |
| --- | --- | --- |
| Unmapped / scene-graph gaps | Residual gaps tracked via ooxml inspection + native object coverage stats; adversarial stubs exercise guards, not L4 fidelity | Second parser may reduce some shape/diagram misses but does not fix package authority/source-map complexity |
| Semantic delta risk | Dual parsers without unified source-map contract create dual projection truths | High maintain cost; dual-shape regressions |
| Source-map / package-first | Package authority, generation fencing, and preserve-only charts assume one projection pipeline | Second parser would need full source-map rebind + matrix integration — multi-plan effort |
| Maintain cost | pptxtojson + worker isolation already operational; OfficeCLI path is package-first owned | Adding npm/native second parser doubles CVE/version surface |
| Cost/benefit | Marginal unmapped reduction vs dual-pipeline risk | **Not justified** for best-effort milestone |

## Optional micro-benchmark stance

- No second dependency installed.
- Existing unmapped/stats fields and corpus metrics are sufficient evidence for this eval.
- If a future probe is warranted: offline script only; must not mutate presentations store; must not claim L4.

## Exit criteria (Validation V4)

| Criterion | Result |
| --- | --- |
| Docs/eval only | **Met** |
| No secondary parser implementation | **Met** |
| No fallback dual-parser runtime | **Met** |
| Follow-up if ever greenlit | New plan under package-first / capability track — not silent ship |

## Recommendation

Keep **pptxtojson-only**. Invest remaining fidelity budget in package-first G4/G5 and oracle work, not a second best-effort importer.
