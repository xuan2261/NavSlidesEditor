---
phase: 5
title: "Client Correctness Guardrails"
status: completed
priority: P1
effort: "4h"
dependencies: [1]
---

# Phase 5: Client Correctness Guardrails

## Context Links
- [Plan](./plan.md)
- `client/src/pages/EditorPage.jsx`
- `client/src/pages/LiveViewPage.jsx`
- `client/src/pages/SettingsPage.jsx`
- `client/src/components/properties/*.jsx`
- `client/src/components/PropertiesPanel.jsx`
- `client/src/utils/api.js`

## Overview
Fix client-side correctness issues that can crash pages, hide API failures, or persist invalid slide values.

## Key Insights
- Thin API wrapper already throws for non-OK responses; direct `fetch()` callers need equivalent guards.
- Numeric properties use `Number(e.target.value)` widely.
- Settings page can render with `settings === null` if loading fails.

## Requirements
- Functional: live room creation/check handles non-OK and non-JSON responses.
- Functional: settings page shows recoverable error state if settings fail to load.
- Functional: numeric inputs reject empty/NaN/Infinity and clamp where needed.
- Non-functional: preserve existing UI layout and autosave behavior.

## Architecture
Create small utility:
`client/src/utils/number-input.js`
```js
export function parseFiniteNumber(value, fallback = null) { ... }
export function clampNumber(value, min, max, fallback) { ... }
```

Use in property panels. Keep updates local; no new state framework.

## Related Code Files
- Create: `client/src/utils/number-input.js`
- Modify: `client/src/pages/EditorPage.jsx`
- Modify: `client/src/pages/LiveViewPage.jsx`
- Modify: `client/src/pages/SettingsPage.jsx`
- Modify: `client/src/components/properties/common-element-controls.jsx`
- Modify: `client/src/components/properties/shape-properties.jsx`
- Modify: `client/src/components/properties/table-properties.jsx`
- Modify: `client/src/components/properties/code-properties.jsx`
- Modify: `client/src/components/properties/media-properties.jsx`
- Modify: `client/src/components/properties/misc-properties.jsx`
- Modify: `client/src/components/properties/image-properties.jsx`
- Create/modify tests:
  - `client/src/utils/number-input.test.js`
  - `tests/e2e/properties-panel.spec.js`
  - `tests/e2e/live.spec.js`
  - `tests/e2e/settings.spec.js`

## Implementation Steps
1. Add finite-number utility.
2. Replace direct `Number(e.target.value)` in high-risk property fields.
3. Keep existing defaults/clamps.
4. Add `res.ok` checks in `EditorPage` live-room creation.
5. Add `res.ok` checks in `LiveViewPage` room check.
6. Update `SettingsPage`:
   - handle load error.
   - guard `update()` and `updateAI()` when settings is null.
   - avoid saving null settings.
7. Ensure user-visible error messages are concise.

## Todo List
- [x] Add number utility and tests.
- [x] Patch property panels.
- [x] Patch live fetch error handling.
- [x] Patch settings null/error state.
- [x] Add E2E coverage for failure paths.

## Tests / Verification
- Unit:
  - empty string returns fallback/null, not `0` unless intended.
  - `NaN`, `Infinity`, `-Infinity` rejected.
  - clamps min/max correctly.
- Component/E2E:
  - clearing x/y/width field does not persist `NaN`.
  - Settings API failure shows error state, no crash.
  - Live room API 500 shows failure message/modal remains stable.
- Commands:
  - `npm run test -- client/src/utils/number-input.test.js`
  - `npm run test:e2e -- tests/e2e/properties-panel.spec.js tests/e2e/settings.spec.js tests/e2e/live.spec.js`
  - `npm run build`

## Success Criteria
- [x] No `NaN` persisted from covered fields.
- [x] Live fetch failures visible and safe.
- [x] Settings load failure does not crash.

## Risk Assessment
- Risk: changing input behavior annoys users while typing empty field.
- Mitigation: either keep local input state or only commit finite numbers on blur for sensitive fields.

## Security Considerations
- Prevents corrupted presentation data.
- Does not change HTML embed.

## Next Steps
- Phase 6 import/export reliability.
