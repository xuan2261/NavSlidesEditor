---
title: "Red-Team Review - Frontend UI Hygiene UX Consistency"
status: completed
created: 2026-07-05
updated: 2026-07-05
scope: "plans/260705-0000-frontend-ui-hygiene-ux-consistency-deep-tdd"
---

# Red-Team Review

## Summary

The plan is valid if it stays narrow. The main failure mode is over-scoping into a broad ribbon/editor redesign, broad static audits, or a notification framework rewrite. The plan must keep fixes tied to confirmed evidence and must not hide advanced Insert actions.

## High-Risk Areas

| Risk | Severity | Required mitigation |
|---|---:|---|
| Broad `Button.jsx` size changes can break UI across the app | High | Add opt-in density/size variants; test main call sites |
| Reworking `HomePage.jsx` can conflict with external edits | High | Re-read latest file before edits; refactor one card family at a time |
| Native-dialog replacement can alter async flows | Medium | Preserve callbacks and add flow tests for import/export/delete/share |
| Ribbon overflow can accidentally hide differentiator features | High | Test advanced action accessibility by role/name at constrained widths |
| Static audits can become noisy | Medium | Use small allowlists and exclude tests/fixtures/templates where appropriate |
| Visual baseline updates can mask regressions | Medium | Prefer DOM/a11y/bounding-box assertions before screenshot updates |
| Static audits can false-positive on tests, templates, export fixtures, and trusted author content | High | Restrict scans to production UI chrome files, use parser/token boundaries, and keep small reasoned allowlists |
| Full E2E treated as optional can mask regressions | Medium | Make `npm run test:e2e` mandatory unless an objective blocker is reported and user approves skipping |
| Dialog replacement can miss inert/background isolation | High | Require `aria-modal`, focus trap, focus restore, background non-interaction, and destructive action labels |
| Hit-target policy is currently under-defined | High | Define compact vs comfortable/touch thresholds before implementation |

## Binding Scope Corrections

- Do not hide `Kinetic Text`, `Math Grid`, `Anime.js`, `Three.js`, or `Timeline` by default.
- Do not implement Backstage/File view, new Designer pane, new slide sorter, or brand overhaul in this plan.
- Do not refactor `EditorPage.jsx` broadly unless a phase-specific test requires a small integration change.
- Do not update docs unless the implemented behavior changes a documented user-visible contract.
- Do not create a persisted density setting unless tests prove CSS/touch-media scoped sizing cannot satisfy the requirement.
- Do not scan slide templates, export HTML fixtures, security fixtures, or tests for app-chrome hard-coded color/dialog rules.

## Required Acceptance Additions

- Advanced Insert actions must be reachable at all tested widths, inline when space allows and through an accessible overflow path when constrained.
- Dashboard card tests must prove action buttons do not open presentations accidentally.
- Dialog tests must prove Escape/cancel/confirm behavior and focus restore.
- Hit-target tests must distinguish compact desktop exceptions from comfortable/touch expectations.
- Final gate must include `npm run lint`, `npm run test`, `npm run build`, and `npm run test:e2e` unless an objective infrastructure/time blocker is reported and explicitly approved.
- Keyboard-only tests must cover ribbon overflow/dropdown/popover open, close with Escape, focus return, and no keyboard trap.
- Phase 5 must either include `LiveViewPage.jsx` in tokenized presentation shells or explicitly allowlist it with a reason.
- Phase 1 fail-first notes must record the failing assertion, mapped finding ID, and why the failure is not setup/mock noise.

## Detailed Findings

| Severity | Phase | Finding | Required amendment |
|---|---|---|---|
| High | 1, 5 | Static audits are too broad and can catch valid `alert(1)` security fixtures, slide template colors, export renderer literals, comments, or tests. | Scope audits to production UI chrome files, exclude tests/templates/export fixtures, prefer AST/token scanning, and require reasoned allowlist comments. |
| High | 3 | Feedback API is unspecified for hooks such as `use-export-actions.js` and `use-ai-actions.js`. | Define a minimal adapter/provider contract before migration; hooks should receive callbacks/adapters instead of importing UI directly where provider access is unclear. |
| High | 6 | Comfortable/touch mode lacks numeric thresholds and trigger policy. | Define compact exceptions, touch breakpoint or `(pointer: coarse)` policy, and target sizes before code changes. |
| High | 7 | Ribbon overflow could become a redesign. Current Insert tab already has `More advanced insert options` for games/plugins. | Reuse existing scroll/dropdown patterns first; only fix constrained-width reachability. |
| Medium | 4 | Dashboard refactor can accidentally preserve `stopPropagation` as the real boundary. | Tests must assert action buttons do not call the open handler and tab order is sane. |
| Medium | 5 | Presentation shell tokenization omits `LiveViewPage.jsx`, which also has hard-coded white borders. | Include it or explicitly allowlist out of scope. |
| Medium | 8 | Scoped Playwright cannot silently replace full E2E in final gate. | Final gate cannot pass if full E2E is skipped without blocker + user approval. |

## Amendment Status

Applied to `plan.md` and phase files:
- scoped static-audit rules,
- dialog accessibility and feedback API contract,
- dashboard keyboard/action separation,
- `LiveViewPage.jsx` tokenization scope,
- compact vs comfortable/touch hit-target policy,
- ribbon overflow keyboard/focus requirements,
- mandatory final `npm run test:e2e` handling.

## Red-Team Verdict

Go with constraints. The binding amendments have been reflected in the phase files. Implementation should still proceed phase-by-phase with fail-first evidence and no broad redesign.

## Unresolved Questions

None.
