# Phase 1 Governance Baseline Characterization

Captured: `2026-09-25T18:31:35.7241976+07:00`

Canonical ledger: [release-scope-manifest.json](./release-scope-manifest.json)

## Decision

Governance scope is characterized, but the release program is **stopped before
G0** until the separately owned real OfficeCLI physical-feasibility receipt
passes. No OfficeCLI, edited-package, exact-row, Windows-artifact, PowerPoint,
or universal compatibility success is claimed here.

## Repository and Worktree

| Fact | Observed value |
| --- | --- |
| HEAD | `ce034e634fdccd769954fef88f3c199d1f8ab77a` |
| HEAD author date | `2026-09-18T07:09:27+07:00` |
| HEAD subject | `fix(ci): stabilize GitHub push flow and PPTX evidence status` |
| Describe | `v1.16.0-5-gce034e63` |
| Latest normal SemVer tag | `v1.16.0` |
| Excluded malformed historical tag | `vv1.7.0` |
| Root package version | `1.16.0` |
| Branch | `master` |

Phase-entry `git status --short --untracked-files=all` contained the complete
untracked `260925-0631...` plan directory, its plan journal, and the three
user-owned scripts below. No tracked modification was present:

- `test_derive.cjs`
- `test_sm.cjs`
- `test_source_map.cjs`

During execution, concurrent OfficeCLI work appeared outside this workstream's
ownership: tracked modifications to `NOTICE` and `website/NOTICE.md`, plus
untracked `scripts/officecli/physical-feasibility-support.mjs`,
`scripts/officecli/run-physical-feasibility.mjs`, and
`server/services/pptx-import/officecli/physical-feasibility.test.js`. None was
read, edited, deleted, staged, or used as passing evidence here. The separately
owned physical receipt remained absent at final governance verification. All
pre-existing and concurrent work remains preserved.

## Host and Runtime

| Fact | Observed value |
| --- | --- |
| OS | Microsoft Windows 10 Pro for Workstations |
| OS version | `10.0.18363` |
| Architecture | `64-bit` |
| Node.js | `v22.22.0` |
| npm | `10.2.4` |

This host snapshot identifies the governance run only. It does not qualify
OfficeCLI or PowerPoint and is not a comparable performance baseline by itself.

## Current Authority and Evidence

| Capability | Current truth | Authority / treatment |
| --- | --- | --- |
| Product scope | Single-user, self-hosted, trusted-author content | `README.md`, deployment and architecture docs |
| Importer corpus | 11/11, zero unmapped nodes, zero permanent placeholders, zero blockers | Completed `260917`; reuse only |
| Package-first edited export | 77/244 checklist items, 0/6 claim gates | `260710`; sole open implementation owner |
| Production prerequisite | Phases 1, 3, 4 complete; 2, 5, 6, 7 pending | `260810`; open prerequisite |
| Editor/runtime | 1,419/1,419 suites; 4,745 passed, 3 skipped of 4,748 | Completed `260821`; historical subject evidence |
| Source remediation | Implemented; Docker evidence closed; prior release decision was conditional | Completed `260820`; reuse contracts |
| Best-effort importer history | 518 files passed, one skipped; 4,196 tests passed, three skipped; 1,227.75 s | Completed `260726`; historical timing only |
| PPTX export surfaces | Polar fallback, table warning, raster policy, and local media embedding exist in current source/tests | Reuse implemented contracts; residual physical playback/parity stays gated |
| PowerPoint oracle | Prior gap remains independently fail-closed | Current G5/Phase 15 owner; never infer from importer evidence |
| Upstream parity | Archived comparison with stale source metadata | Historical-only, non-blocking |

The manifest records every explicit older-plan row, one authority for each open
capability, reusable outcomes, residual work, claim ceilings, source subjects,
and freshness rules. Completed work is never marked for reimplementation.

## Scope and Claim Lock

Allowed at phase entry:

- single-user self-hosted editor;
- trusted author-controlled presentation HTML/CSS/JS;
- bounded best-effort PPTX import;
- importer-corpus qualification for the exact pinned 11-deck manifest;
- exact original recovery only for retained, hash-bound original bytes.

Forbidden at phase entry:

- multi-tenant security;
- universal PowerPoint compatibility;
- 1:1 visual fidelity without exact oracle evidence;
- OfficeCLI qualification from importer-corpus evidence.

Future valid-edited-package, exact promoted editable-row, and
environment-bound PowerPoint claims remain conditional on their own G2, G4,
and G5 evidence.

## OfficeCLI Pre-G0 Stop Rule

The only candidate identity remains a hypothesis:

- version: `1.0.135`;
- expected length: `33,111,928` bytes;
- expected SHA-256:
  `937DB176B585E874AA5BFF48D536BCE78037665CD862B5DEEFE56E79977E6588`.

No configured absolute administrator path or governance-owned real-gateway
receipt was available to this workstream. Therefore legal/provenance,
license/NOTICE, selected-asset checksum, real version output, valid-fixture
acceptance, malformed-fixture typed rejection, timeout/output/path enforcement,
and redacted host/runtime receipt fields are **unresolved**. Static tests, mocks,
the pin, and importer 11/11 cannot make this gate green. G0 must not start.

## Command Baseline

Canonical future commands and output locations are machine-readable in the
manifest. Phase 1 governance did not spend the heavy downstream budget:

| Command | Phase 1 result | Duration | Reason / retained location |
| --- | --- | ---: | --- |
| `git status --short` | Pass, captured | 107 ms | This report |
| `git rev-parse HEAD` | Pass, captured | 55 ms | This report |
| `git describe --tags --always --dirty` | Pass, captured | 68 ms | This report |
| `npm run lint` | Structured not-run | 0 ms | Downstream gate; no product source changed |
| `npm run build` | Structured not-run | 0 ms | Downstream gate; no product source changed |
| `npm run test:coverage` | Structured not-run | 0 ms | Phase 3 owns fresh comparable suite baseline |
| `npm run test:pptx:importer-qualification` | Structured not-run | 0 ms | Retained 11/11 evidence reused; rerun on release subject |
| `npm run test:pptx:browser-audit:full` | Structured not-run | 0 ms | Expensive downstream browser gate |
| `npm run test:pptx:oracle:integrity` | Blocked / not-run | 0 ms | Exact evidence manifest and role receipts were not supplied |

The three Git durations were measured during acceptance revalidation after the
planned Phase 1 files existed. The phase-entry outputs in
`Repository and Worktree` remain the authoritative clean-entry snapshot.

Focused TDD evidence:

1. RED:
   `npx vitest run tests/unit/release-scope-governance-contract.test.js --maxWorkers=1`
   failed as intended with `6/6` tests failing because the manifest/report did
   not exist.
2. GREEN: recorded after final manifest validation below.
3. Whitespace gate: recorded after final owned-file diff validation below.

## Freshness Rules

- Any source, dependency, corpus, manifest, policy, environment, or artifact
  change invalidates only the evidence bound to that subject.
- Historical counts and timings are inputs, not a current performance baseline.
- A path existing is not a pass; exact command, subject, result, and claim
  ceiling must agree.
- Corrections are additive annotations. Historical evidence is not moved,
  deleted, or rewritten.

## Final Focused Verification

- `npx vitest run tests/unit/release-scope-governance-contract.test.js --maxWorkers=1`
  passed: 1 file, 6 tests, 0 failures.
- Owned-file `git diff --check` and equivalent no-index checks for the three new
  untracked files passed.
- `release-scope-manifest.json` parsed successfully as JSON.
- The governance test remains below the repository's 200-line code-file limit.

## Unresolved Blockers

1. Real OfficeCLI physical/legal/supply-chain receipt is absent from this
   governance-owned evidence; stop before G0.
2. Relationship classifications still require owner review before source-plan
   status metadata changes.

## Physical follow-up on 2026-09-25

The matching local `1.0.135` executable was found and its size, hash, and
version checked against the upstream release. After the legal/provenance
manifest fields were reviewed, the real gateway returned `PROCESS_FAILED` on
the pinned `good-package.pptx`. Direct OfficeCLI validation exited 1 because
the file lacks OPC relationship declarations. A disposable PowerPoint-created
package passed the direct validator, but the production decoder rejected its
real `success: true` JSON because it expects `valid: true`. No passing physical
receipt exists. See [the redacted blocker report](./officecli-physical-feasibility-blocker.md).
The stop-before-G0 decision remains in force; this annotation does not revise
the earlier governance snapshot.
