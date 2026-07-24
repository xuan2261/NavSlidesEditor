# Plan: Upgrade KineticTextAnimationTemplateSelectorModal from parallax-presentations

Generated: 2026-05-19
Mode: `--port` (idiomatic rewrite, not verbatim copy)
Source: `jbirky/parallax-presentations` @ `ce548c535abc7701ac45cc3164560caba121adce` -- `client/src/components/KineticTextModal.jsx` (464 LOC)
Local target: `client/src/components/kinetic-text-animation-template-selector-modal.jsx` (currently 133 LOC, stub)

## TL;DR

Local already has a working stub modal that emits `html` element type via `insertEmbedHtml`. It works in offline export, share-link, PPTX, live viewer because it routes through `shared/src/element-renderers.js renderHtml:146`. **Port = upgrade, not greenfield.** No call-site change (3-arg `onInsert(html, w, h)` from source is collapsed to 1-arg, matching sibling Anime/Three modals).

10 known gaps to close:

1. No live preview iframe -- user inserts blind. Siblings have it.
2. No "Edit as code" template -> custom bridge.
3. No `DEFAULT_CUSTOM` scaffold; Custom Code starts empty.
4. No Tab key handler in textarea (focus jumps out).
5. Missing font selector (13 Google Fonts), weight selector (9 weights), bold/italic/underline toggles -- core to "kinetic text" identity.
6. `escapeCssValue` strips quotes -- corrupts `'Barlow', sans-serif`. Latent bug.
7. Template `desc` field exists but not surfaced in UI.
8. Animation quality lower than source (revolve, glitch, circular, etc.). Several keyframes oversimplified.
9. No AGPL/SPDX header on ported template strings.
10. No file split (sibling pattern: `data/<feature>-templates.js` + modal under 200 LOC).

## Phases

| # | Phase | Status | Effort |
|---|---|---|---|
| 1 | Upgrade modal + extract templates module + extend tests | pending | M (1 session) |

## Source Manifest

| Field | Value |
|---|---|
| Repo | `jbirky/parallax-presentations` |
| Commit SHA | `ce548c535abc7701ac45cc3164560caba121adce` |
| File | `client/src/components/KineticTextModal.jsx` (464 LOC) |
| License | AGPL-3.0-or-later |
| Local LICENSE | AGPL-3.0 (per ThreeModal plan finding -- compatible) |

## Decision Matrix (Phase 4 outcome)

| Decision | Source | Local plan | Why |
|---|---|---|---|
| Output element type | `html` element via `onInsert(html, w, h)` | **`html` element via `onInsert(html)`** (drop w/h) | Match sibling Anime/Three ports; element renderer handles default size |
| Animation library | Pure CSS keyframes only (no anime.js) | **Pure CSS** | Source has no anime.js dep; matches local privacy goals |
| Style system | inline styles | **Tailwind** (match local convention) | Codebase consistency; matches sibling AnimeModal |
| File layout | single 464-LOC file | **split**: modal + `data/kinetic-text-animation-templates.js` | CLAUDE.md 200 LOC rule; matches sibling pattern |
| Font selector + 13 Google Fonts @import | yes | **adopt** | Core to feature identity; same external CDN trust as siblings |
| Weight selector (9) + bold/italic/underline | yes | **adopt** | Intrinsic to "kinetic text" |
| Live preview pane | iframe + sandbox="allow-scripts" | **adopt** | Validate before insert; siblings have it |
| `DEFAULT_CUSTOM` scaffold | yes | **adopt** | Onboarding |
| Tab key indent in textarea | yes | **adopt** | QoL; siblings have it |
| "Edit as code" handoff | yes (toggle: template <-> custom) | **adopt** as one-way (template -> custom) | Match sibling AnimeModal pattern |
| Refresh Preview button | no | **adopt** | Match sibling AnimeModal; useful for custom code |
| `computeElementSize` (canvas-measure) | yes -- 3-arg `onInsert` | **drop** | Local `insertEmbedHtml` ignores w/h; sibling pattern |
| `escapeCssValue` (current local bug) | n/a (source doesn't have it) | **remove** | Strips quotes from font names; CSS injection isn't a real risk inside sandboxed iframe |
| Template `desc` shown as title + footer hint | yes | **adopt** | Match sibling pattern |
| AGPL header on template strings | n/a (source has it on whole file) | **add SPDX + Copyright Jessica Birky** to template module | License compliance; matches sibling templates module |
| Animation fidelity (revolve, glitch, circular, split-flap, fade-cascade, bounce, stagger-center, wave) | source quality | **adopt source keyframes** | Visual quality |

## Dependency Matrix

| Source component | Local target | Status | Action |
|---|---|---|---|
| `KineticTextModal.jsx` (464 LOC) | `kinetic-text-animation-template-selector-modal.jsx` (133 LOC stub) | EXISTS | Upgrade in place |
| Inline `TEMPLATES` (11 entries) + `generateHTML(id, params)` + `textStyle(params)` | `data/kinetic-text-animation-templates.js` -- exports `TEMPLATES`, `FONTS`, `WEIGHTS`, `DEFAULT_CUSTOM`, `generateKineticHtml` | NEW | Extract |
| `DEFAULT_CUSTOM` constant (~25 LOC) | same module | NEW | Extract |
| `useMemo` preview html + `previewKey` invalidation | none | NEW | Inline in modal |
| `<iframe srcDoc sandbox="allow-scripts">` preview | none | NEW | Inline in modal |
| `slideW` / `slideH` props for preview sizing | not passed | CONFLICT (sibling-aligned) | Add props with defaults; do not change EditorPage call shape |
| Tab key indent handler | none | NEW | Inline in modal (match sibling helper) |
| 3-arg `onInsert(html, w, h)` | 1-arg `onInsert(html)` | CONFLICT | Drop w/h; collapse to 1-arg matching sibling pattern |
| `computeElementSize` canvas-measure helper | none | DROP | Out of scope |
| `Bold` / `Italic` / `Underline` / `Code2` Lucide icons | none in current modal | NEW | Already in `lucide-react` dep (used by ribbon) |
| `escapeCssValue` (local-only) | n/a | REMOVE | Latent bug; not present in source |
| AGPL header lines (1-2) | none in templates module | NEW | Add to template module only |
| Existing test (7 cases) | `kinetic-text-animation-template-selector-modal.test.jsx` | EXISTS | Extend with template-content + Edit-as-code + Tab-key + iframe assertions; mirror sibling AnimeModal test depth |

## Challenge Framework Pass

| # | Question | Source answer | Local answer | Risk if wrong |
|---|---|---|---|---|
| 1 | Should output be a new `kinetic-text` element type? | n/a (source emits `html`) | Match siblings: emit `html` element via `insertEmbedHtml` | Adopting new type forces edits to `shared/src/element-renderers.js`, PPTX exporter, offline export, live viewer -- significant infra cost for zero functional gain |
| 2 | Should we adopt anime.js for these animations? | No -- source uses pure CSS | Pure CSS | Adding anime.js adds 47KB CDN dep with no benefit -- source proves CSS is enough |
| 3 | Should the 13-font Google Fonts @import be kept? | Yes | Yes -- same external-dep trust model as Three.js (importmap from CDN) and Anime.js (CDN) ports | Self-hosting fonts is +500KB to bundle and offline gap is shared with siblings; defer to a fonts-vendoring plan if/when offline-first becomes a goal |
| 4 | Drop the 3-arg `onInsert(html, w, h)`? | n/a | Yes -- siblings emit 1-arg; `insertEmbedHtml` ignores w/h; html element renderer applies default size | Keeping 3-arg forces EditorPage call-site changes and diverges from sibling pattern; cosmetic-only loss |
| 5 | Remove `escapeCssValue` from current local code? | n/a (source doesn't have it) | Yes -- inside `srcDoc` sandboxed iframe with `allow-scripts` only (no `allow-same-origin`), CSS injection cannot exfiltrate; quote-stripping breaks valid font names like `'Playfair Display', serif` | Keeping it preserves a latent bug for no security gain |
| 6 | Adopt source's font/weight/B/I/U toolbar? | Yes -- it's the feature's defining surface | Yes | Without it, "kinetic text" reduces to "kinetic Hello-World-only" -- the modal name implies typography control |
| 7 | Adopt `DEFAULT_CUSTOM` + Edit-as-code + Tab indent? | Yes | Yes -- siblings already do this | Custom code path is unusable without a starting scaffold and Tab handling |
| 8 | License compatibility for porting template strings? | AGPL-3.0-or-later | Local LICENSE = AGPL-3.0 (per ThreeModal plan verification); compatible | If LICENSE divergence appears, port stops; risk currently 0 |

## Risk Score: **2 / 5**

- File size (mitigated by split): 1
- External CDN for Google Fonts (parity with siblings, pre-existing offline gap): 1
- Test churn (extension only, no rewrites of existing 7 cases): 0
- No new XSS surface (same `html` element path through `renderHtml`, sandboxed iframe in modal): 0
- No new server work: 0
- No EditorPage call-site change (1-arg `onInsert` matches existing wiring at `EditorPage.jsx:1882-1887`): 0

## Rollback Strategy

Single commit. If issues post-merge:

1. `git revert <hash>` -- restores 133-LOC stub verbatim.
2. EditorPage call site (`EditorPage.jsx:1882-1887`) doesn't change shape (`onInsert`, `onClose` only) -- no other callers to fix.
3. Existing 7 test cases are independent of template internals (text matching, button clicks, default values) -- they pass on prior version too. New tests are additions only.

## Out of Scope

- Vendoring Google Fonts locally for offline export (separate plan; pre-existing gap shared with sibling Anime/Three modals).
- Self-hosting Lucide icons (already in deps).
- Porting `MathGridModal` from source (separate xia run).
- Adding new element type for kinetic text (rejected per Challenge #1).
- Server-side animation pipeline (rejected per Challenge #2).

## Unresolved Questions

None. All Phase 4 decisions resolved. The two ambiguous calls (drop 3-arg `onInsert`, remove `escapeCssValue`) are resolved by sibling-pattern alignment and threat-model analysis respectively.
