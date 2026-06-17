# Phase 01: Lock Corpus Threshold Contract

## Context Links

- [Scout Report](./reports/scout-report.md)
- Current strict script wiring: `package.json:50-54`
- Current strict summary messaging: `server/services/pptx-import/pptx-import-corpus-cli.js:36-55`
- Current strict constants: `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js:20-25`
- Existing CLI test seam: `server/services/pptx-import/pptx-import-corpus-cli.test.js:1-39`

## Overview

- Priority: `P1`
- Status: `pending`
- Goal: make one canonical strict corpus gate contract drive code, tests, baseline metadata, and later docs.

## Key Insights

- Current code drift is real, not theoretical: aggregate round-trip strict gate is `0.5` in code, while CLI text says `99%` and docs mix `98%`, `99%`, and `50%` claims. Sources: `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js:20-25`, `server/services/pptx-import/pptx-import-corpus-cli.js:43-49`, `docs/project-roadmap.md:79-80`, `docs/pptx-import-fidelity-report.md:103-110,351-390`.
- Most user-facing and historical acceptance docs point to `>=99%` aggregate round-trip, not `50%`: `docs/pptx-import-fidelity-report.md:103-107`, `docs/project-changelog.md:132`, `README.md:282-287`.
- The CLI already has a testable seam; no shell-level golden test is needed for threshold messaging if the exported gate contract becomes canonical: `server/services/pptx-import/pptx-import-corpus-cli.test.js:1-39`.

## Requirements

- Functional:
  1. One exported strict gate source defines aggregate semantic, aggregate round-trip, per-deck semantic, max class drop, and minimum corpus size.
  2. `enforceStrictSummary()` and per-deck gates must read those values instead of duplicated literals.
  3. Baseline JSON output must persist the same gate values it enforces.
- Non-functional:
  1. Keep CLI flags and exit-code behavior unchanged.
  2. Avoid broad refactors outside the PPTX import harness.

## Architecture

- Data flow:
  1. CLI args enter `runFromCli()` in `server/services/pptx-import/pptx-import-corpus-cli.js:58-101`.
  2. Parsed options feed `runCorpusTests()` in `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js:1136-1212`.
  3. Summary metrics re-enter `enforceStrictSummary()` in `server/services/pptx-import/pptx-import-corpus-cli.js:36-55`.
  4. Baseline JSON persists `gates` through `baselineFromResults()` in `server/services/pptx-import/pptx-import-corpus-cli.js:23-34`.
- Recommended seam:
  - Move the gate literals into one named export, ideally `STRICT_CORPUS_GATES`, in `server/services/pptx-import/constants.js:1-68` or an equally small dedicated helper if `constants.js` would become noisy.
- Failure modes:
  - If the true intended round-trip gate is `99%`, current code under-enforces.
  - If the corpus can no longer satisfy `99%`, switching to the documented gate will fail the suite immediately.

## Related Code Files

- Modify:
  - `server/services/pptx-import/constants.js` or a small equivalent shared gate module
  - `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js`
  - `server/services/pptx-import/pptx-import-corpus-cli.js`
  - `server/services/pptx-import/pptx-import-corpus-cli.test.js`
  - `server/services/pptx-import/corpus-baseline.test.js`
- Create:
  - None required if existing tests are extended in place.
- Delete:
  - None.
- Exclusive ownership this phase:
  - Only the files above.

## Implementation Steps

1. Red:
   Add/strengthen tests so strict summary messaging fails unless it prints the chosen canonical threshold value, not a hardcoded string.
2. Red:
   Extend baseline tests to assert the persisted `gates` block matches the same exported strict gate object.
3. Implement:
   Export one canonical strict gate object and replace duplicated threshold literals in the tester and CLI.
4. Implement:
   Make error messages format percentages from the gate object so code and messaging cannot drift again.
5. Verify:
   Run targeted Vitest and `npm run test:corpus`.

## Todo List

- [x] Decide and lock the canonical aggregate round-trip threshold.
- [x] Replace duplicated literals with one shared export.
- [x] Update CLI tests to fail on message/value drift.
- [x] Add docs/package contract tests to fail on gate metadata drift.
- [x] Re-run strict corpus locally.

## Success Criteria

- `enforceStrictSummary()` prints the same threshold it enforces.
- Baseline metadata mirrors the enforced gate object exactly.
- `npm run test:corpus` passes with the chosen gate set, or the phase stops and escalates the threshold decision before any docs change lands.

## Risk Assessment

- High, high impact:
  - Restoring `>=99%` round-trip can break the corpus if the 50% constant has masked regressions.
  - Mitigation: run `npm run test:corpus` before and after the change; if the corpus fails, stop and resolve the threshold decision explicitly in the same phase.
- Medium, medium impact:
  - Mixing harness gates into generic constants can make ownership fuzzy.
  - Mitigation: use a clearly named export and keep all gate consumers importing from the same place.

## Security Considerations

- No new trust boundary.
- No new filesystem or network surface.
- Keep failure messaging sanitized and numeric only.

## Rollback Plan

- Revert the shared gate export and all threshold/message test changes as one unit.
- Do not revert docs separately before code is stable; phase 4 owns docs sync.

## Next Steps

- Blocker to Phase 2: canonical threshold set is chosen and green under targeted tests.
- Follow-up decision if blocked: if `99%` is not supportable, lower the contract intentionally and propagate that exact number through code + docs + tests in one pass.
