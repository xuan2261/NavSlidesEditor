---
title: "Smoke Test Bug Fixes TDD"
description: "Fix all 5 issues (I-001..I-005) discovered in the 2026-05-23 manual smoke test using a tests-first TDD workflow. Each phase: RED failing test → GREEN minimal fix → REFACTOR + regression guard."
status: completed
priority: P0
effort: "2-3 days single dev"
branch: master
tags: [bugfix, tdd, regression, storage, validation, ui, smoke-test]
created: 2026-05-23
createdBy: ck-plan-skill
source: skill
mode: "--deep --tdd"
blockedBy: []
blocks: [260523-0500-upstream-parity-verification-tdd]
---

# Smoke Test Bug Fixes TDD

## Overview

Goal: close every defect found by the 2026-05-23 manual smoke test before progressing further on upstream parity verification. Drive each fix RED → GREEN → REFACTOR with deterministic regression tests so the same bug cannot recur silently.

Five issues identified, two of them release-blocking:

| Issue | Severity | Title | Root cause area | Owner phase |
|---|---|---|---|---|
| I-002 | Medium | Legacy fixtures fail Zod x/y/w/h validation on save | `server/middleware/schemas.js` elementSchema | Phase 2 |
| I-005 | Medium | `presentations.json` reset between sessions | `server/services/storage.js` non-atomic writes | Phase 3 |
| I-001 | Low | Trash sidebar entry intermittent visibility | `client/src/pages/HomePage.jsx` sidebar layout | Phase 4 |
| I-003 | Low | Ctrl+K command palette did not respond | `client/src/utils/default-keyboard-shortcut-definitions-registry.js` scope | Phase 5 |
| I-004 | Low | Footer version mismatch v1.6.1 vs v1.9.4 | `client/src/components/layout/StatusBar.jsx` hardcoded literal | Phase 6 |

## Context

| Source | Use |
|---|---|
| `plans/260523-0500-upstream-parity-verification-tdd/reports/smoke-test-findings.md` | Authoritative issue list, repro steps, and inspect file pointers (5 issues, 16 deferred tests, 5 unresolved questions) |
| `README.md` | Current release v1.9.4; feature inventory used to scope regression sweep in Phase 7 |
| `server/middleware/schemas.js:33-43` | I-002 root cause — `elementSchema` requires x/y/width/height with no defaults |
| `server/services/storage.js:73-84` | I-005 root cause — `fs.writeJson` calls are not atomic (no temp-fsync-rename) |
| `client/src/components/layout/StatusBar.jsx:60` | I-004 root cause — hardcoded `v1.6.1` literal |
| `client/src/pages/HomePage.jsx:856-870` | I-001 inspection point — Trash render block in sidebar |
| `client/src/utils/default-keyboard-shortcut-definitions-registry.js:52` | I-003 inspection point — `commandPalette` shortcut bound only to `scopes: ['editor']` |
| `client/src/pages/EditorPage.jsx:1185` | I-003 — `onCommandPalette` wiring works; scope check is the suspect |
| `package.json` | Source of truth for app version (v1.9.4) |

## Phases

| # | Phase | Status | Priority | File |
|---|---|---|---|---|
| 1 | Test Harness & Failing Tests | pending | P0 | [phase-01-test-harness-and-failing-tests.md](./phase-01-test-harness-and-failing-tests.md) |
| 2 | Fix I-002 Zod Backwards-Compat | pending | P0 | [phase-02-fix-i-002-zod-backwards-compat.md](./phase-02-fix-i-002-zod-backwards-compat.md) |
| 3 | Fix I-005 Atomic Storage Writes | pending | P0 | [phase-03-fix-i-005-atomic-storage-writes.md](./phase-03-fix-i-005-atomic-storage-writes.md) |
| 4 | Fix I-001 Trash Sidebar Visibility | pending | P1 | [phase-04-fix-i-001-trash-sidebar-visibility.md](./phase-04-fix-i-001-trash-sidebar-visibility.md) |
| 5 | Verify I-003 Ctrl+K Command Palette | pending | P2 | [phase-05-verify-i-003-ctrl-k-command-palette.md](./phase-05-verify-i-003-ctrl-k-command-palette.md) |
| 6 | Fix I-004 Footer Version Source | pending | P1 | [phase-06-fix-i-004-footer-version-source.md](./phase-06-fix-i-004-footer-version-source.md) |
| 7 | Regression Sweep & Docs Update | pending | P0 | [phase-07-regression-sweep-and-docs-update.md](./phase-07-regression-sweep-and-docs-update.md) |

## Dependency Graph

```text
Phase 1 (tests) -> Phase 2 (I-002)
                -> Phase 3 (I-005)
                -> Phase 4 (I-001)
                -> Phase 5 (I-003)
                -> Phase 6 (I-004)

Phase 2, 3, 4, 5, 6 -> Phase 7 (regression sweep + docs)
```

Phase 1 lands all failing tests first (RED). Phases 2–6 are independent and can run in parallel by file ownership (each touches a distinct file). Phase 7 runs only after all five fixes turn the suite GREEN.

## Parallel Opportunities (post Phase 1)

| Lane | Files owned | Phases |
|---|---|---|
| Backend lane | `server/middleware/schemas.js`, `server/services/storage.js`, `server/services/storage.test.js`, `server/routes/presentations.test.js` | Phase 2, Phase 3 |
| Frontend lane | `client/src/pages/HomePage.jsx`, `client/src/utils/default-keyboard-shortcut-definitions-registry.js`, `client/src/components/layout/StatusBar.jsx`, `client/vite.config.js` | Phase 4, Phase 5, Phase 6 |
| Test lane (Phase 1 only) | `tests/e2e/regression-smoke-fixes.spec.js`, `server/services/storage.test.js` (new), client test files | Phase 1 |

## Success Criteria

- All 5 RED tests authored in Phase 1 turn GREEN by Phase 7.
- `npm run test` (Vitest) passes with no skipped tests for the new regression files.
- `npm run test:e2e -- --grep regression-smoke` (Playwright) passes for the new spec.
- `npm run lint` and `npm run build` pass.
- Legacy fixture deck (elements without x/y/w/h) loads, edits, and saves without 400.
- Killing server process mid-save no longer truncates `presentations.json`. Verified by atomicity test.
- Footer displays `v1.9.4` matching `package.json` (or whatever the live version is at release time).
- Trash sidebar entry is always reachable and visible on the dashboard.
- Ctrl+K command palette opens reliably in editor with a real keyboard event; OR documented + closed as agent-browser limitation with proof.
- `plans/260523-0500-upstream-parity-verification-tdd/plan.md` frontmatter updated with reciprocal `blockedBy` of this plan.
- 5 unresolved questions from smoke-test-findings.md resolved or escalated.
- CHANGELOG / project-changelog reflects all fixes.

## Out of Scope

- Deferred behavioral tests from smoke report (Socket.IO live broadcast, PDF/PPTX export, game player journey) — owned by parity plan Phase 5.
- README element-count reconciliation (Q4) — informational only, parked unless trivial.
- New features beyond the 5 issues — strict YAGNI on this plan.
- Real AI provider integration tests — mock-only per parity policy.

## Risks

| Risk | Mitigation |
|---|---|
| Adding `.default()` to elementSchema masks frontend bugs that should send full geometry | Add Phase 2 contract test ensuring normalized output and a server log when defaults are applied (debug-level, no spam) |
| Atomic write rename fails on Windows when target is open by node --watch | Test on Windows path; fall back to `fs.rename` retry loop with bounded attempts |
| Trash visibility is environment-specific (viewport-dependent) | Use deterministic viewport in Playwright; pin sidebar overflow CSS |
| Ctrl+K issue is agent-browser key dispatch, not a real bug | Phase 5 first runs a real-browser repro before code changes; close as infra issue with proof if so |
| Footer wired to build-time `__APP_VERSION__` breaks dev mode | Add fallback `'dev'` value and confirm both `npm run dev` and `npm run build` paths |

## Recommended Cook Command

```powershell
/ck:cook --tdd C:\Work\NavSlidesEditor\plans\260523-0900-smoke-test-bug-fixes-tdd\plan.md
```

## Unresolved Questions (carry from smoke report)

- **Q1 (I-002 fix shape):** schema defaults vs load-time migration vs storage-write normalizer? **Decision in Phase 2:** schema defaults `.default(0)` for x/y and `.default(100)` for w/h (least invasive, validated for all entry paths including PUT, POST, duplicate, import).
- **Q2 (I-005 root cause):** node --watch race vs agent-browser race? **Decision in Phase 3:** treat as non-atomic write regardless; atomic writes solve both.
- **Q3 (I-003 root cause):** real shortcut binding bug vs agent-browser focus? **Decision in Phase 5:** real-browser repro first.
- **Q4 (element count claims):** README says 20, ribbon shows 27+. Out of scope; will park in Phase 7 as docs follow-up.
- **Q5 (I-004 version source):** build-time `__APP_VERSION__` injection from `package.json` via Vite `define`.

## Red Team Review

### Session 2 — 2026-05-23 (post-draft review of all 7 phases)

**Findings:** 9 (9 accepted, 0 rejected)
**Severity breakdown:** 2 Critical, 3 High, 3 Medium, 1 Low

| # | Finding | Severity | Disposition | Applied To |
|---|---|---|---|---|
| 1 | I-005 test used CJS `require.cache` / `require.resolve` — silent no-ops in Vitest ESM | Critical | Accept | Phase 1.2 (rewritten with `vi.resetModules()` + dynamic `import()` cache-bust) |
| 2 | I-005 test set `SLIDES_DATA_DIR` after the module's `DATA_DIR` had already resolved — risked corrupting dev data | Critical | Accept | Phase 1.2 (dynamic import inside `beforeEach` AFTER env var is set) |
| 3 | Windows rename retry mentioned in Risk table but absent from code | High | Accept | Phase 3.1 (`renameWithRetry` with bounded backoff for EPERM/EBUSY/EACCES/EEXIST) |
| 4 | Inline I-002 fixture is brittle; original bug came from a real file | High | Accept | Phase 1.1 (added `__fixtures__/legacy-deck-no-geometry.json` + second test case) |
| 5 | Phase 5 Option A widened `scopes: ['editor', 'canvas']` — causally unrelated to the bug; reverses a documented YAGNI NOTE in the registry | High | Accept | Phase 5.3 (options rewritten to focus on TipTap focus interception / `preventDefault` / infra-noise closure; scope widening forbidden) |
| 6 | Phase 4 `mt-auto` could push Trash off-screen with verbose warnings | Medium | Accept | Phase 4.1 (`position: sticky bottom-0` on Trash only; warnings flow normally below) |
| 7 | Startup `.tmp` sweep used `readdirSync`/`removeSync` — blocks event loop on slow disks | Medium | Accept | Phase 3.5 (`setImmediate` + async `readdir`/`Promise.all(remove)`) |
| 8 | `assert { type: 'json' }` deprecated in Node 22 / experimental in Node 18 — fragile across Node versions | Medium | Accept | Phase 6.1 (`createRequire` promoted to primary; works on Node 18/20/22/24) |
| 9 | I-002 test asserted only on response status — would pass if defaults silently dropped elements | Medium | Accept | Phase 1.1 (added saved-record assertion on `x/y/width/height` for every legacy element + round-trip via PUT) |

All Red Team adjustments applied inline to phase files as `## Red Team Adjustment` sections.

### Session 1 — 2026-05-23 (planning placeholder, superseded)

The Session 1 placeholder noted pre-emptive considerations on the original drafts. Session 2 is authoritative; Session 1 retained for audit trail.

## Validation Log

### Session 2 — 2026-05-23 (post-draft validation interview)

**Trigger:** `/ck:plan validate` after Session 1 draft + Red Team Session 2.
**Questions surfaced:** 10. Distribution: Approach 3, Risk 3, Scope 2, Release 1, Architecture 1.

| # | Category | Question | Decision | Rationale |
|---|---|---|---|---|
| Q1 | Approach | How to handle `require()` not working in Vitest ESM for storage test isolation? | Use `vi.resetModules()` + dynamic `import()` with cache-busting query string | CJS `require.cache` is silently no-op in Vitest ESM. Dynamic `import()` after env var is set produces a fresh module bound to the per-test `SLIDES_DATA_DIR` |
| Q2 | Risk | The 11-call-sites table in Phase 3 was never verified against current source | Mandate a grep verification pass at Step 3.2 before editing; treat the table as expected-but-confirm | Trust-but-verify. Drift between scout-time and edit-time is the typical bug source |
| Q3 | Risk | I-003 registry has an inline NOTE explicitly choosing editor-only as a YAGNI decision. Should Phase 5 reverse that? | No. Investigate TipTap `isEditing` / `document.activeElement` focus interception instead | Reversing a documented YAGNI without evidence is regression. Comparator shortcuts (Ctrl+F is canvas-scope, Ctrl+M is editor-scope) work; scope is not the bug |
| Q4 | Risk | What if `position: sticky` doesn't work in `<nav>` (e.g. parent isn't a scroll container)? | Step 4.2 verifies parent has `overflow-y-auto`; sticky requires it. Already present per scout. If absent, add it | Sticky only works when parent has overflow. Phase 4.2 makes this an explicit verification step |
| Q5 | Scope | What if all 5 fixes can't fit in 2-3 days due to Phase 5 investigation overrun? | Phase 7 explicit skip-on-overrun: if Phase 5 is still investigating after 1 day, close I-003 as deferred + escalate, ship the other 4 fixes | I-001/I-003/I-004 are P1/P2 — non-blocking. Don't gate release on a non-blocker |
| Q6 | Approach | What's the right Vitest ESM module-reset pattern long-term? | `vi.resetModules()` + dynamic `import()` with cache-bust query string (per Phase 1.2 rewrite) | Vitest's `resetModules` clears its internal module graph but not the V8 module cache for fully-resolved URLs. Query-string cache-bust is the canonical workaround |
| Q7 | Release | Does Phase 7 require both `npm run lint` AND `npm run build` to pass? | Yes, both block. Test pass alone is insufficient | Build catches type-level / import-resolution issues lint can't see. Both have been release gates historically per parity plan precedent |
| Q8 | Risk | What if the smoke test was triggered by a stale `.tmp` from a prior crash, not by node --watch race? | Phase 3.5 sweep handles this. Diagnosis is unchanged: atomic writes prevent both classes of failure | Either way, atomic writes are the correct fix. Q8 is moot |
| Q9 | Scope | If Phase 5 closes I-003 as agent-browser infra noise, does Phase 7 still need to document? | Yes. Phase 7 updates `docs/project-changelog.md` either way — fix or closure both count as resolution | Audit trail. A "closed as infra noise" entry prevents the same bug from being re-reported next smoke test |
| Q10 | Architecture | Why hand-roll `writeJsonAtomic` rather than use `proper-lockfile` or `write-file-atomic` npm packages? | 15 lines, no dependency, no maintenance surface. `write-file-atomic` is the canonical reference and our implementation follows the same pattern (tmp + rename) | YAGNI; new dependency requires audit, npm install path, and CI cache update. Hand-roll is shorter than the package's docs page |

**Confirmed decisions:**

- Storage test uses `vi.resetModules()` + dynamic `import()` (Q1, Q6)
- Phase 3 call sites verified via grep at edit time (Q2)
- Phase 5 forbids scope widening — investigates TipTap focus instead (Q3)
- Phase 4 uses `position: sticky`; parent overflow verified (Q4)
- Phase 7 includes skip-on-overrun for P1/P2 fixes (Q5)
- Phase 7 gates on lint + build + tests (Q7)
- `.tmp` cleanup covers both crash classes (Q8)
- Phase 7 documents closures the same as fixes (Q9)
- Hand-rolled `writeJsonAtomic` — no new dependency (Q10)

**Action items integrated into phases (no new TODOs):**

- [x] Phase 1.2: ESM-safe storage test (Q1, Q6)
- [x] Phase 3.2: grep-then-edit verification step (Q2)
- [x] Phase 5.3: scope widening forbidden, TipTap focus investigation primary (Q3)
- [x] Phase 4.1: `position: sticky` + parent overflow verification (Q4)
- [ ] Phase 7: skip-on-overrun gate added in update below (Q5)
- [x] Phase 7: lint + build + test gate (Q7, already in success criteria)
- [x] Phase 3.5: async `.tmp` cleanup (Q8)
- [x] Phase 7: "closed as infra" documentation path (Q9, already in Step 7.4)
- [x] Phase 3.1: hand-rolled atomic helper (Q10)

### Session 1 — 2026-05-23 (planning)

Validation interview to be run via `/ck:plan validate`. Pre-recorded decisions:

1. **[Approach]** Which Zod fix strategy for I-002?
   - **Decision:** Schema-level `.default()` for x/y/w/h (Phase 2). Cheapest, validates at boundary, no migration risk.
   - **Rationale:** Migration on load duplicates the contract across read paths. Storage normalizer happens too late (write already validated). Defaults at the schema mean every entry path is uniform.

2. **[Approach]** Which atomic-write pattern for I-005?
   - **Decision:** Write-to-temp + `fs.rename` (POSIX atomic). On Windows the same `rename` is also atomic at the directory entry level for files in same dir.
   - **Rationale:** `fs-extra` doesn't ship `writeJsonAtomic`. Hand-roll is small (≈ 15 lines), no new dependency.

3. **[Scope]** Should this plan also fix the deferred Socket.IO behavioral tests?
   - **Decision:** No. Parity plan Phase 5 owns them. This plan stays focused on the 5 issues.
   - **Rationale:** YAGNI; the 5 issues are independently shippable. Mixing scopes delays both.

4. **[Risk]** Is Ctrl+K a real user-facing bug worth fixing?
   - **Decision:** Phase 5 first verifies with a real keyboard event in Playwright. If the test passes there, the smoke-test miss is agent-browser focus and we close I-003 as infra noise (documented). If it fails, fix the focus-routing (NOT scope widening — per Session 2 Q3).
   - **Rationale:** Don't burn engineering on a non-bug.

5. **[Release]** Block release on which issues?
   - **Decision:** I-002 (data corruption vector) and I-005 (data-loss vector) block. I-001/I-003/I-004 are P1/P2 — visible but not blocking.
   - **Rationale:** Severity matches user impact, not severity of test failure.

6. **[Ownership]** Who signs off Phase 7?
   - **Decision:** Project owner (this dev) per parity plan precedent. Manual sweep recorded in CHANGELOG.

## Cross-Plan Dependency

- This plan **blocks** `plans/260523-0500-upstream-parity-verification-tdd/` (parity verification depends on smoke baseline being green before parity gates run).
- The parity plan's frontmatter will be updated reciprocally with `blockedBy: [260523-0900-smoke-test-bug-fixes-tdd]` in Phase 7's docs update step.

## Visualization

- Phase visuals (RED→GREEN trace, atomic-write timing diagram, scope decision matrix) saved to `{plan_dir}/visuals/` if `/ck:preview` is invoked.
