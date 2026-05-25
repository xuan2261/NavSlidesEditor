# Geometry Drift Diagnostic

Date: 2026-05-24

## Summary

Phase 3 root cause was the fidelity tester, not the PPTX mapper.

The old diagnostic flattened grouped PPTX children as local group coordinates, then compared them to NavSlides elements already mapped to absolute canvas coordinates. That made grouped shapes look hundreds of pixels away even when import geometry was correct.

## Evidence

Command:

```bash
node server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js ./PPTX --drift-out=plans/260524-1729-pptx-import-review/reports/shape-drift-baseline.json
```

Before source-group transform:

| Deck | Shape count | >50px drift | Median | Max |
|---|---:|---:|---:|---:|
| Bai_2_1.pptx | 79 | 58 | 364.5px | 718.77px |
| Bai_2_2.pptx | 199 | 107 | 121.04px | 817.3px |
| Bai_2_5.pptx | 245 | 190 | 325.91px | 828.99px |
| STTre_Duc.pptx | 73 | 0 | 0.38px | 1px |

Most large outliers had grouped source paths such as `6.2.33`, `5.0.19`, and `6.7.41.1`. The source `origin` was local to the group while mapped geometry was absolute.

After applying group transforms to source children inside the tester:

| Deck | Shape count | >50px drift | Median | Max |
|---|---:|---:|---:|---:|
| Bai_2_1.pptx | 79 | 0 | 0px | 0.5px |
| Bai_2_2.pptx | 199 | 0 | 0px | 1px |
| Bai_2_5.pptx | 245 | 0 | 0px | 1px |
| STTre_Duc.pptx | 73 | 0 | 0.38px | 1px |

Command:

```bash
node server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js ./PPTX --drift-out=plans/260524-1729-pptx-import-review/reports/shape-drift-after-source-transform.json
```

## Implementation

- Added `shapeDriftDetails` to `computeDetailedFidelityMetrics`.
- Added CLI `--drift-out=<path>` for per-shape JSON diagnostics.
- Updated grouped PPTX source flattening in the tester to apply group matrix transforms before geometry comparison.
- Added unit coverage for grouped source geometry comparison.

## Decision

No mapper geometry behavior change is needed for Phase 3. The acceptance target is met by correcting the diagnostic metric:

- Bai_2_1 median shape drift: 364.5px -> 0px
- Bai_2_5 median shape drift: 325.91px -> 0px
- Bai_2_2 median shape drift: 121.04px -> 0px

## Unresolved Questions

None for Phase 3.
