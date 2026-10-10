# Semantic release regression repair

## Cause and authority

Recorded RED: `artifact://537` (full-suite run, not rerun to confirm). Failures in the assigned group asserted exact workflow strings, documentation phrasing, fixture creation syntax, or a historical lock snapshot rather than executing release decisions. The reusable workflow assertions inspected slices with missing/changed job headers and required old inline implementation after executable producer extraction. These are invalid implementation-dependent tests under the accepted developer retirement policy; they are not evidence that qualification has passed or that a security defect is absent.

The governance mismatch was current workspace semantic lock hash `d5c5a86289fb0b932c7f5bc126753270239a11ffb4c3a38a854e232bbecebc78` versus historical approved-scope hash `02ee829c6890f15505668e4d824b38718b18d4975d607e487aabab17433609a4`. The historical scope decision is signed-source evidence for an older state, not authority requiring all future dependency bytes to remain identical. Neither historical evidence nor current dependency locks were modified. Current package/lock version coherence remains enforced by the retained case and release-state CLI.

Counsel approved the exact retirements. No production workflow, release policy, README, qualification report gate, or historical decision manifest changed.

## Exact retired cases

Deleted `tests/unit/github-actions-build-once-contract.test.js`:
- `compiles the client once and consumers verify downloaded bytes`
- `binds checkout and artifact names to the full subject SHA`
- `makes main CI consume one manifest-bound client artifact`

Deleted `tests/unit/github-actions-signing-provenance-contract.test.js`:
- `pins every third-party action to an immutable commit`
- `keeps signing and publication protected and verifies downloaded assets`

Deleted `tests/unit/github-actions-green-sha-release-contract.test.js`:
- `accepts only an existing tag and contains no synthetic tag path`
- `stages a draft on the existing tag before protected publication`

Deleted `tests/unit/github-actions-multi-host-receipt-contract.test.js`:
- `selects Windows and explicitly declines unqualified desktop targets` (copied configuration assertions, not execution of selection enforcement)
- `requires selected physical Windows gates and a non-circular root DAG`

Deleted `tests/unit/electron-release-readiness-contract.test.js`:
- `distinguishes the published release from the root candidate version`
- `keeps release-facing docs aligned with the root package version`
- `keeps the GitHub release workflow scoped to Windows Electron packages`

Deleted `tests/unit/no-adhoc-presentation-creation.test.js`:
- `does not create root presentations outside test fixtures` (source regex/fixture wiring, not isolation or creation behavior)

Removed from `tests/unit/release-version-governance-contract.test.js`:
- `records one justified next version newer than immutable v1.16.2`
- `distinguishes the candidate from the current published release in docs`
- `separates immutable release history from pending Unreleased work`
- `keeps upstream parity evidence historical and non-blocking`

Retained unchanged meaningful expectations in `aligns every product manifest and checked-in lock to the root version`; removed only its historical semantic-hash pin. Retained `accepts only matching final and positive non-zero RC release tags`, which calls production `parseReleaseTag`.

## Exercised surviving security behavior

The existing executable tests exercise production decisions, not source strings:

Removed `tests/unit/release-version-governance-helpers.js` after Main expanded ownership: repository reference search found no remaining live imports of either helper, only declarations and historical report mentions. It only implemented the retired historical comparison/hash calculations. Historical report references were preserved.
- `scripts/ci/release-state.test.js`: actual CLI checks clean/full subject, final/positive RC tags, tag/HEAD identity, manifest/lock version drift, tracked/untracked dirtiness.
- `scripts/ci/release-subject.test.js`: exact peeled tag/checkout/CI/artifact/receipt subject binding and canonical tag rejection.
- `scripts/ci/release-receipts.test.js`: mandatory Linux/Windows targets, explicit unselected hosts, real leaf requirements, required gates, non-circular parent hashes, wrong subjects/client identities, independent signature/attestation policy rejection.
- `scripts/ci/release-evidence-producer.test.js`: spawned current CLI rejects declaration-only/missing evidence, stale run, missing shard, expired artifacts, changed actual client bytes, invalid scanner invocation, empty attestation results, unapproved policy identity, and changed root children. Complete synthetic wire inputs also round-trip.
- `scripts/ci/authenticode-policy.test.js`: fails closed on unsigned/wrong publisher/thumbprint, missing trusted timestamp/post-download evidence, changed hash.
- `scripts/ci/attestation-policy.test.js`: fails closed on missing artifact, wrong subject/workflow/issuer, unverified bundle.
- `scripts/ci/client-artifact-manifest.test.js` behavioral cases: real creator/verifier CLI binds bytes/locks/subject/dirty identity and rejects missing/extra/changed files, traversal/duplicates/case collisions, symlinks/reparse points, non-NFC names, duplicate locks, identity drift.

## Commands and receipts

1. `npx vitest run tests/unit/release-version-governance-contract.test.js scripts/ci/release-subject.test.js scripts/ci/release-state.test.js scripts/ci/release-receipts.test.js scripts/ci/release-evidence-producer.test.js scripts/ci/authenticode-policy.test.js scripts/ci/attestation-policy.test.js --maxWorkers=1 --no-file-parallelism --reporter=json --outputFile=plans/261009-0901-navslides-full-reliability-deep-tdd/reports/semantic-release-regression-final.json`
   - Exit 0; 73/73 passed, zero failed. Receipt: `semantic-release-regression-final.json` (seven files; Vitest reports fourteen aggregate suite nodes).
2. `npx vitest run scripts/ci/client-artifact-manifest.test.js --maxWorkers=1 --no-file-parallelism -t "^(?!.*(?:includes untracked source in automatic dirty detection|wires verified bytes into Docker and Electron)).*$" --reporter=json --outputFile=plans/261009-0901-navslides-full-reliability-deep-tdd/reports/semantic-release-artifact-final.json`
   - Exit 0; 9 behavioral cases passed; 2 source-string cases deliberately not selected, not changed. Those outside-ownership source audits are not counted as behavior proof or a full-file pass.

3. `npx vitest run tests/unit/release-version-governance-contract.test.js --maxWorkers=1 --no-file-parallelism`
   - Exit 0; 2/2 passed after removing the orphan helper. These repeat the same two retained contracts, not two additional unique cases: 82 unique semantic cases passed across the selected suites.
4. `node .tmp/semantic-release-retirement-smoke.mjs`
   - Final exit 0; the existing test-support module supplied synthetic inputs to the real spawned validator CLI: Linux leaf creation exit 0, root creation exit 0, root verification exit 0, changed child rejection exit 1. This is validator smoke, explicitly not qualification evidence. No new fixture implementation or fallback was introduced.
   - First harness attempt exited 1 before any validator execution because two relative imports resolved outside the repository. Counsel approved correction from `../../scripts` to `../scripts`; final execution above passed. The disposable harness and its isolated temporary receipt directory were removed afterward.
   - Node emitted an existing `MODULE_TYPELESS_PACKAGE_JSON` warning for `scripts/trivy-report-evidence.js`; it was not suppressed or changed.

## Risk and unverified scope

High-severity publication boundaries remain fail-closed; synthetic validator inputs do **not** qualify a physical Windows host, authenticate real installer bytes, establish approved environment protections, demonstrate actual GitHub publication, or prove successful CI build-once scheduling. Static substring/pinning assertions were not reliable runtime proof of those integration properties. No release qualification or publication is claimed. Full-suite/full-build and actual external release execution were intentionally not run in this owned slice. The earlier full-suite failures outside ownership remain Main's integration responsibility.
