---
title: "Monorepo review remediation — completion history"
date: 2026-07-22 14:17 Asia/Saigon
status: historical-record
source_plan: plans/archive/260611-0902-monorepo-review-remediation-tdd/plan.md
---

# Monorepo Review Remediation: completion history

> Historical record for archival. It preserves what was completed on 2026-06-11/12; it is not current product authority.

## Context

A six-stream read-only review identified 71 defects: 4 critical, 25 important,
17 medium, and 25 low. The plan deliberately treated the deployment as
multi-user behind a proxy, which turned publicly serving soft-deleted decks from
a theoretical issue into a P0 boundary failure. See the [completed plan](../archive/260611-0902-monorepo-review-remediation-tdd/plan.md) and its [completion evidence](../archive/260611-0902-monorepo-review-remediation-tdd/plan.md#completion-evidence).

The ugly truth: several failures were painfully basic contract breaks, not exotic
edge cases. Game clients used the default Socket.IO namespace while the server
listened on `/games`; soft-delete set `deletedAt` while serving and fork routes
ignored it; the importer trusted archive-declared inflated sizes. Those are
exactly the seams that needed adversarial tests before they reached users.

## What happened

- **2026-06-11, planning/review:** 15 red-team findings were accepted. The team
  rejected phantom in-app auth because the product had none; the documented
  boundary remained reverse-proxy auth. It also narrowed two bad abstractions:
  add seven missing canvas shape cases rather than force incompatible SVG-string
  and JSX geometry sources together, and export games as a labeled static box
  rather than pretend heterogeneous game state had one faithful snapshot.
- **11:53 — Phase 1, `f90454e8`:** repaired game traffic by moving both hooks to
  `/games`, aligned `gameId`/`answerIndex`/`timeSpentMs`, introduced stable
  `playerId`/`hostPlayerId`, rejected duplicate answers, and added reconnect-aware
  room cleanup. The socket-layer regression suite is [here](../../server/services/game-socket-end-to-end.test.js).
- **13:37 and 14:18 — Phase 2, `faba2c2e`, `f2a4b73a`:** centralized
  `findServeablePresentation` so deleted decks were refused across serving,
  export, duplication, fork, GitHub, and share-token sinks; made share mutations
  atomic; preserved omitted AI secrets; created a pre-restore snapshot; and
  pinned validated SSRF connections instead of letting fetch re-resolve DNS.
- **15:42 — Phase 3, `183a8933`:** escaped and tightened markdown links,
  measured actual ZIP entry inflation with per-entry and cumulative budgets,
  capped the parser worker heap, and gated every background URL scheme. Evidence
  includes the [zip-bomb regression test](../../server/services/pptx-import/zip-bomb-guard.test.js).
- **16:55 and 18:49 — Phases 4–5, `348fc733`, `09c5c39c`:** restored canvas/export
  parity for seven shapes and `auto` colors, exported timeline images and a game
  placeholder, then consolidated rasterization so one bad element becomes a
  placeholder rather than killing the deck. The Phase 5 dependency on Phase 4
  was made explicit in the [phase record](../archive/260611-0902-monorepo-review-remediation-tdd/phase-05-export-pipeline-robustness.md).
- **19:19, 21:23, and 22:18 — Phases 6–8, `00c53d8e`, `2361598e`, `405b2a2d`:**
  scoped annotations per slide and reaped orphaned live rooms; fixed vertical
  child-slide replace, multi-select arrange, redo parity, and ribbon mixed state;
  then closed security-adjacent low findings including bcrypt handling, SVG byte
  sniffing, Electron navigation guards, atomic upload-hash writes, and line/CSS
  correctness. The corresponding [phase records](../archive/260611-0902-monorepo-review-remediation-tdd/phase-06-live-presentation-realtime.md), [Phase 7](../archive/260611-0902-monorepo-review-remediation-tdd/phase-07-editor-ui-controls.md), and [Phase 8](../archive/260611-0902-monorepo-review-remediation-tdd/phase-08-medium-low-cleanup-sweep.md) record the scope.
- **2026-06-12 — `72efbf7b`:** the plan was marked complete after nine focused
  implementation commits.

## Impact

The work closed the recorded critical paths and replaced untested assumptions
with regression tests at the relevant boundaries. The final historical gate
record is: `npm run test` **2474 passed, 0 failed, 1 skipped**; `npm run lint`
had **0 errors** and **23 pre-existing benchmark-script warnings**; `npm run build`
passed; PPTX corpus and browser-audit gates passed for the import/export phases.

That is real relief, but not a license to claim timeless health: these results
were recorded on 2026-06-12, not re-run for this archival journal on 2026-07-22.

## Decisions

- Keep game traffic isolated on `/games`; moving the server to the default
  namespace was rejected because live timer events already occupy it.
- Keep multi-user auth at the reverse proxy; creating a pretend app-auth layer
  would have changed scope without supplying a real identity model.
- Use a serve-guard instead of mutating share tokens on soft-delete, avoiding
  token loss when a deck is restored.
- Prefer targeted shape cases and a labeled game export placeholder over risky
  or fabricated abstractions.

## Concerns / limitations

- Vertical-child Find/Replace data coverage is fixed, but jump-focus UX still
  needs `childIndex` end-to-end wiring.
- Electron navigation hardening and late-save unmount handling had review and
  available-test coverage, but the completion record still recommends manual
  desktop smoke testing.
- Three cosmetic low-priority items were intentionally logged as won't-fix with
  rationale in Phase 8; this journal does not reclassify them.
- **Unresolved questions:** None in the completed plan. This journal ran no new
  validation and makes no claim about later changes.

## Next

- **Owner: coordinating agent, 2026-07-22.** Archive the completed plan only
  after retaining this journal and its git history as evidence.
- **Owner: future maintainers, when touching these areas.** Re-run focused tests
  and perform the deferred child-slide UX and Electron manual smoke checks rather
  than treating this historical green run as proof of current behavior.
- AgentWiki publication was intentionally skipped: outward sharing was not
  authorized; this local journal is the source of truth for the archival note.
