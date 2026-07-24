---
title: "Scout Report: PPTX Gates And Parser Coverage"
description: "Current-state grep for strict corpus thresholds, browser audit flow, and native object coverage seams."
status: completed
created: 2026-06-17
---

# Scout Report: PPTX Gates And Parser Coverage

## Summary

Repo scan confirms 3 real drift seams:

- Strict corpus thresholds conflict inside code and docs.
- `test:pptx:strict` still routes to full browser audit even though smoke/full split already exists.
- Import stats only report mapped output, not native OOXML evidence, so chart/SmartArt degradation can be invisible.

## Findings

- Threshold drift:
  - `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js:20-25`
  - `server/services/pptx-import/pptx-import-corpus-cli.js:36-55`
  - `docs/project-roadmap.md:79-80,199-201`
  - `docs/pptx-import-fidelity-report.md:103-110,351-390`
- Browser audit flow drift:
  - `package.json:50-54`
  - `scripts/run-pptx-browser-audit.js:1-31`
  - `tests/e2e/pages/pptx-import-audit-helper.js:13-20`
  - `tests/e2e/pptx-import-real-browser-audit.spec.js:176-179`
- Native object coverage seam:
  - `server/services/pptx-import/mapper/map-presentation.js:31-37,149-187`
  - `server/services/pptx-import/mapper/map-diagram.js:85-110`
  - `server/services/pptx-import/importer.js:36-57`
  - `server/services/pptx-import/parse-worker.js:14-27`
  - `scripts/pptx-parser-benchmark/summarize-parser-output.js:34-39,78-103`

## Recommendations

- Use one exported gate object for strict corpus thresholds.
- Keep smoke/full audit split at the script layer; do not fork the Playwright spec.
- Add a small OOXML inspector helper and preserve additive stats through `importer.js`.
- Add a docs contract test after code is stable.

## Unresolved Questions

- If external release automation currently calls `npm run test:pptx:strict`, that workflow will need an explicit full-audit command after phase 2. No in-repo CI file was in scope for this plan.
