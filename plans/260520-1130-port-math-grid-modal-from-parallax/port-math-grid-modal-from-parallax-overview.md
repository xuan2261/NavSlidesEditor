# Plan: Port MathGridModal from parallax-presentations

Generated: 2026-05-20
Mode: `--deep --tdd` (idiomatic rewrite + tests-first; not verbatim copy)
Source: `jbirky/parallax-presentations` @ `ce548c535abc7701ac45cc3164560caba121adce` -- `client/src/components/MathGridModal.jsx` (281 LOC)
Local target: `client/src/components/parametric-math-grid-surface-plotter-modal.jsx` (currently 125 LOC, canvas-based stub)
Sibling pattern: `plans/260519-2310-port-kinetic-text-modal-from-parallax/`, `plans/260519-2114-port-three-modal-from-parallax/`, commit `72343090`.

## TL;DR

Local has a canvas-based stub that generates self-contained iframe HTML via `eval2` with a regex-sanitized math expression. Source uses **inline SVG polylines** generated via `new Function()` compilation, with rich `GridSVG` React preview + line toggles + opacity + line width. Both emit `html` element via `onInsert` -- no element-type change, no call-site change. Port = adopt source's SVG output + preview model, keep local's regex sanitization (security improvement over both), match sibling Tailwind shell + AGPL/SPDX header on data module.

10 known gaps to close:

1. Output uses canvas + `eval2` (script-tag in iframe). Source uses inline SVG (no scripts). SVG is simpler, scales via `viewBox`, and removes a script execution surface in the inserted slide element.
2. No live preview at all. Source has rich `GridSVG` React preview reflecting current params.
3. Local has only 6 of 10 source presets with simplified parameter sets (no per-preset `uMin/uMax/vMin/vMax/uDiv/vDiv` overrides). Source's per-preset metadata yields visibly distinct grids; local applies a single fixed range to every preset.
4. Local's 11th preset "Lissajous" is not in source -- it's a stub-author addition that doesn't fit the surface-plotting model (a 1D parametric curve, not a 2D grid).
5. Missing controls: line width, opacity, bg, u-line / v-line toggle.
6. Math expression compilation: local uses `Function('u','v','with(Math){return('+expr+')}')`. `with` statement is a long-standing JS footgun -- `var` declarations inside `with` leak. Source uses destructured `const {sin,cos,...}=Math` (cleaner, strict-mode-safe).
7. Math expression injection surface: source's `new Function()` runs in React parent context (no sandbox), giving any string passed to `compileExpr` access to global scope via `Function.constructor`. Local's regex sanitizer is a real security improvement -- keep it.
8. Inline-style soup. Source uses inline `style={{...}}`; codebase convention is Tailwind (per sibling Anime/Three/Kinetic-text modals).
9. AGPL/SPDX header missing on local; source carries it at file top. Per sibling pattern, header lives on the data module (template strings/PRESETS), not the modal shell (locally rewritten).
10. No file split. Source = 281 LOC single file; sibling pattern = `data/<feature>-templates.js` + modal under 200 LOC.

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | Upgrade modal + extract data module + extend tests (TDD) | completed | M (1 session) |

## Source Manifest

| Field | Value |
|-------|-------|
| Repo | `jbirky/parallax-presentations` |
| Commit SHA | `ce548c535abc7701ac45cc3164560caba121adce` |
| File | `client/src/components/MathGridModal.jsx` (281 LOC) |
| License | AGPL-3.0-or-later |
| Local LICENSE | AGPL-3.0 (per ThreeModal port verification -- compatible) |
| Stashed source | `plans/reports/_source-MathGridModal.jsx.tmp` |

## Decision Matrix

| Decision | Source | Local plan | Why |
|---|---|---|---|
| Output element type | `html` element via `onInsert(html)` | **same** | No change; matches sibling ports |
| Output content | inline SVG polylines (no JS) | **adopt SVG** | No script execution in inserted element; smaller payload; viewBox handles scaling |
| Preview surface | inline React `GridSVG` component | **adopt inline SVG (no iframe)** | Output is non-executable SVG -- iframe sandbox is overkill; matches sibling pattern only when output is executable (Anime/Three: yes; MathGrid: no) |
| Math compilation | `Function('u','v','const {sin,...}=Math;return('+expr+')')` | **adopt destructured pattern + keep local's regex allowlist** | Strict-mode-safe; allowlist blocks Function-constructor escape via `expr.constructor.constructor("...")` |
| Preset count | 10 | **10 (drop local's 11th "Lissajous")** | Lissajous is a 1D curve, not a 2D parametric surface -- doesn't fit the grid model |
| Per-preset range/division metadata | yes | **adopt** | Each preset's geometry needs different ranges (Polar wants `[0..2*PI]`, Cartesian wants `[-5..5]`) |
| `evalRange(string \| number)` | yes (parses `'2*PI'` etc.) | **adopt** | Lets presets ship `'2*PI'` literally; consistent with source |
| Line width / opacity / bg / u-line / v-line toggles | yes | **adopt** | Core to feature surface |
| `GridSVG` React component | yes | **adopt, keep in modal file** | Preview-only; has JSX so cannot move to data module |
| Style system | inline styles | **Tailwind** | Codebase convention; matches sibling modals |
| Custom-mode HTML editor | no | **drop (no parity needed)** | Source doesn't have it; output is SVG, not anime.js -- "edit emitted SVG" is out of scope |
| `DEFAULT_CUSTOM` scaffold | n/a | **n/a** | Tied to dropped custom mode |
| Tab key indent | n/a | **n/a** | Tied to dropped custom mode |
| Edit-as-code button | n/a | **n/a** | Tied to dropped custom mode |
| File layout | single 281-LOC file | **split**: modal + `data/parametric-math-grid-templates.js` | CLAUDE.md 200 LOC rule; matches sibling pattern |
| AGPL header | on modal file | **on data module** | Locally rewritten modal shell needs no header; ported template/PRESETS strings live in data module |
| `onClose()` call after `onInsert` | source omits | **call onClose() (sibling pattern)** | Sibling Anime/Three/Kinetic modals all close on insert; matches existing local stub behavior; better UX |
| Math sanitizer regex | n/a (source unsanitized) | **keep + tighten allowlist** | Block `Function`, `constructor`, `prototype`, `globalThis`, `window`, `eval`, `import`, backtick, brackets `[]`, `=` (assignment) |

## Dependency Matrix

| Source artifact | Local target | Status | Action |
|---|---|---|---|
| `PRESETS` (10 entries with full range/div metadata) | local stub PRESETS (11 entries, range/div not per-preset) | CONFLICT | Replace; drop "Lissajous" |
| `compileExpr` + `evalRange` + `generateGrid` (all pure) | inline `eval2` + canvas draw | CONFLICT | Replace; move to data module |
| `GridSVG` React component | none | NEW | Add to modal file (JSX) |
| `handleInsert` (emits SVG html string) | `generateHTML` (emits canvas html string) | CONFLICT | Replace; SVG output |
| Style: inline `style={{...}}` | inline Tailwind classes | CONFLICT | Replace with Tailwind |
| Sanitizer: none | `ALLOWED_MATH_TOKENS` regex + `sanitizeMathExpr` | KEEP | Tighten allowlist; move to data module |
| AGPL/SPDX header | none | NEW | Add to data module only |
| `EditorPage.jsx:1888-1892` call site | already correct | UNCHANGED | Verify untouched |
| `EditorPage.jsx:82` import | already correct | UNCHANGED | Verify untouched |
| Test file `parametric-math-grid-surface-plotter-modal.test.jsx` (5 cases) | EXISTS | EXTEND | Update for SVG output, drop "Lissajous" assertion, add ~9 cases (sibling depth) |

## Challenge Framework Pass (Red-Team)

| # | Question | Source answer | Local answer | Risk if wrong |
|---|---|---|---|---|
| 1 | New `math-grid` element type? | n/a (`html`) | Match siblings: `html` via `insertEmbedHtml` | New type forces edits to renderers, PPTX exporter, offline export, live viewer -- no functional gain |
| 2 | Inline SVG preview or iframe sandbox? | Inline SVG | **Inline SVG** -- output is non-executable SVG; preview parity with output is more important than sibling-pattern symmetry | iframe-wrapping a static SVG adds zero security (no scripts) and adds layout complexity |
| 3 | Drop local's 11th "Lissajous" preset? | n/a | Yes -- 1D curve, not 2D grid; not in source | Existing users who selected Lissajous lose the option; mitigated because their already-inserted elements stored their HTML and still render |
| 4 | Adopt source's `Function` compilation without sanitizer? | Source has no sanitizer | No -- keep regex allowlist | Without allowlist, `xExpr = "constructor.constructor('fetch(`/api/secret`)')()"` runs in parent context |
| 5 | Move `GridSVG` to data module? | n/a | No -- React component (JSX) belongs in modal | data modules should be pure JS; cross-import constraints with vite/test runner |
| 6 | Custom-mode HTML editor for sibling-pattern parity? | None | No -- math grid output is SVG, not script; "edit raw SVG" is out of scope | Adding it = +100 LOC for a feature with unclear UX; defer to a separate plan if requested |
| 7 | Empty/NaN grid (e.g., `xExpr = '1/0'`)? | `if (!isFinite(minX)) return error` | **adopt source guard** + disable Insert button | Without guard, `viewBox="NaN NaN NaN NaN"` produces invalid SVG; user can't tell why insert is "broken" |
| 8 | Compile errors in user expressions? | `try { return new Function(...) } catch { return null }` | **adopt** + show error message in modal | Silent failure hides the bug; user thinks the modal is broken |
| 9 | Stroke-width scaling for `viewBox` math? | `lineWidth * bw / (width || 400)` | **adopt verbatim** | Stroke-width in viewBox-units; without scaling, lines look hairline or chunky depending on aspect ratio |
| 10 | AGPL header on modal vs data module? | On modal | **On data module only** | Per Three.js port journal: modal is locally rewritten, header attaches to ported strings (PRESETS + helper signatures), not the React shell |
| 11 | Old inserted elements (canvas-based) break after upgrade? | n/a | No -- they're stored as `html` element with their content; renderer doesn't change | Test path: Insert with stub, save, upgrade, reopen -- element renders as before |
| 12 | Test fragility: `getByText('Lissajous')` will fail | n/a | Update test to source's 10 presets; assert `not.getByText('Lissajous')` for regression | Otherwise CI red on first run |
| 13 | `useMemo` deps for `grid` -- 8 inputs | source's 8 deps | Adopt | Missing dep = stale grid; extra dep (lineWidth, opacity, bg) re-runs full eval needlessly |

## Risk Score: **2 / 5**

- File size (mitigated by split): 1
- Behavioral change for old stored canvas elements (none -- HTML stored verbatim): 0
- Math expression injection (mitigated by tightened regex allowlist): 0 (improved over source)
- Test churn (extension + 1 deletion of "Lissajous" assertion): 1
- No new server work: 0
- No EditorPage call-site change (`EditorPage.jsx:1888-1892` already correct): 0

## Rollback Strategy

Single commit. If issues post-merge:

1. `git revert <hash>` -- restores 125-LOC canvas stub verbatim.
2. EditorPage call shape (`onInsert`, `onClose` only) unchanged across versions -- no other callers to fix.
3. Existing test cases -- keep 4 of 5 unchanged (preset list change forces 1 update); new assertions are additions only.
4. Already-inserted MathGrid slide elements (canvas+JS HTML) continue to render via `renderHtml` -- they're stored as `html` elements and don't depend on the modal at runtime.

## Out of Scope

- Custom-mode raw SVG editor (deferred; siblings have HTML/JS edit, math grid SVG editing is a different UX).
- 3D parametric surfaces (Z-axis) -- source is 2D-only.
- Math expression IDE (autocomplete, hover hints).
- Vendoring KaTeX/MathJax for `\sin/\cos` rendering inside expressions.
- Saving custom user presets.

## Unresolved Questions

None. All decisions resolved by sibling-pattern alignment + source-fidelity preference + threat-model analysis.

## Status

**DONE** -- plan ready for `/ck:cook --tdd`.
**Summary:** Replace canvas+JS stub with SVG-only port of source's MathGridModal, keep local's regex sanitizer (tightened), split into Tailwind modal + AGPL-headed data module, adopt source's 10 presets with per-preset range/div metadata, adopt `GridSVG` preview + line toggles + opacity + line width + bg controls. Tests-first: rewrite test file to 16 cases mirroring sibling depth.
**Concerns/Blockers:** None.
