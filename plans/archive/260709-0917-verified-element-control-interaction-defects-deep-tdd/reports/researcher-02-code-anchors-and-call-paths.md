# Researcher 02 — Code Anchors And Call Paths

**Date:** 2026-07-09

## Cut path (V1)

```
EditorPage.handleCut
  → performCut(slideElements, selectedElementIds)
       → createCutOperation(...)  // no locked filter TODAY
       → filter elements !idsToDelete.includes  // uses RAW selection TODAY
```

Dup path (reference correct policy):

```
createDuplicateOperation → filter !el.locked
```

Delete path:

```
deleteSelectedElements → deletableIds = ids.filter not locked
```

## Table merge (V2)

```
table-properties.jsx ±row/col
  → normalizeTableShape({ data }, element)
       → mergedCells: []  // ALWAYS
```

## Find/replace (V3)

```
FindReplaceBar matches collect: text|code|shape|md|latex|html
replaceInElement: same whitelist
// no table
```

## Multi-nudge (NOT a bug)

```
EditorPage onArrow → filter !locked → computeClampedBatchDelta → updateElements
// works for multi-select
```

## Group block (V4)

```
hasBlockedGroupMutation(slide, ids)
// true if any group member locked|hidden among selected groups
// early return in drag, align, nudge, fan-out — no UI
```

## Geometry (V5)

```
MIN_SIZE = 40 in use-canvas-resize-rotate.js
callout defaults 36×36 in element-defaults.js
buildSelectionUpdates floors width/height to MIN_SIZE
```
