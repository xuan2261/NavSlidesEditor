---
phase: 7
title: "Verification And Docs"
status: pending
priority: P1
effort: "0.5-1d"
dependencies: [6]
---

# Phase 7: Verification And Docs

> **Red Team #15-part (Medium) — applied.** The `/api/ai/generate-slides` route (`server/routes/ai.js:168-209`) is the codebase's only correct, fully-escaped outline→HTML mapper. <!-- Updated: Validation Session 1 — route KEPT, not deleted -->**Validation Session 1 LOCKED: do NOT delete the route this round.** Grepping JS source proves no *in-repo* caller; it does NOT prove no external HTTP client hits the endpoint (the app is self-hostable). Phase 3 already PORTED its `escapeHtml` treatment into `buildSlidesFromOutline`, so stopping internal use loses nothing functional. Instead of deletion: confirm the builder escaping is in place, then annotate the route as **deprecated / caller-less in-repo**. Hard deletion is deferred to a future release after confirming no external traffic. Also propagate any Phase 1 renderability-spike stub downgrade (browser smoke becomes load-bearing, not optional).

## Overview

Whole-change verification gate: full unit + e2e + lint + build + browser smoke, plus docs sync (README vertical-slides note, `docs/` updates) and final cleanup (annotate the now-caller-less AI route as deprecated — NOT delete, per Validation Session 1). Confirms the refactor preserved behavior and the new vertical-slide feature works end-to-end.

## Requirements

- Functional: every prior phase's behavior holds together; no cross-phase regression.
- Non-functional: EditorPage materially smaller; docs reflect reality; CI-relevant suites green.

## Architecture

- Run the project's canonical verification order (README "Testing & Performance"): `npm run lint` → `npm run build` → `npm run test` → `npm run test:e2e` (golden editor paths).
- Browser smoke is mandatory for UI correctness (type-check ≠ feature-check): launch dev, exercise add/edit each element type, modals open/close, present-tab, vertical child edit.
- Docs sync per `docs/` management rules: changelog entry, codebase-summary EditorPage LOC + new hooks, README vertical-slides capability.

## Related Code Files

- Modify: `README.md` — note first-class vertical slides under Slides; verify element-type count still matches `ELEMENT_DEFAULTS` (unchanged this round).
- Modify: `docs/project-changelog.md` (or equivalent) — entries for VĐ1/VĐ2/VĐ3 + refactor.
- Modify: `docs/codebase-summary.md` — modal flags centralized in `ui-store` + `<EditorModals>`; EditorPage now composes `use-element-creation`/`use-export-actions`/`use-ai-actions`; new vertical addressing.
- Annotate (do NOT remove): `server/routes/ai.js` `/generate-slides` route — Phase 3 verified zero in-repo callers (inline fetch removed + dead `aiGenerateSlides` wrapper deleted) AND ported the route's `escapeHtml` into `buildSlidesFromOutline`. <!-- Updated: Validation Session 1 — route KEPT, not deleted -->**Validation Session 1 LOCKED: keep the route; do NOT delete this round.** Confirm the builder escaping is in place (nothing lost), re-grep to confirm zero in-repo callers, then add a deprecation/caller-less annotation on the route + its schema. Hard deletion deferred to a future release after confirming no external HTTP traffic (grep cannot prove no external caller; the app is self-hostable).
- Read for context: all files touched in Phases 1-6.

## Implementation Steps

1. `npm run lint` — fix any unused imports/vars left from extractions.
2. `npm run build` — must exit 0 (Vite client build).
3. `npm run test` — full unit suite incl. all new phase tests; 0 failures.
4. `npm run test:e2e` — editor golden paths (create deck, add elements, save, present). If a flow lacks coverage, note it; do not fake-pass.
5. Browser smoke (dev server): every element type adds+edits; all migrated modals open/close; AI Generator builds slides w/o network; vertical child create→edit→present.
6. Confirm Phase 3 ported the route's `escapeHtml` into `buildSlidesFromOutline` (escaping not lost). Grep `/api/ai/generate-slides`; if zero in-repo callers (expected after Phase 3), **annotate the route + schema as deprecated/caller-less in-repo — do NOT delete (Validation Session 1 LOCKED)**. The app is self-hostable so an external HTTP client may still call it; hard deletion is deferred to a future release after confirming no external traffic. Note the deprecation in the changelog (no breaking removal this round).
7. Docs sync: README + changelog + codebase-summary. Verify element-type count guard (`element-defaults.test.js`) still passes.
8. Measure final EditorPage LOC; record before/after in changelog (2071 → target ≤ ~1350).
9. Delegate a final pass to `code-reviewer` per workflow; address Critical/Important.

## Success Criteria

- [ ] `npm run lint` clean; `npm run build` exit 0.
- [ ] `npm run test` 0 failures (all phase suites GREEN together).
- [ ] `npm run test:e2e` editor paths pass (or gaps explicitly documented).
- [ ] Browser smoke passes for all element types, modals, AI generator, vertical slides.
- [ ] EditorPage reduced from 2071 LOC to ≤ ~1350; new hooks + `EditorModals` each < 200 LOC.
- [ ] Docs synced (README/changelog/codebase-summary); element-type count guard green.
- [ ] `code-reviewer` pass complete; no open Critical/Important.

## Risk Assessment

- **Risk:** Cross-phase interaction regression only visible in full suite. **Mitigation:** this phase is the integration gate; run everything together, not per-phase only.
- **Risk:** e2e flakiness masks real failures. **Mitigation:** follow repo e2e conventions (state-based waits, no `waitForTimeout`); re-run flaky specs, fix root cause.
- **Risk:** Browser smoke skipped under time pressure. **Mitigation:** mandatory per project rules — type/test green is not feature-proof; explicitly state if any UI path could not be exercised.
