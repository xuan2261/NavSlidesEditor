# Phase 02 Text Overflow Root Cause Report

Generated: 2026-05-27

## Scope

- Added browser-real text diagnostics to the audit harness only.
- No product mapper or renderer behavior changed in this phase.
- Diagnostics redact slide text: reports store text length and token length, not raw content.

## Evidence Run

Run: latest ignored audit artifact from `plans/reports/pptx-import-real-browser-audit-latest.json`

Command:

```bash
npx playwright test tests/e2e/pptx-import-real-browser-audit.spec.js --project=chromium --workers=1 --retries=0 --reporter=line
```

Result: passed in non-strict mode, 5 decks imported, 227 slides visited.

## Root Cause Buckets

| Bucket | Count | Share |
| --- | ---: | ---: |
| `nowrap-or-unbreakable` | 616 | 94.0% |
| `shape-text-foreign-object` | 25 | 3.8% |
| `font-too-large` | 12 | 1.8% |
| `unknown/insufficient-source-data` | 2 | 0.3% |

## Top Offenders

| Deck | Slide | Root cause | Overflow X | Box | Font | Notes |
| --- | ---: | --- | ---: | --- | ---: | --- |
| `Bai_2_5.pptx` | 21 | `nowrap-or-unbreakable` | 3657 | 1096x284 | 16 | `white-space: normal`, `word-break: normal`, `overflow-wrap: normal` |
| `Bai_2_5.pptx` | 9 | `nowrap-or-unbreakable` | 2891 | 1096x318 | 16 | same computed wrap policy |
| `Bai_2_2.pptx` | 22 | `nowrap-or-unbreakable` | 2709 | 1019x431 | 16 | same computed wrap policy |
| `Bai_2_2.pptx` | 23 | `nowrap-or-unbreakable` | 2709 | 1019x431 | 16 | same computed wrap policy |
| `Bai_2_5.pptx` | 19 | `nowrap-or-unbreakable` | 1717 | 1096x467 | 16 | same computed wrap policy |

## Findings

- Dominant failure is horizontal overflow with normal browser wrapping defaults and no explicit `overflow-wrap`/`word-break` policy for imported rich text.
- The largest failures are not explained by huge font size; top offenders report 16px font and long paragraph content.
- Shape text is a separate smaller bucket and should be fixed with the same wrapping policy in the shape renderer.
- Only 14/655 text issues are outside the top two buckets, so Phase 03 can focus on imported wrapping policy first, then bounded fit if needed.

## Phase 03 Target

- Add imported text wrapping rules for editor text preview and rich shape text.
- Preserve editable text and rich inline styling.
- Re-run strict audit to measure residual text overflow before adding shrink-to-fit.

## Unresolved Questions

- Exact min readable font-size for bounded shrink-to-fit remains Phase 03 decision.
