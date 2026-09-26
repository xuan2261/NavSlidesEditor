---
phase: 2
title: 'Release state and documentation governance'
status: pending
priority: P0
effort: '2-3 engineer-days'
dependencies: [1]
---

# Phase 2: Release state and documentation governance

## Context Links

- [Phase 1 baseline and scope lock](./phase-01-start.md)
- [Root package manifest](../../package.json)
- [Workspace lockfile](../../package-lock.json)
- [Electron isolated server lock](../../electron/server-package-lock.json)
- [Workspace lock updater](../../scripts/update-workspace-lock.js)
- [Electron lock updater](../../scripts/update-electron-server-lock.js)
- [Runtime version owner](../../runtime-versions.json)
- [README release statement](../../README.md)
- [Project overview](../../docs/project-overview-pdr.md)
- [Project roadmap](../../docs/project-roadmap.md)
- [Project changelog](../../docs/project-changelog.md)
- [Codebase summary](../../docs/codebase-summary.md)
- [Historical upstream matrix](../../docs/upstream-parity-matrix.md)
- [Archived upstream parity plan](../archive/260523-0500-upstream-parity-verification-tdd/plan.md)
- [Existing Electron release contract](../../tests/unit/electron-release-readiness-contract.test.js)
- [Existing runtime closure contract](../../tests/unit/production-runtime-closure-contract.test.js)

## Goal/Overview

Establish one enforceable release-state contract for version manifests, generated
locks, changelog, release-facing docs, and historical plan status. Correct current
drift, then select the next unreleased SemVer during implementation. The selected
version must be at least `1.16.1`, must be derived from release contents and SemVer
impact at that time, and must never reuse or move the already published
`v1.16.0` tag.

Current exact drift:

- Root, client, server, shared, and website manifests say `1.16.0`.
- `package-lock.json` root and workspace entries still say `1.15.7`.
- `electron/server-package-lock.json` still says `1.15.7`.
- `README.md`, `docs/project-roadmap.md`, and
  `docs/codebase-summary.md` say `v1.16.0`.
- `docs/project-overview-pdr.md` still says `v1.15.1`.
- `docs/project-changelog.md` has no `## v1.16.0` section; current material is
  concentrated under `Unreleased`.
- The upstream parity plan is physically archived but says `status: in_progress`;
  `docs/upstream-parity-matrix.md` remains a blocked May 2026 comparison artifact
  without a prominent historical-only release disclaimer.
- `v1.16.0` is immutable published history. A release candidate for this program
  therefore cannot keep package version `1.16.0` or create/move that tag.

## Scope and Non-Goals

### Scope

- Preserve `1.16.0` as the latest published historical release.
- Derive and record `NEXT_VERSION` during implementation from the approved
  release delta:
  - minimum `1.16.1`;
  - patch for compatible fixes/hardening only;
  - minor for compatible user-visible capability;
  - major only for an approved breaking contract.
- Bump every manifest, generated lock, changelog Unreleased heading/metadata, and
  release-facing next-release reference to `NEXT_VERSION` before the first RC.
- Regenerate both checked-in locks from manifests using repository scripts.
- Enforce equality across:
  - `package.json`;
  - `client/package.json`;
  - `server/package.json`;
  - `shared/package.json`;
  - `website/package.json`;
  - root/workspace entries in `package-lock.json`;
  - root entry in `electron/server-package-lock.json`.
- Separate the `v1.16.0` release record from changes after tag `v1.16.0`.
- Align release-facing docs to distinguish the root candidate version from the
  latest published tag.
- Mark upstream parity and its matrix historical/non-blocking while retaining
  immutable evidence and links.
- Document package manifests as product-version authority and
  `runtime-versions.json` as runtime-toolchain authority.
- Support prerelease RC tags `vNEXT_VERSION-rc.N` in release-state validation
  without treating them as the final current release.

### Non-Goals

- No hard-coded guess of the exact next version in this plan.
- No creation, deletion, movement, or replacement of `v1.16.0`.
- No final or RC tag creation in this phase; this phase prepares and validates
  the version state before an operator creates a tag.
- No package dependency upgrade except lock metadata necessary to faithfully
  represent current manifests; unexpected dependency graph drift is a stop signal.
- No rewriting old release evidence to claim present behavior.
- No deleting `docs/upstream-parity-matrix.md` or archived reports.
- No claim that changelog prose is executable evidence.
- No source implementation or fidelity change.

## Key Insights

1. `npm ci` consumes `package-lock.json`; manifest/lock version drift undermines
   deterministic release checks even when dependency versions happen to resolve.
2. Electron packaging validates an isolated manifest created from
   `server/package.json`. Its checked-in lock must carry the same project version.
3. `runtime-versions.json` owns Node/Electron/Playwright/Tiptap runtime pins, not
   the app release version. Do not merge these two concepts.
4. `v1.16.0` is already tagged and `HEAD` is five commits later. The changelog
   must distinguish tag content from post-tag `Unreleased` changes using git
   history, not by moving every current bullet into the release section.
5. Upstream parity cannot remain a current release blocker. The project has
   deliberately diverged into a single-user self-hosted editor with current local
   executable contracts.
6. Keeping package manifests at `1.16.0` while releasing from a later SHA makes
   the required `v${package.version}` contract impossible without moving an
   immutable tag. The next version must be selected and bumped before RC.
7. RC tags are prerelease identifiers, not alternate package versions. For
   `package.version = X`, accept `vX-rc.N` during rehearsal and only `vX` for final
   publication.

## Requirements

### Functional

1. Add a release-version governance test before changing locks/docs.
2. Derive `NEXT_VERSION` from the approved release delta and write the decision,
   evidence range, SemVer rationale, and selected value to the Phase 1 release
   scope manifest. It must satisfy `semver.gt(NEXT_VERSION, "1.16.0")` and
   `semver.gte(NEXT_VERSION, "1.16.1")`.
3. Version equality test must parse JSON; no regex-only lock validation.
4. Lock regeneration must use:

```powershell
npm run workspace:lock
npm run electron:lock
```

5. Review lock diffs. Expected intentional change is project/workspace version
   metadata from `1.16.0` to `NEXT_VERSION`; any unrelated dependency resolution change requires
   explanation or rollback.
6. Changelog must contain exactly one immutable `## v1.16.0` heading and an
   `Unreleased (NEXT_VERSION)` section containing only post-tag work.
7. Before RC, README, overview, roadmap, codebase summary, all five manifests,
   and both lock roots/workspace entries must identify `NEXT_VERSION` as the
   upcoming/current candidate while preserving `v1.16.0` in release history.
8. Release-state tests must accept:
   - final tag `vNEXT_VERSION`;
   - RC tags `vNEXT_VERSION-rc.1`, `vNEXT_VERSION-rc.2`, ...;
     and reject:
   - `v1.16.0` for the new release subject;
   - `vNEXT_VERSION-rc.0`;
   - leading-zero RC numbers;
   - package/tag core-version mismatch;
   - arbitrary prerelease labels in release mode.
9. Archived upstream plan frontmatter must become `status: historical` or
   `status: superseded` with a link to this release plan.
10. Upstream matrix must begin with a historical, non-blocking disclaimer and
    must not be linked as current release authority.
11. Existing historical rows and approved upstream SHA
    `ce548c535abc7701ac45cc3164560caba121adce` remain unchanged.

### Non-Functional

- Docs use “current published release” for `v1.16.0`, “next release candidate”
  for `NEXT_VERSION`, and “Unreleased” for post-tag work until final publication.
- Generated locks remain npm lockfile v3.
- No manual editing of transitive lock entries.
- Governance tests work offline and in shallow CI checkouts.

## Architecture/Data Flow

```text
SemVer decision from release delta (NEXT_VERSION >= 1.16.1)
  -> root package version
  -> workspace manifests
  -> workspace lock regeneration
  -> Electron isolated manifest
  -> Electron lock regeneration
  -> release docs/changelog assertions
  -> tag/version verification in Phase 4

Phase 1 relationship manifest
  -> archived upstream plan status
  -> historical banner on upstream matrix
  -> current roadmap/changelog no longer treat parity as release authority
```

Version authorities:

| Data                       | Authority                                                                 |
| -------------------------- | ------------------------------------------------------------------------- |
| Published release history  | Immutable tag `v1.16.0` and its changelog section                         |
| Next product version       | Recorded SemVer decision, then root `package.json`, workspaces, and locks |
| Runtime/toolchain versions | `runtime-versions.json` plus executable contract test                     |
| Release history            | Git tag plus `docs/project-changelog.md`                                  |
| Current behavior           | Source and executable tests/docs, not historical plan prose               |
| Upstream comparison        | Archived plan and historical matrix only                                  |

## Deep File Inventory

| Absolute path                                                                                | Action                 |    Rough size | Planned change                                                        | Test impact                 |
| -------------------------------------------------------------------------------------------- | ---------------------- | ------------: | --------------------------------------------------------------------- | --------------------------- |
| `C:\Work\NavSlidesEditor\tests\unit\release-version-governance-contract.test.js`             | Create                 | 120-180 lines | Manifest/lock/docs/changelog/historical-plan assertions               | Primary RED/GREEN gate      |
| `C:\Work\NavSlidesEditor\package.json`                                                       | Modify                 |     155 lines | Select and set `NEXT_VERSION`; scripts remain lock owners             | Parsed by new test          |
| `C:\Work\NavSlidesEditor\client\package.json`                                                | Modify                 |     ~55 lines | Mirror `NEXT_VERSION`                                                 | Version equality            |
| `C:\Work\NavSlidesEditor\server\package.json`                                                | Modify                 |     ~55 lines | Mirror `NEXT_VERSION`                                                 | Version equality            |
| `C:\Work\NavSlidesEditor\shared\package.json`                                                | Modify                 |       5 lines | Mirror `NEXT_VERSION`                                                 | Version equality            |
| `C:\Work\NavSlidesEditor\website\package.json`                                               | Modify                 |         Small | Mirror `NEXT_VERSION`                                                 | Version equality            |
| `C:\Work\NavSlidesEditor\package-lock.json`                                                  | Regenerate             |  14,818 lines | Replace stale metadata with `NEXT_VERSION`                            | `npm ci`; lock contract     |
| `C:\Work\NavSlidesEditor\electron\server-package-lock.json`                                  | Regenerate             |   2,333 lines | Replace stale metadata with `NEXT_VERSION`                            | Electron lock validation    |
| `C:\Work\NavSlidesEditor\README.md`                                                          | Modify                 |     524 lines | Candidate/current `NEXT_VERSION`; preserve v1.16.0 history            | Release docs contract       |
| `C:\Work\NavSlidesEditor\docs\project-overview-pdr.md`                                       | Modify                 |     169 lines | Align to `NEXT_VERSION`; preserve product scope                       | New docs assertion          |
| `C:\Work\NavSlidesEditor\docs\project-roadmap.md`                                            | Modify                 |     567 lines | Clarify active release gates and historical parity                    | Docs and PPTX contracts     |
| `C:\Work\NavSlidesEditor\docs\project-changelog.md`                                          | Modify                 |     536 lines | Add immutable `v1.16.0`; target `NEXT_VERSION` under Unreleased       | Changelog assertion         |
| `C:\Work\NavSlidesEditor\docs\codebase-summary.md`                                           | Modify                 |     239 lines | Distinguish published release from root candidate version             | Existing Electron contract  |
| `C:\Work\NavSlidesEditor\docs\upstream-parity-matrix.md`                                     | Modify                 |      96 lines | Add historical/non-blocking banner; preserve rows                     | Historical-status assertion |
| `C:\Work\NavSlidesEditor\plans\archive\260523-0500-upstream-parity-verification-tdd\plan.md` | Modify metadata/header |    ~220 lines | `in_progress` -> `historical`; add superseded-by link                 | Governance test             |
| `C:\Work\NavSlidesEditor\tests\unit\electron-release-readiness-contract.test.js`             | Modify                 |      45 lines | Include overview/roadmap/changelog version checks or delegate clearly | Focused regression          |
| `C:\Work\NavSlidesEditor\tests\unit\production-runtime-closure-contract.test.js`             | Modify if needed       |     126 lines | Assert isolated lock project version aligns with server manifest      | Runtime regression          |

## Tests Before (RED)

Create the dedicated contract and assert:

1. Root version is greater than `1.16.0`, at least `1.16.1`, and equals the
   recorded `NEXT_VERSION` decision.
2. All five manifests equal root `NEXT_VERSION`.
3. Root lock top-level, root package entry, and four workspace package entries
   equal root version.
4. Electron lock top-level/root package entry equal server version.
5. All locks use `lockfileVersion: 3`.
6. README, overview, roadmap, and codebase summary show `NEXT_VERSION` as the
   candidate/current release and do not relabel post-tag work as `v1.16.0`.
7. Changelog has one immutable `v1.16.0` section and one
   `Unreleased (NEXT_VERSION)` section.
8. Release-state parser accepts `vNEXT_VERSION` and `vNEXT_VERSION-rc.1`, and
   rejects `v1.16.0`, `vNEXT_VERSION-rc.0`, leading-zero RC numbers, loose tags,
   arbitrary prerelease labels, and core-version mismatches.
9. Archived upstream plan is not `pending`, `todo`, or `in_progress`.
10. Upstream matrix contains “historical” and “non-blocking” before its metadata.
11. No current release doc claims upstream parity is required.

Run:

```powershell
npx vitest run tests/unit/release-version-governance-contract.test.js tests/unit/electron-release-readiness-contract.test.js tests/unit/production-runtime-closure-contract.test.js
```

Expected RED reasons:

- package manifests still use the already released `1.16.0`;
- root/workspace lock entries are `1.15.7`;
- Electron lock is `1.15.7`;
- project overview is `v1.15.1`;
- changelog lacks `v1.16.0`;
- archived plan still says `in_progress`;
- matrix lacks a historical banner.

## Implementation Steps

1. Confirm Phase 1 records `v1.16.0` as immutable published history.
2. Compute the release delta from `v1.16.0..HEAD`, classify SemVer impact, select
   `NEXT_VERSION >= 1.16.1`, and record the decision before editing manifests.
   Stop for owner review if any change is breaking or version impact is disputed.
3. Add RED final/RC tag fixtures using the selected value.
4. Bump all five manifests to `NEXT_VERSION` before any RC tag can exist.
5. Capture pre-change lock hashes:

```powershell
Get-FileHash package-lock.json -Algorithm SHA256
Get-FileHash electron/server-package-lock.json -Algorithm SHA256
```

6. Regenerate workspace lock from current manifests:

```powershell
npm run workspace:lock
```

7. Regenerate Electron isolated server lock:

```powershell
npm run electron:lock
```

8. Review structured diffs. If transitive dependency versions changed, stop and
   determine whether npm metadata drift or manifest changes caused it. Do not
   accept broad lock churn as a side effect of version repair.
9. Build the immutable `v1.16.0` changelog section from:
   - tag `v1.16.0`;
   - prior tag range;
   - release evidence existing at that tag.
10. Build `Unreleased (NEXT_VERSION)` from `git log v1.16.0..HEAD`; do not place
    post-tag work in the release section.
11. Correct `docs/project-overview-pdr.md` and all release-facing version drift.
12. Update roadmap wording:

- importer strict 11/11 is current;
- package-first and PowerPoint gates remain separate;
- upstream parity is historical only.

13. Change archived upstream plan metadata to historical and add:
    - archive date/reason;
    - approved upstream SHA retained for provenance;
    - superseded-by current local release governance;
    - explicit “not a release gate.”
14. Add the same prominent notice to `docs/upstream-parity-matrix.md` without
    changing historical row outcomes.
15. Make focused tests green, including final and RC release-state fixtures.
16. Run `npm ci --ignore-scripts` in a disposable/clean workspace if lock
    regeneration produced any dependency graph change.
17. Record selected version, SemVer rationale, and final lock hashes in the Phase
    1 release-scope manifest evidence row.

## Refactor

- Keep version-parsing helpers in one test module.
- Remove duplicated literal version checks from older tests only after the new
  contract owns them.
- Do not create a second changelog or root `CHANGELOG.md`.
- Do not add a general documentation generator.
- Prefer links to historical evidence over copying old parity tables.

## Tests After (GREEN)

```powershell
npx vitest run tests/unit/release-version-governance-contract.test.js tests/unit/electron-release-readiness-contract.test.js tests/unit/production-runtime-closure-contract.test.js
npm ci --ignore-scripts
npm run electron:lock
git diff --exit-code electron/server-package-lock.json
npm run workspace:lock
git diff --exit-code package-lock.json
git diff --check
```

The second lock-generation pass must be idempotent.

## Test Scenario Matrix

| Priority | Scenario                                           | Expected result                            |
| -------- | -------------------------------------------------- | ------------------------------------------ |
| Critical | Root manifest `NEXT_VERSION`, root lock stale      | Contract fails                             |
| Critical | New release subject remains `1.16.0`               | Contract fails; published tag is immutable |
| Critical | RC core version differs from package version       | Contract fails before packaging            |
| Critical | Electron lock differs from server version          | Contract fails before packaging            |
| Critical | Changelog records post-tag commits as v1.16.0      | Review/gov test fails classification       |
| High     | One workspace version drifts                       | Contract identifies workspace path         |
| High     | Upstream parity marked active                      | Contract fails historical status           |
| High     | Historical matrix rows are deleted                 | Review rejects evidence destruction        |
| High     | Lock regeneration changes dependencies             | Stop; investigate, do not merge silently   |
| Medium   | Runtime version owner differs from product version | Allowed; concepts documented separately    |
| Medium   | README wording changes but version remains aligned | Existing release test stays green          |

## Regression Gate Commands

Focused:

```powershell
npx vitest run tests/unit/release-version-governance-contract.test.js tests/unit/electron-release-readiness-contract.test.js tests/unit/production-runtime-closure-contract.test.js
```

Phase gate:

```powershell
npm run lint
npm run build
npm run runtime:verify
npm run docs:build
```

Final downstream release gates:

```powershell
npm run test:coverage
npm run test:e2e
npm run test:pptx:importer-qualification
npm run test:pptx:browser-audit:full
npm run test:pptx:oracle:qualify
```

## Todo

- [ ] Add failing version-governance contract.
- [ ] Derive and record exact `NEXT_VERSION >= 1.16.1`.
- [ ] Add final and `-rc.N` release-state fixtures.
- [ ] Bump every manifest before RC.
- [ ] Regenerate workspace lock.
- [ ] Regenerate Electron isolated lock.
- [ ] Review lock diffs for dependency churn.
- [ ] Add `v1.16.0` changelog section from tag evidence.
- [ ] Retain only post-tag work under `Unreleased`.
- [ ] Correct project overview version.
- [ ] Align roadmap and codebase summary wording.
- [ ] Mark upstream plan historical/non-blocking.
- [ ] Add historical banner to upstream matrix.
- [ ] Make lock generation idempotent.
- [ ] Run focused, build, runtime, and docs gates.
- [ ] Update Phase 1 manifest with final lock hashes.

## Success Criteria

- A recorded, justified `NEXT_VERSION >= 1.16.1` exists before RC.
- All product manifests and both locks report exactly `NEXT_VERSION`.
- Lock regeneration is idempotent and has no unexplained dependency churn.
- Release-facing docs distinguish immutable `v1.16.0` history from the
  `NEXT_VERSION` candidate.
- Release-state validation supports `vNEXT_VERSION-rc.N` and `vNEXT_VERSION`
  without accepting loose or mismatched tags.
- Changelog separates tagged release history from post-tag Unreleased work.
- Upstream parity remains auditable but cannot block current release.
- Existing runtime/toolchain pins remain unchanged and green.
- Focused governance, runtime, build, and docs tests pass.

## Risk Assessment

| Risk                                    | Observable signal                                         | Pre-decided response                                      |
| --------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| Lock regeneration upgrades dependencies | Large resolved/integrity diff beyond version metadata     | Stop; restore locks; investigate npm/manifests separately |
| Changelog rewrites history              | Post-tag SHA appears under v1.16.0                        | Move item back to Unreleased                              |
| Historical evidence destroyed           | Matrix rows/reports removed or rewritten                  | Reject change; add banner only                            |
| Version remains already released        | New RC/final subject still says `1.16.0`                  | Fail contract; derive/bump `NEXT_VERSION`; never move tag |
| Unsupported RC tag                      | `rc.0`, leading zero, arbitrary label, or mismatched core | Reject before verification/packaging                      |
| SemVer impact disputed                  | Breaking or user-visible delta has no agreed bump         | Stop before manifest edits; obtain owner decision         |
| Docs contradict fidelity ceiling        | “PowerPoint-compatible/1:1” lacks exact oracle qualifier  | Fail docs review and release contract                     |
| Generated lock differs by platform      | Second clean generation changes file                      | Block; normalize generator/toolchain first                |

## Security Considerations

- Lockfiles are supply-chain inputs. Review all unexpected resolved URLs,
  integrity values, and dependency changes.
- Do not place tokens, release credentials, workflow run URLs containing
  credentials, or private deck names in changelog/docs.
- Historical upstream code/evidence is not trusted executable input.
- Keep current single-user external-auth deployment warning intact.
- Version alignment must not weaken runtime action pinning or package integrity
  verification.

## Dependencies/Next Steps

- Depends on Phase 1’s approved scope and authority manifest.
- Phase 3 starts only after `npm ci` and runtime contracts consume aligned locks.
- Phase 4 consumes the exact version/tag/changelog contract and rejects any tag
  whose version differs.
- If release history for `v1.16.0` cannot be reconstructed from repository
  evidence, record a minimal factual section and an explicit provenance gap; do
  not invent release notes.
