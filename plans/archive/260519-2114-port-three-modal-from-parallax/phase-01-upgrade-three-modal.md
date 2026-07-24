# Phase 01 — Upgrade ThreeJs3DSceneTemplateSelectorModal

Priority: medium
Status: completed
Effort: ~1 session, ~390 LOC across 3 files (1 modified, 1 new, 1 test extended)

## Context Links

- Compare report (full): `plans/reports/xia-compare-260519-parallax-presentations.md`
- Compare report (plugin subsystem): `plans/reports/xia-compare-260519-parallax-plugin-architecture.md`
- Source file: `https://github.com/jbirky/parallax-presentations/blob/ce548c535abc7701ac45cc3164560caba121adce/client/src/components/ThreeModal.jsx`
- Local file (target of upgrade): `client/src/components/three-js-3d-scene-template-selector-modal.jsx`
- Local test: `client/src/components/three-js-3d-scene-template-selector-modal.test.jsx`
- Insertion site: `client/src/pages/EditorPage.jsx:1901` (uses `insertEmbedHtml` → `html` element)
- Renderer for inserted HTML: `shared/src/element-renderers.js renderHtml` (line ~146)

## Overview

Upgrade the existing 3D scene modal from script-tag-based Three.js 0.160.0 to ES module + importmap Three.js 0.162.0 with OrbitControls. Replace 3 fake template aliases (galaxy/terrain/instanced-spheres) with real implementations. Add live preview pane. Add `DEFAULT_CUSTOM` scaffold and "Edit as code" handoff. Hybrid background (color picker + transparent toggle).

The existing port emits `html` element type via `insertEmbedHtml`. This is correct and stays — every render path (offline export, share-link, PPTX raster, live viewer) flows through `renderHtml` in `shared/src/element-renderers.js`. **No element-type changes needed.**

## Key Insights

1. **Port = upgrade**, not greenfield. Local already has the modal wired into `EditorPage.jsx`. Tests exist.
2. **Template strings come from source** (AGPL-3.0 → AGPL-3.0 OK). Add SPDX + Copyright header to the new template module file only — modal file is locally authored, no header needed there.
3. **3 alias templates are UI lies**. Local `galaxy` actually renders `particle-cloud` HTML. Existing test `getByText('Galaxy')` passes only because the label exists, not the behavior. Tests need extension to catch this regression.
4. **Importmap is required** for `three/addons/controls/OrbitControls.js`. Browser support: Chrome 89+, Safari 16.4+. Acceptable for a presentation tool target audience.
5. **Background hybrid**: color picker for any color + checkbox "Transparent" that triggers `WebGLRenderer({alpha:true})` and skips `scene.background`.

## Requirements

### Functional

- 8 distinct, working 3D scene templates (rotating-cube, wireframe-sphere, particle-cloud, torus-knot, wave-plane, galaxy, terrain, instanced-spheres) + custom code editor.
- All templates draggable/zoomable in presented slide (OrbitControls).
- Live preview pane in modal (iframe with `sandbox="allow-scripts"`, key-invalidated on params change).
- Color picker for foreground color, color picker for background, separate "Transparent" checkbox.
- Speed control (0.1–5).
- "Edit as code" button on non-custom templates copies generated HTML into custom editor and switches to custom mode.
- Custom editor: textarea with monospace font, Tab key inserts 2 spaces, "Refresh Preview" button.
- `DEFAULT_CUSTOM` scaffold loads on first switch to custom mode (torus + OrbitControls + standard lighting).

### Non-functional

- Files split per 200-LOC rule.
- Tailwind classes (no inline-style migration).
- Existing test assertions still pass; new assertions added for real template content (galaxy contains `5000`, terrain contains `lerp`, instanced-spheres contains `InstancedMesh`).
- License: AGPL-3.0-or-later SPDX header + `// Copyright (c) 2026 Jessica Birky` on the new template module (template HTML strings copied from source).

## Architecture

### Files (final state)

```
client/src/
├── components/
│   ├── three-js-3d-scene-template-selector-modal.jsx        ~180 LOC (was 116)
│   └── three-js-3d-scene-template-selector-modal.test.jsx   ~80 LOC  (was 52)
└── data/
    └── three-js-3d-scene-templates.js                       ~150 LOC (NEW)
```

### Module boundary

- **`data/three-js-3d-scene-templates.js`** — pure data + HTML generators. Exports:
  - `THREE_CDN`, `ORBIT_CDN` constants
  - `TEMPLATES: Array<{id, name, desc}>` (9 entries incl. custom)
  - `DEFAULT_CUSTOM: string` (HTML scaffold for custom mode)
  - `generateThreeJsHtml(templateId, params): string` — switch over 8 ids + default
- **`components/three-js-3d-scene-template-selector-modal.jsx`** — UI shell. Imports the data module. Renders Tailwind layout: template grid (left), preview iframe + controls (right), action footer.

### Data flow

```
User clicks template → setSelected(id)
                    ↓
generateThreeJsHtml(id, params) → previewHtml (useMemo, keyed on selected+params+customCode+customPreviewKey)
                    ↓
<iframe srcDoc={previewHtml} sandbox="allow-scripts" key={previewKey}>
                    ↓
User clicks Insert → onInsert(previewHtml) → EditorPage.insertEmbedHtml(html)
                    ↓
new element { type: 'html', content: html } → renders via shared/src/element-renderers.js renderHtml
```

## Related Code Files

### Modify
- `client/src/components/three-js-3d-scene-template-selector-modal.jsx` — replace body with upgraded UI
- `client/src/components/three-js-3d-scene-template-selector-modal.test.jsx` — extend assertions

### Create
- `client/src/data/three-js-3d-scene-templates.js`

### Read for context (do not modify)
- `client/src/pages/EditorPage.jsx:1901` — insertion site (props unchanged: `onInsert`, `onClose`)
- `shared/src/element-renderers.js` — confirm `renderHtml` handles `<script type="importmap">` (data URL iframe approach should pass through unchanged since the iframe wraps the user content; importmap lives inside that wrapped HTML)

### Do not touch
- `client/src/data/element-defaults.js` — no element type changes
- `client/src/data/slide-templates.js` — unrelated
- Server, shared/, electron/ — no changes needed

## Implementation Steps (TDD slices)

Each slice: **Red** (write failing test) → **Green** (implement to pass) → **Refactor** (clean). Run the focused test command after each slice: `npx vitest run client/src/components/three-js-3d-scene-template-selector-modal.test.jsx`.

### Slice 1 — Templates module shape (RED → GREEN)

**Red — extend test file with module-shape assertions** (write before module exists):
- `import { TEMPLATES, DEFAULT_CUSTOM, generateThreeJsHtml, THREE_CDN, ORBIT_CDN } from '../data/three-js-3d-scene-templates.js'`
- Assert `TEMPLATES.length === 9` and IDs match the 8 named + `custom`.
- Assert `THREE_CDN` and `ORBIT_CDN` strings include version `0.162.0`.
- Assert `typeof generateThreeJsHtml === 'function'`.
- Run tests → fail (module missing).

**Green — create `client/src/data/three-js-3d-scene-templates.js`**:
1. Add `// SPDX-License-Identifier: AGPL-3.0-or-later` and `// Copyright (c) 2026 Jessica Birky` header (template HTML strings copied from source).
2. Export `THREE_CDN`, `ORBIT_CDN` constants (Three.js `0.162.0`, OrbitControls addon).
3. Export `TEMPLATES` array — 9 entries `{id, name, desc}` with names verbatim from source.
4. Export `DEFAULT_CUSTOM` scaffold (torus + OrbitControls + standard lighting via importmap).
5. Export `generateThreeJsHtml(id, params)` — port source `switch` verbatim. Adjust `alpha:` boolean to read `params.transparent` (renamed from source's `background === 'transparent'`).
6. Run focused test → green.

### Slice 2 — Real template content (RED → GREEN)

**Red — assert non-fake template internals** (catches the alias regression):
- `generateThreeJsHtml('galaxy', {})` HTML contains `'5000'` (particle count) and `'lerp'` (color blending).
- `generateThreeJsHtml('terrain', {})` HTML contains `'computeVertexNormals'` and `'flatShading'`.
- `generateThreeJsHtml('instanced-spheres', {})` HTML contains `'InstancedMesh'`.
- All 8 named templates contain `'<script type="importmap">'` and `'three/addons/controls/OrbitControls.js'`.
- Run → fail (current module has alias copies and uses `three.min.js` script tag).

**Green — port template generators verbatim**: copy each `case` body from source `ThreeModal.jsx`, drop into the `switch` in `generateThreeJsHtml`. Keep importmap + OrbitControls boilerplate inside the shared `base` string. Run → green.

### Slice 3 — Modal UI: preview iframe + key invalidation (RED → GREEN)

**Red — assert iframe contract**:
- After render, `screen.getByTitle('3D scene preview')` returns an `iframe` with `sandbox="allow-scripts"` (no `allow-same-origin`).
- Iframe `src` (or `srcDoc`) contains `BoxGeometry` for default `rotating-cube`.
- Switching template via click → iframe content changes (re-query and check for `'TorusKnotGeometry'`).
- Run → fail.

**Green — replace modal body**:
1. Import `TEMPLATES`, `DEFAULT_CUSTOM`, `generateThreeJsHtml` from data module.
2. State: `selected` (default `'rotating-cube'`), `params` (`{color, background, transparent, speed}`), `customCode` (default `DEFAULT_CUSTOM`), `previewKey` (number).
3. `useMemo` for `previewHtml` keyed on `[selected, params, customCode, previewKey]`.
4. Render `<iframe title="3D scene preview" sandbox="allow-scripts" key={previewKey} srcDoc={previewHtml} />`.
5. Tailwind layout: header → template list (left) → preview + controls (right) → footer.
6. Run → green.

### Slice 4 — Hybrid background controls (RED → GREEN)

**Red — assert background API**:
- Color picker for foreground (`color`) renders.
- Color picker for background (`background`) renders.
- Checkbox labelled `Transparent` renders.
- Toggling `Transparent` → generated HTML contains `alpha:true` and **no** `scene.background = ` line referencing the chosen background color.
- Without `Transparent` → generated HTML contains the background color hex literal.
- Run → fail.

**Green — wire controls** (color + color + checkbox + speed). Pass `params.transparent` into `generateThreeJsHtml`; gate the `scene.background` assignment on `!params.transparent`. Run → green.

### Slice 5 — Custom mode (RED → GREEN)

**Red — assert DEFAULT_CUSTOM, Tab indent, Edit-as-code**:
- Click `Custom Code` → textarea `value` contains `'TorusGeometry'` (proves DEFAULT_CUSTOM scaffold loaded, not empty string).
- Tab keydown in textarea inserts 2 spaces at caret (assert `value` after `fireEvent.keyDown(..., {key:'Tab'})`).
- On `rotating-cube`, click `Edit as code` → `selected === 'custom'` AND textarea contains `'BoxGeometry'`.
- Click `Refresh Preview` in custom mode → iframe re-mounts (assert `previewKey` change via re-render of iframe with new `key` attribute).
- Run → fail.

**Green — implement custom mode**:
1. Default `customCode = DEFAULT_CUSTOM`.
2. Tab handler in textarea: `e.preventDefault()`, splice 2 spaces at `selectionStart`.
3. `Edit as code` button (non-custom): `setCustomCode(generateThreeJsHtml(selected, params))`, `setSelected('custom')`, `setPreviewKey(k => k+1)`.
4. `Refresh Preview` button (custom): `setPreviewKey(k => k+1)`.
5. Run → green.

### Slice 6 — Quality gates

1. `npm run lint` — fix any findings introduced.
2. `npm run build` — Vite build covers JSX compile.
3. `npx vitest run client/src/components/three-js-3d-scene-template-selector-modal.test.jsx` — all 12+ assertions green.
4. `npm run test` (full unit suite) — confirm no collateral regressions.

### Slice 7 — Manual smoke (cannot be unit-tested)

1. `npm run dev`; editor → Insert → 3D Scene.
2. Click each of 8 named templates; preview iframe shows visually distinct content.
3. Insert galaxy; in Present mode, drag-orbit and scroll-zoom work (OrbitControls live).
4. Toggle Transparent → modal backdrop bleeds through preview (no opaque scene fill).
5. Custom mode: edit DEFAULT_CUSTOM, Refresh Preview, Insert.
6. Export offline HTML; open file; inserted scene still renders (no regression on `renderHtml` data-URL path).

## Todo List (TDD order — Red → Green per slice)

- [ ] Slice 1 RED: import-shape assertions for `data/three-js-3d-scene-templates.js` (5 assertions)
- [ ] Slice 1 GREEN: create templates module with SPDX + Copyright header, `THREE_CDN`/`ORBIT_CDN`/`TEMPLATES`/`DEFAULT_CUSTOM`/`generateThreeJsHtml`
- [ ] Slice 2 RED: assert real template content (galaxy=5000+lerp, terrain=computeVertexNormals+flatShading, instanced-spheres=InstancedMesh, all 8 contain importmap+OrbitControls)
- [ ] Slice 2 GREEN: port 8 generators verbatim from source; remove alias copies
- [ ] Slice 3 RED: assert iframe `title="3D scene preview"`, `sandbox="allow-scripts"`, srcDoc default `BoxGeometry`, switch updates content
- [ ] Slice 3 GREEN: replace modal body — Tailwind layout, useMemo previewHtml, key invalidation
- [ ] Slice 4 RED: assert hybrid background controls (color, background color, Transparent checkbox) and `alpha:true` toggling
- [ ] Slice 4 GREEN: wire controls; gate `scene.background` on `!params.transparent`
- [ ] Slice 5 RED: DEFAULT_CUSTOM loads on Custom Code click; Tab inserts 2 spaces; Edit-as-code round-trip; Refresh Preview increments key
- [ ] Slice 5 GREEN: implement custom-mode handlers
- [ ] Slice 6: `npm run lint`, `npm run build`, focused vitest, full `npm run test`
- [ ] Slice 7: manual smoke (8 templates, OrbitControls live, transparent bleed, offline export round-trip)

## Success Criteria

- All 8 templates render visually distinct content (no fake aliases).
- OrbitControls work: drag-to-orbit, scroll-to-zoom in both modal preview and presented slide.
- Modal preview iframe stays in sync with control changes (no stale render).
- "Edit as code" round-trip: select template, click button, see HTML in custom textarea, modify, insert.
- Transparent background lets slide background show through.
- All test assertions pass (existing 5 + new 7 = 12 cases).
- `npm run lint` and `npm run build` clean.
- Offline export of a slide containing a 3D scene still renders the scene (no regression).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| File still exceeds 200 LOC after split | Low | Low | Modal is mostly Tailwind layout — measure during step 2; split off the controls panel into a sub-component if it overruns |
| Browser without importmap support hits the 3D scene | Low | Medium | Importmap lacks support only on legacy browsers below the project's stated baseline (Chrome 89+, Safari 16.4+). Reveal.js itself targets evergreen browsers — same baseline |
| Source license header mismatch in copy of HTML strings | Medium | High | Add SPDX + Copyright to template module only; modal file authored locally (no header). Verified AGPL-3.0 ↔ AGPL-3.0 (`LICENSE:1-2` both sides) |
| Existing tests break due to refactor of label text | Low | Low | Keep `name` strings identical (Rotating Cube, Wireframe Sphere, …) — they're already verbatim in source |
| `<script type="importmap">` mangled by `renderHtml` data-URL wrapping | Low | High | The whole HTML is `encodeURIComponent`'d into a data URL; importmap inside the wrapped body is preserved as-is. Test by inspecting the iframe content in dev tools during smoke step 6 |
| 3D scene CPU usage in editor with multiple instances | Medium | Low | Pre-existing limitation of the local modal; out of scope. Document only |

## Security Considerations

- No new attack surface: insertion path is identical to existing flow (`html` element → `renderHtml` → iframe `srcdoc`/data URL).
- Live preview iframe in the modal uses `sandbox="allow-scripts"` (no `allow-same-origin`) — opaque origin, can't reach host.
- All template HTML strings are author-controlled (we generated them from local UI). Custom mode is also author-controlled per README:117-130 trust model.
- No new server endpoints, no new dependencies, no `npm install` required (Three.js loaded via CDN, same as existing modal).

## Next Steps

After Phase 01 ships:
1. Document the importmap pattern in `docs/code-standards.md` so future 3D/anime modals follow the same approach.
2. (Out of scope, future work) Vendor `three.module.js` and `OrbitControls.js` under `client/public/vendor/three/` so offline export of 3D scenes works without internet. Pair this with a `copy-vendor.js` entry. Pre-existing gap — not a regression introduced here.
3. Consider whether the same upgrade pattern (ES module + importmap + addons) applies to the future `AnimeModal` and `KineticTextModal` ports.

---

## Red Team Review (deep mode)

Hostile-reviewer pass on the plan above. Findings ranked by blast radius. Each item has a verdict and (where action is required) a plan delta.

| # | Attack vector | Finding | Verdict | Delta |
|---|---|---|---|---|
| R1 | Iframe `srcDoc` length limit in Chromium | OrbitControls + lighting + 5000-particle galaxy template HTML can exceed ~2 MB. `srcDoc` works but DevTools struggles; some legacy print pipelines truncate. | Low risk — galaxy is ~6 KB, not 2 MB. Verified by reading source `case 'galaxy'`. No delta. | None |
| R2 | `<iframe sandbox="allow-scripts">` blocks inline `<script type="importmap">` | False alarm. CSP `script-src` does NOT apply to importmap inside an opaque-origin iframe; Chrome 89+ honors importmap without `allow-same-origin`. | OK. Smoke step 3 (drag-orbit in present mode) is the actual confirmation. | None |
| R3 | `key` prop on iframe forces full re-mount, dropping WebGL context every keystroke | True if `previewKey` is bumped on every `params` change. Plan only bumps it on `Refresh Preview` and `Edit as code`. `useMemo` re-derives `srcDoc`; React re-renders the iframe attr; the iframe reloads on `srcDoc` change without `key` bump. Acceptable. | No delta — but **add a test**: typing in speed input does NOT increment `previewKey`. | Add Slice 4 test: `previewKey` stable when only `params` change. |
| R4 | AGPL header scope wrong | Plan says: header on template module only, not modal. Source `ThreeModal.jsx` carries the header at file level. Our template HTML strings are verbatim from source — header on the module file is correct. Modal is a local rewrite — no header needed. **However**, individual template strings in source carry no per-block attribution; the file-level header in source covers them. Our module-level header will cover them too. | OK. No delta. | None |
| R5 | "Edit as code" loses pending param edits | Click flow: user picks `wireframe-sphere`, changes color to red, clicks Edit as code. We pass `params` (includes red) to `generateThreeJsHtml`, so edited HTML includes red. Round-trip preserved. | OK. | None |
| R6 | Tab key handler steals focus traversal | `e.preventDefault()` inside textarea is fine; outside the textarea Tab still works. **But**: must not attach the handler at the modal level — only on the custom textarea. | Add to plan: scope `onKeyDown={handleTab}` to the textarea element only, not modal root. | Slice 5 GREEN step 2 amended: handler on textarea only. |
| R7 | `sandbox="allow-scripts"` without `allow-same-origin` blocks `localStorage` inside scene | Source's templates don't read storage. Our DEFAULT_CUSTOM doesn't either. | OK. | None |
| R8 | Test brittleness from string-match assertions | `'5000'`, `'lerp'`, `'computeVertexNormals'`, `'flatShading'`, `'InstancedMesh'`, `'BoxGeometry'`, `'TorusGeometry'`, `'alpha:true'` — these are all stable identifiers in source. Galaxy uses `5000` literally; if source bumps to `4500` later we update assertion. | OK — assertions are intentional canary tests for the alias regression. Document in test file. | Slice 2 RED: add comment in test "// regression guard: was previously aliased to particle-cloud". |
| R9 | `alpha:true` literal match too loose | `WebGLRenderer({antialias:true,alpha:true})` and `WebGLRenderer({alpha:true,antialias:true})` both pass; ` alpha: true ` (spaced) does not. We control the source string, so spacing is stable. | OK. Pin format in module. | Slice 4 GREEN: render renderer options as `{antialias:true,alpha:true}` (no spaces, alpha second) verbatim. |
| R10 | OrbitControls in modal preview iframe consumes pointer events that should drop a modal | `pointer-events` on the iframe vs the modal backdrop: clicking on preview should orbit, clicking off should close. Plan's modal backdrop already uses `onClick={onClose}` with `e.stopPropagation()` on inner panel — clicking on iframe is inside inner panel, so no close. | OK. | None |
| R11 | Smoke step 6 (offline export) untested in unit suite | Cannot be unit-tested (requires Vite build + reveal.js render). Blast radius if it breaks: high (regression in export). | Add Slice 6: also run `npm run test:e2e -- --grep "html embed"` if such a smoke exists, otherwise document manual verification path. | Slice 6 amended: include focused e2e if available; else explicit manual gate. |
| R12 | Importmap CDN outage during preview | jsdelivr 502 → preview iframe shows blank. Editor still loads. Insertion still works (HTML stored). At present-time, viewer hits same CDN. **Pre-existing risk** — current modal already uses jsdelivr `three.min.js`. | Document as known limitation. Vendoring is in Next Steps #2. | None |
| R13 | Plan claims `12 cases (existing 5 + new 7)` | New count: 5 (slice 1) + 4 (slice 2) + 3 (slice 3) + 3 (slice 4) + 4 (slice 5) = 19 new + 5 existing = 24. Plan body undercounts. | Update Success Criteria total. | Done below. |

### Plan Deltas Applied (from red-team)

- **R3**: Add explicit "previewKey stable when only params change" test in Slice 4 RED.
- **R6**: Tab handler attaches to textarea only, never modal root.
- **R8**: Comment regression guards in test file.
- **R9**: Renderer options string format pinned.
- **R11**: Slice 6 includes focused e2e (or explicit manual gate when none exists).
- **R13**: Test count corrected from 12 → 24.

## Validation Interview (deep mode)

Critical questions a senior reviewer would ask. Answers locked in here so implementation does not drift.

| # | Question | Answer | Source |
|---|---|---|---|
| V1 | What is the exact insertion contract? | `onInsert(htmlString)` is called with the generated HTML; `EditorPage.insertEmbedHtml` wraps it as `{ type: 'html', content: html }`. Props unchanged: `onInsert`, `onClose`. | `EditorPage.jsx:1900-1905` (verified) |
| V2 | What renders the inserted HTML in offline export, share-link, PPTX raster, live viewer? | `shared/src/element-renderers.js renderHtml` (`element-renderers.js:146-166` verified). Wraps content in `<!doctype html><html><head><meta charset="utf-8">…</head><body>${content}</body></html>` and serves via `toHtmlDataUrl(...)` data URL. Importmap inside body survives this wrapping (verified by inspecting the wrap template). | `element-renderers.js:155, 164` (verified) |
| V3 | Is `<script type="importmap">` order-sensitive vs the consuming `import` statement? | Yes: importmap MUST be parsed before the first `import`. Our `base` string puts importmap inside `<head>` and the consuming script inside `<body>`. Order preserved. | Spec — html.spec.whatwg.org#import-maps |
| V4 | What is the rollback strategy if the upgrade breaks a presentation in production? | Single commit. `git revert <sha>` restores 116-LOC modal. Existing `el.type === 'html'` content from inserted scenes still renders via `renderHtml` regardless of which modal version generated it; there is no schema migration. Old slides keep their old HTML; new slides use new HTML. | Plan overview "Rollback Strategy" |
| V5 | What is the failure mode if a user pastes JSX into the custom textarea? | Iframe shows render error in console; nothing crashes. No host-page impact (sandbox isolation). Insert button still works → presented slide shows broken iframe. **Acceptable** per `README:117-130` trusted-author model. | README security section |
| V6 | How do we prove OrbitControls actually work without a manual smoke? | Cannot — OrbitControls require pointer events on a real WebGL canvas. Unit test asserts the import statement and the `new OrbitControls(camera, renderer.domElement)` line are present in the generated HTML. The runtime pointer behavior is covered by Slice 7 manual smoke step 3. | Plan Slice 7 |
| V7 | What if Vite tree-shakes the `DEFAULT_CUSTOM` constant? | It cannot: it's a string export from a `.js` data module imported by a component. ESM exports are preserved. | Vite docs — preserveEntrySignatures: 'allow-extension' default for libs; not applicable to apps but exports from imported modules are not tree-shaken when used. |
| V8 | If `params.transparent` is true and `params.background` is set, what wins? | `transparent` wins. Renderer gets `alpha:true`; `scene.background` assignment is skipped. Plan Slice 4 GREEN step is explicit. | Plan |
| V9 | What is the acceptance criterion sharpness — does "OrbitControls work" mean drag-orbit, or zoom, or both? | Both. Slice 7 step 3 lists both. Failure of either is a regression. | Plan Slice 7 |
| V10 | What is "no regression in offline export" measured against? | Manual smoke: insert a `rotating-cube`, export offline HTML, open file in browser, scene renders and rotates. No automated assertion (cannot run reveal.js in vitest). | Plan Slice 7 step 6 |
| V11 | Are ALL 8 templates verified to use OrbitControls in source, or is the importmap there for some and `script` for others? | Source uses ES module + importmap for the entire scene-rendering script across all 8. Verified. | `xia-compare-260519-parallax-presentations.md` cherry-pick item 1 |
| V12 | Test file extension count — does adding 19 new assertions push test runtime over a session-blocker threshold? | No. Each assertion is a string-contains check on generated HTML; no DOM mount, no WebGL. Estimated runtime <500 ms total for the file. | Estimate |
| V13 | Phase priority `medium` vs Risk Score `2/5` vs `--deep --tdd` flag — is medium-priority correct for a deep-mode plan? | Medium-priority is correct: feature scope is bounded, no cross-cutting changes. Deep mode applies to the *quality of planning*, not the *priority of the work*. | Plan |

### Outstanding Decisions (locked)

- **Renderer options literal**: `{antialias:true,alpha:true}` (alpha second, no spaces). Pin in source generator. (R9)
- **`previewKey` semantics**: increments only on `Refresh Preview` and `Edit as code`. `useMemo` handles re-render for all `params`/`selected`/`customCode` changes. (R3)
- **Tab handler attachment**: textarea element only. (R6)
- **AGPL header**: module file only; modal file is locally authored. (R4)
- **Test count**: 24 (5 existing + 19 new). Update Success Criteria below. (R13)

### Updated Success Criteria

Replaces the bullet inside `## Success Criteria`:

- ~~All test assertions pass (existing 5 + new 7 = 12 cases).~~
- **All test assertions pass (existing 5 + new 19 = 24 cases).**

## Whole-Plan Consistency Sweep (deep mode gate)

Re-read `port-three-js-3d-scene-template-selector-modal-from-parallax-overview.md` and this phase file after the deltas above. Findings:

| # | Contradiction | Resolution |
|---|---|---|
| C1 | Overview line 9 says "5 known gaps". Phase Implementation lists 7 slices. | Overview gap count is descriptive (5 user-visible gaps). Slice count is execution detail. No contradiction. |
| C2 | Overview line 38 says `Tailwind` (keep local convention); phase file repeats Tailwind. | Consistent. |
| C3 | Overview line 50 says AGPL header on template module. Phase R4 confirms. | Consistent. |
| C4 | Original phase line 168 said `12 cases`; validation R13 corrects to 24. | Patched in "Updated Success Criteria" above. Original line is historical. |
| C5 | Overview line 86 lists "Out of Scope" — vendoring three.js, reporting source endpoints upstream, porting other modals. Phase file Next Steps #2 also marks vendoring as out of scope. | Consistent. |
| C6 | Phase Risk Assessment row 5 says importmap + data URL wrapping risk is low; validation V2 confirms via `element-renderers.js:155-164`. | Consistent. |
| C7 | Overview Risk Score `2/5`. Red-team raised no items above Medium impact. | Consistent. Risk Score remains 2/5. |

**Sweep result: 0 unresolved contradictions.** Plan is ready for `/ck:cook`.
