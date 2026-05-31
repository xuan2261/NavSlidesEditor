---
title: "EditorPage Hardening And God-Component Refactor TDD"
description: "Fix 3 EditorPage defects (dead present wiring, useless AI round-trip, unfinished vertical slides), split the 2071-LOC god-component into focused hooks, and complete first-class vertical slide support — all behind a characterization test net, TDD per phase."
status: completed
priority: P1
branch: "master"
tags: [frontend, refactor, editor, tdd, regression, ai, vertical-slides]
blockedBy: []
blocks: []
related_plans:
  - 260523-0500-upstream-parity-verification-tdd (in_progress P0 — edits/tests EditorPage parity; Phases 4-5 here are extraction but Phase 6 ADDS behavior + reorders mutation routing, so this is NOT pure-extraction; both plans touch the same 2071-LOC file → line-ref + merge collision risk. Cross-reference + anchor instructions to symbols not line numbers; if P0 lands first, re-map line refs before executing. See Red Team #7.)
created: "2026-05-29T15:57:52.448Z"
createdBy: "ck:plan"
source: skill
mode: "--deep --tdd"
---

# EditorPage Hardening And God-Component Refactor TDD

## Overview

`client/src/pages/EditorPage.jsx` is 2071 LOC (10× the 200-LOC project cap) and carries three verified defects from the code review:

- **VĐ1 — Partly-dead present wiring.** `isPresenting` (`:227`) is never set `true` (only `false` at `:1162`), so the **`presentation`-scope** shortcuts (B/W screen, F5, arrows, pen/laser, end-slideshow) can never fire → `BlackScreenOverlay`/`AnnotationToolbar` are genuinely unreachable. **BUT the `presentation-game`-scope shortcuts are NOT dead:** `use-keyboard.js:42` activates them whenever `activeGameType` is truthy (independent of `isPresenting`), and EditorPage feeds `activeGameType={currentGameType}` (`:1152`), non-null when a game element is on-slide. So `G`→`GameHudOverlay` / `L`→`GameLeaderboardOverlay` ARE reachable in the editor (locked by existing test `game-presenter-keyboard-shortcut-handler.test.js:168`). Present actually works via `presentInWindow` → separate tab (reveal.js native). The overlay components also run for real in `LiveViewPage`/`SpeakerViewPage`. **Fix: remove only the `presentation`-scope dead wiring; KEEP game-scope wiring + overlays.**
- **VĐ2 — Useless AI round-trip.** `onCreatePresentation` (`:1767-1801`) POSTs to `/api/ai/generate-slides`, which does NOT call AI — it maps the client's own `outline` to `<section>` HTML strings (`server/routes/ai.js:175-205`). The client then ignores `data.slides` and rebuilds slides from `outline` anyway. Net: a pointless network round-trip; comment at `:1777` is also wrong.
- **VĐ3 — Unfinished vertical slides.** `onAddVerticalSlide` (`:1498`) adds `slide.children`; `SlidePanel.jsx:413-450` already renders them and accepts `onSelectVertical`/`currentVerticalIndex`. But EditorPage never passes those props and the canvas only renders top-level `currentSlide` (`:392`) — so a created child slide can never be edited.

**Locked decisions:** VĐ1 → remove only the `presentation`-scope dead wiring; KEEP reachable game-scope wiring + shared components (Live/Speaker). VĐ2 → fix client-side now (with field escaping) + define a client↔server slide-element contract WITH runtime validation (schema + safe-`type` allowlist + sanitization) as a roadmap seed (no heavy AI build this round). VĐ3 → keep and fully implement vertical slides (full op matrix retained per user decision — see Red Team #11/#12). God-component split happens this round (Phase 4 extends the EXISTING `ui-store` rather than adding a new modal hook), gated by a characterization test net (Hybrid: own snapshot tests first, do not block on the P0 parity plan). **Net behavior change (not pure-extraction): Phase 6 adds vertical-edit behavior + generalizes element mutation routing.**

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Characterization Test Harness](./phase-01-characterization-test-harness.md) | Complete |
| 2 | [Remove Dead Present Wiring](./phase-02-remove-dead-present-wiring.md) | Complete |
| 3 | [AI Slides Fix And Contract](./phase-03-ai-slides-fix-and-contract.md) | Complete |
| 4 | [Centralize Modal State In ui-store](./phase-04-extract-modal-state-hook.md) | Complete |
| 5 | [Extract Export And AI Hooks](./phase-05-extract-export-and-ai-hooks.md) | Complete |
| 6 | [Vertical Slide Full Support](./phase-06-vertical-slide-full-support.md) | Complete |
| 7 | [Verification And Docs](./phase-07-verification-and-docs.md) | Complete |

## Dependencies

Sequential chain: 1 → 2 → 3 → 4 → 5 → 6 → 7.

- Phase 1 is the safety net; every later phase runs its suite as a regression gate. **Its strength depends on the renderability spike (Red Team #4) — if EditorPage needs heavy child-stubbing in jsdom, Phases 4-5 lean on mandatory browser smoke, not "tests are the contract."**
- Phases 2-3 are behavior fixes (small surface) done before extraction so the net covers the fixed state. Phase 2 splits dead vs reachable wiring; Phase 3 adds field escaping + contract validation (security).
- Phases 4-5 are extraction with NO intended behavior change — characterization tests (+ browser smoke if the net is stubbed) are the contract. Phase 4 extends the existing `ui-store`; Phase 5 extracts handler clusters (single-call-site closures are an acknowledged lateral-move trade-off, scope kept per user — Red Team #11).
- Phase 6 adds NEW behavior (vertical editing) + generalizes ALL element mutation routing via `mapActiveSlide` (broad surface — clipboard/media/inline-dup writers included, Red Team #1) with its own RED→GREEN tests.
- Phase 7 = full suite + lint + build + browser smoke + docs sync.

Cross-plan: `260523-0500-upstream-parity-verification-tdd` (P0, in_progress) edits/tests EditorPage parity on the same 2071-LOC file. This refactor is **NOT pure-extraction** (Phase 6 is additive behavior + mutation-routing change), so parity sign-off is not automatic. We cross-reference only and do not modify that plan's frontmatter (avoid surprising its active executor), BUT: anchor instructions to symbol names not line numbers where possible, and if P0 lands first, re-map this plan's `:NNN` citations before executing (Red Team #7).

<!-- Updated: Validation Session 1 — sequencing LOCKED -->
**SEQUENCING GATE (LOCKED, Validation Session 1):** Do NOT start execution until the P0 parity plan (`260523-0500`) has LANDED. P0 outranks this P1 plan and owns the shared file first; concurrent execution risks merge collision + stale line refs. As of 2026-05-30 the file is still 2071 LOC (P0 not landed) so all `:NNN` citations here are currently accurate. **Pre-execution step (mandatory):** once P0 lands, re-grep every keystone anchor (`isPresenting`, `onCreatePresentation`, `ui-store` modal flags, `htmlGenerator` children, flat `verticalIndex`) and re-map all `:NNN` citations across plan.md + phase-01…07 before Phase 1 begins. Do NOT pause or claim P0 (would block higher-priority work).

## Key Constraints

- Every new hook/file < 200 LOC. EditorPage is a top-level orchestrator page; the 200-LOC cap is NOT reachable in one round without decomposing it into sub-panel components (out of scope). Honest target: **2071 → ≤ ~1330 LOC (~35% cut)** via the extractions below — element-creation callbacks, modal state (into existing `ui-store`), modal-mount JSX, export/AI handlers. Note this still leaves the file ~6.5× over cap — the cut is partial by design (Red Team #3/#11 acknowledged; full sub-panel decomposition is a follow-up).
- LOC math (revised after Red Team): present wiring **−~45** (P2 — revised down from −75 because reachable game-scope wiring + its two overlays STAY, Red Team #1/#5), element-creation callbacks `:563-843` −~200 (P5), modal state −~22 (P4 — boolean flags into `ui-store`; payload modals stay local), scattered modal-mount JSX blocks → `<EditorModals>` −~350 (P4, EXCLUDING the ~195-line editor body at `:1469-1664` which stays inline), export+AI handlers −~170 (P5); vertical slide +~70 (P6 — `mapActiveSlide` + writer routing + converter + reconciliation, up from +50). Net ≈ 2071 − 787 + 70 ≈ **~1350** (target range ~1300-1360; floor rose because game wiring is not dead).
- No INTENDED behavior change in Phases 4-5 — characterization snapshot/interaction tests (+ browser smoke if Phase 1's net is stubbed per Red Team #4) are the contract. Phases 2-3 and 6 DO change behavior (deliberately) and carry their own RED tests.
- Keep shared overlay components untouched (Live/Speaker depend on them); keep reachable game-scope wiring (Red Team #1).
- Security invariant (Red Team #8/#9/#15): all slide `content` reaching state must be escaped/sanitized — outline-built fields escaped (P3), server `elementSlides` validated + type-allowlisted (P3), AITranslate output sanitized (P5), migrated `child.html` sanitized (P6). No raw user/AI HTML reaches an executable sink.
- `--tdd`: each phase is RED (failing test) → GREEN (minimal change) → REFACTOR (+ regression guard).

## Red Team Review

### Session — 2026-05-30
**Reviewers:** 4 (Assumption Destroyer, Security Adversary, Scope & Complexity Critic, Failure Mode Analyst) — Full verification tier (`--deep`).
**Findings:** 15 (after dedup/cap) — 13 accepted-and-applied, 2 acknowledged trade-offs (scope kept per user decision).
**Severity breakdown:** 4 Critical, 7 High, 4 Medium.
All findings carried `file:line` codebase evidence (none auto-rejected on the evidence filter). The two keystone Criticals (ui-store reuse, Phase-2 reachable game wiring) were independently re-verified against source before adjudication.

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Mutation routing incomplete — clipboard/media-insert/inline-dup writers not enumerated → write to parent while child active | Critical | Accept | Phase 6 |
| 2 | Phase 4 reinvents the existing tested `ui-store` modal system | Critical | Accept | Phase 4 |
| 3 | Phase 2 premise false — game-scope G/L shortcuts reachable via `activeGameType`, not dead | Critical | Accept | Phase 2, plan.md |
| 4 | Phase 1 renderability unproven — no EditorPage test ever rendered it (TipTap/`?raw`/KaTeX jsdom risk) | Critical | Accept | Phase 1 |
| 5 | `currentVerticalIndex` not reconciled on slide reorder + undo/redo → stale index → crash | High | Accept | Phase 6 |
| 6 | `{parent,child}` model collides with existing flat `verticalIndex` (socket/live/export) | High | Accept | Phase 6 |
| 7 | "Pure-extraction" rationale false (Phase 6 additive); line-ref + merge collision with in-progress P0 plan | High | Accept | plan.md |
| 8 | "Byte-identical" criterion locks the unescaped builder, blocks hardening | High | Accept | Phase 3 |
| 9 | Contract `elementSlides ??` is an unvalidated server→content trust path into scripts-enabled sinks | High | Accept | Phase 3 |
| 10 | Fake-timer autosave assertion misses async `processSaveQueue` microtask → flaky/false dedup test | High | Accept | Phase 1 |
| 11 | Extraction effort/value — Phase 5 wraps single-call-site closures; ~1300 still 6.5× over cap | High | Acknowledged (scope kept) | Phase 5, plan.md |
| 12 | Vertical = new feature in hardening plan + relocate-then-rewrite of `addElement` (P5→P6) | Medium | Seq fix Accepted; descope Acknowledged (kept) | Phase 5, Phase 6 |
| 13 | Vertical export already implemented (`htmlGenerator.js:142-157`) — demote to lock test | Medium | Accept | Phase 6 |
| 14 | SlideCanvas not "just works" — chrome props (page#/section/footer) parent-derived | Medium | Accept | Phase 6 |
| 15 | Untrusted-content boundaries unflagged — migrate `child.html`, AITranslate, route-escaping port, raw `fetch` | Medium | Accept | Phases 3/5/6/7/1 |

**User decisions (rules: guard locked decisions against audit/YAGNI drift):**
- #11 + #12-descope recommended cutting the full god-component split and the full vertical op-matrix — both LOCKED decisions. User chose **Keep locked scope**; applied as acknowledged trade-off annotations, not cuts.
- #12-sequencing (do behavior change before/with extraction) is an ordering optimization, not a scope cut → applied as a note (kept 1→…→6 order).
- #9 left branch (`elementSlides`) is dead this round → accepted as a *documented validation guard on the seam*, not new build work (consistent with the plan's own YAGNI mitigation).

### Whole-Plan Consistency Sweep
- Files reread/grepped: plan.md, phase-01 … phase-07 (all 8).
- Decision deltas checked: 10 (VĐ1 dead→split, Phase-4 new-hook→`ui-store` reuse, byte-identical→escaped output, typedef→runtime-validated contract, 3-writer→all-writer mutation routing, index reconciliation +reorder/+undo, `{parent,child}` vs flat `verticalIndex` naming, export build→lock-test, pure-extraction rationale dropped, LOC target ~1300→~1350).
- Reconciled stale references: 8 (Phase 4 frontmatter title + plan.md phases-table row + Phase 7 codebase-summary note → "Centralize Modal State In ui-store"/`use-element-creation`; Phase 4 `~25`→`~22` useState; Phase 5 ×2 + Phase 7 ×2 LOC targets `~1300`→`~1350`).
- Intentional historical references retained (not stale): plan.md LOC line keeps "revised down from −75 / up from +50" to explain the change; Red Team table row #11 cites the original ~1300 criticism; phase-04 success criterion explicitly states "NO new `use-editor-modals` hook"; phase-06/plan.md "just works" appears only inside finding #14 text and the corrected "do NOT assume" instruction.
- Unresolved contradictions: 0 — plan is internally consistent and ready for implementation.

## Validation Log

### Session 1 — 2026-05-30

**Verification Results** (validate guard: `## Red Team Review` already present with evidence → drift-only re-check, not full re-verify)
- Claims spot-checked: 7 keystone anchors against live source.
- Verified: 7 | Failed: 0 | Unverified: 0
- Tier: Full (5+ phases) — limited to drift check per guard.
- Evidence: `EditorPage.jsx` = 2071 LOC (matches plan); `isPresenting` decl `EditorPage.jsx:227`; `onCreatePresentation`+`fetch('/api/ai/generate-slides')` `:1767`/`:1769`; `ui-store.js` `openModal:44`/`toggleModal:46`/`showGithubModal:17`; `htmlGenerator.js:142-143` vertical children; flat `verticalIndex: childIndex + 1` `socket-handler.js:63`.
- **No line drift:** the in-progress P0 parity plan has NOT landed (file still 2071 LOC), so all `:NNN` citations are currently accurate.

**Decisions confirmed** (user answered "đề xuất cho tôi" → my recommendation adopted on each)

1. **Cross-plan sequencing (Q1) → LOCKED: Wait for P0, then re-map line refs.**
   Rationale: P0 (`260523-0500`, P0, in_progress) outranks this P1 plan and edits the same 2071-LOC file; concurrent execution risks merge collision + stale `:NNN` refs (Red Team #7). File still 2071 LOC ⇒ nothing lost by waiting. Before executing, re-grep all `:NNN` citations and re-map if P0 changed the file. Do NOT pause/claim P0 (would block higher-priority work). → propagated to Dependencies note.

2. **Vertical addressing model (Q2) → LOCKED: parent-by-id (resolve index at read time).**
   Rationale: matches plan's stated preference (#5); reorder needs no `currentVerticalIndex.parent` re-point (free stability); removes an entire stale-index crash class. `currentVerticalIndex` keeps the `{parent,child}` SHAPE for the `SlidePanel` prop, but the active parent is tracked by slide `id` internally; `parent` index resolved on read. → propagated to phase-06.

3. **`/api/ai/generate-slides` route (Q3) → LOCKED: keep + annotate deprecated; do NOT delete this round.**
   Rationale: grep proves zero in-repo callers, NOT zero external HTTP clients (app is self-hostable). Phase 3 already ports the route's `escapeHtml` into `buildSlidesFromOutline`, so stopping internal use loses nothing. Reversible; resolves the Phase 3 (defer) ↔ Phase 7 (delete) internal tension toward the safer stance. Hard deletion deferred to a future release after confirming no external traffic. → propagated to phase-07.

**Phase propagation:** Dependencies note (Q1), phase-06 Architecture + Success Criteria (Q2), phase-07 Remove-list + Implementation Step 6 + Success Criteria (Q3).

**Recommendation:** Verification Failed: 0 → plan eligible for implementation once P0 lands and line refs are re-mapped (Q1).

### Whole-Plan Consistency Sweep — Validation Session 1
- Files reread/grepped: plan.md, phase-01 … phase-07 (all 8).
- Decision deltas propagated: 3 (Q1 sequencing gate → plan.md Dependencies; Q2 parent-by-id → phase-06 Architecture/CRUD/test/risk/success ×5; Q3 route kept → phase-03 ×3, phase-07 ×4).
- Stale references reconciled after propagation: 6 — phase-06 parent-by-id hedges ("if adopted / if kept index-based / id-based OR resets / reconcile on ALL four triggers" ×4 → collapsed to LOCKED parent-by-id, reorder reconciliation-free); phase-03 ×2 ("slated for Phase 7 removal", "survives the Phase 7 route deletion" → route deprecated-not-deleted).
- Verification greps: route-delete residue = 0; parent-by-id hedges = 0.
- Unresolved contradictions: 0 — plan remains internally consistent after all three locked decisions.
