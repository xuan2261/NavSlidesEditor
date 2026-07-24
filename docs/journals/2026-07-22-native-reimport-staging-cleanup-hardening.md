# Native Re-import Staging Cleanup Is Fail-Closed, Not Durably Repaired

**Date**: 2026-07-22 09:27
**Severity**: High
**Component**: PPTX native re-import staging
**Status**: Ongoing

## What Happened

The native re-import validator no longer lets a staging-cleanup exception mask its semantic or provenance result. It attempts normal recursive deletion first; when that fails, it moves the job root into a local UUID-named quarantine. If both removal and rename fail, validation otherwise succeeds only as a fail-closed `NATIVE_REIMPORT_CLEANUP_FAILED` result; if validation already failed, that primary error remains and receives cleanup metadata. This closes the immediate false-success and error-masking path, not the larger durability problem.

## The Brutal Truth

The old `finally` cleanup could throw after the actual validation result, turning the cleanup accident into the only visible failure and leaving candidate bytes in temp space. That is maddening because a green semantic check was never safe if we could not account for the staging directory afterward. Quarantine is damage containment, not recovery. When both removal and quarantine rename fail, validation otherwise succeeds only as a fail-closed `NATIVE_REIMPORT_CLEANUP_FAILED` result; if validation already failed, that primary error remains and receives cleanup metadata. We still have no durable record or sweeper for the residue.

## Technical Details

`server/services/pptx-import/native-reimport-workspace.js` uses `fs.rm(..., { recursive: true, force: true })`, then a local `quarantine/job-${crypto.randomUUID()}` rename. `native-reimport-validator.js` keeps a primary semantic/provenance error and attaches cleanup metadata instead of overwriting it; the regression asserts `NATIVE_REIMPORT_SEMANTIC_MISMATCH` remains primary with `NATIVE_REIMPORT_CLEANUP_QUARANTINED`. The double failure rejects fail-closed.

The follow-up containment slice canonicalizes the workspace root, rejects an
external quarantine root and final or intermediate symbolic-link/junction
components before importer invocation, and rechecks containment before and after
quarantine rename. It deliberately accepts ordinary Windows 8.3 aliases by comparing a
canonical entry's parent rather than its raw basename; the previous exact
canonical-string comparison falsely rejected the host's normal `%TEMP%` path.
These checks are application path validation, not a
race-proof OS-handle boundary or OfficeCLI containment qualification.

The next media-state slice removes a separate production corruption path. Native
re-import now passes `importPptxFile()` a transaction backed by an in-memory hash
scope, so private staged media cannot delete or replace entries in the persisted
`server/data/upload-hashes.json` index. On importer or semantic/provenance failure,
the validator rolls the private transaction back before removing or quarantining the
job root; successful validation commits only the private transaction and then cleans
the root. Ordinary route imports still use the existing persisted global transaction.
The scope is software-contract hardening, not proof of a real package
import-to-mapper media run.

A separate native correctness slice repaired source-map presentation identity. The
mapper projection has no persisted `id`, so `buildImportSourceMap()` now consumes the
explicit `sourceMapIdentity.presentationId` supplied by the native validator while
preserving the existing projection-id fallback for ordinary imports. The red
regression observed `import-pending`; the green source-map/native validator suite
now passes **3 files / 40 tests**, with **5 files / 210 tests** passing across the
importer/mapper/route/validated-export transaction neighbors. The exact commands
were run with `--maxWorkers=1 --no-file-parallelism` over the named source-map,
native-validator, containment, importer, mapper, presentations, materialization,
and transactional-patch test files. Strict real-package re-import,
provenance/collateral, and physical evidence remain open.

Focused validation passed **2 files / 14 tests** (exit 0; 5.71 s), including the
missing nested temp-root regression and existing-leaf intermediate junction
fixture. The adjacent six-file native export regression passed **57/57 tests** in
17.18 s. Touched-file ESLint, production syntax checks, and `git diff --check`
passed; line-ending warnings were the only diff-check output. The media and native
validator/containment focused command passed **3 files / 37 tests** after the
failure-exit rollback fix. Neighboring importer/mapper/resource-budget tests passed
**4 files / 134 tests**, and native validation/transaction integrations passed
**4 files / 55 tests**. The fresh excluded full-unit run exited `0`: **482 files
passed / 1 skipped; 3,855 tests passed / 3 skipped** in **1,120.65 s**. `PPTX_ORACLE=off`;
the oracle subprocesses were synthetic. All results are application regression
evidence only, not a physical PPTX, OfficeCLI, or PowerPoint oracle claim.

## What We Tried

We chose normal deletion plus local UUID quarantine rather than silently swallowing cleanup failure or reporting validation success. We rejected treating the local rename as durable remediation: no residual registry, ownership record, retry policy, or sweeper was added in this slice.

## Root Cause Analysis

The validator coupled its return path to best-effort filesystem cleanup. A failed `fs.rm()` could eclipse the actual validation error, while the system had no accountable path for the leftover staged package. The code had cleanup, but not cleanup authority.

## Lessons Learned

A validator is only fail-closed when cleanup failure is an explicit outcome and the original failure survives. Do not call local quarantine durable merely because it has a UUID: without an owner record and sweeper, it is a hidden pile of risky residue.

## Next Steps

- **App/Storage, before any G2/native-fidelity claim**: add durable residual recording and a bounded sweeper/retry policy for removal-and-rename double failures; prove ownership and cleanup with regressions. The native media hash scope is locally isolated and the supplied presentation identity is now bound during source-map construction; remaining validator work is provenance/collateral closure and strict real-package re-import.
- **Validation owner, before promotion**: retain the replacement excluded full suite separately from focused cleanup evidence; neither establishes physical validation.
- **Security, before promotion**: decide whether native staging needs an OS-handle or equivalent race-resistant boundary; current checks reject known symlink/junction components but do not prove rename-swap resistance.
- **Security and Release, before promotion**: keep `G0`–`G5` open. Physical OfficeCLI, PowerPoint, Electron, and real-package native re-import claims remain open.

## Unresolved Questions

Which durable store, retention policy, and operator-visible recovery path will own a staging residue after both deletion and quarantine rename fail? Can the native staging boundary obtain race-resistant directory handles on supported Windows targets, or should the residual race remain an explicit unsupported threat? The remaining native validator work must bind every operation to the authoritative base source map and close expected-projection/collateral drift before strict re-import can be considered representative.
