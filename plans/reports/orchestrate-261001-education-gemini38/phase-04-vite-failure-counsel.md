## TL;DR — NO-GO for Phase04 acceptance; GO for a minimal optimizer repair

The failure is a **CommonJS-to-browser-ESM boundary error**, not locator readiness or missing helper implementation. Explicitly optimize both new JavaScript deep-import entrypoints, then restart isolated Vite with `--force`. A forced restart alone is not a reliable root repair under the current configuration.

This is read-only counsel. I ran no browser, tests, builds, formatters, or edits.

## Reframed problem

Make the actual editor load and expose native Name Picker Try gameplay while retaining the same CommonJS runtime used by generated documents. The decision is **which imported entrypoints Vite must convert**, not whether to rewrite gameplay or serialization.

### Verified evidence

- `escapeInlineScript` exists and is exported through `module.exports`: `shared/src/education/config-serialization.js:5-8`. It is not an ESM export.
- The exact failing named import comes from **`client/src/utils/offlineExport.js:1`**, not `htmlGenerator.js`. The adapter separately imports `serializeEducationConfig` from that same deep path: `client/src/components/education/native-game-try-adapter.jsx:3-4`.
- The adapter also imports CommonJS `mount.js`, whose dependency graph uses `require()` and whose API is exported through `module.exports`: `shared/src/education/browser/mount.js:1-9,70`.
- Dev optimization explicitly includes only `revealjs-shared`: `client/vite.config.js:57-59`. The wider CommonJS transformation configuration is under **`build`**, not dev: `client/vite.config.js:64-68`.
- The cached optimizer metadata lists the root package, but neither new JavaScript deep entrypoint: `client/node_modules/.vite/deps/_metadata.json:6-234`.
- The root barrel currently exports neither serialization helpers nor mount: `shared/src/index.js:108-154`.
- Vite’s [linked-dependency guidance](https://vite.dev/guide/dep-pre-bundling) says linked packages are treated as source unless explicitly optimized; non-ESM linked dependencies require inclusion. Its [optimizer options](https://vite.dev/config/dep-optimization-options) also distinguish deep-import entrypoints.

**[INFERENCE, high confidence]** The observed `/@fs/.../config-serialization.js` URL, missing ESM export, source imports, and optimizer configuration form a consistent chain: the browser receives an unconverted linked CommonJS leaf. Optimizing the package root does not make every separately imported source file an optimized entrypoint.

## What to do

### Recommended repair: one configuration change

Keep the current imports and runtime. Extend `optimizeDeps.include` to:

```js
include: [
  'revealjs-shared',
  'revealjs-shared/src/education/config-serialization.js',
  'revealjs-shared/src/education/browser/mount.js',
],
```

Do **not** add `runtime.css` to dependency optimization; retain its normal CSS import.

This repairs the imported-entrypoint boundary without changing module implementations, widening the shared barrel, or adding an ESM facade.

Then restart **only the isolated Vite process**, preserving the API proxy target:

```text
VITE_API_PROXY_TARGET = http://127.0.0.1:34102
npm run dev --workspace=client -- --host 127.0.0.1 --port 55173 --strictPort --force
```

The first line denotes the environment value, not shell syntax. Disable browser cache for the reload. Keep the isolated API/data intact.

## Alternatives & trade-offs

1. **Explicit deep-entry optimization — recommended.** Smallest repair; keeps browser runtime outside the general-purpose barrel. Future CommonJS deep imports need equivalent optimizer integration.
2. **Root-barrel integration.** Export serialization helpers and mount from `shared/src/index.js`, then migrate all three JavaScript deep imports to `revealjs-shared`. This reuses the existing root optimization convention, but exposes browser runtime dependencies through the client/server barrel. It is valid, but unnecessary for this failure.
3. **Forced restart only.** Useful for stale *already-optimized* linked dependencies. It does not address the missing deep-entry integration; do not accept it as the permanent fix.

## What to avoid

- Fixing only `escapeInlineScript`: `serializeEducationConfig` shares its boundary problem, and `mount` is another CommonJS deep entry.
- Switching named imports to default imports from the same raw CommonJS files.
- Broad experimental deep-import globs, `needsInterop` overrides without evidence, or production CommonJS changes to solve a dev-only boundary.
- Importing `runtime-entry.js` into React. It initializes browser transport and Reveal boot behavior at module load: `shared/src/education/browser/runtime-entry.js:4-15`.
- Treating the supplied 15/15 results as editor-load proof. The generated-document harness bundles through esbuild and runs in JSDOM; it does not exercise Vite’s editor module graph.

## Work checklist / success metrics

- Confirm fresh optimizer metadata includes both deep JavaScript entries.
- Reload the specified editor: no error boundary, missing-export error, or raw CommonJS execution error.
- Select the authored Name Picker; open **Try game**.
- Exercise wheel, dice, and button modes: picking, exclusion/exhaustion, reset, close/reopen, and independent roots. Verify gameplay does not mutate authored configuration.
- Exercise actual offline export—the original failing consumer—and open the freshly exported document with network access disabled. Confirm native gameplay and styling.
- Exercise freshly generated HTML through actual Reveal navigation; verify independent root state and return-to-slide behavior.
- After that evidence, record the optimizer requirement in project documentation/changelog.

**GO for acceptance only after these real-surface checks pass.**

## Assumptions

- **High confidence:** The supplied browser failure and passing-suite observations are authoritative; I did not rerun them.
- **Medium confidence:** The inspected `.vite` cache belongs to the reported isolated editor process. A different cache directory would weaken the metadata evidence, but not the import/config diagnosis.