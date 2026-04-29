# Validation Log

## Decisions

- Canonical notes field: `slide.notes`.
- Legacy alias: `slide.speakerNotes`, accepted only as input and stripped on normalize.
- Live role addition: `controller`.
- Live state payload: `{ slideIndex, verticalIndex, fragmentIndex }`.
- Metadata event: `presentation-meta`.
- Controller command event: `control-navigate`.

## Verification Targets

- `npm run lint`
- `npm run build`
- `npm run test`
- `npm run test:e2e`

## Results

- `npm run lint`: pass, 0 errors, existing warnings remain.
- `npm run build`: pass.
- `npm run test`: pass, 14 files / 68 tests.
- `npm run test:e2e`: pass, 98 tests.

## Notes

- First full E2E run exposed the missing `/vendor/socket.io/socket.io.min.js` runtime asset for presenter HTML. Fixed by serving `socket.io-client/dist` under `/vendor/socket.io`.
- Rerun of `tests/e2e/live.spec.js` passed before the final full E2E run.

## Unresolved Questions

None.
