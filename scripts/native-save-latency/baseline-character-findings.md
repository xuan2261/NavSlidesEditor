# Current-build baseline diagnosis

Evidence: `plans/261009-0901-navslides-full-reliability-deep-tdd/reports/character-profile-6b1789fd-1a1f-48a4-8171-ece76cf09119/{result.json,character.cpuprofile}`. One fresh copied root from 4aad1cdc, one browser session, one native `x`; explicit Node. No semantic Node probes, rebuild, commit, or full smoke. Browser route instruments served `EditorPage-BojwbP3z.js` without changing validation decisions or budgets.

- **prepare baseline succeeds**, returning true. No validation exception. Schema 3; input and normalized UTF-8 JSON both **8,114,407 bytes**, below unchanged 8,388,608 limit by 274,201 bytes. Validation ~0.1ms (successful normalization receipt hit); prepare/checkpoint commit 1,104.9ms.
- CDP inspection proves committed version-1 checkpoint, 8,114,578 bytes including envelope.
- Edited root validates successfully: 8,114,408 bytes, no error.
- CDP after input proves **compact head**, not full fallback: localStorage 2,167,871 bytes, semanticDraftVersion 1, committed checkpoint reference, one patch set. Checkpoint retained in IDB.
- Single-character typing 1,155ms; two-frame observation 1,312ms after start. PUT request observed 4,120ms after typing start. This is not marker/save/reload qualification; `characterPayload` only tests includes('x'), not exact marker proof.
- Historical 4aad1cdc receipt actually records typing **27,747.235ms**, deadline failure at 33,182.3ms, **marker-bearing PUT at 41,789.145ms** after input start, and no marker save/PUT200 proof.

## Parent causal boundary

Always-failing baseline/default-budget hypothesis is disproved for this build/root. No validation error exists to fix; no shared change or budget relaxation justified. Old full-marker failure cannot be assigned an exact per-character root from this single-character diagnostic. Sampled input work includes semantic text update (~532ms inclusive), React and draft capture (~376ms inclusive); diagnostic full-document byte measurement itself adds ~351ms inclusive in AK, not production validation cost. Profile also spans post-input CDP storage inspection and idle time. No speculative production fix applied. Next stage must be causally isolated before full smoke; all validated+certified admission and budgets remain intact.
