**Recommend authorizing bounded diagnosis and repair of the client’s shared-package loading boundary. Phase02 remains unapproved.** The reported browser failure is sufficient evidence; do not rerun it merely to confirm.

### File evidence

- `shared/package.json`: `revealjs-shared` enters through `src/index.js`.
- `shared/src/index.js`: exports both helpers through `...require('./svg-paint-overrides.js')` and `...require('./chart-authoring-options.js')`.
- Both helper files explicitly export their named functions.
- `svg-element-renderer.jsx`: imports `applySvgPaintOverrides` from the package and calls it before sanitization.
- `chart-element-renderer.jsx`: imports and calls `resolveChartAuthoringOptions` through the same package boundary.
- `client/vite.config.js`: explicitly prebundles `revealjs-shared`; has no shared-package resolution alias. Its `build.commonjsOptions` applies to builds, not evidence that the running dev optimizer is current.
- `config/vitest/client-jsdom.config.mjs`: uses a separate Vitest project configuration. Green unit results do not establish what the existing Vite process serves.

**[INFERENCE]** Stale prebundling is plausible because client HMR updated while Vite predates the new exports. Wrong package resolution is equally actionable: junctioned dependencies can lead to the base repository’s workspace package. The exception alone does not distinguish these from CommonJS interop.

### Bounded diagnostic sequence

1. **Prove disk resolution first.** Anchor `createRequire` to this worktree’s `client/package.json`. Record:
   - `require.resolve('revealjs-shared')` and its filesystem realpath;
   - `typeof` both helpers from that resolved package;
   - the same types from this worktree’s explicit `shared/src/index.js`.

   Also establish Vite’s actual resolved entry; Node resolution alone is not proof of browser resolution.

2. **Inspect the served boundary without replaying the failed scenario.** Read Vite’s transformed SVG and chart modules. Follow their exact optimized dependency URLs, including version queries. Inspect the optimizer’s recorded entry path and the property expression used by the transformed consumers. Determine whether the served CommonJS export object contains both functions; do not assume namespace and default exports are interchangeable.

3. **Repair only the proven branch.**
   - **Wrong entry:** correct worktree-local package resolution. If changing Vite configuration, keep the existing CommonJS package entry and optimization path. Do not mutate the base repository’s shared dependency installation.
   - **Correct entry and disk exports, outdated optimized object:** restart only the existing Vite service with `--force`, preserving its port and API proxy environment. No API restart or broad cache deletion.
   - **Fresh optimizer still exposes the wrong callable shape:** diagnose that specific interop transformation and repair the package/loading boundary. No duplicated helper, fallback import, or swallowed exception.

### Required post-repair proof

Once repair is authorized, verify both browser-loaded helpers, then exercise the existing all19 deck: canvas and thumbnails render, SVG overrides work, chart content actually renders, and no new page errors occur. Function availability alone is not acceptance.

Read-only source inspection performed here; no edits, runtime checks, delegation, or model switching.