---
title: "Feature Coverage Traceability Matrix System (editor-core, TDD)"
description: "Living system that auto-inventories every editor-core capability (elements, controls, canvas ops, shortcuts, flows), maps each to the test(s) verifying it via [cap:*] title tags, emits a Markdown+JSON visibility matrix (PASS/FAIL/GAP/DEEP-GAP), and gates CI with a shrinking allowlist + drift guard. Answers 'làm sao biết toàn bộ chức năng/elements/controls chạy đúng' by making gaps VISIBLE first, then closing them by tier (smoke floor + deep for high-risk)."
status: completed
priority: P2
branch: "master"
tags: [qa, testing, traceability, ci, coverage, tdd, editor-core, visibility]
blockedBy: []
blocks: []
created: "2026-05-30T01:54:45.976Z"
createdBy: "ck:plan"
source: skill
mode: "--deep --tdd"
---

# Feature Coverage Traceability Matrix System (editor-core, TDD)

## Origin

From brainstorm session 2026-05-30 answering *"làm sao để tôi biết toàn bộ chức năng, các elements, controls chạy đúng chức năng logic, flow"*. Brainstorm converged on a 4-pillar decision:

1. **Visibility map** — auto-generated matrix listing every capability × its verifying test × status. The artifact that lets you SEE gaps.
2. **Scope** — editor-core first (19 elements + ribbon controls + canvas ops + undo/redo/clipboard). Live/game/PPTX/AI deferred.
3. **Depth** — two tiers: smoke floor (renders, basic op no-crash, persists) for everything; deep behavior tests for high-risk items only.
4. **Living system + CI gate** — matrix self-updates, drift guard fails build when a new element/control lands without a test; adoption via shrinking allowlist (warn-first, not hard-block day 1).

**The hard truth (carried from brainstorm):** "100% correct" is not a deliverable. This system delivers *visibility into what is and isn't verified* + a *forcing function* to close gaps. Coverage % measures "did code run"; this matrix measures "is the capability's behavior asserted" — a different, more useful signal.

## Relationship to existing plans

| Plan | Status | Relation |
|---|---|---|
| `260522-1339-qa-confidence-uplift-5-phase-tdd` | pending (MVP) | **This IS its deferred follow-up.** That plan's "Deferred items" blueprint explicitly lists "Full feature × test layer matrix", "matrix-to-checklist generator", "per-glob coverage thresholds". This plan delivers the matrix half. **Independent** — does not block on MVP (auto-sources from registries, needs no golden-path doc). Cross-referenced, runs in parallel. |
| `260519-1200-comprehensive-test-coverage-expansion` | completed | Wired the CI coverage gate + thresholds in `vitest.config.mjs`. Phase 6 here adds a SEPARATE capability gate, does not touch coverage thresholds. |
| `260529-2256-editorpage-hardening-refactor-tdd` | pending | Touches `EditorPage.jsx` (where command-palette array lives, line 904). Phase 1 reads that array read-only; if refactor extracts it to a module, Phase 1 inventory source path updates. No hard block — note as soft coupling. |

## Architecture (locked decisions)

Decided in brainstorm + plan kickoff (2026-05-30):

| Decision | Choice | Rationale |
|---|---|---|
| Plan relationship | **Independent follow-up** | Auto-sourcing means no dependency on MVP golden-path doc |
| Feature→test link | **Tag in test title `[cap:<id>]`** | Cheapest, self-documenting, greppable; declares verify-INTENT not just code-execution |
| CI gate strictness | **Warn + shrinking allowlist** | Adopt incrementally; never hard-block the team on day 1 |
| Matrix output | **Markdown + JSON** | Markdown = human-readable, git-diffable; JSON = CI consumption. No HTML dashboard (YAGNI) |

### Capability ID namespace

```
element.<type>        e.g. element.chart, element.timeline       (auto: ELEMENT_DEFAULTS)
shortcut.<id>         e.g. shortcut.group, shortcut.rotate        (auto: DEFAULT_SHORTCUTS)
renderer.<type>       e.g. renderer.svg                           (auto: elementRendererRegistry, cross-check)
canvas.<op>           e.g. canvas.rotate-snap, canvas.zorder      (manual manifest)
control.<tab>.<name>  e.g. control.format.bold                    (manual manifest)
command.<id>          e.g. command.insertSlide                    (manual manifest; array in EditorPage.jsx)
flow.<name>           e.g. flow.undo-redo, flow.autosave          (manual manifest)
```

### Data flow

```
[auto sources]                          [manual source]
ELEMENT_DEFAULTS ─┐                      feature-manifest.yaml
DEFAULT_SHORTCUTS ─┼─► build-inventory.mjs ◄──────┘
registry.js keys ─┘            │
                               ▼
                        inventory.json  (canonical: every capability that MUST exist)
                               │
test files ──► extract-tags.mjs ──► tags.json  ([cap:*] occurrences + which spec/suite)
                               │
vitest json ──────────────────┤  (pass/fail per test, optional cross-check)
                               ▼
                        build-matrix.mjs
                               │
                ┌──────────────┴───────────────┐
                ▼                               ▼
   feature-coverage-matrix.md          feature-coverage-matrix.json
   (human visibility map)              (CI gate input)
                                               │
                                               ▼
                                     check-coverage-gate.mjs ──► warn / fail (allowlist-aware)
```

### Status semantics (per capability row)

**Run-status is MANDATORY (decided 2026-05-30, red-team CRITICAL #1).** PASS requires a test that ACTUALLY RAN GREEN — never inferred from a tag alone. A skipped/empty/stub test must never show PASS (that manufactures the exact false confidence this system exists to eliminate). Matrix builder joins tags against vitest `--reporter=json` (+ Playwright JSON for e2e) run results.

| Status | Meaning |
|---|---|
| `PASS` | ≥1 tagged test exists AND its last run PASSED (verified against run JSON) |
| `FAIL` | tagged test exists but last run FAILED |
| `SKIP` | tagged test exists but was skipped (`it.skip`/`test.skip`/`.fixme`) — NOT counted as verified |
| `TAGGED` | tag exists but no run result joined yet (run JSON missing for it) — treated as unverified, never green |
| `GAP` | no `[cap:<id>]` tag found anywhere (invisible / unverified) |
| `DEEP-GAP` | capability `risk: high` + has smoke tag but no `tier:deep` tag |
| `ALLOWED` | GAP/DEEP-GAP/SKIP/TAGGED but on allowlist (acknowledged debt, not yet a build failure) |
| `ORPHAN-TAG` | tag references an id not in inventory (stale tag — warn/fail) |

Only `PASS` counts toward "verified". `SKIP` and `TAGGED` are explicitly NOT verified — they surface as un-green so a skipped test can never hide a regression.

### Test layers scanned (decided 2026-05-30, red-team HIGH #3)

**e2e Playwright specs are scanned BY DEFAULT**, not opt-in. Most existing element coverage lives in `tests/e2e/elements/*` (10 specs). Scanning unit-only would falsely mark those elements GAP and trigger duplicate smoke tests in Phase 4. Each tag carries a `layer` (`unit`|`integration`|`e2e`) for transparency. Run-status for e2e joins Playwright's JSON reporter.

## Phases

| Phase | Name | Effort | Priority | Status |
|-------|------|--------|----------|--------|
| 1 | [Inventory Generator & Manifest](./phase-01-inventory-generator-manifest.md) | 2d | P1 | Completed |
| 2 | [Tag Extraction & Matrix Builder (with run-status join)](./phase-02-tag-extraction-matrix-builder.md) | 2d | P1 | Completed |
| 3 | [Tag Retrofit (editor-core + shortcuts, e2e + unit)](./phase-03-tag-retrofit-editor-core.md) | 1.5d | P2 | Completed |
| 4 | [Smoke Floor for Gaps](./phase-04-smoke-floor-for-gaps.md) | 2.5d | P2 | Completed |
| 5 | [Deep Behavior Tests (high-risk)](./phase-05-deep-behavior-tests-high-risk.md) | 2.5d | P2 | Completed |
| 6 | [CI Gate Allowlist & Drift Guard (elements + controls)](./phase-06-ci-gate-allowlist-drift-guard.md) | 1.5d | P1 | Completed |

**Total effort:** ~12 dev-days (test-writing only). **Bug-fix budget is SEPARATE** (decided 2026-05-30, red-team HIGH #4b): Phases 4/5 will surface real defects; fixing them is tracked + estimated independently, NOT inside the test-writing effort above. Phases 1-2 deliver the visibility map (the core ask). Phases 3-5 close gaps. Phase 6 makes it a living system.

### Shortcut handling (decided 2026-05-30, red-team HIGH #4)

All 44 `DEFAULT_SHORTCUTS` enter the inventory AND the gate denominator. Phase 3 retrofit-tags them against existing keyboard tests (`use-keyboard`, `slideshow-presentation-mode-keyboard-navigation-shortcuts-handler.test.js`, shortcut-registry tests) so the allowlist does NOT start with 44 permanent entries. Shortcuts genuinely untested after retrofit get a smoke test in Phase 4 or a dated allowlist entry — not a silent pass.

## Execution order

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 6
(inventory) (matrix)    (retrofit)  (smoke)  ┌─►(CI gate)
                                    Phase 5 ─┘
                                    (deep, // with 4)
```

Phase 1 → 2 strict (matrix needs inventory). Phase 2 emits first matrix → **gaps become visible here** (earliest value). Phase 3 (tag existing tests) before 4/5 so the matrix reflects reality before writing new tests. Phase 4 (smoke) and Phase 5 (deep) can run in parallel — different test files. Phase 6 last (gate needs a stable matrix + populated allowlist).

## Non-negotiables (TDD)

- **TDD per phase**: each phase starts with a failing test commit (`red:` prefix) → implementation (`green:`) → cleanup (`refactor:`). Verify via `git log`.
- **File size ≤ 200 LOC** per `CLAUDE.md`. Scripts split by responsibility (inventory / extract / matrix / gate are separate files).
- **No plan refs in code/test names** per `review-audit-self-decision.md` rule 5. Tags use stable capability IDs (`[cap:element.chart]`), NOT phase numbers. Test names describe scenario.
- **DRY source-of-truth**: inventory auto-sources from existing registries; never hardcode the 19 element types — import `ELEMENT_DEFAULTS`.
- **Scripts are pure Node ESM** (`.mjs`), dependency-light. Dynamic-import only pure-data modules; parse JSX-importing files (registry.js) by regex, do not execute.

## Success Criteria (plan-level)

- [x] `npm run matrix` regenerates `plans/.../reports/feature-coverage-matrix.{md,json}` from live sources (also promotes to `docs/feature-coverage-matrix.md`)
- [x] Matrix lists every `ELEMENT_DEFAULTS` key + every `DEFAULT_SHORTCUTS` id + all manifest capabilities, each with a status (100 editor-core caps; `element.game` excluded as game-scope)
- [x] Adding a key to `ELEMENT_DEFAULTS` with no `[cap:*]` test → drift guard test goes red (verified by intentional break + revert, see `reports/ci-gate-intentional-break-verification.md`)
- [x] Every editor-core capability is PASS or on a dated allowlist entry (no silent GAP) — 73 PASS + 27 ALLOWED, gate green
- [~] High-risk capabilities have `tier:deep` tests asserting real behavior: DONE for rotate-snap, resize-aspect, group, align, distribute, clipboard, multiselect, table-merge. DEFERRED for z-order, undo/redo, chart-mapping, timeline-scaling (no clean pure seam today — inline in EditorPage/renderers; dated allowlist entries + extraction path recorded in `reports/deep-test-findings.md`)
- [x] CI runs `check-coverage-gate.mjs`: warns on allowlisted gaps, fails on un-allowlisted/new gaps (warn-first, non-required job; `gh` flip command documented)
- [x] Each phase shows `red:`→`green:`→`refactor:` commit sequence in `git log`

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Manual manifest incomplete → capabilities stay invisible | H | H | Auto-source everything with a registry; manifest only for registry-less ops. Phase 1 cross-checks ribbon `data-testid` + README shortcut table to seed manifest. Drift guard catches new auto-sourced items. |
| Tag "lies" — `[cap:*]` present but assertion empty | M | M | Phase 5 deep tests require real assertions. Optional vitest-json cross-check: tag claims PASS but maps to 0 assertions → flag. Don't over-engineer (YAGNI) — manual review in Phase 3 retrofit. |
| Node can't import client ESM (lucide/JSX deps) | M | H | Generator dynamic-imports only pure-data files (`element-defaults.js`, shortcut registry — verified no non-data imports). `registry.js` keys extracted via regex (no execution). |
| command-palette array not importable (inline in EditorPage.jsx:904) | M | L | Treat as manual manifest entries; note soft coupling to `260529-2256` refactor. If extracted later, switch to auto-source. |
| Allowlist becomes permanent dumping ground | M | M | Allowlist entries require `reason` + `added` date; Phase 6 gate warns on entries older than N days. Review each sprint. |
| Scope creep into live/game/PPTX | M | M | Manifest `scope: editor-core` filter; out-of-scope capabilities explicitly excluded, documented. |
| `EditorPage.jsx` refactor (parallel plan) moves command array | L | L | Phase 1 cites `EditorPage.jsx:904` as of 2026-05-30; if moved, update one source path constant. |

## Out of scope

- Live presentation, game mode, PPTX import/export, AI tools, share/sync capabilities (separate future round — manifest `scope` field reserves the namespace)
- HTML dashboard (Markdown+JSON only)
- Coverage threshold changes in `vitest.config.mjs` (owned by `260519-1200` plan)
- Refactoring `EditorPage.jsx` / `HomePage.jsx` (separate epic)
- E2E/Playwright capability tags in Phase 1-3 (unit/integration tags first; e2e tag retrofit is a Phase 3 stretch, gated by time)

## Open Questions

All major forks resolved in red-team + validation (2026-05-30):

1. ~~e2e tags too?~~ → **RESOLVED: scan e2e by default**, tag with `layer` label. Element coverage lives in e2e.
2. ~~Run-status now or defer?~~ → **RESOLVED: run-status MANDATORY in Phase 2.** No tag-only PASS.
3. ~~Shortcuts in gate?~~ → **RESOLVED: include all 44**, retrofit-tag in Phase 3, smoke/allowlist remainder.
4. ~~Effort + bug budget?~~ → **RESOLVED: ~12d test-writing, bug-fix budget SEPARATE.**
5. Allowlist staleness threshold (warn if entry older than X days)? — *Proposed: 30 days. Final tweak during Phase 6.*
6. Long-term matrix home — `plans/.../reports/` during build-out → promote to `docs/feature-coverage-matrix.md` in Phase 6. *Confirmed.*
7. `yaml` dep vs flat-JSON manifest — *Proposed: `yaml` (tiny, maintained). Switch to JSON if zero-new-dep is required. Decide at Phase 1 start.*
