# Phase 2: Refactor Client and Server

## Overview

- Priority: High
- Current status: Pending
- Description: Remove the duplicated copies of logic and import everything from the `revealjs-shared` local package.

## Related Code Files

- `[MODIFY] server/package.json`
- `[MODIFY] server/index.js`
- `[MODIFY] client/package.json`
- `[MODIFY] client/src/utils/generateHTML.js`
- `[DELETE] client/src/utils/shapeUtils.js`

## Implementation Steps

1. Add `"revealjs-shared": "1.0.0"` or `"link:../shared"` to dependencies of client and server.
2. In `server/index.js`, remove local copies of `generateRevealHTML` and `shapeSvgString`, and require them from `revealjs-shared`.
3. In `client/src/utils/generateHTML.js`, remove local raw generation code and replace it with imports from `revealjs-shared` (or export directly if acting as a facade/adapter).
4. Remove `client/src/utils/shapeUtils.js` and update any React components (like `SlideCanvas.jsx` or `PropertiesPanel.jsx`) to import the shape helper from `revealjs-shared/shapeUtils` (if used outside generateHTML).
5. Run `npm install` gracefully at the root.

## Success Criteria

- Root `npm i` succeeds.
- Frontend App and Backend Server run without throwing 'module not found'.
- HTML Export continues to produce identical files as before.
