---
phase: 3
title: "STEM Simulation Embed Presets"
status: completed
priority: P1
effort: "2-3d"
dependencies: [1]
---

# Phase 03: STEM Simulation Embed Presets

## Overview

Add provider presets for PhET, GeoGebra, Desmos, and CircuitJS/Falstad as UI sugar over existing `html` elements.

## Requirements

- Functional: User selects provider, enters URL/id, inserts previewable simulation.
- Non-functional: No native simulation engine; clearly label online-only behavior; only allow known provider origins.

## Architecture

Preset builder normalizes provider URL/id into iframe/API HTML only after strict provider allowlist validation. Saved element remains `type: 'html'` with metadata (`embedKind: 'stem-simulation'`, `provider`, `sourceUrl`) for UI/fallback labels. Generated iframes must include deliberate `sandbox`, `allow`, `referrerpolicy`, and `loading` attributes.

Allowed origins:
- PhET: `phet.colorado.edu`
- GeoGebra: `www.geogebra.org`, `geogebra.org`
- Desmos: `www.desmos.com`, `desmos.com`
- CircuitJS/Falstad: `www.falstad.com`, `falstad.com`

## Related Code Files

- Modify: `client/src/hooks/use-element-creation.js`
- Modify: `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx`
- Create: `client/src/components/stem-simulation-preset-modal.jsx`
- Create: `client/src/utils/stem-embed-presets.js`
- Modify: `shared/src/element-renderers.js` only for labels/fallback
- Test: preset builders, insert UI, shared export, PPTX warnings

## Implementation Steps

1. Write failing provider URL/id builder tests for allowed origins and rejected schemes/domains.
2. Add modal tests for provider selection and validation.
3. Insert generated HTML element through existing creation path.
4. Add export warning tests proving existing HTML fallback policy applies.
5. Add privacy/online-only warning text tests and update matrix evidence.

## Success Criteria

- [x] Four providers selectable.
- [x] Generated element is still `html`.
- [x] HTML export preserves iframe.
- [x] PPTX emits existing HTML fallback warning.
- [x] `javascript:`, `data:`, private localhost, and unknown domains are rejected by preset builder.
- [x] Generated iframe has sandbox/referrer/loading attributes.

## Risk Assessment

Risk: provider formats vary. Mitigation: support explicit templates only; do not parse arbitrary embed code beyond safe subset.
