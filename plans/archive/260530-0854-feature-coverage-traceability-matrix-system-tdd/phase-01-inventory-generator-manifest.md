---
phase: 1
title: "Inventory Generator & Manifest"
status: completed
priority: P1
effort: "2d"
dependencies: []
---

# Phase 1: Inventory Generator & Manifest

## Overview

Build the canonical capability inventory — the list of everything that MUST be verified. Auto-source from existing registries (zero drift) and hand-write a manifest only for capabilities that have no code registry (canvas ops, ribbon buttons without stable IDs, the inline command array). Output: `inventory.json`.

This is the foundation. A capability not in the inventory is invisible forever — so completeness here is the load-bearing concern.

## Requirements

- **Functional**
  - Emit `inventory.json`: array of `{ id, category, source, risk, tiers, scope }` objects.
  - Auto-source `element.<type>` from `client/src/data/element-defaults.js` → `ELEMENT_DEFAULTS` keys (19, dynamic-import: pure data, safe).
  - Auto-source `shortcut.<id>` from `client/src/utils/default-keyboard-shortcut-definitions-registry.js` → `DEFAULT_SHORTCUTS` (id, category, scopes; ~45 entries).
  - Auto-source `renderer.<type>` from `client/src/components/canvas/element-renderers/registry.js` → `elementRendererRegistry` keys (13) — **regex-extract keys, do NOT execute** (file imports JSX renderers).
  - Load manual `feature-manifest.yaml` for `canvas.*`, `control.*`, `command.*`, `flow.*`.
  - Filter by `scope: editor-core`; reserve (but exclude) `live`/`game`/`pptx`/`ai` namespaces.
  - Each capability carries `risk: low|high` and `tiers: [smoke]` or `[smoke, deep]`.
- **Non-functional**
  - Pure Node ESM, no new runtime deps beyond a YAML parser (`yaml` is dependency-light; or hand-parse the flat manifest to avoid the dep — prefer `yaml`).
  - Script ≤ 200 LOC; split loaders (`load-auto-sources.mjs`, `load-manifest.mjs`) if it grows.
  - Deterministic output (sorted by id) so git diffs are stable.

## Architecture

```
scripts/feature-inventory/
├── build-inventory.mjs          # orchestrator → inventory.json
├── load-auto-sources.mjs        # ELEMENT_DEFAULTS + DEFAULT_SHORTCUTS + registry keys
├── load-manifest.mjs            # parse feature-manifest.yaml
└── feature-manifest.yaml        # hand-written non-registry capabilities
```

**Auto-source mechanics:**
- `element-defaults.js` and the shortcut registry are pure-data ESM → `await import(pathToFileURL(...))` works in Node.
- `registry.js` imports JSX components → executing it in Node fails. Read the file as text, regex the object literal keys between `elementRendererRegistry = {` and `}`. Cross-check against `ELEMENT_DEFAULTS` keys.
  - **NO-REGISTRY-BY-DESIGN exclusion set** (red-team #5): `text`, `image`, `code`, `html`, `video`, `audio` render via TipTap/media/embed paths, NOT the renderer registry. These 6 are legitimately registry-less. Registry has 13 keys, defaults have 19 → the 6-key delta is EXPECTED. Warn ONLY when a type is outside this exclusion set AND missing from one side. Hardcoding 6 false warnings every run trains reviewers to ignore the signal — so suppress them explicitly.

**Manifest seed sources (to maximize completeness):**
- Canvas ops: README "Editing" section + `client/src/hooks/use-canvas-pointer-interaction*` + `editor-store.js` actions (move/resize/rotate/group/zorder/lock/align/distribute).
- Ribbon controls: grep `data-testid=` across `client/src/components/ribbon/**` (only 12 today — most lack IDs, hence manual) + `ribbon-tabs-config.js` (7 tabs) + control files (`ribbon-text-formatting-controls.jsx`, `paragraph-formatting-and-alignment-controls.jsx`, `arrange-controls.jsx`, `clipboard-buttons.jsx`, `canvas-controls.jsx`).
- Commands: `EditorPage.jsx:904` `commands` array (9 entries as of 2026-05-30).
- Shortcuts table: README "Keyboard Shortcuts" cross-checked against `DEFAULT_SHORTCUTS`.

**`high` risk seed list** (gets `tiers: [smoke, deep]`): `canvas.rotate-snap`, `canvas.resize-aspect`, `canvas.zorder`, `canvas.group`, `canvas.align`, `canvas.distribute`, `flow.undo-redo`, `flow.clipboard`, `flow.autosave`, `flow.multiselect`, `element.table` (merge/span logic), `element.chart` (data mapping), `element.timeline` (date scaling).

## Related Code Files

- **Create:**
  - `scripts/feature-inventory/build-inventory.mjs`
  - `scripts/feature-inventory/load-auto-sources.mjs`
  - `scripts/feature-inventory/load-manifest.mjs`
  - `scripts/feature-inventory/feature-manifest.yaml`
  - `scripts/feature-inventory/build-inventory.test.mjs` (vitest, TDD red first)
- **Read (sources, do not modify):**
  - `client/src/data/element-defaults.js`
  - `client/src/utils/default-keyboard-shortcut-definitions-registry.js`
  - `client/src/components/canvas/element-renderers/registry.js`
  - `client/src/components/ribbon/ribbon-tabs-config.js`
  - `client/src/pages/EditorPage.jsx` (line ~904, command array — read-only)
- **Modify:**
  - `package.json` — add `"inventory": "node scripts/feature-inventory/build-inventory.mjs"`
  - `vitest.config.mjs` — **NO CHANGE NEEDED (verified red-team #4).** Vitest's default test glob `**/*.{test,spec}.?(c|m)[jt]s?(x)` already matches `.test.mjs`, and `scripts/**` is not in the test `exclude` list → script tests run automatically. **Do NOT add `scripts/**` to coverage `include`** — script files are tooling, not product code; including them would distort (likely lower) the coverage % that the `260519-1200` gate enforces. Script tests run but stay out of the coverage denominator, which is correct.

## Implementation Steps (TDD)

1. **`red:`** Write `build-inventory.test.mjs` asserting: (a) running the generator returns an array, (b) it contains `element.chart` and `element.timeline`, (c) count of `element.*` === `Object.keys(ELEMENT_DEFAULTS).length` (19), (d) every entry has `{id, category, source, risk, tiers, scope}`, (e) `shortcut.group` present with category `editing`. Run → fails (no generator yet).
2. **`green:`** Implement `load-auto-sources.mjs`: dynamic-import element defaults + shortcut registry; regex-extract renderer keys. Implement `load-manifest.mjs`: parse YAML. Implement `build-inventory.mjs`: merge, dedupe by id, sort, write `inventory.json` + return array. Run test → passes.
3. Write `feature-manifest.yaml` seed: canvas ops, ribbon controls, commands, flows (editor-core scope). Use grep/README sources above. Mark high-risk items.
4. **`green:`** Add manifest-coverage assertion to test: inventory includes `canvas.rotate-snap` (high, tiers smoke+deep) and `control.format.bold`.
5. **`refactor:`** Extract shared path constants; ensure each file ≤ 200 LOC; sort output deterministically; add header comment explaining regex-not-execute for registry.js.
6. Add `npm run inventory` script. Verify `node scripts/feature-inventory/build-inventory.mjs` writes valid JSON.

## Success Criteria

- [ ] `npm run inventory` emits `inventory.json` with ≥ 19 `element.*` + ~45 `shortcut.*` + manifest entries
- [ ] `element.*` count exactly equals `Object.keys(ELEMENT_DEFAULTS).length`
- [ ] Renderer-vs-defaults mismatch emits a warning (not silent)
- [ ] Every capability has `risk` and `tiers`; high-risk items carry `tiers: [smoke, deep]`
- [ ] Manifest covers all README "Editing" canvas ops + all 7 ribbon tabs' primary controls
- [ ] `build-inventory.test.mjs` passes; commit log shows `red:`→`green:`→`refactor:`
- [ ] Out-of-scope namespaces (live/game/pptx/ai) excluded by `scope` filter

## Risk Assessment

- **Manifest incompleteness** (primary risk) → seed from 4 cross-checked sources (README, store actions, ribbon files, command array); drift guard (Phase 6) catches future auto-sourced additions. Accept that manual canvas/control list needs one careful human pass.
- **registry.js regex brittle** if formatting changes → cross-check count against `ELEMENT_DEFAULTS`; mismatch warns, so a broken regex surfaces loudly.
- **`yaml` dep** → it's tiny and well-maintained; acceptable. Alternative: flat JSON manifest (no dep) if user prefers zero new deps — confirm in validate.
