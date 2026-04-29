# Baseline Drift Report

Date: 2026-04-27
Plan: 260426-2128-pptx-import-coordinate-fidelity-hardening

## Baseline Before Hardening

- Existing strict corpus already passed.
- `npm run test:corpus` baseline: 4/4 files pass.
- Avg semantic: 97.0%.
- Avg round-trip: 99.0%.
- But element-local drift still hidden by averages, mostly group/shape transform drift.

## Added Repro Coverage

- `server/services/pptx-import/geometry-drift.test.js`
  - zero-coordinate fallback guard (`left/top = 0` stay 0)
  - non-16:9 source size normalization to 960x540
  - absolute line endpoint to local endpoint normalization
  - PPTX image crop rect conversion to editor-native crop model
  - nested group transform stability guard
- `server/services/pptx-import/geometry.test.js`
  - pure helper unit coverage for numeric/nullish + affine math + line mapping modes

## Baseline Gate Command

```bash
npm run test -- server/services/pptx-import/geometry.test.js server/services/pptx-import/geometry-drift.test.js server/services/pptx-import/mapper.test.js
```

Result: pass (112 tests)

## Notes

- Baseline now captures classes of drift previously invisible to average semantic gate.
- Core fixes implemented in geometry helper + mapper refactor; drift tests now green.

## Unresolved Questions

- None.