# Phase 3: Setup Linters and Formatters

## Overview

- Priority: Medium
- Current status: Pending
- Description: Configure ESLint v9 (Flat Config) and Prettier for the entire monorepo to ensure consistent code styling.

## Related Code Files

- `[MODIFY] package.json` (Root)
- `[NEW] eslint.config.mjs`
- `[NEW] .prettierrc`
- `[NEW] .prettierignore`

## Implementation Steps

1. In Root: `npm i -D eslint prettier @eslint/js globals eslint-plugin-react eslint-plugin-react-hooks`
2. Create `.prettierrc` with singleQuote, trailingComma, printWidth settings.
3. Create `.prettierignore` ignoring builds.
4. Create `eslint.config.mjs` that targets:
   - `client/**/*.js(x)` with browser + react globals.
   - `server/**/*.js` with node globals.
   - `shared/**/*.js` with node+browser globals.
5. Add `"lint": "eslint ."` and `"format": "prettier --write ."` to root package scripts.

## Success Criteria

- Running `npm run format` successfully formats all files.
- Running `npm run lint` yields warnings/errors correctly without crashing.
