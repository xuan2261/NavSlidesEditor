---
phase: 4
title: "Fix README Element Count + Contributing Note"
status: completed
priority: P1
effort: "1h"
dependencies: []
---

# Phase 4: Fix README Element Count + Contributing Note

## Overview

Reconcile README's element-type claim with the canonical source (`client/src/data/element-defaults.js` — 19 keys). Add a footnote distinguishing "element types" (renderable atoms) from "insert actions" (UI ribbon buttons, ~27 including sub-variants). Add a short contributing note so future contributors know to update the README count when adding a new type.

Parallel-safe with Phases 2 and 3 (different file ownership).

## Red-Team Adjustments (Session 1 — 2026-05-23)

- **F4 (High):** Plan v1 only fixed the headline ("20" → "19") but README prose paragraph still enumerated 21 items (included "divider" and "inline math" — neither in ELEMENT_DEFAULTS). Step 4.2 now explicitly removes these from prose.
- **F7 (Medium):** Added a 5-line vitest count guard so README claim and `ELEMENT_DEFAULTS` cannot silently drift. Test fails if `Object.keys(ELEMENT_DEFAULTS).length !== 19`.

## Requirements

### Functional
- README claim updated: "20 element types" → "19 element types" (matches `Object.keys(ELEMENT_DEFAULTS).length`).
- Prose enumeration in README purged of the 2 false items: "divider" (a `line` preset, not a type) and standalone "inline math" (a TipTap inline text feature, not a canvas type).
- New 1-2 line note: "Insert ribbon offers ~27 actions because shapes (5) and games (7) expose sub-variants from a single element type."
- Contributing note added: location decided at edit time — preferred `CONTRIBUTING.md` if exists, else append to `CLAUDE.md` under a new heading.

### Non-functional
- No new files unless `CONTRIBUTING.md` is the chosen path AND it doesn't already exist.
- No changes to prose unrelated to the count discussion.
- README formatting consistent with existing style (numbered/bulleted, sentence case, etc.).

## Architecture

Canonical source: `client/src/data/element-defaults.js`. `ELEMENT_DEFAULTS` keys:

```
text, image, shape, code, latex, html, markdown, chart,
video, audio, table, icon, callout, qrcode, drawing,
line, svg, timeline, game
```

= **19 element types**. Read by `element-factory.js` → `createElement(type, ...)` → every entry path uses these strings as canonical `element.type`.

Out-of-source enumerations (registry, insert panel) are downstream and intentionally diverge:
- `element-renderers/registry.js` has 13 — excludes types using TipTap/native renderers.
- Insert ribbon has 27 actions — UI-level, includes sub-variants (5 shapes × 1 type; 7 games × 1 type).

## Related Code Files

- **Modify:** `README.md` (line ~36 + surrounding prose paragraph)
- **Modify or Create:** `CONTRIBUTING.md` if exists, else `CLAUDE.md` (append to existing file — DO NOT create new top-level files unnecessarily)
- **Read for context:** `client/src/data/element-defaults.js`, `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx` (verify insert action count is 27 at edit time)

## Implementation Steps

### 4.1 — Verify current README claim

Grep for "element type" and "20 element" in `README.md` to find every reference, not just line 36. List all sites for batch edit:

```powershell
Select-String -Path README.md -Pattern "element type" -CaseSensitive:$false
```

### 4.2 — Update README count + prose

Replace:
- "20 element types" → "19 element types" (headline + any inline mention).
- Remove "divider" from the prose enumeration. The `divider` UI button calls `addElement('line', {...preset})` — it's a `line` element preset, not a separate type. Keep the divider Insert ribbon button working; just don't count it as a type.
- Remove standalone "inline math" or "math" from the type enumeration. Math is rendered via TipTap inline extension on text elements — a TEXT feature, not a type. (`latex` IS a separate type and STAYS in the count.)

Add an inline footnote (single sentence, no separate section):

> The Insert ribbon shows ~27 actions because shapes (rectangle, circle, triangle, arrow, star) and games (7 variants) expose sub-variants from a single element type. The 19 canonical types are listed in `client/src/data/element-defaults.js`.

After edit, the README prose enumeration must list exactly these 19 items (in whatever stylistic order README chooses): text, image, shape, code, latex, html, markdown, chart, video, audio, table, icon, callout, qrcode, drawing, line, svg, timeline, game.

### 4.3 — Add element-count guard test (Red-Team F7)

Create `client/src/data/element-defaults.test.js` (single file, ~10 lines):

```js
import { describe, it, expect } from 'vitest'
import { ELEMENT_DEFAULTS } from './element-defaults'

describe('element-defaults guards README count claim', () => {
  it('exposes exactly 19 element types (matches README "19 element types")', () => {
    expect(Object.keys(ELEMENT_DEFAULTS)).toHaveLength(19)
  })
})
```

If a future PR adds a new type without updating README, this test fails — CI guard against drift.

### 4.4 — Verify insert action count

Open `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx`. Count actions per section. Per Researcher 2:
- Basic 3 + Shapes 5 + Content 6 + Media 3-4 + Embed 4 + Advanced 6 = **27 (28 with conditional file-browser)**.

If count drifts at edit time, use the literal count from current file. Document the count source in the note as a pointer to the panel file.

### 4.5 — Add contributing note (renumbered from 4.4)

Check for `CONTRIBUTING.md` at repo root:

```powershell
Test-Path CONTRIBUTING.md
```

If exists, append a "Documentation Drift" section. If not, append to `CLAUDE.md` (project-level) under existing structure:

```markdown
### Documentation Drift

- Element type count: canonical list = `Object.keys(ELEMENT_DEFAULTS)` in `client/src/data/element-defaults.js`. When adding a new type, update that file first.
- README "N element types" count must equal `Object.keys(ELEMENT_DEFAULTS).length`.
- "divider" is a `line` preset, not a type — do not count it. Same for "inline math" (a TipTap text feature).
- The element-renderer registry (`client/src/components/canvas/element-renderers/registry.js`) and Insert ribbon panel count differ by design and should NOT be used as the type count source.
```

### 4.6 — Verify no other docs drift (renumbered from 4.5)

Quick grep for the old "20" claim in adjacent docs:

```powershell
Select-String -Path docs/*.md -Pattern "20 element" -CaseSensitive:$false
```

If any other doc says "20 element types", update to 19 with same footnote pattern.

## Success Criteria

- [x] `README.md` reads "19 element types" (or equivalent phrasing using N=19).
- [x] Prose enumeration in README lists exactly the 19 ELEMENT_DEFAULTS keys (no "divider", no standalone "math"/"inline math").
- [x] Footnote distinguishing element types vs insert actions present.
- [x] `client/src/data/element-defaults.test.js` created with the 19-key guard test, passing.
- [x] Contributing note added to `CONTRIBUTING.md` or `CLAUDE.md` (whichever exists).
- [x] No other docs claim 20 element types.
- [x] `npm run lint` passes (no markdown lint config likely, but safe to run).

## Risk Assessment

| Risk | Mitigation |
|---|---|
| README is consumed by an external service (docs site, npm registry) — change might cascade | Grep for `README` references in client/server code. Unlikely; README is presentation only. Document any consumers in evidence. |
| Contributing note in CLAUDE.md may conflict with existing structure | Append after the last existing section, use H3 (`###`) heading to nest under the existing top-level structure. Read CLAUDE.md before edit. |
| Future contributors ignore the note | Mitigation hardened by step 4.3 — `element-defaults.test.js` now FAILS in CI if count drifts. Contributing note is the human-facing complement. |
| Visual baselines include README rendering | Unlikely — README is GitHub-only. Confirm no client route renders README. |

## Next Steps

Phase 5 runs a full regression sweep across all four prior phases.
