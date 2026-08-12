---
title: "Verified Production Readiness Remediation Deep TDD"
description: "Test-first remediation of the independently reproduced live-capability, portable-export, deployment/SVG, and PPTX reliability defects without broad editor refactoring."
status: in-progress
priority: P1
effort: "24-34 engineer-days"
issue: null
branch: master
tags: [bugfix, security, reliability, frontend, backend, export, pptx, infra, tdd, critical]
blockedBy: []
blocks: [260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd]
related:
  - 260726-0616-pptx-import-reliability-ux-evidence-hardening-deep-tdd
  - 260724-1444-pptx-import-p1-p3-readiness-remediation-deep-tdd
created: 2026-08-10
mode: "--deep --tdd"
scopeDecision: hold
sourceReport: "./reports/debug-verification-baseline.md"
---

# Verified Production Readiness Remediation Deep TDD

## Overview

Implement every actionable finding from the 2026-08-09/10 debug re-verification.
The plan fixes two unconditional release blockers, hardens documented deployment
boundaries, closes four reproducible PPTX reliability gaps, and removes one dead
game control path. It preserves the single-user trusted-author model and does not
turn NavSlides into a multi-user authentication product.

## Scope Challenge

- **Existing code reused:** presenter-token hashing, in-memory live rooms, package
  StateStore/WAL, compatibility outbox, bounded ZIP entry streams, upload hash
  store, offline HTML inliner, feature inventory, Vitest and Playwright harnesses.
- **Requested scope:** all confirmed and partial findings from the reviewed debug
  report, with implementation detail, TDD order, verification, docs, rollback,
  and one phase file per delivery boundary.
- **Complexity:** seven phases, four runtime boundaries, more than eight touched
  files by necessity. New modules are limited to small policy/manifest/recovery
  owners; no generic transaction framework or broad UI rewrite.
- **Selected scope:** HOLD. No YAGNI reduction requested. Rejected line-count-only
  debt remains out of implementation scope.

## Product and Delivery Contract

### Required outcomes

1. A viewer room code never grants remote/speaker authority or speaker notes.
2. Standard and GitHub HTML exports run away from the NavSlides origin while
   same-origin Present and Offline HTML behavior remain intact.
3. Local/Electron/Docker defaults do not accidentally expose the no-auth API;
   uploaded SVG cannot execute with application-origin authority on navigation.
4. PPTX archive limits are applied before CRC inflation work.
5. PPTX import reports `done` only after its exact compatibility write is visible;
   cancellation cannot leave a compatibility row bound to a removed package head.
6. Newly imported PPTX media has durable, job-owned crash recovery.
7. Dead generic game controls are removed without changing real game protocols.

### Non-goals

- Built-in user accounts, RBAC, OAuth, or multi-tenant content isolation.
- Pixel-perfect PowerPoint, native OfficeCLI, chart promotion, or new import fidelity.
- A generic distributed transaction/saga framework, cross-process file database, or
  legacy-media reference-count migration.
- Broad EditorPage, HomePage, game renderer, or source-file-size refactoring.
- Blanket sanitization of trusted author HTML/CSS/JS.
- Fetching arbitrary remote media during export.

## Debug Evidence Baseline

| ID | Reproduced fact | Corrected severity | Owning phase |
|---|---|---:|---|
| D1 | Viewer code permits tokenless controller join and notes exposure | High | 1 |
| D2 | Standard/GitHub HTML contains ten root-relative runtime references | High | 2 |
| D3 | Server/Docker/Electron bind can expose no-auth APIs | High when network reachable | 3 |
| D4 | Direct navigation to uploaded SVG executed `onload` as app origin | Medium, conditional | 3 |
| D5 | CRC path inflated five entries before 1 KiB budget rejection | Medium | 4 |
| D6 | Mid-drain cancel produced `{row:true, head:false, status:"cancelled"}` | Low consistency defect | 5 |
| D7 | Zero-applied drain produced `{row:false, head:true, status:"done"}` | Low false-success defect | 5 |
| D8 | Imported file/hash survived isolated process restart without commit | Low crash leak | 6 |
| D9 | Generic START/SPIN has no handler but is unreachable in production Present | Low dead code | 7 |
| D10 | Existing files over 200 LOC are automatic release defects | Rejected | Out of scope |

## Architecture Decisions

1. **Live capabilities:** viewer stays room-code-only. Presenter, remote, and speaker
   receive independent random bearer capabilities stored only as hashes. Privileged
   links carry capabilities in URL fragments, which are scrubbed immediately after
   parsing. Bare legacy privileged links and presenter query credentials fail closed.
   Capability-bearing responses are non-cacheable.
2. **Role-specific live payloads:** viewer gets notes-free HTML; remote gets only
   the minimal metadata/control data it needs; speaker/presenter get notes-bearing
   metadata. Unknown roles are rejected.
3. **Explicit HTML modes:** `generateRevealHTML()` defaults to `same-origin`;
   `portable` uses one lockfile-derived, SRI-pinned CDN manifest, inlines local
   overrides, omits live bootstrap, and accepts a trusted media resolver.
4. **GitHub artifacts:** build a complete artifact set before Git API mutation,
   rewrite only verified local uploads to deterministic relative assets, never
   fetch remote URLs, re-sanitize legacy SVG, use identity-stable deck folders,
   and fail before any empty-repo or commit mutation on missing/unsafe local media.
   rclone HTML uses the same portable profile with its `_uploads` resolver.
5. **Deployment policy:** Node/Electron default to loopback. Docker binds inside
   the container but publishes to host loopback unless explicitly opted into LAN
   exposure with external authentication and a separate danger acknowledgement.
   Missing acknowledgement emits a structured warning but does not abort.
6. **SVG defense:** sanitize new SVG uploads, then serve every SVG (including
   legacy files) with attachment/sandbox/nosniff policy. Trusted inline SVG render
   sanitizers remain separate and unchanged except for parity tests.
7. **PPTX archive order:** raw structural preflight and declared budgets precede
   `JSZip.loadAsync({checkCRC32:false})`; one bounded stream calculates actual bytes
   and CRC. Public bounded-reader/validator return shapes stay compatible. Worker
   cancellation uses abort IPC plus bounded force termination.
8. **Exact compatibility receipts:** drains return per-write outcomes. Import opens
   only after its exact write is `applied`. Rollback queues an identity-fenced
   compensation removal and persists `reconcile-required` when compensation fails.
   All production drain callers adopt an explicit target-receipt policy.
9. **Durable media:** stage new media under a job namespace; package publication
   binds a bounded manifest; finalize/rollback/restart are idempotent. Legacy media
   is never inferred, migrated, or swept. Durable listability requires finalized
   media. Startup recovery is single-owner and lease-aware.

## Cross-Plan Dependencies

| Relationship | Plan | Contract |
|---|---|---|
| Blocks | `260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd` | User-selected hard block. Shared PPTX package/guard/outbox/media contracts land here first. |
| Reuses completed work | `260726-0616-pptx-import-reliability-ux-evidence-hardening-deep-tdd` | Preserve durable authority, listability and existing recovery behavior. |
| Reuses completed work | `260724-1444-pptx-import-p1-p3-readiness-remediation-deep-tdd` | Preserve worker, outbox and import lifecycle contracts; close only newly reproduced gaps. |
| No dependency | Existing UI accessibility plans | No broad editor or accessibility redesign. |
| No dependency | `260808-1700-pptx-export-fidelity-all-surfaces` | That plan owns PPTX export fidelity, not portable HTML. |

## Phase Dependency Graph

```text
Phase 1 Live capability ───────┐
                               ├──> Phase 2 Portable HTML/GitHub
Phase 3 Loopback/SVG ──────────┘
Phase 4 PPTX archive safety ──> Phase 5 Compatibility compensation
                                      └──> Phase 6 Durable media recovery
All phases ───────────────────────────────> Phase 7 Closeout and release gates
```

Phases 1, 3 and 4 start independently. Phase 2 consumes Phase 1's generator option
contract and Phase 3's SVG sanitizer. Implementation should still serialize edits
in shared hotspots (`htmlGenerator.js`, `server/index.js`, and `pptx-import.js`).
Phases 5 and 6 are sequential because both evolve durable package-job state and
import commit ordering.

## Phases

| Phase | Name | Priority | Dependencies | Status |
|---|---|---:|---|---|
| 1 | [Live Session Capability Separation](./phase-01-live-session-capability-separation.md) | P1 | None | Completed |
| 2 | [Portable HTML and GitHub Export](./phase-02-portable-html-and-github-export.md) | P1 | Phases 1, 3 | Pending |
| 3 | [Loopback Deployment and SVG Isolation](./phase-03-loopback-deployment-and-svg-isolation.md) | P1 | None | Completed |
| 4 | [PPTX Archive Preflight and Bounded CRC](./phase-04-pptx-archive-preflight-and-bounded-crc.md) | P1 | None | Completed |
| 5 | [PPTX Compatibility Receipts and Compensation](./phase-05-pptx-compatibility-receipts-and-compensation.md) | P1 | Phase 4 | Pending |
| 6 | [PPTX Durable Media Recovery](./phase-06-pptx-durable-media-recovery.md) | P1 | Phase 5 | Pending |
| 7 | [Release Closeout and Dead Control Cleanup](./phase-07-release-closeout-and-dead-control-cleanup.md) | P1 | Phases 1-6 | Pending |

## Global Verification Policy

- Every phase starts with failing tests for the reproduced defect.
- No sleeps for races. Use deferred gates, injected fault hooks, reopened stores,
  isolated temporary directories, and real route/socket adapters.
- No live credentials, GitHub pushes, external publishing, or destructive
  presentation data operations in automated tests.
- Focused phase gate must pass before moving on. Final gate runs lint, build,
  unit, coverage, audit/matrix, targeted E2E, PPTX adversarial/corpus, docs build,
  disposable container/Electron runtime probes, and smoke load profiles.
- Environment-only Docker/Electron/k6/corpus lanes may be named deferred CI
  evidence. The plan may close PASS WITH DEFERRED CI, but package-first stays
  blocked until every mandatory deferred lane is actually green.
- Preserve the three pre-existing dirty files unless explicitly assigned:
  `client/src/pages/LiveViewPage.jsx`, `docs/codebase-summary.md`, and
  `tests/e2e/live/black-and-white-screen-overlay-viewer-keyboard.spec.js`.

## Whole-Plan Success Criteria

- [ ] All seven phase success criteria and locally available regression gates pass
  from final source; unavailable environment lanes have named CI owners.
- [ ] Viewer payloads contain no root or vertical-child note canaries.
- [ ] Missing/wrong/cross-role live capabilities fail closed; valid remote/speaker flows pass.
- [ ] Downloaded and GitHub HTML have no application-root runtime dependency.
- [ ] Same-origin Present and fully inlined Offline HTML remain regression-green.
- [ ] Local/Electron/Docker default binding is loopback-safe; explicit exposure is documented and tested.
- [ ] Direct SVG navigation cannot execute with application-origin authority.
- [ ] PPTX budget rejection is proven to occur before CRC inflation.
- [ ] Exact compatibility receipt/compensation crash tests leave no ghost or false-success import.
- [ ] Media crash/restart tests converge idempotently without touching legacy files.
- [ ] Durable status never exposes a deck before media finalization.
- [ ] Package-first plan dependency is released only after every mandatory local
  and deferred CI lane has actual green evidence.

## Open Questions

None. The implementation contracts above resolve the design forks found during
research. Any new requirement that changes public auth, CDN provider, or durable
storage authority requires replan rather than silent expansion.

## Red Team Review

### Session — 2026-08-11

**Raw findings:** 29 across four lenses.  
**Deduplicated findings:** 15 (13 accepted, 2 rejected).  
**Severity after deduplication:** 0 Critical, 12 High, 3 Medium.

| # | Finding | Severity | Disposition | Applied To |
|---|---|---:|---|---|
| 1 | Remove presenter query credentials; add no-store and fragment scrubbing | High | Accept | Phase 1 |
| 2 | Thread role capabilities through all EditorPage/modal intermediates | High | Accept | Phase 1 |
| 3 | Validate artifacts before empty-repo mutation; prevent deck-folder collisions | High | Accept | Phase 2 |
| 4 | Cover rclone HTML producers and portable SVG sanitization | High | Accept | Phase 2 |
| 5 | Close CDN transitive-resource integrity gap | Medium | Accept | Phase 2 |
| 6 | Cap SVG parse bytes and require explicit dangerous network exposure | High | Accept | Phase 3 |
| 7 | Add actual Docker/Electron runtime-connect gates | Medium | Accept | Phases 3, 7 |
| 8 | Preserve bounded-reader wrappers and abort the parser worker cooperatively | High | Accept | Phase 4 |
| 9 | Migrate all drain consumers and expose reconcile-required consistently | High | Accept | Phase 5 |
| 10 | Keep Phase 5/6 as one release unit | High | Accept | Phases 5, 6 |
| 11 | Gate listability on finalized media and centralize startup recovery | High | Accept | Phase 6 |
| 12 | Add lease, same-hash multi-job and native-validator media contracts | High | Accept | Phase 6 |
| 13 | Add CI coverage and runtime release gates | Medium | Accept | Phase 7 |
| 14 | Sandbox all trusted author live content | High | Reject | Conflicts with documented trusted-author product model; external auth remains deployment boundary |
| 15 | Add a new high-entropy viewer capability/rate-limit feature | Medium | Reject | Unrequested expansion beyond the reproduced viewer-to-privileged escalation defect |

### Whole-Plan Consistency Sweep

- Decision deltas checked: 13 accepted changes and 2 rejected expansions.
- Files reread after validation: `plan.md` and phases 1-7.
- Reconciled stale references: network acknowledgement behavior, Phase 2
  dependencies, changelog authority, capability cache wording, deferred runtime
  gates, corpus deferral and default loopback-smoke wording.
- Current unresolved contradictions: 0.

## Current Execution Status — 2026-08-12

- **Completed:** Phases 1 (live capability separation), 3 (loopback/SVG
  isolation), and 4 (PPTX archive preflight, bounded CRC, and cancellation).
- **Pending:** Phases 2 (portable HTML/GitHub export), 5 (PPTX compatibility
  receipts), 6 (durable media recovery), and 7 (release closeout).
- **Phase 1 evidence:** live REST/unit `83/83`; live capability/security browser
  `9/9`.
- **Phase 3 evidence:** loopback/SVG contracts `36/36`; server loopback
  startup/shutdown smoke; `npm run build`; and `npm run docs:build` all passed.
- **Phase 4 evidence:** focused archive/worker gates; PPTX adversarial `10/10`;
  tiny performance check; and corpus `11/11` passed. Lint reported 0 errors
  with 29 pre-existing warnings.
- **Deferred CI:** Docker Compose runtime (Docker command unavailable here),
  planned deployment and Electron runtime probes, and planned uploaded-SVG
  browser specs (spec files absent here). These remain deferred CI lanes; no
  pending phase is marked complete.

## Validation Log

### Session 1 — 2026-08-11

**Trigger:** automatic `--deep` post-red-team validation.  
**Questions asked:** 7.

### Verification Results

- **Tier:** Full (7 phases).
- **Path claims checked:** 118.
- **Verified existing paths:** 97.
- **Planned create paths:** 20.
- **Failed:** 1 initial stale path, corrected from root `CHANGELOG.md` to
  `docs/project-changelog.md`.
- **Unverified:** 0.
- Red-team Fact Checker, Flow Tracer, Scope Auditor and Contract Verifier evidence
  was applied before the interview.

#### Questions and Answers

1. **[Security/UX]** After reading a remote/speaker capability from the URL
   fragment, how should browser history be handled?
   - Options: scrub immediately and keep in memory; keep fragment for reload;
     move to `sessionStorage`.
   - **Answer:** scrub immediately, keep in memory; reload requires the original link.
   - **Rationale:** minimizes bearer persistence and preserves fail-closed reload.
2. **[Architecture]** How should portable HTML protect runtime dependencies?
   - Options: fixed CDN + SRI and inline non-SRI transitive assets; inline all
     runtime; export an HTML + local-assets directory.
   - **Answer:** fixed CDN + SRI; inline fonts/transitive assets without SRI.
   - **Rationale:** preserves CDN-backed standard export while closing subordinate
     integrity/resource gaps.
3. **[Deployment]** What happens when non-loopback exposure lacks the explicit
   danger acknowledgement?
   - Options: fail startup; warning and continue; reverse-proxy-only mode.
   - **Answer:** warning and continue.
   - **Rationale:** operator compatibility wins over hard refusal; exposure must
     still be high-signal and documented as unauthenticated.
4. **[Durability]** What concurrency boundary applies to shared data/uploads?
   - Options: single package-store writer; full multi-process lease system; no check.
   - **Answer:** single package-store writer; second process fails startup.
   - **Rationale:** matches current file-store authority and avoids unsafe sweeps.
5. **[Compatibility]** How should GitHub folder-title collisions be resolved?
   - Options: safe title + stable presentation ID; reject existing title folder;
     overwrite current folder.
   - **Answer:** safe title + stable presentation ID.
   - **Rationale:** deterministic, collision-free and restart-stable.
6. **[Release]** May the plan complete when Docker/Electron/k6/corpus cannot run
   locally?
   - Options: remain blocked; complete with named deferred CI; require only
     unit/build/E2E.
   - **Answer:** complete with named deferred CI.
   - **Rationale:** environment-only lanes move to CI without becoming false passes;
     package-first remains blocked until actual green evidence.
7. **[Documentation]** Where should release notes be recorded?
   - Options: existing `docs/project-changelog.md`; create root `CHANGELOG.md`;
     release report only.
   - **Answer:** use existing `docs/project-changelog.md`.
   - **Rationale:** follows repository organization and avoids duplicate authority.

### Confirmed Decisions

- Privileged fragments are one-time transport into component memory.
- Portable standard HTML remains CDN-backed with verified/inline transitive graph.
- Missing network acknowledgement warns rather than aborts.
- Package state remains single-writer; second writer is refused.
- GitHub deck folders include stable presentation identity.
- Environment-only gates may defer to named CI, never become implicit passes.
- Existing project changelog remains the release-note authority.

### Impact on Phases

- Phase 1: hash scrubbing and reload-fail tests remain required.
- Phase 2: fixed CDN/SRI plus inline transitive assets; stable identity folder.
- Phase 3: replace fail-startup behavior with structured warning.
- Phase 6: enforce single package-store writer before recovery/sweep.
- Phase 7: use project changelog; allow PASS WITH DEFERRED CI while retaining the
  package-first blocker until evidence is green.

### Whole-Plan Consistency Sweep

- Files reread in full: `plan.md`, phases 1-7.
- Validation deltas: 7.
- Initial path contradiction corrected: 1.
- Planned cross-phase create/reuse paths classified: 1 (Phase 3 SVG sanitizer,
  reused by Phase 2).
- Final unresolved contradictions: 0.
- Final plan structure validation: passed.

<!-- slug: verified-production-readiness-remediation-deep-tdd -->