# Upstream Feature Audit Research

## Context

- Work context: `D:\NCKH_2025\NavSlidesEditor`
- Upstream: `https://github.com/jbirky/parallax-presentations.git`
- Local branch: `master`, ahead `origin/master` by 8 commits at scan time
- Upstream target: `upstream/main` primary, `upstream/dev` and `upstream/feature/grid-and-axis-tools` read-only scan
- Date: 2026-05-14

## Hard Facts

| Check | Result |
| --- | --- |
| `git merge-base HEAD upstream/main` | no merge-base |
| `git rev-list --left-right --count HEAD...upstream/main` | `53 122` |
| `git diff --shortstat HEAD..upstream/main` | `9630 files changed, 888234 insertions, 304798 deletions` |
| Local project | React/Vite + Express + Electron monorepo |
| Local storage | file-backed JSON, no database |
| Local test gates | ESLint, Vite build, Vitest, Playwright, k6, PPTX corpus |

## Important Existing Local Work

- `plans/260514-0749-upstream-main-merge-sync/` is cancelled due unrelated histories.
- `plans/260514-1045-upstream-main-selective-port-workflow/` is complete.
- Copy URL context menu concept from upstream commit `93816b88` is already ported locally.
- Local repo has extra domains not present upstream baseline:
  - PPTX import/export fidelity pipeline
  - live presentation routes
  - game presenter/player flows
  - modal shell and UI/UX warm editorial overhaul
  - rclone sync, GitHub push, Electron packaging

## Upstream Main Candidates

| Commit | Topic | Fit | Recommendation |
| --- | --- | --- | --- |
| `6c3ef006` | text spacing mismatch 42px -> 16px | high, likely already aligned | verify only |
| `cde1b2e9`, `347d6ad8` | HTML embeds present mode blob/data URL | medium | verify current local paths before port |
| `53173592` | editor vs present px/em mismatch | medium-high | port if local mismatch found |
| `edfc1ba5` | LaTeX present mode direct KaTeX | medium | compare with local renderer first |
| `315eee97` | LaTeX/TikZ font size | high | port/adapt |
| `6d971eb0` | LaTeX font color | high | port/adapt |
| `8050b08a` | fragment animations slide/flip/strike | high | port/adapt from `upstream/dev` if desired |
| `a388d35b`, `f7a3a351` | video trimming, OGV, speed | medium | audit after media model check |
| `9d3288ea` + timeline series | timeline element | medium value, high risk | defer to separate epic |
| citation commits | image citations | low fit | skip unless local image schema expands |
| landing/docs/pricing | product/marketing | low fit | skip |

## Upstream Dev / Feature Branch Notes

- `upstream/dev` includes:
  - kinetic text box fit
  - grouped slides page number fix
  - plugin API/loader/Manim commits
  - SaaS/billing/auth commits
- `upstream/feature/grid-and-axis-tools` includes storage split and advanced layout/tool reorganization.
- `upstream/saas-migration` is architecture direction mismatch for current self-host single-user repo.

## Recommended Scope

Primary scope:
- `upstream/main` bugfix/editor/export improvements.

Read-only idea scope:
- `upstream/dev`
- `upstream/feature/grid-and-axis-tools`

Skip by default:
- `upstream/saas-migration`
- billing/auth/Stripe/Clerk
- upstream built artifacts
- upstream landing/pricing changes

## Risks

- No common history means cherry-pick is often unsafe.
- Upstream file structure differs: upstream uses `client/src/utils/generateHTML.js` and large `server/index.js`; local uses `shared/src/htmlGenerator.js`, `shared/src/element-renderers.js`, route/service split.
- Feature names overlap but semantics differ: local `AnimationTimeline` is fragment sequencing, upstream timeline is a slide element.
- HTML embed changes touch trusted author content and PDF/export behavior.
- Plugin architecture is attractive but large; mixing it with bugfix sync will create review noise.

## Recommended Test Strategy

Per phase:
- `npm run lint`
- `npm run build`
- `npm run test` or targeted Vitest
- targeted Playwright by touched area

Final:
- `npm run lint`
- `npm run build`
- `npm run test`
- `npm run test:e2e`
- `npm run test:corpus` if export/PPTX code touched

## Unresolved Questions

- Whether plugin architecture should become a P1 epic after this sync.
- Whether timeline element should become a new element type in NavSlidesEditor.
