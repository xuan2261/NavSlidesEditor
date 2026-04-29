# Fidelity Gate Result

Date: 2026-04-27
Plan: 260426-2128-pptx-import-coordinate-fidelity-hardening

## Gate Command

```bash
npm run test:corpus
```

## Result Summary

- Files: 4 total, 4 pass, 0 fail.
- Avg semantic fidelity: 97.0%.
- Avg round-trip stability: 99.0%.
- Strict mode: pass (`--roundtrip --strict`).
- Export method: production for all decks.

## New Reported Metrics

Harness now prints and returns:

- `geometryDrift.maxPx`
- `geometryDrift.medianPx`
- `geometryDrift.byType`
- `propertyCoverage.overall`
- `propertyCoverage.byType`
- `elementCount.sourceByType`
- `elementCount.navByType`

## Strict Per-Type Gate Policy

- Added strict per-type geometry/property gate path for generated fixture decks.
- Thresholds:
  - text/shape/line/image/table: max drift <= 3px
  - group: max drift <= 5px
  - table/chart property coverage >= 0.8
- Applied when filename indicates generated fixture (`generated` or `fixture`).

## Notes

- Existing real-deck corpus remains green with current strict global thresholds.
- Generated fixture gate logic now covered by `generated-fixtures.test.js`.

## Unresolved Questions

- None.