---
phase: 1
title: 'Baseline consolidation and release-scope lock'
status: pending
priority: P0
effort: '1-2 engineer-days'
dependencies: []
---

# Phase 1: Baseline consolidation and release-scope lock

## Context Links

- [Plan overview](./plan.md)
- [Completed native-strict 11/11 plan](../260917-1500-pptx-native-strict-11-of-11-qualification-deep-tdd/plan.md)
- [In-progress package-first OfficeCLI plan](../260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/plan.md)
- [In-progress production-readiness plan](../260810-0921-verified-production-readiness-remediation-deep-tdd/plan.md)
- [Completed controls/elements/Reveal.js 6 plan](../260821-1631-controls-elements-reveal-upgrade-deep-tdd/plan.md)
- [Completed full-codebase remediation](../260820-0235-full-codebase-review/plan.md)
- [Completed PPTX reliability closeout](../260726-0616-pptx-import-reliability-ux-evidence-hardening-deep-tdd/plan.md)
- [Historical upstream parity plan](../archive/260523-0500-upstream-parity-verification-tdd/plan.md)
- [Current release evidence](../reports/260824-controls-elements-reveal-upgrade-release-evidence.json)
- [Current PPTX readiness record](../reports/pptx-import-release-readiness-260728-1756.md)
- [Pinned OfficeCLI qualification contract](../260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/phase-02-officecli-qualification-and-reproducible-distribution.md)
- [Real OfficeCLI gateway](../../server/services/pptx-import/officecli/gateway.js)
- [OfficeCLI qualification manifest](../../server/services/pptx-import/officecli/qualification-manifest.json)
- [Root third-party notice](../../NOTICE)
- [Product scope and security model](../../README.md#security-model)
- [Roadmap and current claim boundaries](../../docs/project-roadmap.md)

## Goal/Overview

Create one machine-readable, reviewable baseline for this release program before
changing product, tests, CI, or release automation. Lock the product as a
single-user, self-hosted editor and lock the release objective as truthful,
evidence-bounded PowerPoint native fidelity. Consolidate existing plans and
evidence by reference; do not restart completed implementation.

Before any expensive G0 package-authority or matrix implementation, run a
physical feasibility, legal, and supply-chain spike against the real typed
gateway and the administrator-provided OfficeCLI `1.0.135` binary. Mocks and
static contract tests cannot satisfy this spike. A failed spike stops this
program for explicit re-planning instead of allowing G0 work to accumulate
behind an unusable dependency.

Current facts to preserve:

- Repository `HEAD` at planning time is
  `ce034e634fdccd769954fef88f3c199d1f8ab77a`, described as
  `v1.16.0-5-gce034e63`.
- `v1.16.0` is the latest normal SemVer tag. A malformed historical tag
  `vv1.7.0` exists and must never be selected by release automation.
- The current manifest-bound importer qualification is 11/11 with zero unmapped
  scene-graph nodes, zero permanent placeholders, and zero blockers. This is
  importer-corpus evidence only.
- The package-first plan remains in progress at 77/244 checklist items and 0/6
  claim gates. OfficeCLI, edited-package, exact-row, Windows-artifact, and
  PowerPoint-oracle evidence remain independently fail-closed.
- The only candidate OfficeCLI identity is version `1.0.135`, expected byte
  length `33,111,928`, and expected SHA-256
  `937DB176B585E874AA5BFF48D536BCE78037665CD862B5DEEFE56E79977E6588`.
  These values are hypotheses until recomputed from the selected official asset
  and exercised through the real gateway on this host.
- Historical full-unit evidence recorded 518 passed files, one skipped file,
  4,196 passed tests, three skipped tests, and 1,227.75 seconds. Later completed
  editor evidence records 1,419/1,419 suites and 4,745 passed tests of 4,748.
  These records are evidence inputs, not substitutes for a fresh baseline.
- Current untracked files include this plan directory and unrelated
  `test_derive.cjs`, `test_sm.cjs`, and `test_source_map.cjs`. The three scripts
  are user-owned and excluded from this plan.

## Scope and Non-Goals

### Scope

- Inventory active, completed, blocked, superseded, and historical plans that
  overlap release, PPTX fidelity, CI, docs, or test governance.
- Physically prove the pinned OfficeCLI candidate is legally reviewable,
  checksum-identical, version-identical, and usable through the real gateway on
  one valid and two malformed fixtures before G0 starts.
- Record which plan remains authoritative for each open capability.
- Record reusable evidence with source path, date, commit/subject, claim ceiling,
  and freshness status.
- Lock supported deployment/trust scope:
  - single operator;
  - local/private self-hosting or externally authenticated reverse proxy;
  - trusted author-controlled presentation HTML/CSS/JS;
  - no built-in multi-tenant identity product.
- Lock native-fidelity terminology:
  - importer-corpus qualification;
  - exact original recovery;
  - valid edited package;
  - exact promoted editable rows;
  - environment-bound Microsoft PowerPoint evidence.
- Mark overlap as `reuse`, `blocks`, `supersedes`, or `historical`; never infer
  completion from a stale checkbox.

### Non-Goals

- No product implementation.
- No new parser, mapper, OOXML patcher, OfficeCLI gateway, chart adapter, or
  PowerPoint oracle.
- No OfficeCLI mutation or production enablement. The spike may invoke only the
  existing typed `version`/`validate` qualification path and may add a
  fail-closed spike runner, receipt schema, tests, and legal notice.
- No re-execution of completed 11/11 remediation.
- No built-in authentication, RBAC, SaaS, collaboration, PostgreSQL, or plugin
  marketplace work.
- No claim that importer strict success proves PowerPoint compatibility.
- No moving or deleting old evidence. Historical records remain auditable.
- No edits to unrelated untracked scripts or user-owned dirty work.

## Key Insights

1. Native-strict 11/11 is complete but has a narrow claim ceiling. Re-running its
   implementation as part of this release would create duplicate ownership.
2. Package-first G0-G5 remains the sole owner of edited-package and exact-row
   native fidelity. This plan may sequence and release it, not replace its
   architecture.
3. Production-readiness work is partly complete and still blocks package-first
   through its pending portable export, compatibility receipt, durable media,
   and closeout phases. Phase 1 must preserve that dependency.
4. Upstream parity is already physically under `plans/archive/`, but its
   frontmatter still says `in_progress` and `docs/upstream-parity-matrix.md`
   reads like a live blocked gate. Phase 2 will explicitly convert both to
   historical context.
5. Existing evidence comes from different dates and subjects. A path existing is
   not proof that its result applies to the release SHA.
6. Release scope must remain single-user. Missing multi-user auth is not a defect
   in this product model; network exposure without the documented external auth
   boundary remains a deployment risk.
7. OfficeCLI is a physical dependency, not a future paperwork item. Discovering
   an unusable binary, incompatible output schema, or unacceptable distribution
   obligation after G0 would invalidate the critical path after expensive work.
8. Old UI plans can provide historical regression evidence, but unrelated
   accessibility, ribbon, and EditorPage backlog is not silently absorbed into
   this native-fidelity release.

## Requirements

### Functional

1. Create a release-scope manifest with one row per relevant plan/evidence source.
2. Every row must include:
   - absolute or repository-relative source path;
   - current recorded status;
   - authoritative owner;
   - relationship to this plan;
   - reusable outcome;
   - open work;
   - claim ceiling;
   - freshness rule.
3. Include at minimum these plan relationships:
   - `260917...`: completed evidence, reused, never reimplemented;
   - `260710...`: authoritative open package-first implementation;
   - `260810...`: prerequisite/open production-readiness work;
   - `260821...`: completed editor/runtime evidence;
   - `260820...`: completed source remediation with historical conditional
     release decision;
   - `260726...`: completed bounded best-effort importer evidence;
   - `260808...`: classify current implemented/export evidence before deciding
     whether its unversioned plan is historical;
   - `archive/260523...`: historical upstream comparison only.
4. Classify every older plan in the explicit classification table below. A
   grouped row is allowed only when every listed plan has the same relationship,
   claim ceiling, and non-scope decision.
5. Record explicit release claims allowed and forbidden at phase entry.
6. Record exact baseline commands and output locations for later phases.
7. Add a governance contract test that fails on a missing owner, duplicate
   authority, missing path, contradictory status, or forbidden claim promotion.
8. Add an OfficeCLI spike contract that requires:
   - official upstream/release URL and acquisition timestamp;
   - Apache-2.0 license text hash, upstream NOTICE presence/absence, redistribution
     analysis, and required root/website notice text;
   - recomputed byte length and SHA-256 matching the pin;
   - real `1.0.135` version output decoded by production code;
   - real gateway validation of
     `server/data/test-corpus/adversarial/good-package.pptx`;
   - fail-closed typed rejection of `bad-crc.pptx` and `malformed-xml.pptx`;
   - bounded stdout/stderr, exit code, reason code, schema version, fixture hash,
     binary hash, host identity, and duration in a redacted receipt.
9. The spike must use the configured absolute administrator path, stage the
   content-addressed execution copy, and prohibit PATH lookup or runtime download.
10. Stop and re-plan before G0 if any legal/provenance field is unresolved,
    checksum/version differs, the valid fixture fails, malformed fixtures are
    accepted or crash, production decoders reject real output, or the gateway
    cannot enforce its existing timeout/output/path contract.

### Non-Functional

- Manifest ordering deterministic by capability then plan path.
- JSON output canonical enough for stable diffs.
- No generated evidence contains secrets, slide content, local usernames, or
  bearer capabilities.
- Historical evidence remains immutable; corrections are additive annotations.

## Architecture/Data Flow

```text
official OfficeCLI asset + license/notice + real Windows gateway
  -> physical feasibility receipt
  -> stop/re-plan OR authorize baseline/G0 sequencing

current plans + reports + docs + git metadata
  -> classify status and claim ceiling
  -> release-scope-manifest.json
  -> governance contract test
  -> approved baseline report
  -> Phase 2 docs/version governance
  -> Phase 3 test-topology work
  -> Phase 4 CI/release work

completed implementation
  -> referenced as reusable evidence
  -> never copied into a new implementation owner
```

Authority map:

| Capability                                  | Authority after Phase 1                                                |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| Single-user trust/deployment model          | `README.md`, `docs/deployment-guide.md`, `docs/system-architecture.md` |
| Current importer qualification              | `260917...` evidence and qualification manifest                        |
| Edited-package/native row fidelity          | `260710...` package-first plan                                         |
| Remaining production hardening prerequisite | `260810...` plan                                                       |
| Current editor/Reveal contracts             | completed `260821...` plan and executable tests                        |
| Release version and docs truth              | Phase 2 contract                                                       |
| Vitest topology/performance                 | Phase 3 contract                                                       |
| Build/release lineage                       | Phase 4 contract                                                       |
| Upstream comparison                         | historical-only archive                                                |

## Explicit Older-Plan Classification

The Phase 1 manifest must contain one row for each path below. “Excluded” means
the plan may supply regression evidence but contributes no implementation tasks
to this release.

| Older plan/evidence path                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Classification in this release                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `260917-1500-pptx-native-strict-11-of-11-qualification-deep-tdd`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `reuse-completed`; importer-corpus evidence only                                                        |
| `260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `open-owner`; sole owner for package-first/OfficeCLI row implementation                                 |
| `260810-0921-verified-production-readiness-remediation-deep-tdd`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `open-prerequisite`; remaining production-hardening work                                                |
| `260821-1631-controls-elements-reveal-upgrade-deep-tdd`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `reuse-completed`; editor/runtime regression evidence                                                   |
| `260820-0235-full-codebase-review`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `reuse-completed`; source/runtime remediation evidence                                                  |
| `260726-0616-pptx-import-reliability-ux-evidence-hardening-deep-tdd`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `reuse-completed`; bounded importer reliability and historical timing                                   |
| `260724-1444-pptx-import-p1-p3-readiness-remediation-deep-tdd`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `reuse-completed`; lifecycle/durability/security evidence, no row reimplementation                      |
| `260722-1630-pptx-import-p0-readiness-remediation-deep-tdd`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `blocked-evidence-owner`; preserve its PowerPoint-oracle gap, do not relabel pass                       |
| `260808-1700-pptx-export-fidelity-all-surfaces`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `characterize-then-reuse-or-residual`; no duplicate export implementation                               |
| `260531-0511-full-feature-verification-gap-closure-tdd/reports`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `informative-report-container`; no active plan authority                                                |
| `260617-0739-element-control-audit-matrix-tdd/reports`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `informative-report-container`; no active plan authority                                                |
| `260708-1900-verified-ui-accessibility-ux-remediation-deep-tdd`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `excluded-ui-backlog`; unrelated pending UI scope                                                       |
| `260709-0913-verified-ui-findings-remediation-deep-tdd`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `excluded-ui-backlog`; unrelated pending UI scope                                                       |
| `260711-1038-editorpage-ui-ux-remediation-deep-tdd`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `excluded-ui-backlog`; blocked/held UI scope, not a release prerequisite                                |
| `archive/260522-0922-windows-electron-v1-9-1-release`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `historical-release-pattern`; evidence only, never version/tag authority                                |
| `archive/260521-2330-github-actions-visual-baseline-regeneration-tdd`, `archive/260522-1339-qa-confidence-uplift-5-phase-tdd`, `archive/260523-0900-smoke-test-bug-fixes-tdd`, `archive/260524-0959-e2e-cleanup-and-coverage-tdd`, `archive/260530-0854-feature-coverage-traceability-matrix-system-tdd`, `archive/260531-2013-test-system-governance-and-matrix-debt-tdd`, `archive/260611-0902-monorepo-review-remediation-tdd`, `archive/260615-1641-long-term-automated-coverage-expansion-tdd`, `archive/260629-2154-full-application-qa-verification-deep-tdd` | `historical-test-evidence`; Phase 3 may reuse contracts, never stale counts as baseline                 |
| `archive/260524-1729-pptx-import-review`, `archive/260525-1450-pptx-import-unit-conversion-and-scale-fixes`, `archive/260527-1131-pptx-import-real-browser-fidelity-fixes`, `archive/260529-1942-pptx-import-parser-convention-fidelity-fixes-tdd`, `archive/260617-0814-pptx-import-strict-gates-and-ooxml-inspection-tdd`, `archive/260617-0815-pptx-import-gates-and-parser-coverage-tdd`, `archive/260709-1306-pptx-import-native-ooxml-1to1-fidelity-deep-tdd`                                                                                                  | `historical-pptx-evidence`; superseded by current executable gates and named open owners                |
| `archive/260523-0500-upstream-parity-verification-tdd`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `historical-upstream-only`; non-blocking and never implementation authority                             |
| Archived ribbon, icon, modal, template, teaching, accessibility, and EditorPage UI plans not named above                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `excluded-historical-ui`; no implementation scope unless a current executable regression directly fails |

## Deep File Inventory

| Absolute path                                                                                                                                   | Action                                               |    Rough size | Planned content                                                              | Test impact                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------: | ---------------------------------------------------------------------------- | ---------------------------------------------- |
| `C:\Work\NavSlidesEditor\plans\260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd\reports\release-scope-manifest.json`         | Create                                               | 150-250 lines | Canonical plan/evidence/claim relationship ledger                            | Parsed by governance test                      |
| `C:\Work\NavSlidesEditor\plans\260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd\reports\baseline-characterization.md`        | Create                                               | 120-180 lines | HEAD/tag/worktree, command, runtime, count, and evidence-freshness snapshot  | Documentation assertion only                   |
| `C:\Work\NavSlidesEditor\plans\260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd\reports\officecli-physical-feasibility.json` | Create                                               | 100-180 lines | Redacted legal/provenance/binary/fixture/output-schema receipt               | Hard pre-G0 gate                               |
| `C:\Work\NavSlidesEditor\tests\unit\release-scope-governance-contract.test.js`                                                                  | Create                                               | 120-170 lines | Schema/path/authority/status/claim-ceiling checks                            | Focused RED/GREEN gate                         |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\officecli\physical-feasibility.test.js`                                                    | Create                                               | 120-180 lines | Receipt schema, exact pin, valid/malformed fixture, stop-rule contract       | Physical spike gate                            |
| `C:\Work\NavSlidesEditor\scripts\officecli\run-physical-feasibility.mjs`                                                                        | Create                                               | 120-180 lines | Invoke production qualification/gateway only; emit canonical receipt         | Real Windows command                           |
| `C:\Work\NavSlidesEditor\NOTICE` and `C:\Work\NavSlidesEditor\website\NOTICE.md`                                                                | Modify if legal review requires                      |      Existing | OfficeCLI attribution/license/NOTICE obligations without claiming bundling   | Notice contract                                |
| `C:\Work\NavSlidesEditor\plans\260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd\plan.md`                                             | Read/reference; metadata edit only if owner approves |   1,346 lines | Preserve as sole package-first owner; add superseding release-plan link only | No production test change                      |
| `C:\Work\NavSlidesEditor\plans\260810-0921-verified-production-readiness-remediation-deep-tdd\plan.md`                                          | Read/reference; metadata edit only if owner approves |     345 lines | Preserve open prerequisite status and phase ownership                        | No production test change                      |
| `C:\Work\NavSlidesEditor\plans\260917-1500-pptx-native-strict-11-of-11-qualification-deep-tdd\plan.md`                                          | Read/reference only                                  |     100 lines | Reuse completed importer qualification                                       | Existing qualification remains downstream gate |
| `C:\Work\NavSlidesEditor\plans\260821-1631-controls-elements-reveal-upgrade-deep-tdd\plan.md`                                                   | Read/reference only                                  |    ~250 lines | Reuse completed editor/runtime evidence                                      | Existing matrix/runtime gates                  |
| `C:\Work\NavSlidesEditor\plans\260820-0235-full-codebase-review\plan.md`                                                                        | Read/reference only                                  |    ~130 lines | Retain historical remediation and Docker evidence                            | Existing runtime contracts                     |
| `C:\Work\NavSlidesEditor\plans\260726-0616-pptx-import-reliability-ux-evidence-hardening-deep-tdd\plan.md`                                      | Read/reference only                                  |         Large | Reuse 1,227.75-second baseline as historical context                         | Phase 3 benchmark reference                    |
| `C:\Work\NavSlidesEditor\plans\260808-1700-pptx-export-fidelity-all-surfaces\plan.md`                                                           | Characterize                                         |     ~80 lines | Decide active residual vs absorbed historical work from executable evidence  | Focused export tests determine status          |
| `C:\Work\NavSlidesEditor\plans\archive\260523-0500-upstream-parity-verification-tdd\plan.md`                                                    | Defer metadata correction to Phase 2                 |    ~220 lines | Historical-only source                                                       | Phase 2 docs contract                          |

## Tests Before (RED)

1. Create `physical-feasibility.test.js` first. It must reject a missing receipt,
   fake executable, wrong version/hash/length, unresolved license/NOTICE status,
   success on either malformed fixture, unrecognized real output, or receipt
   containing absolute paths/raw output.
2. Run the real spike before creating G0 tasks:

```powershell
$env:NAVSLIDES_OFFICECLI_PATH = 'C:\absolute\admin-provided\OfficeCLI.exe'
$env:OFFICECLI_ACQUIRED_AT = '<verified local acquisition time in ISO 8601>'
node scripts/officecli/run-physical-feasibility.mjs `
  --binary $env:NAVSLIDES_OFFICECLI_PATH `
  --valid server/data/test-corpus/adversarial/good-package.pptx `
  --malformed server/data/test-corpus/adversarial/bad-crc.pptx `
  --malformed server/data/test-corpus/adversarial/malformed-xml.pptx `
  --manifest server/services/pptx-import/officecli/qualification-manifest.json `
  --acquired-at $env:OFFICECLI_ACQUIRED_AT `
  --out plans/260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd/reports/officecli-physical-feasibility.json
npx vitest run server/services/pptx-import/officecli/physical-feasibility.test.js
```

Expected RED before a physical run: receipt absent. A fake-backed green result is
invalid.

3. Create `release-scope-governance-contract.test.js`.
4. Assert the manifest exists and uses schema version 1.
5. Assert every row in the explicit classification table appears exactly once.
6. Assert exactly one owner for each open capability:
   - package-first edited export;
   - production-readiness prerequisite;
   - release version/docs;
   - Vitest topology;
   - green-SHA release.
7. Assert completed plans cannot be marked `implement-again`.
8. Assert all excluded UI plans have `implementationScope: false`.
9. Assert the upstream parity plan has `relationship: "historical"` in the new
   manifest even before its own metadata is corrected in Phase 2.
10. Assert forbidden claims include:

- multi-tenant security;
- universal PowerPoint compatibility;
- 1:1 visual fidelity without exact oracle evidence;
- OfficeCLI qualification from importer-corpus evidence.

11. Assert every evidence row has a freshness rule and subject/commit field.
12. Run and retain the expected failure:

```powershell
npx vitest run tests/unit/release-scope-governance-contract.test.js
```

Expected RED: manifest/report absent.

## Implementation Steps

1. Complete the physical OfficeCLI spike and legal/supply-chain review. Verify
   the official release source, recompute the binary and license hashes, record
   whether upstream ships a NOTICE, and update local notices if required.
2. Exercise the real production qualification and gateway decoders on the valid
   and malformed fixtures. Preserve only redacted structured outputs.
3. Apply the stop/re-plan rule. No release-scope approval and no G0 start while
   the receipt is absent, blocked, or failed.
4. Capture `git status --short`, exact `HEAD`, `git describe`, and normal SemVer
   tags. Do not mutate the worktree.
5. Inventory non-archived plan directories with a `plan.md`; normalize status
   only in the new manifest. Do not rewrite source plans yet.
6. Read the named evidence records and classify each as:
   `current`, `historical`, `blocked`, `open-owner`, or `informative`.
7. Build the capability authority map. Stop if two plans claim current ownership
   of the same implementation surface.
8. Record the single-user scope lock and the five-level fidelity vocabulary.
9. Record completed-work reuse rules. Completed 11/11, editor runtime, full
   codebase remediation, and importer reliability work become prerequisites or
   evidence, not new tasks.
10. Record excluded UI plans as evidence-only/non-scope. Do not copy their todos.
11. Record open dependencies and explicit unblock conditions.
12. Add baseline commands for later reproducibility:

```powershell
git status --short
git rev-parse HEAD
git describe --tags --always --dirty
npm run lint
npm run build
npm run test:coverage
npm run test:pptx:importer-qualification
npm run test:pptx:browser-audit:full
npm run test:pptx:oracle:integrity
```

13. Do not require all heavy commands to pass in Phase 1. Record result, duration,
    host facts, and exact reason for blocked/structured-skipped lanes.
14. Make the physical-spike and governance tests green.
15. Review the manifest against existing plan owners before any status edit.

## Refactor

- Extract repeated status/claim enums into the test helper only if used at least
  twice.
- Keep one manifest, not separate plan and evidence ledgers.
- Replace prose duplication with links to source plans.
- Remove speculative work items that are already complete.
- Keep unresolved physical gates explicit rather than introducing mock evidence.

## Tests After (GREEN)

```powershell
npx vitest run tests/unit/release-scope-governance-contract.test.js
npx vitest run server/services/pptx-import/officecli/physical-feasibility.test.js
git diff --check
```

GREEN assertions:

- Every required plan/evidence path resolves.
- No capability has two active implementation owners.
- Completed work is marked reuse-only.
- Upstream parity is historical-only.
- Single-user and native-fidelity claim ceilings are explicit.
- User-owned untracked scripts remain absent from all planned write sets.
- OfficeCLI `1.0.135` has a passing real-gateway receipt, or the program is
  explicitly stopped before G0 with a recorded re-plan decision.

## Test Scenario Matrix

| Priority | Scenario                                                 | Expected result                                                   |
| -------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| Critical | Two plans own edited-package publication                 | Contract fails with both paths                                    |
| Critical | 11/11 importer evidence is labeled PowerPoint-compatible | Contract fails forbidden claim                                    |
| Critical | Multi-user auth silently becomes release scope           | Contract fails scope lock                                         |
| High     | Completed plan is scheduled for reimplementation         | Contract fails relationship                                       |
| High     | Evidence has no SHA/subject/freshness rule               | Contract fails                                                    |
| High     | Open prerequisite is mislabeled completed                | Contract fails against source status/evidence                     |
| Medium   | Historical plan path moves                               | Contract reports missing path; reviewer updates link deliberately |
| Medium   | Informative evidence is retained                         | Contract passes but claim ceiling remains non-authoritative       |

## Regression Gate Commands

Focused phase gate:

```powershell
npx vitest run tests/unit/release-scope-governance-contract.test.js
```

Final downstream gates, not all Phase 1 blockers:

```powershell
npm run lint
npm run build
npm run test:coverage
npm run test:e2e
npm run test:pptx:importer-qualification
npm run test:pptx:browser-audit:full
npm run test:pptx:oracle:qualify
```

## Todo

- [ ] Capture exact repository/tag/worktree baseline.
- [ ] Verify OfficeCLI official asset, license, NOTICE, checksum, and byte length.
- [ ] Run pinned `1.0.135` through the real gateway on valid/malformed fixtures.
- [ ] Validate and retain the redacted physical feasibility receipt.
- [ ] Apply the pre-G0 stop/re-plan rule.
- [ ] Create canonical release-scope manifest.
- [ ] Create baseline characterization report.
- [ ] Assign one authority per open capability.
- [ ] Mark completed work reuse-only.
- [ ] Mark unrelated current and historical UI plans implementation-scope false.
- [ ] Record package-first and production-readiness dependencies.
- [ ] Lock single-user product scope.
- [ ] Lock fidelity claim vocabulary and forbidden claims.
- [ ] Add RED governance contract.
- [ ] Make focused contract GREEN.
- [ ] Confirm unrelated untracked scripts are untouched.
- [ ] Obtain owner review of relationship classifications.

## Success Criteria

- One canonical manifest explains every relevant plan/evidence relationship.
- No completed implementation is duplicated by this plan.
- Package-first and production-readiness ownership remains intact.
- Importer-corpus evidence cannot be promoted to OfficeCLI or PowerPoint proof.
- Single-user scope is explicit and test-guarded.
- Historical upstream parity cannot block this release.
- G0 cannot begin from mocks, contract-only evidence, or an unverified OfficeCLI
  supply-chain/legal posture.
- The focused governance test passes from a clean checkout.

## Risk Assessment

| Risk                                       | Observable signal                                  | Pre-decided response                                                           |
| ------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| Stale plan status treated as current truth | Source plan status conflicts with newer evidence   | Record both; classify freshness; do not silently rewrite                       |
| Duplicate implementation ownership         | Two manifest rows own same capability              | Stop Phase 1 and obtain owner decision                                         |
| Completed work restarted                   | New task duplicates completed file/test outcome    | Delete duplicate task; link completed evidence                                 |
| False fidelity promotion                   | Claim wording exceeds evidence ceiling             | Fail governance test; block downstream release wording                         |
| User work overwritten                      | Planned writes include unrelated untracked paths   | Abort; remove paths from write set                                             |
| Baseline host mismatch                     | Runtime comparison lacks same-host metadata        | Mark performance result informative only                                       |
| OfficeCLI legal/provenance gap             | License/NOTICE/source cannot be verified           | Stop before G0; obtain counsel/upstream clarification or remove the dependency |
| Pinned binary drift                        | Version, length, or SHA-256 differs                | Reject before spawn; reacquire from approved source; never repin silently      |
| Real output schema drift                   | Production decoder rejects real stdout/result      | Stop and re-plan adapter/version; mocks cannot override physical failure       |
| Malformed package accepted or crashes      | Bad CRC/XML reports success or escapes typed error | Keep OfficeCLI disabled; treat candidate as unqualified and re-plan            |

## Security Considerations

- Preserve the trusted-author model; do not flag intentional authored HTML as a
  release vulnerability by itself.
- Treat uploads, imported documents, external URLs, credentials, capabilities,
  package authority, and release tokens as real trust boundaries.
- Store no bearer capability, PAT, environment secret, slide content, or raw
  customer deck in plan evidence.
- Single-user does not mean public-network safe. Keep external authentication and
  loopback/default exposure rules explicit.
- Evidence subject hashes prove identity/integrity only; they do not create
  independent attestation.

## Dependencies/Next Steps

- No prerequisite phase.
- Phase 2 consumes the approved manifest to align versions, locks, changelog,
  docs, and historical plan metadata.
- Phase 3 uses the recorded full-suite history only as context; it must generate
  a fresh comparable runtime baseline before accepting the 30% target.
- Phase 4 consumes the locked release claim and exact current version/tag rules.
- Any dispute over package-first or production-readiness ownership blocks only
  the affected capability; do not expand scope by guessing.

## Physical spike outcome on 2026-09-25

The real pinned OfficeCLI rejected the checked-in `good-package.pptx`. The
[failed-spike report](./reports/officecli-physical-feasibility-blocker.md)
records the identity, exact OPC validation failure, and successful disposable
PowerPoint-generated counterexample. A clean isolated account/VM and outbound
deny policy are also unproven. Apply the stop/re-plan rule above; Phase 1 remains
pending and no later release gate inherits this developer-session probe.
