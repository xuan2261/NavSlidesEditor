# Plan: Upgrade ThreeJs3DSceneTemplateSelectorModal from parallax-presentations

Generated: 2026-05-19
Mode: `--port` (idiomatic rewrite, not verbatim copy)
Source: `jbirky/parallax-presentations` @ `ce548c535abc7701ac45cc3164560caba121adce` — `client/src/components/ThreeModal.jsx` (396 LOC)
Local target: `client/src/components/three-js-3d-scene-template-selector-modal.jsx` (currently 116 LOC)

## TL;DR

Local already has a working 3D scene modal that emits `html` element type via `insertEmbedHtml`. It works in offline export, share-link, PPTX, live viewer because it routes through `shared/src/element-renderers.js renderHtml`. **Port = upgrade, not greenfield.**

5 known gaps to close:
1. 3 of 8 templates are aliases (galaxy, terrain, instanced-spheres) — UI lies.
2. No OrbitControls (no drag/zoom in presented slide) — needs ES module + importmap.
3. Basic lighting/materials (`MeshBasicMaterial` wireframe) — source uses `MeshStandardMaterial` with proper lights.
4. No live preview pane in modal — user inserts blind.
5. No "Edit as code" handoff, no `DEFAULT_CUSTOM` scaffold, no Tab key in textarea.

## Phases

| # | Phase | Status | Effort |
|---|---|---|---|
| 1 | Upgrade modal + extract templates module + extend tests | completed | M (1 session) |

## Source Manifest

| Field | Value |
|---|---|
| Repo | `jbirky/parallax-presentations` |
| Commit SHA | `ce548c535abc7701ac45cc3164560caba121adce` |
| File | `client/src/components/ThreeModal.jsx` (396 LOC) |
| License | AGPL-3.0-or-later |
| Local LICENSE | AGPL-3.0-only — **compatible** |

## Decision Matrix (Phase 4 outcome)

| Decision | Source | Local plan | Why |
|---|---|---|---|
| Style system | inline styles | **Tailwind** (keep local convention) | Codebase consistency |
| File layout | single 396-LOC file | **split**: modal + `data/three-js-3d-scene-templates.js` | CLAUDE.md 200 LOC rule |
| Three.js loading | ES module + importmap (0.162.0) | **adopt** | Required for OrbitControls |
| OrbitControls | yes | **adopt** | UX uplift |
| 3 fake aliases | n/a | **replace with real implementations from source** | Fix UI lying |
| Lighting/materials upgrade | yes | **adopt** | Visual quality |
| Live preview pane | iframe + sandbox="allow-scripts" | **adopt** | Validate before insert |
| Background UI | select 6 preset | **hybrid: color picker + transparent toggle** (user choice) | Flexibility + alpha capability |
| `DEFAULT_CUSTOM` scaffold | yes | **adopt** | Onboarding |
| Tab key indent in textarea | yes | **adopt** | QoL |
| "Edit as code" handoff | yes | **adopt** (user choice) | UX |
| AGPL header on template strings | n/a (source has them) | **add** SPDX + Copyright Jessica Birky to template module | License compliance |
| Vendor three.js locally | no (CDN) | **defer** — out of scope; offline export gap pre-existed | Scope discipline |

## Dependency Matrix

| Source component | Local target | Status | Action |
|---|---|---|---|
| `ThreeModal.jsx` (396 LOC) | `three-js-3d-scene-template-selector-modal.jsx` (116 LOC) | EXISTS | Upgrade in place |
| Inline `TEMPLATES` array + `generateHTML(id, params)` | none | NEW | Extract → `client/src/data/three-js-3d-scene-templates.js` |
| `DEFAULT_CUSTOM` constant (~50 LOC) | none | NEW | Same module |
| `useMemo` preview html + `previewKey` invalidation | none | NEW | Inline in modal |
| `<iframe srcDoc sandbox="allow-scripts">` preview | none | NEW | Inline in modal |
| `slideW` / `slideH` props for preview sizing | not passed | CONFLICT | Add to EditorPage call site |
| Tab key indent handler | none | NEW | Inline in modal |
| AGPL header lines (1-2) | none in templates module | NEW | Add to template module only (we authored the modal) |
| `existing test` (5 cases) | `three-js-3d-scene-template-selector-modal.test.jsx` | EXISTS | Extend with template-content assertions |

## Risk Score: **2 / 5**

- File size (mitigated by split): 1
- Importmap browser support (Chrome 89+, Safari 16.4+): 1
- Test churn (extension only, no rewrites): 0
- No new XSS surface (same `html` element path through `renderHtml`): 0
- No new server work: 0

## Rollback Strategy

Single commit. If issues post-merge:
1. `git revert <hash>` — restores 116-LOC modal verbatim.
2. `EditorPage.jsx:1901` props don't change shape (`onInsert`, `onClose` only) — no other callers to fix.
3. Tests still pass on prior version (5 existing assertions are independent of template internals).

## Out of Scope

- Vendoring three.js locally for offline export (separate plan; pre-existing gap).
- Reporting source's unauthenticated `/api/presentations/:id/plugins` endpoint upstream.
- Porting `AnimeModal`, `KineticTextModal`, `MathGridModal` (separate xia runs).

## Unresolved Questions

None — both Phase 4 ambiguous decisions resolved by user (hybrid background UI, port "Edit as code").
