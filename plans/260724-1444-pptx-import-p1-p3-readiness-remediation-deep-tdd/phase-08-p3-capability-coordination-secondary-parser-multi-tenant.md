---
phase: 8
title: "P3 Capability Coordination Secondary Parser Multi Tenant"
status: completed
priority: P3
effort: "2-3d"
dependencies: [1, 2, 3, 4, 5, 6, 7]
---

# Phase 8: P3 Capability Coordination, Secondary Parser Eval, Multi-Tenant Decision

## Overview

Close audit P3 **without duplicating package-first**. Produce coordination checklist linking L4/charts/OfficeCLI/oracle/platform ownership; run secondary-parser cost/benefit eval only; record multi-tenant decision. **No production unlock** of chart edit, L4 rows, or 1:1 claims.

## Context Links

- Audit P3: readiness report §11 P3
- Package-first: `../260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/plan.md` G1–G5
- P0 phase 4: PowerPoint goldens blocked
- Chart preserve-only: `chart-properties.jsx` four gates
- Fidelity levels: `fidelity-contract.js` level5 always unavailable
- Parser single path: `parse-worker.js` pptxtojson only

## Requirements

### Functional

1. **Capability coordination matrix** (report under `plans/reports/`):

| Capability | Owner plan | Status | This plan action |
| --- | --- | --- | --- |
| Level-4 row promote | package-first G4 | not done | Link only |
| Chart/complex edit | package-first phase 8 + G4 | preserve-only | Link only |
| OfficeCLI receipt / containment | package-first G1 | open | Link only |
| PowerPoint oracle / 1:1 | P0 ph4 + package-first G5 | blocked | Link only |
| Electron/Docker platform qual | package-first G3 | open | Link only |
| Secondary parser | **this phase** | eval only | Write eval |
| Multi-tenant job auth | **this phase** | decision | Decision record |

2. **Secondary parser eval** (document, optional micro-benchmark only):
   - Compare pptxtojson-only vs hypothetical second parser on current 11-deck (+ adversarial sample if useful).
   - Score: unmapped node reduction, semantic delta, maintain cost, source-map complexity.
   - Exit criteria: **docs/eval only** (Validation V4). Do **not** implement secondary parser in this plan even if probe looks promising — file follow-up plan instead.

3. **Multi-tenant decision record**:
   - Current model: single-user self-hosted; UUID job IDs; no per-job auth.
   - If product stays single-user: accept residual risk; no auth work.
   - If multi-tenant later: require job owner binding + authorize GET/SSE/DELETE — **out of scope to implement** here; record interface sketch only.

### Non-functional / hard non-goals

- Do **not** set `level4Promoted: true`.
- Do **not** enable chart properties editing.
- Do **not** pin OfficeCLI binaries or implement Job Objects.
- Do **not** claim visual fidelity or 1:1.
- Do **not** reintroduce pptx2json as “fallback parser”.

## Architecture

Documentation + optional offline benchmark script. No runtime feature flags that unlock editability.

## File Inventory

| Path | Action |
| --- | --- |
| `plans/reports/YYYY-MM-DD-pptx-p3-capability-coordination.md` | Create |
| `plans/reports/YYYY-MM-DD-pptx-secondary-parser-eval.md` | Create |
| `plans/reports/YYYY-MM-DD-pptx-multi-tenant-decision.md` | Create |
| Optional `scripts/pptx-secondary-parser-probe.js` | Create only if probe needed |
| Application production code | **No capability unlock** |

## Dependency Map

- Prefer after phases 1–7 so coordination text can reference landed reliability/hardening.
- Soft-blocks package-first marketing claims until matrix read.

## Tests Before (TDD)

- If probe script exists: unit test that probe does not mutate presentations store.
- Guard test (optional): `canonical-feature-matrix` still all `level4Promoted: false` after this phase (existing test should remain green).

## Refactor / Implementation Steps

1. Draft coordination matrix from package-first + P0 status.
2. Run secondary parser probe **or** literature/cost analysis without second dependency if probe cost high — prefer evidence from existing unmapped stats.
3. Write multi-tenant decision (default: remain single-user).
4. Update this plan success checkboxes; do not open capability PRs.

## Tests After

```bash
npx vitest run server/services/pptx-import/canonical-feature-matrix.test.js client/src/components/properties/chart-properties.test.jsx
```

## Regression Gate

- Docs exist and link owners.
- No new production parser dependency unless eval explicitly greenlights (default no).
- Feature matrix / chart preserve-only tests still pass.

## Test Scenario Matrix

| ID | Scenario | Priority |
| --- | --- | --- |
| G1 | Coordination report complete | Critical |
| G2 | Secondary parser eval complete with go/no-go | Critical |
| G3 | Multi-tenant decision recorded | Critical |
| G4 | No L4/chart unlock in code | Critical |

## Function / Interface Checklist

- [ ] Coordination matrix
- [ ] Secondary parser go/no-go
- [ ] Multi-tenant decision
- [ ] Explicit non-claim language for README if any drift found (patch only)

## Success Criteria

- [ ] Three reports written under `plans/reports/`
- [ ] Go/no-go for secondary parser stated
- [ ] Multi-tenant: implement or defer stated
- [ ] Production code shows no capability promotion

## Risk Assessment

| Risk | Mitigation |
| --- | --- |
| Scope creeps into OfficeCLI | Hard non-goals + review |
| Eval becomes full parser project | Cap effort; default no-go |
| Conflicting claims in README | Grep claim language; patch if needed |

## Security Considerations

- Multi-tenant decision must not silently claim per-job auth exists.
- Secondary parser would expand attack surface — another reason default no-go.

## Todo

- [ ] Coordination matrix report
- [ ] Secondary parser eval
- [ ] Multi-tenant decision
- [ ] Verify no L4/chart unlock
- [ ] Regression gate (matrix + chart tests)
