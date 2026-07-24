---
phase: 2
title: "Import Evidence and Strict Contract"
status: completed
priority: P1
effort: "3-4 days"
dependencies: []
---

# Phase 2: Import Evidence and Strict Contract

## Overview

Make parser telemetry and strict evidence truthful. Remove the ineffective runtime `pptx2json` inspector, propagate native scene metrics, bind qualification to the exact 11-deck corpus, and separate best-effort metric regression from two-pass importer qualification.

## Completion Status — 2026-07-22

Implemented and covered by focused importer-evidence contracts. The manifest-bound qualifier remains intentionally non-zero for current native unmapped/placeholder evidence; its structured fail-closed result completes this truthfulness phase without representing native capability qualification.

<!-- Updated: Red Team Review 1 + Validation Session 1 - corpus binding and two-pass strict qualification -->

## Context Links

- Audit P0: `../reports/2026-07-22-pptx-import-readiness-audit.md:435-448`.
- Runtime inspector: `server/services/pptx-import/parse-worker.js:11-88`.
- Dropped stats: `server/services/pptx-import/importer.js:14-35`, `server/services/pptx-import/importer.js:85-96`.
- Strict throws before stats: `server/services/pptx-import/importer.js:87-106`, stats assemble at line 136.
- Current silent corpus fallback: `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js:1305-1321`.
- Existing inventory utility: `server/services/pptx-import/evidence/corpus-manifest.js:65-81`.

## Requirements

### Functional

- Runtime importer declares only `pptxtojson` as parser.
- Remove successful `fallbackParserUsed` and `fallback-inspector` contracts.
- Remove production `pptx2json` dependency/Electron check; benchmark sandbox remains independent.
- Return finite `sceneGraphMappedNodes` and `sceneGraphUnmapped` in public import stats, preserving zero.
- Keep parser-relative semantic/roundtrip scoring as explicit best-effort metrics.
- Add explicit importer qualification bound to checked-in manifest names and SHA-256 values for all 11 `server/data/test-corpus/*.pptx` decks.
- Qualification forbids fallback corpus, positional substitution, missing/extra decks, duplicate content hashes, hash drift and stale matrix subject.
- Per deck, first run best-effort import to collect finite evidence, then run the same source hash with `{ strict: true }` to obtain a typed decision.
- Qualification combines evidence and strict result; strict rejection must not erase evidence.
- Missing/non-finite scene, chart, SmartArt or permanent-placeholder evidence is a blocker.
- Known EMF/native-node failures remain structured non-zero blockers; they are not P0 capability work.

### Non-functional

- Metrics lane behavior remains backward compatible.
- Additive `errorDetails`/stats are allowed; removed false fields get a current changelog note.
- Every report records lane mode, corpus manifest digest, exact importer options and per-deck source hash.
- Do not rewrite historical changelog claims.

## Architecture

### Runtime parser boundary

```text
validate package -> pptxtojson -> output usability -> success or typed output-empty
```

No production fallback/inspection with `pptx2json`. Sandbox benchmark code continues resolving its own package.

### Qualification boundary

```text
manifest-in + exact corpus directory
  -> rebuild actual inventory + matrix subject
  -> exact canonical comparison (no fallback)
  -> for each deck hash H:
       pass A: best-effort import -> finite evidence or evidence-unavailable
       pass B: importer { strict: true } -> pass or typed rejection
       assert both passes used H
       combine { evidence, strictOutcome }
  -> apply zero-gap and finite-evidence gates
  -> structured report + non-zero when blocked
```

Use a small `pptx-import-qualification.js` owner instead of growing the 174-line CLI beyond 200 LOC. Extend corpus-manifest code with a reusable exact deck inventory; do not duplicate hashing.

### Script contract

- `test:pptx:corpus-metrics` — current parser-relative strict metrics/roundtrip.
- `test:corpus` — compatibility alias to corpus metrics.
- `test:pptx:best-effort` — metrics plus browser smoke.
- `test:pptx:importer-qualification` — manifest-bound two-pass importer gate.
- `test:pptx:strict` — deprecated alias to importer qualification, never metrics.
- CLI `--strict` remains a deprecated metrics alias if external compatibility requires it; explicit flags are `--strict-metrics` and `--importer-strict`.

## File Inventory

| Action | File | Rough change | Test impact |
| --- | --- | --- | --- |
| Modify | `server/services/pptx-import/parse-worker.js` | M | Remove inspector path |
| Modify | `server/services/pptx-import/importer.js` | S | Truthful stats/warnings |
| Modify | `server/services/pptx-import/importer.test.js` | M | Zero/non-zero scene propagation |
| Modify | `client/src/utils/pptx-import-summary.js` | XS | Remove unreachable warning class |
| Modify | `client/src/utils/pptx-import-summary.test.js` | S | Summary contract |
| Modify | `server/routes/pptx-import.test.js` | XS | Remove false fixture field |
| Create | `server/services/pptx-import/pptx-import-qualification.js` | M, <200 LOC | Two-pass deck/result gate |
| Create | `server/services/pptx-import/pptx-import-qualification.test.js` | L, split if >200 LOC | Evidence retained after strict rejection |
| Modify | `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js` | S | Add typed `errorDetails`; preserve metrics |
| Modify | `server/services/pptx-import/production-corpus-parity.test.js` | M | Prove lanes differ |
| Modify | `server/services/pptx-import/pptx-import-corpus-cli.js` | M, keep <200 LOC | Explicit modes/manifest-in delegation |
| Modify | `server/services/pptx-import/pptx-import-corpus-cli.test.js` | L | CLI mode and fail-closed corpus cases |
| Modify | `server/services/pptx-import/corpus-baseline.test.js` | S | Missing/finite evidence |
| Modify | `server/services/pptx-import/evidence/corpus-manifest.js` | M, keep <200 LOC | Reusable exact inventory/verification |
| Modify | `server/services/pptx-import/evidence/corpus-manifest.test.js` | M | Missing/extra/duplicate/hash/matrix cases |
| Create | `server/data/test-corpus/importer-qualification-manifest.json` | Generated/reviewed data | Pins exact 11-deck corpus |
| Modify | `package.json` | S | Explicit script names/manifest path |
| Modify | `server/package.json` | XS | Remove runtime `pptx2json` |
| Modify | `package-lock.json` | Generated | Expected dependency removal only |
| Modify | `scripts/prepare-electron.js` | XS | Stop requiring unused runtime parser |
| Modify | `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml` | XS | Explicit metrics lane |
| Modify | `README.md` | XS | Runtime parser truth |
| Modify | `docs/system-architecture.md` | S | Parser/lane architecture |
| Modify | `docs/codebase-summary.md` | XS | Runtime parser summary |
| Modify | `docs/code-standards.md` | S | Command semantics |
| Modify | `docs/project-roadmap.md` | S | Current runtime vs historical benchmark |
| Modify narrowly | `docs/project-changelog.md` | XS append | Current correction; preserve dirty content |

## Function and Interface Checklist

- [x] `parseFile()` returns no `fallback` success metadata.
- [x] `buildImportStats()` returns both scene counts, including zero.
- [x] `importPptxFile()` emits no `fallback-inspector` warning.
- [x] Warning summary has no unreachable fallback category.
- [x] `testCorpusFile()` retains existing `errors: string[]` and adds sanitized typed `errorDetails` without breaking consumers.
- [x] `buildCorpusInventory()` hashes sorted `.pptx` files and rejects duplicate hashes for qualification.
- [x] `verifyCorpusManifest()` compares schema, matrix subject, exact names/counts/hashes and canonical digest.
- [x] Qualification mode requires `--manifest-in`; it never calls `resolveCorpusDir()` fallback.
- [x] `qualifyDeck()` verifies the same hash before both passes and combines best-effort evidence with strict outcome.
- [x] Baseline preserves finite zero and exposes invalid evidence distinctly.
- [x] Reports record `mode`, `manifestDigest`, source hashes and importer options.
- [x] Benchmark runner resolves `pptx2json` only through its sandbox.

## Dependency Map

```text
runtime parser truth --------> importer stats/warnings -----> client/docs
exact corpus manifest -------> two-pass qualifier ----------> structured release gate
best-effort pass ------------> finite native evidence --+
strict pass -----------------> typed decision ----------+---> per-deck result
package scripts/CI ----------> explicit lane naming
Phase 2 -----------------------------------------------------> Phases 3 and 4
```

## Tests Before

1. Stats preserve scene zeros and non-zero values.
2. Successful jobs contain neither fallback telemetry nor warning.
3. Metrics lane passes no strict importer flags.
4. Qualification without manifest exits non-zero before import.
5. Missing, extra, renamed, hash-drifted and duplicate-hash decks fail exact inventory.
6. Requested qualification corpus never falls back to `PPTX/`.
7. Best-effort pass returns finite evidence while strict pass rejects; combined result retains both.
8. Missing/non-finite evidence fails qualification.
9. Non-zero scene/chart/SmartArt/placeholder gaps fail qualification.
10. Manifest digest and per-deck hash are present in report.
11. Run current code first and retain expected red evidence.

## Refactor

1. Delete runtime `pptx2json` inspector and fallback result.
2. Remove false stats/warning/UI fields and runtime dependency.
3. Add scene counts to stats whitelist.
4. Extend result error details additively.
5. Extract exact corpus inventory/verification.
6. Generate and review the 11-deck manifest from source bytes.
7. Add two-pass qualification module.
8. Delegate explicit CLI mode to qualification module.
9. Rename scripts/CI/docs without changing metrics behavior.

## Tests After

- Runtime reports `pptxtojson` only.
- Empty output remains typed `output-empty`, not fallback success.
- Best-effort metrics result stays behaviorally unchanged.
- Qualification cannot run against substituted corpus.
- Strict rejection preserves source-bound finite evidence or reports evidence unavailable.
- Known native blockers yield deterministic non-zero structured results.
- Baseline cannot convert absence into valid zero/null evidence.

## Test Scenario Matrix

| Priority | Scenario | Expected |
| --- | --- | --- |
| Critical | Metrics lane importer spy | No strict import options |
| Critical | Qualification two passes | `{}` evidence pass, `{ strict: true }` decision pass |
| Critical | Strict rejects after evidence pass | Evidence retained; gate blocked |
| Critical | Manifest missing/hash drift/extra deck | Fail before import |
| Critical | Corpus resolver fallback available | Qualification still fails requested path |
| Critical | Missing scene evidence | Fail evidence contract |
| High | All finite zero gaps + strict pass | Qualification may pass |
| High | Empty parser output | Typed blocker; no fallback warning |
| Medium | Legacy `--strict` | Explicit deprecated metrics behavior only |
| Medium | Parser benchmark | Sandbox `pptx2json` remains testable |

## Implementation Steps

1. Land stats/parser/manifest/qualifier red tests.
2. Remove production inspector and dependency.
3. Propagate scene metrics and typed errors.
4. Add exact inventory and checked-in manifest.
5. Add two-pass qualifier and explicit CLI modes.
6. Update scripts and CI.
7. Update current authority docs; append changelog correction.
8. Run metrics corpus and compare baseline.
9. Run importer qualification and retain structured known blockers without weakening policy.

## Todo

- [x] Remove false runtime fallback contract/dependency.
- [x] Propagate native scene stats.
- [x] Add exact 11-deck manifest and verification.
- [x] Add two-pass qualification module.
- [x] Reject missing/non-finite/gap evidence.
- [x] Split script/CLI semantics and update CI/docs.
- [x] Run both lanes and preserve distinct outcomes.

## Success Criteria

- [x] No current runtime/doc claim calls `pptx2json` a fallback parser.
- [x] Public stats expose mapped/unmapped scene counts.
- [x] Metrics corpus remains green and unchanged by naming alone.
- [x] Qualification report binds exact corpus manifest and same source hash across both passes.
- [x] Known strict failures are structured and non-zero, with no fabricated evidence.
- [x] A passing harness asserts the expected blocked qualification result.
- [x] CI invokes only the explicit metrics lane until qualification is genuinely green.

## Regression Gate

```bash
npx vitest run server/services/pptx-import/importer.test.js server/services/pptx-import/production-corpus-parity.test.js server/services/pptx-import/pptx-import-qualification.test.js server/services/pptx-import/pptx-import-corpus-cli.test.js server/services/pptx-import/corpus-baseline.test.js server/services/pptx-import/evidence/corpus-manifest.test.js client/src/utils/pptx-import-summary.test.js server/routes/pptx-import.test.js
npm run test:pptx:corpus-metrics
npm run test:pptx:importer-qualification
```

The last command is a truth gate and is expected to remain non-zero on current EMF/native blockers. Unit/harness tests must assert that result and report schema; never relabel it green.

## Risk Assessment

- **Strict evidence disappears:** mandatory two-pass result composition.
- **Corpus laundering:** exact checked-in names/hashes/matrix; no fallback or duplicate hashes.
- **False backward compatibility:** do not retain `fallbackParserUsed: false`.
- **Native scope expansion:** never fix EMF/174 nodes in this phase.
- **Lockfile/doc churn:** inspect expected dependency removal and narrow-edit dirty docs.

## Rollback

Stats/error additions and new scripts are additive. If packaging unexpectedly needs the package, restore the dependency temporarily but keep runtime/docs truthful; never restore fallback success telemetry or unbound qualification.
