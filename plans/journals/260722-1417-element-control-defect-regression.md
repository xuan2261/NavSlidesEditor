---
title: "Element control defect regression: completion with evidence gaps"
date: 2026-07-22 14:17 +07:00
status: completed
plan: ../archive/260704-0000-element-control-defect-regression-deep-tdd/plan.md
---

# Element Control Defect Regression: Completion with Evidence Gaps

## Context

The [deep-TDD plan](../archive/260704-0000-element-control-defect-regression-deep-tdd/plan.md) addressed six verified defects: print Markdown, stale table-cell selection, line-marker collisions, fixed-width ribbon alignment, QR races, and CDN-dependent previews. The root cause was fragmented behavior: separate renderers and controls quietly made incompatible assumptions about state, identity, slide size, and runtime availability.

## What happened

Red-team review correctly rejected superficial fixes. The accepted design required synchronous safe Markdown, stateful table tests, full-ID marker hashing, custom-width fallback, latest-request-wins QR state, local vendor assets, and script-breakout protection.

Commit `a13334f9` (2026-07-04) changed 29 files. It added a table-cell clamp in [table utilities](../../client/src/components/properties/table-properties-utils.js), full-ID FNV-1a marker tokens in [the line renderer](../../client/src/components/canvas/element-renderers/line-element-renderer.jsx), resolution-aware ribbon alignment, request-token QR handling, and local Chart/KaTeX/TikZJax paths plus `<\/script>` escaping in [shared renderers](../../shared/src/element-renderers.js). It also added [vendor-route checks](../../server/vendor-assets.test.js) and an [offline preview smoke](../../tests/e2e/element-preview-offline-runtime.spec.js).

## Impact

Historical implementation evidence records targeted Vitest passing **9 files / 38 tests**, one Playwright test passing, and `npm run test` passing **324 files / 2,747 tests** in **697.15s** with one skipped test. Lint had zero errors and 16 pre-existing warnings; build passed. At that commit, the reported fixes closed the six named contracts without a broad editor rewrite.

## Decisions

- Chose a local synchronous sanitizer over dynamic ESM Markdown parsing; shared rendering cannot await a browser runtime.
- Chose table-cell clamping over resetting selection; it preserves the nearest user context after deletion.
- Chose full-ID hashing over an eight-character prefix; same-prefix lines otherwise share SVG marker IDs.
- Chose local `/vendor` assets and request tokens over CDNs and unguarded promises; neither external availability nor stale async completion is a valid preview contract.

## Concerns / limitations

The painful truth is that the completion evidence does not meet its own red-test standard. [Implementation evidence](../archive/260704-0000-element-control-defect-regression-deep-tdd/reports/implementation-evidence.md) records only “Red test” and “Green intent,” not the required command, failing assertion, and setup-noise exclusion for D1–D6.

The claimed browser smoke is also weaker than advertised: its one Playwright test reads source/files and loads a stub `srcdoc` iframe. It does not open the editor or prove Chart, LaTeX, and TikZ execute against successful local `/vendor` responses. The July 4 Markdown helper recognizes headings, lists, links, and inline code, but contains no fenced-code or emphasis parser despite those phase claims. Later commits `08ab88f9` and `11f1c6be` changed overlapping shared/chart code, so these historic counts are not current validation.

## Next

Owner: repository maintainer. Before relying on this plan for a release claim, backfill real red/green command evidence, replace the stub smoke with a served-editor runtime test, and either implement fenced-code/emphasis parity or narrow the contract explicitly. Re-run focused renderer, vendor, and browser checks after any shared/chart change. AgentWiki publication was skipped because external sharing was not authorized.

## Unresolved questions

None.
