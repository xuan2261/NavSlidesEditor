---
phase: 5
title: "Format Ribbon Coverage Policy"
status: completed
priority: P1
dependencies: [3]
---

# Phase 05: Format Ribbon Coverage Policy

## Overview

Turn the Format ribbon gap into an explicit coverage policy: each element type either has contextual controls or an accepted reason to use Properties Panel/direct editing instead.

## Requirements

- Functional: Format ribbon label/control coverage must be tested against canonical element types.
- Functional: text direct-editing behavior must not be mislabeled as missing.
- Functional: elements without contextual Format controls must have an explicit accepted-limit row in the capability matrix.
- Non-functional: avoid a broad ribbon redesign.

## Architecture

Use the capability matrix from Phase 3 as the source for Format ribbon policy. Keep `formatTabLabel(type)` and `ContextualControls` simple, but add tests that make omissions visible.

Accepted examples:
- `text`: direct editing + Home/Format typography controls, no type-specific contextual block required.
- `html`, `latex`, `markdown`: Properties Panel/editor modal controls accepted unless product wants ribbon shortcuts.
- `game`: live/game-specific properties panel accepted.

Accepted limits must name a verified alternate surface (`PropertiesPanel`, editor modal, direct canvas editing, Home typography controls, or live-game panel). A default label alone is not evidence.

## Related Code Files

- Modify: `client/src/components/ribbon/ribbon-tabs-config.js`
- Modify: `client/src/components/ribbon/ribbon-tabs-config.test.js`
- Modify: `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx`
- Modify: `scripts/feature-inventory/element-control-expected-controls.json`
- Modify: `scripts/feature-inventory/validate-element-control-audit-matrix.test.mjs`
- Optional modify: `client/src/components/PropertiesPanel.jsx`

## TDD Steps

1. Add failing test that every canonical element has a Format ribbon policy row.
2. Add failing test that `formatTabLabel()` returns either a dedicated label or documented default for every type.
3. Add failing test that `ContextualControls` coverage matches the policy matrix.
4. Add failing test that every accepted-limit row names a verified alternate control surface.
5. Add minimal labels/accepted-limit metadata.
6. Only add new UI controls if a type has an existing obvious control that is inaccessible elsewhere.

## Targeted Tests

```powershell
npx vitest run client/src/components/ribbon/ribbon-tabs-config.test.js
npx vitest run scripts/feature-inventory/validate-element-control-audit-matrix.test.mjs
npx vitest run client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.test.jsx
```

If the last file does not exist, create it or extend the nearest existing ribbon test.

## Success Criteria

- [x] No element type has ambiguous Format ribbon status.
- [x] Current contextual controls remain unchanged unless tests prove a real gap.
- [x] Properties Panel fallback is explicit for non-ribbon element types.
- [x] `text` accepted policy verifies direct editing or typography controls instead of relying on the default `Format` label.
- [x] Future element additions must choose a Format ribbon policy.

## Risk Assessment

Risk: policy may be mistaken for product UX completeness. Mitigation: label accepted limits clearly and keep matrix language distinct between `implemented` and `accepted-limit`.
