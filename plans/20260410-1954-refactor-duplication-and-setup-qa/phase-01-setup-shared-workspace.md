# Phase 1: Setup shared workspace

## Overview

- Priority: High
- Current status: Pending
- Description: Create the `shared` workspace and move the duplicated HTML generation and SVG shape logic from the client and server.

## Related Code Files

- `[MODIFY] package.json` (Root)
- `[NEW] shared/package.json`
- `[NEW] shared/src/index.js`
- `[NEW] shared/src/htmlGenerator.js`
- `[NEW] shared/src/shapeUtils.js`

## Implementation Steps

1. Create `shared` folder and initialize `shared/package.json` with name `revealjs-shared`.
2. Update root `package.json` to include `"shared"` in the workspaces array.
3. Move `client/src/utils/generateHTML.js` and `server/index.js` code regarding `generateRevealHTML`, `getBackgroundAttrs`, `escapeHtml` to `shared/src/htmlGenerator.js`.
4. Move `shapeSvgString` from both client and server to `shared/src/shapeUtils.js`.
5. Export everything from `shared/src/index.js`.
6. Add exports field in `shared/package.json` if needed.

## Success Criteria

- The `revealjs-shared` local package is successfully added to the monorepo.
- `shared/src` contains the deduplicated pure JS logic.
