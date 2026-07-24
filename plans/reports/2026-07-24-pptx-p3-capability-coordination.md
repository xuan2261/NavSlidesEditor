# PPTX P3 Capability Coordination Matrix

**Date:** 2026-07-24  
**Plan:** `plans/260724-1444-pptx-import-p1-p3-readiness-remediation-deep-tdd` phase 8  
**Product claim target:** self-hosted **best-effort import** reliability only — not PowerPoint 1:1 or level-4/5 editability.

## Coordination matrix

| Capability | Owner plan | Status | This plan action |
| --- | --- | --- | --- |
| Level-4 row promote | package-first G4 (`260710-1757-…`) | not done | Link only — do not promote |
| Chart/complex edit | package-first phase 8 + G4 | preserve-only | Link only — chart properties remain gated |
| OfficeCLI receipt / containment | package-first G1 | open | Link only — no Job Objects here |
| PowerPoint oracle / 1:1 | P0 phase 4 + package-first G5 | blocked | Link only — visual goldens out of scope |
| Electron/Docker platform qual | package-first G3 | open | Link only |
| Secondary parser | this phase | eval only | See secondary-parser eval report |
| Multi-tenant job auth | this phase | decision | See multi-tenant decision record |
| Client import lifecycle abort/wait | P1–P3 remediation phase 1 | landed | Abort + wait budget + ownership guard |
| Single outbox writer + drain barrier | phase 2 | landed | Sole package-backed presentations writer |
| Durable import report | phase 3 | landed | Bounded `_pptxImportReport` + reportSummary |
| Crash/restart suite | phase 4 | in flight | CP matrix on real store |
| Worker env / warning budget | phase 5 | landed | Allowlist env; accumulate-time caps |
| CRC + adversarial corpus | phase 6 | landed | fail-closed CRC; isolated adversarial lane |
| Perf matrix + sandbox eval | phase 7 | in flight | Opt-in harness + residual risk note |

## Hard non-goals (reaffirmed)

- Do **not** set `level4Promoted: true`.
- Do **not** enable chart properties editing.
- Do **not** pin OfficeCLI binaries or implement OS Job Objects/seccomp here.
- Do **not** claim visual fidelity or 1:1 PowerPoint parity.
- Do **not** reintroduce a second production parser as “fallback”.

## Ownership handoff notes

- Package-first remains sole owner of L4 promotion, OfficeCLI containment, and visual oracle authority.
- P0 phase 4 remains blocked for PowerPoint goldens; this plan does not unblock it.
- Reliability work here (lifecycle, sole writer, durable report, CRC, worker env) improves **best-effort import** honesty without expanding capability claims.

## Related reports

- `2026-07-24-pptx-secondary-parser-eval.md`
- `2026-07-24-pptx-multi-tenant-decision.md`
- Package-first plan: `plans/260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/plan.md`
- P0 readiness: `plans/260722-1630-pptx-import-p0-readiness-remediation-deep-tdd/plan.md`
