# Parallax Presentations Comparison — Residual Gap Delta

**Date:** 2026-05-19
**Mode:** `/ck:xia --compare` (analysis only, no plan)
**Source:** https://github.com/jbirky/parallax-presentations @ `ce548c53` (HEAD)
**Local:** NavSlidesEditor v1.9.1 (ribbon UI release line)
**Predecessor report:** [`plans/reports/upstream-comprehensive-comparison-2026-05-17.md`](./upstream-comprehensive-comparison-2026-05-17.md) (893 lines, file-by-file)

---

## TL;DR

Upstream has not advanced since the previous comprehensive comparison (`ls-remote upstream main` returns the same SHA `ce548c53`). The `parallax-features-port` plan finished phases 01-09 (`docs/journals/260517-0740-parallax-port-finalization.md`). Functional gap is now small and almost entirely intentional. One real omission found: **`line-arrow` shape**.

Recommendation: close the parallax sync as **substantively done**, port `line-arrow`, leave the rest as documented out-of-scope.

---

## Source Manifest

| Field | Value |
|---|---|
| Repo | `jbirky/parallax-presentations` |
| Branch | `main` |
| Resolved SHA | `ce548c53add line-arrow shape: stroke-only arrow with no fill` |
| Last upstream activity since prev compare | none (zero new commits) |
| License | AGPL-3.0 |
| Local upstream remote | `upstream -> https://github.com/jbirky/parallax-presentations.git` (fetch corrupted local pack — `ls-remote` works, `fetch` fails; covered in *Concerns* below) |

---

## Phase Status Snapshot (port plan vs reality)

| Phase | Scope | Plan status | Verified locally |
|---|---|---|---|
| 01 | TipTap FontWeight + LineHeight | Complete | `client/src/extensions/tiptap-font-weight-extension.js`, `tiptap-line-height-extension.js` present + tests |
| 02 | Video URL / trim / speed | Complete | Per port plan, integrated into video element |
| 03 | LaTeX color/size, citations, Copy URL ctx menu | Complete | Ctrl+K explicitly **not** ported (Command Palette wins — documented decision) |
| 04 | Present mode CSS overrides | Complete | CSS chain final state lives in `shared/src/htmlGenerator.js` |
| 05 | Timeline element | Complete | `timeline-element.jsx`, `timeline-element-renderer.jsx`, 13 unit tests |
| 06 | Kinetic / Math Grid / Anime / Three modals | Complete | Renamed locally: `kinetic-text-animation-template-selector-modal.jsx`, `parametric-math-grid-surface-plotter-modal.jsx`, `anime-js-animation-template-selector-modal.jsx`, `three-js-3d-scene-template-selector-modal.jsx` |
| 07 | Bug fixes from upstream commits | Complete | CSS oscillation chain reduced to FINAL state only |
| 08 | Upload SHA-256 dedup + file browser | Complete | `file-browser-modal-to-select-and-insert-media.jsx` present |
| 09 | Integration testing | Complete | 1036 unit + 169 e2e + PPTX corpus pass per finalization journal |

---

## Head-to-Head — Residual Gaps

| Aspect | Upstream | Local | Verdict |
|---|---|---|---|
| `line-arrow` shape | `ce548c53` adds stroke-only arrow shape with no fill, registered alongside other shapes | Not present in `shared/src/shapeUtils.js` (only `arrow-right` filled variant). Local has `LineArrowRenderer` + `ARROWHEAD_MARKERS` for the **`line` element type**, which covers the visual outcome via a different element class | **Real gap, but cosmetic.** Either port the shape (~30 LOC) or document the workaround (insert line element with arrowhead) |
| `textpath` element | Inline renderer in upstream `generateHTML.js` | None | **Skip** — niche, no demand, not in port plan |
| `p5` element | Plugin-loaded inline renderer | None | **Skip** — would require plugin system |
| `d3` element | Inline renderer | None | **Skip** — Chart.js covers most use cases |
| `manim` element | Plugin + server tooling (libreoffice/poppler in upstream Dockerfile) | None | **Skip** — heavy server deps, AGPL plugin, out of scope |
| `modular-grid` | Inline upstream | None | **Skip** — niche layout helper |
| Plugin system (`plugins/`, `client/src/plugins/`) | 5 client plugin files + 2 example plugins (`animated-counter`, `manim`) | None | **Skip per documented scope decision** — major architectural change deferred |
| Clerk auth | `@clerk/clerk-react`, `@clerk/express` | None | **Skip** — self-hosted, single-user model |
| Stripe billing | `stripe` SDK | None | **Skip** — no monetization |
| PostgreSQL storage | `pg` + `server/migrations/` (6 files) + `server/storage/` abstraction | JSON file storage | **Skip** — file storage is a feature, not a limitation, for self-host |
| R2 / S3 storage | `@aws-sdk/client-s3` | Local filesystem `server/uploads/` | **Skip** — same rationale |
| Landing page / DocsPage | Cloud marketing surfaces | None | **Skip** |
| reveal.js theme override CSS | FINAL state of 11-commit oscillation chain | Ported to `shared/src/htmlGenerator.js` | Match |
| GSAP entry animations | CDN-loaded in exported HTML | Already in `htmlGenerator.js` per phase 04 | Match |
| Time widget / fullscreen button | Inline in present mode | Already in `htmlGenerator.js` per phase 04 | Match |
| 2D slide navigation, slide groups | Inline in present mode | Already in `htmlGenerator.js` per phase 04 | Match |

---

## Architectural Divergence (intentional, do not reconcile)

| Dimension | Upstream | Local | Why local diverges |
|---|---|---|---|
| `shared/` workspace | Deleted, all logic inlined into `client/src/utils/generateHTML.js` (1,141 LOC) | Modular `shared/src/` (htmlGenerator, element-renderers, shapeUtils, presenterTools) | Server reuses HTML generation for share links + GitHub push; client cannot host server-side renders |
| State | `useState`/`useCallback` in 3,489-LOC EditorPage | Zustand stores (editor / presentation / ui) | 200-LOC file size guideline + testability |
| Server | Monolithic `server/index.js` (2,038 LOC) | Modular `server/routes/` (26 files) + `services/` (38 files) | Same guideline + Socket.IO live presentation needs separation |
| Real-time | Absent | Socket.IO live presentation, remote control, speaker view, annotation sync, game mode | Differentiating feature |
| Routing | Manual page state | `react-router-dom` v7 | Multi-page surface (`/live`, `/remote`, `/speaker`, `/game/join`, `/explore`, `/settings`) |
| Tests | Removed | 1036 unit + 169 e2e + load (`k6`) + PPTX corpus | Non-negotiable |
| CSS | Inline styles only | Tailwind 3 + design tokens | Ribbon UI relies on it |

The 2026-05-17 report covers each row in detail.

---

## Challenge Pass

| Q | Source assumption | Local reality | Risk if wrong |
|---|---|---|---|
| Is `line-arrow` redundant given local line element + arrowhead markers? | Upstream registers it as a shape, expecting users to think *"shape gallery"* | Local exposes the same outcome via line element, not shape gallery | UX regression for users coming from upstream UI mental model — minor |
| Is the plugin system *actually* needed for any of `p5`/`d3`/`manim`/`textpath`? | Upstream couples them via plugin loader | Local doesn't have them as element types at all | None — features simply absent, no broken UX |
| Does upstream's CSS FINAL state actually match what got into local? | Phase 04 says complete | Predecessor report enumerates final CSS block (lines 601-676); not re-verified char-by-char this pass | Low — covered by present-mode visual regression e2e suite |
| Is the predecessor report still valid? | Upstream HEAD frozen at `ce548c53` | Confirmed via `git ls-remote` | None |
| Has local *regressed* away from upstream parity since 2026-05-17? | Possible — ribbon UI shipped (v1.8 → v1.9.1) | Ribbon migration touches `EditorPage.jsx`, ribbon insert tab references kinetic/anime/three modals — those still wired. No present-mode CSS files touched in ribbon commits | Low |

---

## Recommendation

1. **Port `line-arrow` shape.** Smallest residual gap, ~30 LOC into `shared/src/shapeUtils.js`, register in shape gallery. Skip if Q1 risk is judged not worth the work — current local UX already produces the same visual via line element.
2. **Close parallax sync.** Mark `plans/parallax-features-port/` and the upstream-merge plan family archived with a one-line pointer to this report. Upstream is dormant and remaining items are documented out-of-scope.
3. **Drop `upstream` git remote** *only if* user confirms. The corrupted local pack file is failing `git fetch` — fixing it requires either a `git gc` repair pass or removing the remote entirely. Not auto-applied.
4. **No new port plan needed for this comparison.** Compare-mode output stops here.

---

## Concerns

- Local `.git/objects/pack/pack-517abdce04...pack` is corrupted (`fsck` reports many object errors, `git fetch` fails with `Invalid argument`). `ls-remote` and committed history work fine, but force-fetching upstream commits is currently broken. Repair: `git gc --aggressive --prune=now` or re-clone if benign. **Independent of parallax sync** — flag separately.
- `line-arrow` gap was implicit in phase plan (phase 02 covered video, not shapes; no phase covered "shape additions"). No phase ever claimed to port it, which is why it slipped — surfacing here for explicit decision.

## Unresolved Questions

- Port `line-arrow` shape, or accept the line-element-with-arrowhead workaround and close?
- Repair the corrupted pack (`git gc`) or drop the `upstream` remote entirely now that sync is effectively done?

---

**Status:** DONE
**Summary:** Residual gap analysis between local NavSlidesEditor v1.9.1 and parallax-presentations @ ce548c53. Upstream frozen, ports complete except `line-arrow` shape; remaining divergence is documented and intentional.
**Concerns/Blockers:** Corrupted local git pack file blocks `git fetch upstream`; flagged for separate repair.
