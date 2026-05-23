---
phase: 7
title: "Regression Sweep & Docs Update"
status: pending
priority: P0
effort: "2-3h"
dependencies: [2, 3, 4, 5, 6]
---

# Phase 7: Regression Sweep & Docs Update

## Overview

After all five fixes land, run the full test pipeline against the integrated codebase, resolve every unresolved question from the smoke report, and update docs so future contributors don't repeat the mistakes. This phase is the merge / release gate.

## Requirements

### Functional
- All Phase 1 RED tests are GREEN.
- `npm run lint` passes.
- `npm run build` succeeds (client dist artifact present).
- `npm run test` passes with no skipped tests in the new regression files.
- `npm run test:e2e` passes (or only fails on pre-existing known-failing specs not introduced by this plan).
- All 5 unresolved questions Q1..Q5 from `smoke-test-findings.md` are answered or escalated.
- Cross-plan dependency between this plan and `260523-0500-upstream-parity-verification-tdd` is reciprocal.

### Non-functional
- CHANGELOG / `docs/project-changelog.md` reflects all fixes with severity + issue IDs.
- `docs/codebase-summary.md` updated if any file structure or contract changed (storage atomic pattern is worth a note).
- `README.md` `Current release` line updated only if version is bumped (not in this plan).

## Architecture

```
Phase 2..6 fixes merged → Phase 7:
  ├─ Run full test pipeline
  ├─ Resolve Q1..Q5 with verdicts logged
  ├─ Update docs/project-changelog.md
  ├─ Update docs/codebase-summary.md (storage pattern note)
  ├─ Update parity plan frontmatter (reciprocal blockedBy)
  └─ Append final report to plan dir
```

## Related Code Files

- Modify: `docs/project-changelog.md` (or create if absent)
- Modify (conditional): `docs/codebase-summary.md` — add line about atomic storage write pattern
- Modify: `plans/260523-0500-upstream-parity-verification-tdd/plan.md` — frontmatter `blockedBy: [260523-0900-smoke-test-bug-fixes-tdd]`
- Read for context: `plans/260523-0500-upstream-parity-verification-tdd/reports/smoke-test-findings.md`
- Create: `plans/260523-0900-smoke-test-bug-fixes-tdd/reports/phase-07-final-report.md`

## Implementation Steps

### Step 7.1 — Run the full pipeline

```powershell
npm run lint
npm run build
npm run test
npm run test:e2e -- --grep regression-smoke
```

Capture results (pass/fail count, durations) into `reports/phase-07-final-report.md`. Any failing existing tests (pre-existing flakes) must be enumerated by name; do not paper over them.

### Step 7.2 — Run wider e2e to catch unrelated regression

```powershell
npm run test:e2e
```

Allowable failures: pre-existing flakes in `tests/e2e/live/*` (require 2 browser sessions per smoke report Deferred section). All other failures must be triaged in this phase.

### Step 7.3 — Resolve unresolved questions

For each Q1..Q5 from the smoke report, log a verdict in the final report:

| Q | Smoke-report question | Verdict |
|---|---|---|
| Q1 | I-002 fix shape: defaults vs migration vs storage normalizer | Answered Phase 2: schema defaults. Cheapest, validates at boundary |
| Q2 | I-005 root cause: node --watch vs agent-browser race | Moot; atomic write fixes both. Either way data is safe |
| Q3 | I-003 cause: real scope bug vs agent-browser focus | Phase 5 outcome (real fix or closed as infra) |
| Q4 | Element count claim: README 20 vs ribbon 27+ | Park as docs follow-up. Not in this plan's scope |
| Q5 | I-004 version source: build-time vs constant | Answered Phase 6: build-time via Vite define |

### Step 7.4 — Update project changelog

Append to `docs/project-changelog.md` (create with single header if missing):

```markdown
## [Unreleased] — 2026-05-23

### Fixed
- **I-002 (Medium)**: Legacy fixture decks no longer fail save validation. Element geometry fields now default to (x=0, y=0, width=100, height=100) when missing. `server/middleware/schemas.js`.
- **I-005 (Medium)**: Storage writes are now atomic (temp-write + rename). Prevents `presentations.json` from being truncated under concurrent reads, node --watch restarts, or crashes. `server/services/storage.js`.
- **I-001 (Low)**: Trash entry in dashboard sidebar is pinned to the bottom and remains visible at all viewport heights. `client/src/pages/HomePage.jsx`.
- **I-003 (Low)**: `Ctrl+K` reliably opens the command palette in the editor. `client/src/utils/default-keyboard-shortcut-definitions-registry.js`. *(or closed as infra noise — replace this bullet with the Phase 5 outcome)*
- **I-004 (Low)**: Footer version is now derived from `package.json` at build time via Vite `define`. `client/vite.config.js`, `client/src/components/layout/StatusBar.jsx`.

### Added
- `writeJsonAtomic` helper in storage layer.
- Regression test suite at `tests/e2e/regression-smoke-fixes.spec.js` and `server/services/storage.test.js`.
```

### Step 7.5 — Note the storage atomic pattern in codebase summary

In `docs/codebase-summary.md`, locate the "Persistence / Storage" section (or "server/services/storage.js" mention) and add:

> All JSON state files in `server/data/` are written through `writeJsonAtomic` (temp file + rename) to guarantee crash safety. Direct calls to `fs.writeJson` for persistent state are now forbidden — extend the helper if a new file is added.

### Step 7.6 — Cross-plan dependency wiring

Edit `plans/260523-0500-upstream-parity-verification-tdd/plan.md` frontmatter:

```yaml
blockedBy: [260523-0900-smoke-test-bug-fixes-tdd]
```

Add a short note in that plan's `## Overview` or `## Context` referencing this plan as prerequisite:

> Prerequisite: `plans/260523-0900-smoke-test-bug-fixes-tdd` must be GREEN before parity gates run. Smoke-test issues are baseline assumptions of the parity matrix.

### Step 7.7 — Final report

Create `plans/260523-0900-smoke-test-bug-fixes-tdd/reports/phase-07-final-report.md` with:

- Test results summary (pass/fail counts, duration)
- Per-issue resolution status (5 rows)
- Q1..Q5 verdicts (5 rows)
- Files changed (path + LOC delta)
- Risks accepted (any that surfaced during fix)
- Recommendations for the parity plan to consume

### Step 7.8 — Smoke retest

Repeat the failing scenarios from the original smoke session manually:

| Scenario | Expected |
|---|---|
| Load deck with legacy element (no x/y/w/h) → edit → save | 200 OK, persisted |
| Kill server mid-save (Ctrl+C in dev shell) → restart → reload | Last full save visible; no truncation |
| Resize browser to 1280×500 → look for Trash entry | Visible at bottom |
| Open editor → click empty canvas → press Ctrl+K | Command palette opens (or documented infra closure) |
| Open `/` → look at footer | Shows `v1.9.4` (matching package.json) |

All five pass → plan is GREEN. Capture results.

### Step 7.9 — Commit

```text
docs(release): close smoke-test issues I-001..I-005

Regression sweep + final report + cross-plan dependency to
parity verification plan. All five issues resolved or closed
with proof.
```

## Success Criteria

- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] `npm run test` passes (no skipped tests in regression files)
- [ ] `npm run test:e2e -- --grep regression-smoke` passes
- [ ] Full `npm run test:e2e` either passes or only fails on documented pre-existing flakes
- [ ] All Q1..Q5 verdicts logged
- [ ] `docs/project-changelog.md` updated
- [ ] `docs/codebase-summary.md` updated with storage pattern note
- [ ] Parity plan frontmatter has reciprocal `blockedBy`
- [ ] `reports/phase-07-final-report.md` written
- [ ] Smoke retest all 5 scenarios pass

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Full e2e suite reveals unrelated regression introduced elsewhere this week | Triage by name; if not introduced by Phase 2..6, file as separate issue and proceed |
| `docs/project-changelog.md` doesn't exist yet | Create with H1 + the entry above |
| Parity plan is currently in_progress; editing its frontmatter triggers stale state | Edit is purely additive on frontmatter; parity plan's phase content unchanged |
| Storage pattern note in codebase summary contradicts existing prose | Read existing section first; replace, don't duplicate |
| Smoke retest re-uses production data dir | Use a fresh dev shell with `SLIDES_DATA_DIR=$tmpdir` for the kill-mid-save step |

## Security Considerations

- No new attack surface. Atomic writes harden against corruption; defaults harden against malformed input being rejected silently.
- Confirm no secrets in `reports/phase-07-final-report.md` (it's committed).

## Red Team Adjustment

To be populated after `/ck:plan red-team`. Pre-emptive:
- If reviewer asks for explicit rollback plan: every fix is reversed by git revert of its commit; storage atomic writes are backwards compatible (consumers of `presentations.json` are unchanged).
- If reviewer wants a release version bump: out of scope; version is bumped in a release-cut commit, not in this fix plan.

### Skip-On-Overrun Gate (per Validation Session 2 Q5)

If Phase 5 (I-003 investigation) is still in progress after 1 working day, close I-003 as **deferred — non-blocking** and proceed to Phase 7 with the remaining 4 fixes. Document the deferral in `docs/project-changelog.md` under a `### Deferred` section:

```markdown
### Deferred
- **I-003 (Low)**: Ctrl+K command palette investigation pending real-browser repro. Tracked in next sprint. Not release-blocking.
```

Rationale: I-001/I-003/I-004 are P1/P2; I-002 and I-005 are the only release-blockers. Don't gate ship on a non-blocker.

## Next Steps

Plan completes. Hand off to user via Post-Plan Handoff. Parity plan Phase 1 can now resume.
