# Test Report — 2026-05-17 — Parallax Features Port

## Test Results Overview

- **Unit/integration**: 1030 passed, 0 failed, 118 files
- **E2E/UI**: 169 passed, 0 failed, Chromium
- **PPTX corpus**: 4 passed, 0 failed
- **Load**: blocked locally, `k6` missing from PATH

## Coverage Added

- Mandatory E2E/UI checks for Timeline, Kinetic Text, Math Grid, Anime.js, Three.js insertion.
- Toolbar checks for Font Weight and Line Height in active TipTap edit mode.
- Persistence/export E2E for font weight, line height, URL video trim/speed, timeline, image citation.
- Route-level upload dedup tests using real `/api/upload`, replacing simulated hash logic.
- Shared reveal/print export integration for parallax port features.

## Build Status

- `npm run lint`: PASS
- `npm run build`: PASS
- `npm run test`: PASS
- `npm run test:e2e`: PASS
- `npm run test:corpus`: PASS

## Fixes From Testing

- Added `timeline` to API element schema.
- Added `timeline` defaults and default position to editor element factory data.
- Removed conditional E2E assertions that allowed missing controls/features to pass.

## Unresolved Questions

- Should `k6` be installed on this workstation/CI so `npm run test:load:api` and `npm run test:load:ws` can be part of the required local gate?
