# Candidate Matrix

## Scope Rule

Selective port only. Do not merge `upstream/main` and do not cherry-pick broad ranges from unrelated history.

## High-Fit / Conditional Candidates

| Commit | Upstream title | Local fit | Expected local files | Strategy | Test gate | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| `93816b88` | add Copy URL to right-click context menu for image and video elements | Keep | `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.jsx`, maybe `client/src/components/SlideCanvas.jsx`, E2E context-menu coverage | Manual port | `element-lifecycle`, `element-interactions`, lint/build/unit | Small UI-local behavior. Local has a dedicated canvas context menu component, while upstream changed `SlideCanvas.jsx` directly. |
| `315eee97` | add font size control for LaTeX/TikZ elements | Manual Port / Conditional | `client/src/components/properties/*`, `client/src/components/canvas/element-renderers/latex-element-renderer.jsx`, `shared/src/htmlGenerator.js`, export tests | Verify then manual | targeted renderer/export tests | Useful if local LaTeX lacks element-level font size. Upstream file layout differs. |
| `6d971eb0` | add font color picker for LaTeX elements | Manual Port / Conditional | same LaTeX property/render/export surface | Verify then manual | targeted renderer/export tests | Useful only if local LaTeX lacks color control. Avoid toolbar rewrite. |
| `53173592` | fix editor vs present mode position mismatch: px margins | Verify First | `shared/src/htmlGenerator.js`, transition/generate HTML paths | Skip if already covered | `shared/tests/htmlGenerator.test.js`, export E2E | Local shared generator already uses fixed `font-size:calc(16px * var(--font-zoom, 1))` and px-like reset rules need inspection before changing. |
| `6c3ef006` | fix text spacing mismatch: section font-size 42px to 16px | Likely Already Present | `shared/src/htmlGenerator.js`, `client/src/components/TransitionPreview.jsx` | Skip unless gap found | `shared/tests/htmlGenerator.test.js`, export E2E | Local shared generator sections already use `font-size:calc(16px * var(--font-zoom, 1))`; `TransitionPreview.jsx` still has 42px but is preview-only. |
| `347d6ad8` | fix HTML embeds not showing in present mode: blob URLs | Verify First | `shared/src/element-renderers.js`, `shared/src/htmlGenerator.js`, `client/src/utils/generateHTML.js`, server export routes | Do not port directly | HTML generator/renderer tests + hardening/export E2E | Superseded upstream by data URL commit; local trusted HTML model uses `srcdoc`, verify real defect first. |
| `cde1b2e9` | fix HTML embeds in present mode: data URLs | Verify First | same HTML embed render/export surface | Minimal fix only if defect reproduced | HTML generator/renderer tests + hardening/export E2E | Better than blob if needed, but local structure differs and security model intentionally trusts author HTML. |

## Deferred / Rejected Domains

| Commit(s) | Upstream title/domain | Decision | Reason |
| --- | --- | --- | --- |
| `9d3288ea`, `778a7646`, `fe5deaae`, `56067fde`, `2e280692` | Timeline element series | Defer | Local `AnimationTimeline.jsx` is fragment sequencing UI, not a content timeline element. Porting would be new feature/schema work. |
| `856d206b`, `0e7196b6`, `515b607c`, `b69202d8` | Image citation/crop citation series | Defer | Local schema/UI does not expose citation metadata as a first-class image property. Needs separate product plan. |
| Docs/VitePress commits | Upstream docs site | Reject | Local README/docs structure differs; not part of sync hygiene. |
| SaaS/billing/Clerk/Stripe commits | Cloud commercial flow | Reject | Product mismatch with local self-hosted/no-account README positioning. |
| Plugin API commits | Plugin infrastructure | Reject for this plan | Too broad; separate architecture plan needed if wanted. |
| Landing page/demo commits | Marketing surface | Reject | Not related to selective upstream fixes. |

## Local Landing Zone Notes

- Right-click context menu exists at `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.jsx`.
- `SlideCanvas.jsx` imports and wires that menu.
- Font family/size extensions already exist at `client/src/extensions/FontFamily.js` and `client/src/extensions/FontSize.js`.
- Shared HTML generator already sets reveal sections to `font-size:calc(16px * var(--font-zoom, 1))`.
- Trusted HTML embed renderer tests currently expect `srcdoc` behavior.

## Phase 05 Decision - 2026-05-14

- Ported no typography code in this batch.
- `53173592` / `6c3ef006`: skip. Local shared reveal/print generator already uses 16px section baseline. Targeted tests passed.
- `315eee97` / `6d971eb0`: defer. LaTeX font size/color controls require coordinated UI, editor iframe, shared HTML generator, and PPTX raster behavior. That is feature expansion, not selective sync hygiene.
- Verification passed:
  - `npm run test -- client/src/utils/export-pptx-text-runs.test.js shared/tests/htmlGenerator.test.js shared/tests/element-renderers.test.js server/services/pptx-import/property-mapping.test.js`
  - `npm run test:e2e -- tests/e2e/element-properties.spec.js tests/e2e/toolbar-elements.spec.js tests/e2e/export.spec.js`

## Phase 06 Decision - 2026-05-14

- Ported no HTML embed code in this batch.
- `347d6ad8` / `cde1b2e9`: skip. Local shared renderer intentionally uses `srcdoc` for present mode and `data-pdf-iframe` + Blob initialization for print/PDF. Current hardening E2E proves trusted HTML scripts run in editor, present, share, and export outputs.
- Verification passed:
  - `npm run test -- shared/tests/htmlGenerator.test.js shared/tests/element-renderers.test.js client/src/utils/offlineExport.test.js`
  - `npm run test:e2e -- tests/e2e/hardening-regression.spec.js tests/e2e/export.spec.js`

## Unresolved Questions

- Whether LaTeX font size/color controls are product requirements for this sync or should become separate UX work.
