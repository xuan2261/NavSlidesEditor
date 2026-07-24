---
title: "Element Control Defect Regression Deep TDD Plan"
description: "Test-first repair plan for six confirmed element/control defects from brainstorm and ck-debug verification."
status: completed
priority: P0
effort: "3-5 dev-days"
branch: master
tags: [tdd, frontend, elements, controls, export, offline, regression]
blockedBy: []
blocks: []
created: 2026-07-04
createdBy: ck-plan-skill
mode: "--deep --tdd"
redTeamReviewed: 2026-07-04
validated: 2026-07-04
---

# Element Control Defect Regression Deep TDD Plan

## Overview

Fix the six confirmed element/control defects found during brainstorming and ck-debug verification. This is a narrow, regression-safe plan: write failing tests for each confirmed defect first, fix at the smallest source of truth, then run targeted and full validators.

## Source Context

| Source | Use |
|---|---|
| Current brainstorm report | Initial defect inventory across elements, controls, and operations |
| Current ck-debug verification | Confirms all six suspected defects are real by code inspection |
| `red-team-review.md` | Binding red-team amendments from security, architecture, and QA/TDD review |
| `validation-report.md` | Binding validation decisions and go/no-go result |
| `README.md` | Canonical feature and element list context |
| `client/src/data/element-defaults.js` | Canonical 19 element types |
| `shared/src/element-renderers.js` | Reveal/export renderer behavior |
| `client/src/components/properties/table-properties.jsx` | Table property controls and selected-cell state |
| `client/src/components/canvas/element-renderers/line-element-renderer.jsx` | Canvas line marker IDs |
| `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx` | Format ribbon geometry controls |
| `client/src/components/canvas/element-renderers/qrcode-element-renderer.jsx` | QR canvas preview state |
| `client/src/components/canvas/element-renderers/chart-element-renderer.jsx` | Chart preview iframe runtime |
| `client/src/components/canvas/element-renderers/latex-element-renderer.jsx` | LaTeX/TikZ preview iframe runtime |

## Confirmed Defect Backlog

| ID | Defect | Severity | Current evidence |
|---|---|---:|---|
| D1 | Markdown print/PDF path outputs escaped raw Markdown instead of rendered HTML | P1 | `shared/src/element-renderers.js`, `renderMarkdown()` `opts.forPrint` branch |
| D2 | Table properties can crash after deleting the selected row/column | P0 | `table-properties.jsx`, stale `selectedCell` not clamped |
| D3 | Canvas line arrow markers can collide for IDs with same 8-char prefix | P1 | `line-element-renderer.jsx`, `element.id?.slice(0, 8)` |
| D4 | Format ribbon Align Center/Right uses fixed `CANVAS_WIDTH` and ignores custom slide resolution | P1 | `ribbon-format-tab-element-position-size-rotation-controls.jsx` |
| D5 | QR preview keeps stale image after `QRCode.toDataURL()` rejects | P2 | `qrcode-element-renderer.jsx`, `.catch(console.error)` only |
| D6 | Chart and LaTeX/TikZ canvas previews depend on external CDN URLs, breaking offline/self-host preview | P1 | chart and latex canvas renderers use jsDelivr/TikZJax URLs |

## Scope

In scope:
- Test-first repros for D1-D6.
- Minimal source fixes only in the confirmed files and directly related tests.
- Vendor/local asset parity for editor preview where existing `/vendor` assets already exist.
- Final validation with targeted tests, full unit tests, lint, and build.

Out of scope:
- New element types, new authoring controls, or broad EditorPage refactors.
- Full offline rewrite of trusted user HTML embeds, animation templates, transition preview, or D3 defaults.
- PPTX export redesign. Only verify no regression where touched renderers feed export paths.
- Documentation updates unless a changed user-facing contract requires it.

## Phase Roadmap

| # | Phase | Defects | Priority | Status |
|---|---|---|---|---|
| 1 | [Regression Harness and Baseline](phase-01-regression-harness-and-baseline.md) | D1-D6 | P0 | completed |
| 2 | [Markdown Print Renderer Parity](phase-02-markdown-print-renderer-parity.md) | D1 | P1 | completed |
| 3 | [Table Selected Cell Bounds Safety](phase-03-table-selected-cell-bounds-safety.md) | D2 | P0 | completed |
| 4 | [Line Marker Identity Parity](phase-04-line-marker-identity-parity.md) | D3 | P1 | completed |
| 5 | [Resolution-Aware Ribbon Alignment](phase-05-resolution-aware-ribbon-alignment.md) | D4 | P1 | completed |
| 6 | [Preview Error and Offline Runtime Parity](phase-06-preview-error-and-offline-runtime-parity.md) | D5, D6 | P1 | completed |
| 7 | [Final Verification and Release Gate](phase-07-final-verification-and-release-gate.md) | D1-D6 | P0 | completed |

## Execution Order

1. Phase 01 creates common harness patterns and, where useful, repro tests with red evidence. Each implementation phase still owns its defect-specific red evidence immediately before fixing.
2. Phase 02 fixes shared Markdown print rendering.
3. Phase 03 fixes table selected-cell bounds.
4. Phase 04 aligns canvas line marker identity with shared export hashing.
5. Phase 05 threads slide width/resolution into Format ribbon alignment.
6. Phase 06 fixes QR error state and swaps chart/latex preview runtime URLs to local vendor paths.
7. Phase 07 runs the full command matrix and performs a consistency sweep.

## Architecture Direction

- Fix at source of truth, not symptoms.
- Keep helpers pure and small where possible, especially marker ID generation and table cell clamping.
- Preserve trusted-author HTML behavior. This plan is about editor preview runtime availability, not new sandbox policy.
- Prefer existing vendor assets under `/vendor` because export/rendering already uses them.
- Keep Format ribbon API backward-compatible; pass optional `resolution` or `slideWidth` from the editor shell, defaulting to `CANVAS_WIDTH`.
- Keep shared renderers synchronous. Do not introduce dynamic async parser imports into `shared/src/element-renderers.js`.
- Treat generated `srcDoc` as an HTML/script boundary: user data embedded inside scripts must be escaped so `</script>` payloads cannot break out.

## TDD Strategy

1. Add or extend tests before each code change:
   - `shared/tests/markdown-reveal-textcolor-fontsize.test.js` or a focused shared renderer test for D1.
   - `client/src/components/properties/table-properties.test.jsx` for D2.
   - `client/src/components/canvas/element-renderers/line-element-renderer.test.jsx` for D3.
   - `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.test.jsx` for D4.
   - New or existing QR renderer component test for D5.
   - Chart/LaTeX renderer tests for D6.
2. Run targeted tests and confirm they fail for the expected reason. Record the command, failing assertion, defect mapping, and why the failure is not setup noise.
3. Implement minimal fixes.
4. Rerun targeted tests until green.
5. Run final validators in Phase 07.

## Required Command Matrix

| Gate | Command |
|---|---|
| Shared renderer targeted | `npx vitest run shared/tests/markdown-reveal-textcolor-fontsize.test.js` |
| Table targeted | `npx vitest run client/src/components/properties/table-properties.test.jsx` |
| Ribbon targeted | `npx vitest run client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.test.jsx` |
| Canvas renderer targeted | `npx vitest run client/src/components/canvas/element-renderers` |
| Vendor route/assets targeted | `npx vitest run server/vendor-assets.test.js` or equivalent server route test for `/vendor/chart.js/dist/chart.umd.js`, `/vendor/katex/dist/katex.min.css`, `/vendor/katex/dist/katex.min.js`, `/vendor/tikzjax/fonts.css`, `/vendor/tikzjax/tikzjax.js` |
| Browser/offline runtime smoke | `npx playwright test tests/e2e/element-preview-offline-runtime.spec.js` |
| Unit suite | `npm run test` |
| Lint | `npm run lint` |
| Build | `npm run build` |

## Red-Team Checklist

- [ ] Tests fail for the old bug, not because selectors or mocks are wrong.
- [ ] Markdown fix preserves trusted-author escaping and does not introduce raw HTML injection beyond existing Markdown policy.
- [ ] Markdown print tests include unsafe link, raw script, and event-handler payloads.
- [ ] Table fix handles both row and column deletion, including repeated deletion to 1x1.
- [ ] Table tests use a stateful harness that applies `onUpdate` back into props.
- [ ] Line marker fix hashes or sanitizes full element id input and does not break marker URL syntax.
- [ ] Ribbon align remains backward-compatible when no custom resolution is supplied.
- [ ] QR error UI does not silently show stale content.
- [ ] QR async handling is latest-request-wins for out-of-order resolves/rejects.
- [ ] Vendor URL changes work in dev and production behind the existing `/vendor` route.
- [ ] Chart/LaTeX/TikZ `srcDoc` escapes user data that can contain `</script>`.
- [ ] No unrelated CDN/embed defaults are pulled into scope.

## Red-Team Amendments

Red-team review completed on 2026-07-04. All findings in `red-team-review.md` are accepted and binding:

1. **Fail-first evidence must be explicit.** Each defect phase records command, failing assertion, expected old-bug reason, and confirmation that selector/mock/import setup is not the cause.
2. **TDD is per defect phase.** Phase 01 may create common harnesses, but each implementation phase must add or run its defect's red test immediately before the fix. Avoid one broad permanent red state that is hard to bisect.
3. **Markdown print must be safe and synchronous.** Do not use dynamic ESM imports inside sync shared rendering. Add negative tests for unsafe links, raw scripts, and event handlers.
4. **Generated `srcDoc` must be script-breakout safe.** Chart labels/dataset labels and LaTeX/TikZ content must not allow `</script>` injection.
5. **D6 runtime verification is mandatory.** Exact vendor paths, file/route availability, iframe sandbox, and no external host requests are required.
6. **QR state must be latest-request-wins.** Out-of-order QR promise resolution or rejection must not restore stale images/errors.
7. **Line marker IDs must be DOM-safe.** Use hash/sanitized tokens and test hostile IDs in the same DOM document.
8. **D2 tests must be stateful.** Apply `onUpdate` to the rendered `element` prop before asserting stale selected-cell behavior is fixed.
9. **Helper placement is explicit.** Table clamp helper belongs in `table-properties-utils.js`; line marker helper should be shared only through a clean small helper, otherwise local deterministic hash with parity tests.
10. **Final gate must include route/runtime checks.** Browser/offline runtime smoke for D6 is not optional unless blocked with exact evidence.

## Validation Questions

| Question | Decision |
|---|---|
| Should raw Markdown in print be allowed as an accepted limitation? | No. Canvas/export normal path renders Markdown, so print/PDF should be consistent. |
| Should table selected cell be reset or clamped? | Clamp to nearest existing cell to preserve user context and avoid surprise. |
| Should canvas line renderer duplicate shared hash logic or import it? | Prefer sharing/exporting a small hash/marker helper if dependency direction stays clean; otherwise copy the same deterministic algorithm with tests. |
| Should ribbon alignment use full `presentation.resolution` or only width? | Use width for horizontal controls now; keep API extensible for vertical align later. |
| Should QR show blank or error state after reject? | Show a clear fallback/error placeholder and clear stale `dataUrl`. |
| Should CDN fix include all hardcoded CDN URLs in repo? | No. Limit this plan to Chart and LaTeX/TikZ element previews confirmed by debug. |
| Should Phase 01 commit all red tests at once? | No. Prefer common harness plus per-phase red evidence to keep bisection clean. |

## Validation Amendments

Validation completed on 2026-07-04. All findings in `validation-report.md` are accepted and binding:

1. **Fail-first evidence location is fixed.** Record per-defect red/green evidence in `reports/implementation-evidence.md` under this plan directory.
2. **D6 browser/offline smoke is concrete.** Add and run `npx playwright test tests/e2e/element-preview-offline-runtime.spec.js`.
3. **Vendor route verification is concrete.** Add and run `npx vitest run server/vendor-assets.test.js` or an equivalent server route test proving the five required `/vendor` paths return 200.
4. **Markdown parser strategy has a decision gate.** Phase 02 must prove the selected synchronous CommonJS-compatible parser/helper before implementing the print renderer fix.
5. **Phase 05 mixed-value coverage is required.** Add a test/check proving custom-resolution alignment does not regress multi-select mixed-value display.
6. **Phase 06 LaTeX script-breakout coverage is required.** Add explicit LaTeX content negative test in addition to Chart and TikZ payloads.

## Global Success Criteria

- [ ] D1-D6 each have at least one regression test.
- [ ] No regression test uses `.skip`, `.only`, or permanent `.fails`.
- [ ] Markdown print output renders headings/lists/links/code as HTML, not raw Markdown text.
- [ ] Table row/column deletion cannot crash selected-cell style controls.
- [ ] Canvas line marker IDs are unique for same-prefix element IDs.
- [ ] Format ribbon center/right align use custom slide width when provided.
- [ ] QR preview clears stale output and exposes an error/fallback state on generation failure.
- [ ] QR preview ignores stale out-of-order promise results.
- [ ] Chart and LaTeX/TikZ preview HTML uses local `/vendor` runtimes, not external CDN URLs.
- [ ] Chart and LaTeX/TikZ preview runtime paths are served locally and browser smoke records no requests to `cdn.jsdelivr.net` or `tikzjax.com`.
- [ ] Markdown and preview `srcDoc` tests include script-breakout/content-safety negative payloads.
- [ ] Per-defect red/green evidence is recorded in `reports/implementation-evidence.md`.
- [ ] Required command matrix passes or any unavailable command is documented with exact blocker.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Markdown parser output differs between client and shared | Medium | Use the same existing shared/export Markdown dependency/pattern as normal renderer branch |
| Table selected-cell clamping causes controlled input churn | Low | Clamp only when data dimensions change or before applying style updates |
| Hash helper location introduces client/shared import cycle | Medium | Use a tiny duplicate helper with parity tests if sharing is risky |
| Resolution prop threading touches too many components | Medium | Prefer existing forwarded presentation props; add optional prop and touch `EditorPage.jsx` only if tests prove it is required |
| Local vendor path unavailable in dev tests | Medium | Assert generated srcDoc string; final build/start validation catches route issues |
| QR error placeholder changes snapshots | Low | Keep simple, accessible text and targeted assertions |

## Unresolved Questions

None.

## Cook Handoff

After review:

```bash
/ck:cook C:/Work/NavSlidesEditor/plans/260704-0000-element-control-defect-regression-deep-tdd/plan.md
```
