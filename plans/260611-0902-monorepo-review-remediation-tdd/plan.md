---
title: "Monorepo Review Remediation (TDD)"
status: complete
created: 2026-06-11
mode: deep
tdd: true
scope: project
blockedBy: []
blocks: []
---

# Monorepo Review Remediation (TDD)

## Goal

Fix the 71 defects found by the 2026-06-11 read-only codebase review (6 parallel
`code-reviewer` streams: R1 element-render, R2 editor-UI, R3 export, R4 realtime,
R5 server, R6 import+electron). Every defect carries file:line evidence. TDD:
each phase writes failing tests first, then fixes until green.

## Source of Truth

- Consolidated findings: `plans/reports/code-review-260611-0826-monorepo-consolidated-findings-report.md`
- Per-stream detail reports (same dir):
  - `from-code-reviewer-element-pipeline-260611-0826-element-render-fidelity-report.md` (R1)
  - `from-code-reviewer-editor-ui-260611-0826-controls-state-workflow-report.md` (R2)
  - `from-code-reviewer-export-260611-0826-pptx-pdf-html-fidelity-report.md` (R3)
  - `from-code-reviewer-realtime-260611-0826-live-game-socket-report.md` (R4)
  - `from-code-reviewer-server-260611-0826-rest-storage-trust-boundary-report.md` (R5)
  - `from-code-reviewer-import-electron-260611-0826-pptx-import-desktop-report.md` (R6)
- Lead-verified Criticals: C1 (game namespace+field, `use-game-socket.js:27,33` vs
  `game-socket-handler.js:9,15`), C2 (`server/index.js:153-173` no `deletedAt` guard).

## Locked Decisions (user, 2026-06-11)

1. **Deploy model = multi-user / behind proxy.** → C2 (soft-deleted decks served
   via share link) and I-R5.4 (unauth explore fork) escalate to **P0** real
   cross-user data exposure, not theoretical.
2. **Game C1 namespace fix = Option A (client→`/games`), SETTLED by red-team.**
   E2E already uses `/games`; game-timer runs on live default namespace → Option B
   would collide. No scout needed; C1 = 2-hook client change + field-name unify.
3. **timeline + game export = write real renderers.** timeline → full shared
   renderer incl. event images; game → static representation renderer (interactive
   runtime cannot export, but a labeled static snapshot must render, never throw).
4. **Scope = all 71 findings.** 4 Critical + 25 Important as full TDD phases;
   17 Medium folded into their domain phases; 25 Low collected in Phase 8 sweep.

## Relationship to Prior Plans

- `260609-0830-element-control-functional-fixes-tdd` (completed 2026-06-09) fixed
  the **properties-panel** layer (opacity, video-src unify, markdown wiring,
  indeterminate read-state for panel controls, export table-merge). This plan's
  R1/R2 findings are **adjacent but distinct**: ribbon Format-tab geometry mixed
  state (panel done, ribbon not — I-R2.4), `'auto'` sentinel in *more* JSX
  renderers not migrated (I-R1.2), shape canvas/export divergence (I-R1.1).
  No overlap; reuse the `computeMixedValues` plumbing that plan introduced.

## Phases

Priority maps to CLI schema (P1=highest..P3). The three P0-severity security
phases (1–3, locked by user decision #1) are P1 here and MUST sequence first.

| # | Phase | Findings | Priority | Severity | Status |
|---|-------|----------|----------|----------|--------|
| 1 | [Game Mode End-to-End Repair](phase-01-game-mode-end-to-end-repair.md) | C1, I-R4.3, I-R4.4, I-R4.5, M(game) | P1 | P0-critical | complete — `f90454e8` |
| 2 | [Server Trust-Boundary & Data Integrity](phase-02-server-trust-boundary-and-data-integrity.md) | C2, I-R5.1..5.5, M(R5)×6 | P1 | P0-critical | complete — `faba2c2e`, `f2a4b73a` |
| 3 | [Untrusted Import Hardening](phase-03-untrusted-import-hardening.md) | C3, C4, I-R6.1..6.3, M(R6)×4 | P1 | P0-critical | complete — `183a8933` |
| 4 | [Element Render Fidelity](phase-04-element-render-fidelity.md) | I-R1.1..1.4, M(R1)×4 | P2 | important | complete — `348fc733` |
| 5 | [Export Pipeline Robustness](phase-05-export-pipeline-robustness.md) | I-R3.1..3.4, M(R3)×4 | P2 | important | complete — `09c5c39c` |
| 6 | [Live Presentation Realtime](phase-06-live-presentation-realtime.md) | I-R4.1, I-R4.2, M(R4)×2 | P2 | important | complete — `00c53d8e` |
| 7 | [Editor UI Controls](phase-07-editor-ui-controls.md) | I-R2.1..2.4, M(R2)×8 | P2 | important | complete — `2361598e` |
| 8 | [Medium & Low Cleanup Sweep](phase-08-medium-low-cleanup-sweep.md) | L×25 + residual M | P3 | low | complete — `405b2a2d` |

## Dependencies

- **Phase 5 blockedBy Phase 4**: export stop-throw for timeline/game (I-R3.3)
  depends on the shared renderers landing in Phase 4. The rest of Phase 5 is
  independent and may proceed in parallel.
- Phases 1, 2, 3 are independent of each other and of 4-7 — parallelizable.
- Phase 8 blockedBy all (final sweep verifies no residual + catches Low items
  that touch files already changed earlier).

## Recommended Sequencing

P0 first (1 → 2 → 3 in any order, or parallel if owners separate), then P1
(4 before 5; 6, 7 anytime), then P3 (8 last). Each phase is independently
shippable behind its own green test suite.

## Global Verification (after every phase)

```bash
npm run lint
npm run test            # Vitest unit (narrow first: the phase's new specs)
npm run test:e2e        # only when phase touches editor/live UI workflow
npm run build
```

PPTX-touching phases (3,4,5) additionally:
```bash
npm run test:corpus
npm run test:pptx:browser-audit
```

## Acceptance Criteria (plan-level)

- [x] All 4 Critical fixed with regression tests proving the original repro fails-then-passes.
- [x] All 25 Important fixed with per-finding tests.
- [x] 17 Medium addressed in-phase or explicitly deferred with rationale.
- [x] 25 Low triaged in Phase 8 (fixed or logged as won't-fix with reason).
- [x] `npm run lint && npm run build && npm run test` green.
- [x] No new file exceeds 200 LOC without justification (CLAUDE.md constraint).

## Completion Evidence

### Session — 2026-06-12

All 8 phases completed with TDD and committed as 9 focused commits:

- `f90454e8` — Phase 1 game mode socket flow, host authz, anti-cheat, room cleanup.
- `faba2c2e` — Phase 2a serve guard for soft-deleted decks and atomic share writes.
- `f2a4b73a` — Phase 2b settings secret preservation, reversible restore, SSRF pin-to-IP.
- `183a8933` — Phase 3 markdown/PPTX import hardening, measured zip caps, worker heap cap.
- `348fc733` — Phase 4 canvas/export render parity for shapes, colors, timeline, game.
- `09c5c39c` — Phase 5 raster engine consolidation and per-element export failure isolation.
- `00c53d8e` — Phase 6 per-slide annotations, live room cleanup, timer re-arm.
- `2361598e` — Phase 7 vertical child find/replace, multi-select arrange, redo cap, ribbon mixed state.
- `405b2a2d` — Phase 8 security-adjacent and low-severity sweep.

Final gates recorded in the implementation transcript:

- `npm run test`: 2474 passed, 0 failed, 1 skipped.
- `npm run lint`: 0 errors; 23 existing benchmark-script warnings.
- `npm run build`: passed.
- PPTX fidelity gates for import/export-touching phases passed, including corpus fidelity and browser audit.

Residual follow-up notes:

- I-R2.1 jump-focus into a vertical child slide still needs UX-level e2e wiring for `childIndex`; Replace All data coverage is fixed and tested.
- Electron navigation hardening and setState-after-unmount fixes were covered by code review and available tests, but still benefit from manual desktop smoke.
- Three cosmetic low-priority items were logged as won't-fix with rationale in the Phase 8 sweep.

## Unresolved Questions

1. ~~Game host identity beyond socket.id?~~ **RESOLVED (red-team):** no host
   field exists; Phase 1 adds stable `playerId` + `hostPlayerId` (see Phase 1
   Red-Team Amendments). Not deferred.
2. Should live annotations persist across server restart? **RESOLVED (validate
   2026-06-11): NO — in-memory only.** Phase 6 room-cleanup does plain in-memory
   removal, no storage flush.
3. ~~Any consumer rendering `element.content` WITHOUT sanitize?~~ **RESOLVED
   (red-team):** the render sink runs `sanitizeRichTextHtml`
   (`element-renderers.js:141` + `content-safety.js:14-19`) → C3 is
   defense-in-depth, not live XSS. Re-scoped in Phase 3.
4. ~~pptxtojson 2.0.2 `vMerge`/`hMerge` semantics for table cell merge.~~
   **RESOLVED (implementation):** Phase 3/5 corpus and export verification stayed green.
5. Confirm proxy-level auth is the multi-user story. **RESOLVED (validate
   2026-06-11): YES — auth enforced at reverse proxy (nginx/Caddy), NOT in-app.**
   I-R5.4 scoped to refuse-trashed + size cap + rate limit + document proxy
   assumption. No in-app auth phase.

## Red Team Review

### Session — 2026-06-11
**Mode:** `--deep` (4 hostile reviewers: Security Adversary, Failure Mode Analyst,
Assumption Destroyer, Scope & Complexity Critic). All findings grep-verified (file:line).
**Findings:** 15 (15 accepted, 0 rejected) after dedup + evidence filter.
**Severity breakdown:** 5 Critical, 4 High, 6 Medium.

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | No in-app auth layer; I-R5.4 "require auth" infeasible → descope to proxy | Critical | Accept | Phase 2 |
| 2 | C2 guard list misses 6+ serve paths (present/export/duplicate/save-as-template/uploads/github/mint-token) | Critical | Accept | Phase 2 |
| 3 | Soft-delete token-suspend loses data on restore → use serve-guard, don't mutate tokens | Critical | Accept | Phase 2 |
| 4 | Game cleanup/authz blocked: socket.id keying + no host field → add stable playerId/hostPlayerId | Critical | Accept | Phase 1 |
| 5 | C4 misses XML-part OOM vector + no worker heap cap | Critical | Accept | Phase 3 |
| 6 | Lock helpers withTemplates/withHistory don't exist → must create; fork needs withPresentations | High | Accept | Phase 2 |
| 7 | Phase 5→4 dependency not test-enforced (placeholder passes test) | High | Accept | Phase 5 |
| 8 | SSRF "re-validate" option IS the TOCTOU → pin connection, IP-check allowlist | High | Accept | Phase 2 |
| 9 | I-R6.1 background gate only http(s); data:/protocol-relative/relative bypass | High | Accept | Phase 3 |
| 10 | C3 is defense-in-depth not live XSS (sink sanitizes) → relabel, narrow test | Medium | Accept | Phase 3 |
| 11 | I-R1.1 "unify geometry" infeasible refactor → just add 7 cases (YAGNI) | Medium | Accept | Phase 4 |
| 12 | I-R1.4 game renderer gold-plated → labeled placeholder only | Medium | Accept | Phase 4 |
| 13 | Stale premises: I-R6.3 ELECTRON gate, I-R5.2 sentinel, I-R3.2 span | Medium | Accept | Phase 3,2,4 |
| 14 | Game C1 scout pre-settled (Option A forced) | Medium | Accept | Phase 1 |
| 15 | bcrypt-500 cite wrong (index.js:275 + explore.js:59, not share.js) | Medium | Accept | Phase 8 |

### Whole-Plan Consistency Sweep
- Locked Decision #2 updated: game C1 = Option A settled (was "plan decides").
- Phase 5→4 dependency retained; now test-enforced per finding 7.
- Unresolved Q1 + Q3 resolved by red-team; Q5 (proxy-auth confirmation) added.
- Severity column in phase table unchanged (CLI P1–P3 schema honored).
- Auth assumption (proxy-level) now consistent across Phase 2 + plan decisions +
  Q5. No remaining reference to in-app auth.
- **No unresolved contradictions.** Plan is implementation-ready pending user
  answers to Q2 (annotation persistence) and Q5 (proxy-auth confirmation).

## Validation Log

### Session — 2026-06-11
**Mode:** `--deep` validate. Verification pass SKIPPED (guard: `## Red Team Review`
already carries file:line verification evidence — per validate-workflow Step 2.5).
**Questions asked:** 4. **Decisions confirmed:**

| Q | Topic | Decision | Propagated To |
|---|-------|----------|---------------|
| 1 | Multi-user auth (Q5) | Auth at reverse proxy (nginx/Caddy); NOT in-app. I-R5.4 = refuse-trashed + size cap + rate limit + document. | Phase 2 (already via red-team #1) |
| 2 | Annotation persistence (Q2) | In-memory only; no storage flush on cleanup. | Phase 6 |
| 3 | Game host identity | Phase 1 decides (first-joiner vs element-owner) at implement. | Phase 1 (amendment already offers both) |
| 4 | Rollout strategy | Ship P0 (Phases 1–3) as first milestone, verify + mergeable, then re-eval P1/P3. | plan Recommended Sequencing |

### Whole-Plan Consistency Sweep (post-validate)
- Q2 + Q5 moved to RESOLVED in Unresolved Questions.
- Phase 6 annotated: in-memory cleanup (no persistence).
- Recommended Sequencing already matches Q4 (P0 first); reinforced as a milestone gate.
- Phase 2 proxy-auth decision consistent with red-team #1 + Q5 — no in-app auth reference remains.
- Game host (Q3) left to Phase 1 implementation, consistent with Phase 1 amendment.
- **No unresolved contradictions.** Verification failures: 0 (none introduced).
  Plan is implementation-ready.
