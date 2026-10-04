# Phase 04 allocation failure counsel

- Runtime: `local52186/gpt-6.1-sol`, separate context; no model-family independence.
- Completed attempt: `proc://bg_126`; session `01a0fbb6-72a5-7000-a869-29b1bfd71488`; exact output `artifact://1027`.
- Verdict: **GO for fixture-only repair; NO-GO for changing production resolution/allocation behavior.**
- Evidence: the inherited master game lacked finite `x/y` and positive `width/height`, so existing layout normalization removed it; hiding was incorrectly stored at slide-level `elementPatches`, rather than `layoutOverrides.elementPatches`.
- Decision: supply valid master geometry and the existing override container; retain expected `one`, `child`, `two`, three isolated transport IDs, unchanged saved source, and no hidden allocation.
- Verification after repair: `npx vitest run server/services/presenter-game-allocations.test.js --maxWorkers=1` — 1 file, 5 tests passed. Actual generated document inherited/hidden proof remains required before Phase 04 completion.
