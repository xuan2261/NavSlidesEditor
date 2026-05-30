---
phase: 6
title: "CI Gate Allowlist & Drift Guard"
status: completed
priority: P1
effort: "1.5d"
dependencies: [2, 4, 5]
---

# Phase 6: CI Gate Allowlist & Drift Guard

## Overview

Turn the matrix from a report into a living system. Add a CI gate that consumes the matrix JSON: warn on allowlisted gaps, fail on un-allowlisted or NEW gaps. Add a drift guard so adding an element/control without a `[cap:*]` test goes red. Promote the matrix to `docs/`. The allowlist starts populated with whatever editor-core gaps remain and shrinks each sprint.

## Requirements

- **Functional**
  - `check-coverage-gate.mjs`: reads `feature-coverage-matrix.json` + `coverage-gate-allowlist.yaml`.
    - GAP/DEEP-GAP not on allowlist → exit non-zero (fail).
    - GAP/DEEP-GAP on allowlist → warn, exit zero.
    - NEW gap (capability with no tag AND not on allowlist) → fail (this is the drift signal).
    - `ORPHAN-TAG` (tag for unknown capability) → fail (stale tag).
    - Allowlist entry older than threshold → warn (staleness nudge).
  - Allowlist schema: `{ id, reason, added: <date>, owner }`. Required fields enforced.
  - **Drift guard — TWO layers (red-team CRITICAL #2):**
    1. **Auto-source drift** — extend `client/src/data/element-defaults.test.js`: assert every `ELEMENT_DEFAULTS` key + every `DEFAULT_SHORTCUTS` id has a matching inventory entry AND a PASS `[cap:*]` tag OR an allowlist entry. New element/shortcut with neither → red. (Auto-sourced categories are self-defending: a new key auto-enters inventory → becomes a GAP → gate fails.)
    2. **Manifest-completeness drift** (the gap red-team flagged) — controls/canvas-ops/commands are HAND-written manifest with NO registry, so a new ribbon button would never auto-enter inventory and stay invisible. Add `check-manifest-completeness.mjs` + test: grep `data-testid=` across `client/src/components/ribbon/**` and the `commands` array at `EditorPage.jsx:904`, then assert every discovered control/command id maps to a `feature-manifest.yaml` entry. A new control with no manifest entry → red. This is the forcing function for the manual categories — without it, "% verified" lies about its denominator.
  - Promote matrix output to `docs/feature-coverage-matrix.md` (committed, human-visible long-term).
  - Wire into CI: add a job/step running `npm run matrix && node scripts/feature-inventory/check-coverage-gate.mjs` in `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml`, fanned into `required-checks`.
- **Non-functional**
  - Warn-first rollout: initial allowlist absorbs current gaps so the gate goes green on merge; real failures only for NEW drift. Shrink allowlist over time.
  - Gate script ≤ 200 LOC. Clear, actionable failure output (lists exactly which capabilities failed + how to fix: "add `[cap:<id>]` test or allowlist it").
  - Pinned, deterministic; no network.

## Architecture

```
scripts/feature-inventory/
├── check-coverage-gate.mjs           # matrix.json + allowlist → pass/warn/fail
├── check-manifest-completeness.mjs   # discovered controls/commands vs manifest → fail on un-manifested
├── coverage-gate-allowlist.yaml      # acknowledged debt, dated, shrinking
├── check-coverage-gate.test.mjs
└── check-manifest-completeness.test.mjs

client/src/data/element-defaults.test.js   # EXTEND: ELEMENT_DEFAULTS + DEFAULT_SHORTCUTS drift assertions
docs/feature-coverage-matrix.md            # promoted, committed output
.github/workflows/...ci-pipeline...yml     # new gate step → required-checks
```

**Gate decision flow:**
```
for each row in matrix.json:
  PASS                          → ok (only PASS counts as verified)
  FAIL                          → FAIL build (a test is red)
  SKIP / TAGGED:
     on allowlist               → WARN
     not on allowlist           → FAIL build  ← skipped/unrun test must not pass silently
  GAP / DEEP-GAP:
     on allowlist (valid entry) → WARN
     not on allowlist           → FAIL build  ← drift / new untested capability
  ORPHAN-TAG                    → FAIL build  ← stale tag, unknown capability
manifest-completeness:
  discovered control/command not in manifest → FAIL build  ← invisible new control (CRITICAL #2)
allowlist entry older than N days → WARN (staleness)
exit nonzero if any FAIL
```

**Rollout safety (warn→block):** mirror the proven pattern from `260522-1339` Phase 5-lite — add the gate as a NON-required check first, observe one cycle, then flip to required in branch protection via `gh api`. Document the `gh` command. This avoids breaking branch protection on day 1.

**Allowlist seed:** after Phase 4/5, whatever editor-core capabilities remain GAP/DEEP-GAP get a dated allowlist entry with a real reason (e.g. "deep test for table-merge deferred — tracked"). Goal state: allowlist empty for editor-core, but warn-first means a populated start is fine.

## Related Code Files

- **Create:**
  - `scripts/feature-inventory/check-coverage-gate.mjs`
  - `scripts/feature-inventory/check-manifest-completeness.mjs`
  - `scripts/feature-inventory/coverage-gate-allowlist.yaml`
  - `scripts/feature-inventory/check-coverage-gate.test.mjs`
  - `scripts/feature-inventory/check-manifest-completeness.test.mjs`
- **Modify:**
  - `client/src/data/element-defaults.test.js` — add drift-guard assertions for `ELEMENT_DEFAULTS` + `DEFAULT_SHORTCUTS` (keep the existing 19-count test).
  - `package.json` — add `"matrix:gate": "npm run matrix && node scripts/feature-inventory/check-coverage-gate.mjs && node scripts/feature-inventory/check-manifest-completeness.mjs"`.
  - `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml` — add gate step + fan into `required-checks`.
  - Move matrix output target to `docs/feature-coverage-matrix.md`.
- **Read:** `feature-coverage-matrix.json`, allowlist, `feature-manifest.yaml`, ribbon `data-testid` occurrences, `EditorPage.jsx:904` command array.

## Implementation Steps (TDD)

1. **`red:`** `check-coverage-gate.test.mjs`: stub matrix with (a) all PASS → exit 0; (b) one un-allowlisted GAP → exit nonzero; (c) same GAP on valid allowlist → exit 0 + warn; (d) ORPHAN-TAG → exit nonzero; (e) allowlist entry missing `reason` → reject; (f) stale-dated entry → warn; (g) `SKIP`/`TAGGED` not on allowlist → exit nonzero (skipped test never passes the gate). Run → fails.
2. **`green:`** Implement `check-coverage-gate.mjs`. Run → passes.
3. **`red:`** `check-manifest-completeness.test.mjs` (CRITICAL #2): stub a discovered-control set containing an id absent from `feature-manifest.yaml` → exit nonzero with a clear "control X not in manifest" message; all-mapped → exit 0. Run → fails.
4. **`green:`** Implement `check-manifest-completeness.mjs` (grep ribbon `data-testid` + parse command array, diff vs manifest). Run → passes.
5. **`red:`** Extend `element-defaults.test.js`: assert every `ELEMENT_DEFAULTS` key AND every `DEFAULT_SHORTCUTS` id has inventory + PASS-tag-or-allowlist; a fake untested key fails. Run → fails as intended, then assert real state passes (after Phase 3/4).
6. **`green:`** Seed `coverage-gate-allowlist.yaml` with remaining editor-core gaps (dated, reasoned) so live gate is green.
7. Promote matrix to `docs/feature-coverage-matrix.md`; update path constant; commit the generated doc.
8. Wire CI step (non-required first). Verify it runs `matrix:gate` (both gate + manifest-completeness) and reports. Document `gh api` command to flip to required after one observation cycle.
9. **Intentional-break verification (×2):** (a) add an `ELEMENT_DEFAULTS` key with no tag → confirm gate red → revert; (b) add a `data-testid` ribbon control with no manifest entry → confirm manifest-completeness gate red → revert. Record both proofs (per QA-uplift "verified by intentional break" convention).
10. **`refactor:`** clean failure-message formatting; ensure each script ≤ 200 LOC; document allowlist staleness threshold.

## Success Criteria

- [ ] `npm run matrix:gate` exits nonzero on un-allowlisted GAP/SKIP/TAGGED, zero (with warn) on allowlisted items
- [ ] Adding an `ELEMENT_DEFAULTS` key OR a `DEFAULT_SHORTCUTS` id with no `[cap:*]` test fails the drift guard (verified by intentional break + revert)
- [ ] **Adding a ribbon control / command with no `feature-manifest.yaml` entry fails the manifest-completeness gate (CRITICAL #2, verified by intentional break + revert)** — manual categories can no longer go invisible
- [ ] `ORPHAN-TAG`, skipped tags, and malformed allowlist entries fail the gate
- [ ] CI workflow runs both gate scripts and fans into `required-checks`; warn-first rollout documented with `gh api` flip command
- [ ] `docs/feature-coverage-matrix.md` committed and regenerable via `npm run matrix`; CI freshness check fails if committed copy is stale
- [ ] Allowlist entries all have `reason` + `added` date; staleness warning works
- [ ] Editor-core has zero un-allowlisted gaps at merge (green gate)
- [ ] Commit log: `red:`→`green:`→`refactor:`; both intentional-break proofs recorded

## Risk Assessment

- **Manifest-completeness grep brittle** (controls without `data-testid` invisible to the grep) → seed manifest thoroughly in Phase 1; the completeness check is best-effort on discoverable controls + the command array. Document that controls lacking ANY testid are themselves a gap to fix (add testid). Not perfect, but closes the "% verified denominator lies" hole for all discoverable controls.
- **Branch-protection breakage** → warn-first / non-required rollout + one observation cycle before flipping to required (proven pattern from `260522-1339`).
- **Allowlist becomes permanent debt dump** → required `reason`+`added`; staleness warning; sprint review. Goal: empty for editor-core.
- **CI flake from matrix regen** → gate reads committed/regenerated JSON deterministically; no network, no timing.
- **Coupling to coverage gate** → this is a SEPARATE capability gate; does not touch `vitest.config.mjs` thresholds (owned by `260519-1200`). Keep concerns isolated.
- **`docs/` drift** → CI freshness check: fail if committed `docs/feature-coverage-matrix.md` != fresh regen.
