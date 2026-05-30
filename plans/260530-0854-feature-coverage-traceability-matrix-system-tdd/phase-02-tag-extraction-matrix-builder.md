---
phase: 2
title: "Tag Extraction & Matrix Builder"
status: completed
priority: P1
effort: "2d"
dependencies: [1]
---

# Phase 2: Tag Extraction & Matrix Builder

## Overview

Scan all test files for `[cap:<id>]` tags, join against `inventory.json` and (optionally) vitest run results, and emit the visibility map: `feature-coverage-matrix.md` (human) + `feature-coverage-matrix.json` (CI). **This phase produces the first matrix — the moment gaps become visible.** Highest-value deliverable of the plan.

## Requirements

- **Functional**
  - `extract-tags.mjs`: walk test files (`client/src/**/*.test.{js,jsx}`, `server/**/*.test.js`, `shared/**/*.test.js`, **AND `tests/e2e/**/*.spec.js` by default** — red-team HIGH #3), regex `\[cap:([a-z0-9.\-]+)\]` from `describe`/`it`/`test` titles, detect `tier:deep` marker, and detect skipped tests (`it.skip`/`test.skip`/`describe.skip`/`.fixme`). Emit `tags.json`: `{ capId: [{ file, title, tier, layer, skipped }] }` where `layer` ∈ `unit|integration|e2e` (derived from path).
  - **Run-status join is MANDATORY (red-team CRITICAL #1).** `build-matrix.mjs` joins tags against actual run results — vitest `--reporter=json` for unit/integration and Playwright JSON reporter for e2e. A capability is `PASS` ONLY when its tagged test ran AND passed. A skipped or unrun tagged test must NEVER show PASS.
  - Compute status per capability: `PASS` / `FAIL` / `SKIP` / `TAGGED` / `GAP` / `DEEP-GAP` / `ALLOWED` / `ORPHAN-TAG` (full semantics in plan.md). Only `PASS` counts as verified.
  - Markdown output: grouped by category, columns `Capability | Risk | Tier | Layer | Test(s) | Status`, summary header (counts per status + % verified where verified = PASS only).
  - JSON output: machine-readable array mirroring rows, for the gate.
- **Non-functional**
  - Deterministic ordering. Markdown stable across runs (git-diffable).
  - Scripts ≤ 200 LOC each; `extract-tags.mjs` and `build-matrix.mjs` separate files.
  - Output path: `plans/260530-0854-feature-coverage-traceability-matrix-system-tdd/reports/feature-coverage-matrix.{md,json}` during build-out (promote to `docs/` in Phase 6).

## Architecture

```
scripts/feature-inventory/
├── extract-tags.mjs     # test files (unit + integration + e2e) → tags.json
├── join-run-status.mjs  # vitest JSON + playwright JSON → run-results.json (pass/fail/skip per test)
├── build-matrix.mjs     # inventory.json + tags.json + run-results.json (+ allowlist) → matrix.{md,json}
└── matrix-format.mjs    # md table rendering (keep build-matrix.mjs lean)
```

**Tag grammar:** `[cap:<id>]` anywhere in the test title string. Deep marker: `[cap:<id> tier:deep]` OR a separate `[tier:deep]` token in the same title. Regex tolerant of both. A title may carry multiple caps (`[cap:canvas.group][cap:canvas.zorder]`). Skip detection: title belonging to an `it.skip`/`test.skip`/`describe.skip`/`.fixme` block → `skipped: true`.

**Run-status join (mandatory):** `join-run-status.mjs` reads vitest `--reporter=json` output (unit/integration) and Playwright's JSON reporter (e2e), keyed by `{file, fullTitle}`, producing per-test `passed|failed|skipped`. `build-matrix.mjs` consumes this — a tag with no joined run result → `TAGGED` (not PASS); skipped → `SKIP`. CI regenerates run JSON fresh; local runs may reuse the last JSON with a staleness note in the matrix header.

**Status decision table (build-matrix):**
```
inventory has cap, tagged test ran + passed       → PASS      (only this counts as verified)
inventory has cap, tagged test ran + failed       → FAIL
inventory has cap, tagged test skipped            → SKIP      (never green)
inventory has cap, tagged but no run result joined → TAGGED   (never green)
inventory has cap, no tag at all                  → GAP
inventory cap risk:high + tiers includes deep,
   has PASS smoke but no tier:deep PASS            → DEEP-GAP
(GAP/DEEP-GAP/SKIP/TAGGED) AND on allowlist        → ALLOWED
tags has cap, inventory missing                   → ORPHAN-TAG (warn)
```

**Markdown sample (the visibility map):**
```
## Feature Coverage Matrix — editor-core — 2026-05-30
Verified: 41/78 (53%)  |  GAP: 30  |  DEEP-GAP: 7  |  FAIL: 0

### element
| Capability        | Risk | Tier  | Test(s)                          | Status |
|-------------------|------|-------|----------------------------------|--------|
| element.chart     | high | smoke | elements/chart-types-smoke.spec  | PASS   |
| element.timeline  | low  | smoke | (none)                           | GAP    |
### canvas
| canvas.rotate-snap| high | deep  | (none)                           | GAP    |
```

## Related Code Files

- **Create:**
  - `scripts/feature-inventory/extract-tags.mjs`
  - `scripts/feature-inventory/join-run-status.mjs`
  - `scripts/feature-inventory/build-matrix.mjs`
  - `scripts/feature-inventory/matrix-format.mjs`
  - `scripts/feature-inventory/extract-tags.test.mjs`
  - `scripts/feature-inventory/join-run-status.test.mjs`
  - `scripts/feature-inventory/build-matrix.test.mjs`
- **Read:** `inventory.json` (Phase 1 output); test files across workspaces incl. `tests/e2e/**` (glob); vitest `--reporter=json` output + Playwright JSON report.
- **Modify:** `package.json` — add:
  - `"matrix": "node scripts/feature-inventory/build-inventory.mjs && node scripts/feature-inventory/extract-tags.mjs && node scripts/feature-inventory/join-run-status.mjs && node scripts/feature-inventory/build-matrix.mjs"` (full regen)
  - A run-results capture step: vitest already supports `--reporter=json --outputFile=...`; Playwright `--reporter=json`. Document how `join-run-status.mjs` locates these (CI writes them fresh; local reuses last with staleness note).

## Implementation Steps (TDD)

1. **`red:`** `extract-tags.test.mjs`: given a fixture test file containing `it('[cap:element.chart] renders bar')`, extractor returns `{ 'element.chart': [{ file, title, tier: 'smoke', layer, skipped: false }] }`; `[cap:canvas.group tier:deep]` → tier `deep`; multiple caps in one title all captured; `it.skip('[cap:x] ...')` → `skipped: true`; e2e spec path → `layer: 'e2e'`. Run → fails.
2. **`green:`** Implement `extract-tags.mjs` (glob incl. `tests/e2e/**` + regex + skip/layer detection). Run → passes.
3. **`red:`** `join-run-status.test.mjs`: given a stub vitest JSON (one test passed, one failed, one skipped) + stub tags, joiner returns per-cap run status keyed by `{file, fullTitle}`. Run → fails.
4. **`green:`** Implement `join-run-status.mjs`. Run → passes.
5. **`red:`** `build-matrix.test.mjs`: feed stub inventory (`element.chart` smoke, `canvas.rotate-snap` high/deep) + tags + run-results → `element.chart=PASS` only when run passed; tagged-but-skipped → `SKIP`; tagged-but-no-run-result → `TAGGED`; failed run → `FAIL`; untagged → `GAP`; high-risk smoke-only PASS → `DEEP-GAP`; unknown-cap tag → `ORPHAN-TAG`. Run → fails.
6. **`green:`** Implement `build-matrix.mjs` + `matrix-format.mjs`. Emit both files. Run → passes.
7. Run `npm run matrix` against the REAL repo (with a real vitest+playwright run) → first real visibility map. Confirm e2e-covered elements (chart/code/shape/text via `tests/e2e/elements/*`) show PASS (not GAP), and a skipped test never shows PASS. This output drives Phase 3-5 scope.
8. **`refactor:`** Extract md rendering to `matrix-format.mjs`; ensure determinism; cap file sizes; header notes run-JSON freshness.

## Success Criteria

- [ ] `npm run matrix` produces `feature-coverage-matrix.md` + `.json` from live inventory + live tags + live run results
- [ ] **No tag-only PASS:** a skipped or unrun tagged test shows `SKIP`/`TAGGED`, never `PASS` (unit-tested across all 8 outcomes)
- [ ] e2e specs scanned by default; e2e-covered elements classify PASS, not GAP (verified against `tests/e2e/elements/*`)
- [ ] Markdown shows summary counts per status + `% verified` computed from PASS only
- [ ] `ORPHAN-TAG` surfaces as warning, not silent
- [ ] First real run classifies ≥1 known-PASS and ≥1 known-GAP correctly (sanity)
- [ ] Commit log: `red:`→`green:`→`refactor:` for extractor, run-status joiner, and matrix builder

## Risk Assessment

- **Run-JSON freshness** → CI regenerates vitest+playwright JSON before building matrix; local reuse flagged with a staleness note in the header so a stale green is never silent.
- **`{file, fullTitle}` join key mismatch** (vitest vs playwright title formats differ) → unit fixtures cover both reporter shapes; normalize titles in `join-run-status.mjs`.
- **Regex over/under-match on titles** → unit fixtures cover multi-cap, tier marker, skip, hyphenated ids. Tolerant but anchored grammar.
- **e2e spec scanning volume** → extraction is text-regex only (fast); the expensive part is the Playwright RUN, which CI already does — matrix reuses its JSON, no extra run.
- **Output location churn** → keep in plan `reports/` until Phase 6 promotes to `docs/`; single path constant.
