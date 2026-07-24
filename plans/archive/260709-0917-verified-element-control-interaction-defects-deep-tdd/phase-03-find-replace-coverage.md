---
phase: 3
title: "Find Replace Coverage"
status: pending
priority: P1
effort: "0.75-1d"
dependencies: [1]
---

# Phase 3: Find Replace Coverage

## Overview

Extend Find & Replace so **`table` element cell text** is discoverable and replaceable (including vertical child slides already walked). Keep other types deferred. Align **search collect** and **replace** paths so match counts never lie.

## Requirements

- Functional:
  - Find matches text inside `element.data[r][c]` (string cells).
  - Replace one / replace all updates the correct cell string(s).
  - Case-sensitive flag honored.
  - Vertical children already iterated — table on child slides included.
  - Non-string cell values coerced safely (`String` or skip).
  - Does **not** alter `mergedCells` / styles.
- Non-functional:
  - Pure helpers preferred (`find-replace-helpers.js`) for replace-all + single-cell replace.
  - FindReplaceBar collect function stays in sync with helpers (extract shared `getSearchableText(el)` if needed to avoid drift).

## Architecture

```
getElementSearchSegments(el):
  text → stripHtml(content)
  code/md/latex → content
  html → stripHtml(content)
  shape → text
  table → flat list of { path: ['data', r, c], text: cell }

replaceInElement(el, ...):
  + table branch: map data rows/cols with regex replace on each cell string

FindReplaceBar matches useMemo:
  use same segments so counts == replace targets
```

Single-replace (`handleReplace`): must update one match position in one cell without re-replacing other matches in same cell incorrectly — mirror text strategy (regex global false for one-shot per match index) or recompute match list after each replace (existing pattern).

## Related Code Files

- Modify: `client/src/components/find-replace-helpers.js`
- Modify: `client/src/components/find-replace-helpers.test.js`
- Modify: `client/src/components/FindReplaceBar.jsx` (collect + single replace)
- Optional: FindReplaceBar component test if present

## TDD — Tests First (RED)

### `find-replace-helpers.test.js`

```js
it('replaceAllInSlides replaces text inside table.data cells')
it('replaceAllInSlides replaces table cells on vertical child slides')
it('does not touch mergedCells when replacing table text')
it('respects matchCase for table cells')
it('leaves non-table types unchanged for table-only fixtures')
```

### Collect parity (unit pure or component)

```js
it('search collect finds positions in table cells (helper)')
// or component test: matches.length === 2 for two cells containing term
```

**RED proof:** table-only deck → replaceAll returns same data; matches empty.

## Implementation Steps

1. Add pure helpers for table segment extraction + cell replace.
2. Wire `replaceInElement` + `replaceAllInSlides`.
3. Wire `FindReplaceBar` collect + single replace branches for `type === 'table'`.
4. Ensure navigate still only needs slideIndex/childIndex (elementId already stored).
5. Green tests; smoke with header row + body cell.

## Success Criteria

- [ ] Find finds table cell text
- [ ] Replace / Replace All updates table data
- [ ] Match count consistent with replaceable sites
- [ ] Existing text/code/html/shape tests still pass
- [ ] Vertical child table covered

## VERIFY Gate

```bash
npx vitest run client/src/components/find-replace-helpers.test.js
npx vitest run client/src/components/FindReplaceBar.jsx 2>$null
npx vitest run client/src/components/FindReplaceBar.test.jsx 2>$null
# if no component test file, helpers + manual smoke OK for phase exit
```

Manual: table cell "foo" → Ctrl+F foo → match → Replace → "bar".

## Out of Scope (this phase)

chart labels, game questions, qrData, timeline events/items, icon names.

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Multi-match same cell | One match entry per occurrence index; replace carefully |
| HTML-ish cell content | Tables store plain strings today — document if rich later |
| Performance large tables | O(cells) fine for deck sizes |

## Risk: Low–Medium | Blast: Search UX + table content only
