---
phase: 4
title: "Line Marker Identity Parity"
status: completed
priority: P1
dependencies: [1]
---

# Phase 04: Line Marker Identity Parity

## Overview

Remove canvas line arrow marker collisions by deriving marker IDs from the full element ID, matching the shared export renderer's collision-resistant behavior.

## Requirements

- Functional: two line elements with the same first 8 ID characters must generate distinct marker IDs.
- Non-functional: marker IDs must remain deterministic, DOM-safe, and stable across rerenders, including hostile or unusual element IDs.

## Architecture

Shared export already documents the prior `slice(0, 8)` collision and uses a FNV-1a hash. Prefer a small helper such as `getLineMarkerUid(elementId) => l${hash}` in a clean shared module if CJS/ESM import direction is straightforward. If helper export adds coupling, implement a local deterministic hash and add parity tests against the known same-prefix collision.

## Related Code Files

- Modify: `client/src/components/canvas/element-renderers/line-element-renderer.jsx`
- Create: `client/src/components/canvas/element-renderers/line-element-renderer.test.jsx`
- Review: `shared/src/element-renderers.js`

## Implementation Steps

1. Confirm Phase 01 D3 same-prefix marker test fails.
2. Record D3 red evidence in `reports/implementation-evidence.md`: command, failing assertion, old-bug reason, and setup-noise exclusion.
3. Decide helper location before coding:
   - Preferred clean path: create a small marker ID helper module, export it from shared, and update both shared export and canvas renderer to use it.
   - Fallback: implement local deterministic `hashId()` with a comment referencing shared parity. Do not import deep private functions from `shared/src/element-renderers.js`.
4. Replace `element.id?.slice(0, 8) || 'line'` with full-ID-derived `uid`.
5. Ensure start and end markers remain unique per element and marker type, and marker IDs contain only DOM-safe characters.
6. Tests:
   - same-prefix IDs produce different `ms-*` and `me-*` IDs when rendered in the same DOM document.
   - missing ID still produces stable fallback.
   - IDs containing spaces, quotes, colon, `url(#x)`, and Unicode produce safe IDs.
   - marker URL references match generated marker IDs.
7. Run canvas renderer targeted tests and record green evidence in `reports/implementation-evidence.md`.

## Success Criteria

- [x] Canvas line markers no longer collide for same 8-character prefixes.
- [x] Marker IDs are DOM-safe and generated from full element identity.
- [x] Shared export marker behavior remains unchanged.
- [x] Marker URL syntax remains `url(#marker-id)`.
- [x] Tests cover both `arrowStart` and `arrowEnd`.
- [x] D3 red/green evidence is recorded in `reports/implementation-evidence.md`.

## Risk Assessment

Risk: helper sharing creates module format friction between ESM client files and CJS shared files. Mitigation: prefer local helper if import complexity exceeds the one-function duplication cost.
