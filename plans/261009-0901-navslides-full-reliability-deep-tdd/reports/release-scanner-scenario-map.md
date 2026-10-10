# Release/scanner acceptance map

## Evidence contract and frozen checkpoint

`bounded-pass` applies only to the named executed local assertion/caller; it is not release qualification. `blocked` names an external prerequisite for the genuine hosted/physical suboracle. `unmapped` names an exact remaining local assertion for which executed proof was not identified; this does not itself assert production code is defective. Do not turn unmapped local assertions into externally blocked work.

Report aliases, relative to this plan:
- **F02**: `reports/final-coverage-frozen02.json`; **I02**: `reports/final-coverage-frozen02-runtime.json`.
- **SCAN**: `reports/scanner-cli-genuine-current02.json`.
- **WIN**: `reports/windows-caller-boundary-smoke.json`.
- **GH**: `reports/github-caller-boundary-smoke-green.json`.
- **LOCAL**: `reports/remaining-required-scanner-local-proof.json` and its companion `.md`.
- **WLOCAL**: `reports/windows-local-remaining-proof.json` (initial independent proof, not aggregate GREEN).
- **ROOT-RED**: `reports/release-root-gap-proof-before.json`.
- **LIVE**: `reports/release-live-readonly-config.json`.
- **ROOT-AFTER**: `reports/release-root-gap-proof-after.json`; **ROOT-GREEN**: `reports/root-policy-binding-ci-green.json`.


Subsequent reconciliation uses these Main-verified raw receipts. LOCAL has success:true, all13 expected/actual exits matched and unchanged before/after identities; Main removed all16 owned scaffolds including its temporary test file. ROOT-RED is historical: Main added canonical policyDigest binding, and ROOT-AFTER passes11 actual producer/root CLI rows on unchanged declared source identity `983ff4286bea3b395d345469b5030b7941b048f86e023a906247f9452e08111d`. ROOT-GREEN has149 passed/zero failed across nine actual CI testResults; prior `root-policy-binding-red.json` retains10 pass/one expected failure (old exit0 vs expected1). This is local synthetic-input consumer verification, not external release qualification. WLOCAL remains initial independent proof; fresh17-case `windows-local-remaining-proof-root-policy-current.json` was not available at this reconciliation, so corrected/current-root Windows results are not inferred.

Historical F02 is **failed**: success:false,5,662 passed/one failed/three pending-skipped; I02 process exit1. Sole failure: electron-desktop-runtime-contracts.test.js → verifies confirmation dialogs use non-blocking themed UI without native dialog traps. Platform skips: worker SIGTERM→SIGKILL, storage POSIX permissions, reused-PID lock reclaim. Cited scanner/release suites actually appear passed. I02 before/after full identity equals3ebdfd3c0c77b1ddf379dac6d5e3b5060c636ca0b5d90502f700a5a13fe8b5a0; backend identity equals11b99818295da61dac29fd0439deaf21c34b15430946b12eeb999943cf778ccc. These bind that run, not later policy edits/clean release candidate. Later F03 status follows separately; Main owns final F04/E2E reconciliation.

F03 is now historical **failed**, not running or passed: `reports/final-coverage-frozen03.json` records5,650 passed/three pending/zero failed assertions but one failed suite, vitest-topology-contract, because temporary `remaining-required-scanner.tmp-inventory.test.js` was discovered as an unknown test root. Main reports671 declared source inputs unchanged. Subsequent `reports/topology-after-owned-cleanup.json` passes10 tests/zero failed after owned cleanup. This scoped repair does not promote F03 to passed; Main will run F04 after permanent changes. No final whole-program/E2E qualification is asserted.

`physical-release-envelope.test.js` does **not** appear in F02, `editor-scanner-release-docs-current01.json`, or `semantic-release-regression-final.json`; evidence-ledger also records its absence in `release-portable-integration-final.json`. Requested filters are not execution proof. Adapter assertions really executed in `windows-verification-evidence.test.js` and WIN.

Broader gap inspection: all `scripts/ci/*.test.js` file names were inventoried; source searches covered scripts, tests and OfficeCLI; F02 executed names were inspected beyond the initial release subset, including Authenticode/attestation/subject/governance/physical tests. Source bodies of required-checks, scanner, Windows verifier, receipt parent edges and physical feasibility tests were read. Remaining unmapped entries below were not closed from similar names or aggregate totals.

## P04 — required CI summary

F02 names below belong to `scripts/ci/required-checks.test.js`. `runSummary` executes the **parsed workflow's real Node argv/environment** with synthetic needs; P04-01 really checks CLI exit0, not merely the evaluator function.

| ID | Status | Exact executed proof / remaining limit |
|---|---|---|
| P04-01 C | bounded-pass | `P04-01 accepts all thirteen required successes`, actual workflow CLI exit0. |
| P04-02 C | bounded-pass | `P04-02 rejects skipped required job <ID>` for all13 IDs, actual CLI exit1/job diagnostic. |
| P04-03 C | bounded-pass | `P04-03 rejects empty needs`, all13 `rejects missing required job <ID>` CLI cases; `does not accept inherited required jobs or results`. |
| P04-04 H | bounded-pass | CLI rejects failure/cancelled/timed_out and unknown/pending/empty/SUCCESS/null/false/0; shell-metacharacter data refusal. |
| P04-05 H | bounded-pass | Malformed-job/nonobject-needs cases; real CLI invalid JSON undefined/empty/{/null/[]; diagnostic payload non-echo. |
| P04-06 H | bounded-pass | `P04-06 ignores a failed optional feature coverage job`, CLI exit0. |
| P04-07 H | bounded-pass semantic divergence | F02 equality plus LOCAL current P04-07 Vitest assertion control exit0; in-memory parsed workflow removes e2e-chromium/adds synthetic-extra-required, each actual assertion deliberately fails/exit1. Production files immutable; intentional RED reports are not passed test runs. |
| P04-08 H | bounded-pass local; blocked hosted | `P04-08 rejects build failure with dependent E2E skipped`, real CLI; `schedules the summary regardless of upstream outcomes`, source-parsed always(). Actual authorized remote graph with skipped dependency/red summary absent. |
| P04-09 M | bounded-pass | `P04-09 ignores unrelated nonrequired results`, CLI exit0. |
| P04-10 H | bounded-pass failed/skipped/missing shard; hosted blocked | LOCAL actual linux producer CLI: all16 jobs-success control exit0; only Chromium shard2/4 failure or skipped exits1, diagnostic names shard, no linux-ci-receipt, inputs preserved. F02 missing-shard cases remain valid. Synthetic wire, not hosted receipts. |

## P05 — full scanner matrix

Unless SCAN is specified, raw proof is F02 → `scripts/verify-container-supply-chain.test.js`, suite `container supply-chain fail-closed boundary`. Numbered mismatch cases bind the source mutation array. Negative mutations, SBOM/browser inventories and invocation wrappers are synthetic contract inputs; genuine report cases use reduced captured Trivy output.

| ID | Status | Exact executed proof / remaining limit |
|---|---|---|
| P05-01 C | bounded-pass | `rejects missing or incomplete report {}/null/undefined/{"SchemaVersion":2}`; source includes [] (reporter renders undefined); CLI {}/null no-receipt cases. |
| P05-02 C | bounded-pass | `rejects malformed Results null/{}/"clean"`; source [null]/[{}] cases have duplicated reporter null/{} labels. |
| P05-03 C | bounded-pass genuine reduced report; blocked candidate | `accepts the actual policy-filtered clean Alpine capture with omitted Vulnerabilities`; `writes a bounded receipt from the genuine clean fixture and explicit workflow evidence`; SCAN clean exit0/status passed. Not candidate-image scope or attestation. |
| P05-04 C | bounded-pass | Empty Results report rejection; mismatch7/8 remove OS/language target,9/10 omit/empty package inventory. |
| P05-05 H | bounded-pass | `rejects malformed vulnerability collections {}/"clean"/null`. |
| P05-06 H | bounded-pass | `rejects unsupported finding severity undefined/"high"/"URGENT"/null`; missing identity cases also passed. |
| P05-07 H | bounded-pass | `rejects unapproved HIGH even without a fix`, CRITICAL counterpart; `rejects genuine severe findings without pruning OS or language targets`. |
| P05-08 H | bounded-pass test-only exceptions | `requires owner, reason, exact CVE/package and unexpired exception`: exact future-expiry pass; empty fields, wrong CVE/package and expired reject. No production exception implied. |
| P05-09 H | bounded-pass | mismatch3/4 target/ImageID; `does not confuse registry manifest digest with Docker configID`; invariants case wrong actualImageID; invocation image/hash mutations. |
| P05-10 H | bounded-pass | `rejects missing, failed, unpinned or unbound invocation evidence`; invocation mutation exitCode1; CLI truncated {, missing file, no receipt, prior receipt/raw-input preservation. SCAN truncated exit1/`successReceiptAbsent:true`. Scan failure is injected, not an observed candidate scan failure. |
| P05-11 H | bounded-pass contract; blocked candidate inventories | `preserves policy and browser/SBOM invariants` changes Playwright version, clears Chromium revision/SBOM; mismatch11/12 package version/purl; invocation browser-image mutation. |
| P05-12 M | bounded-pass | `retains LOW/MEDIUM findings and deterministic duplicate counts`: count3/no severity promotion. |
| P05-13 H | bounded-pass | mismatch0 sets SchemaVersion3; mismatch1 wrong scanner version. |
| P05-14 M | bounded-pass duplicate Results/findings | LOCAL current assertTrivyReport and actual verifier CLI: three duplicated LOW/MEDIUM Results yield6 findings/receipt count6 initially, repeated and reversed. Added duplicated HIGH/CRITICAL records first/last yield8 findings with both severe identities preserved; CLI exit1/no passed receipt. Genuine reduced Alpine base, synthetic duplicate records/findings/inventories. |

SCAN is genuine **disposable Alpine replay**, not candidate qualification. Config ID `sha256:c83674e1999044d33d751661371b873539f47e5b5c5ca3320c7e0377acca6238` is distinct from registry manifest `alpine@sha256:5291449c3df73caf6ed85e649dec1b9e818b39a5d8c871e97afc13e9cd5e8fa8`. Trivy0.74.0 archive SHA256 `94c40e0696e4b907a74b7b2e1438d5d72ebaca83115817407f568a002d520842`; DB metadata hash `31d2ed8405653669bcc0f211a8b4dffb48767102c73a53469e2874f46e536051`; raw capture hash `a29a499dd5a3b8c3d5bf1c15f6aa435d546e24bd6c37324f7abcee4c898df14c`; reduced fixture hash `aed24e903be3d6c10640652cc6d727eedbc7deefd0ed879f4b8d0edcda850778`. Binary SHA matched primary release digest/checksum; **signature not verified**. Capture is HIGH/CRITICAL-filtered: zero findings is not all-severity vulnerability-free. SBOM/browser inputs explicitly synthetic.

## P12 — Windows/Office

F02 aliases: WV=`scripts/ci/windows-verification-evidence.test.js`; RR=`scripts/ci/release-receipts.test.js`; RP=`scripts/ci/release-evidence-producer.test.js`; AU=`scripts/ci/authenticode-policy.test.js`; AT=`scripts/ci/attestation-policy.test.js`. EXE/signature/physical receipt fixtures are synthetic unless explicitly stated. Dummy EXEs are never executed.

| ID | Status | Exact executed proof / remaining limit |
|---|---|---|
| P12-01 C | bounded-pass consumer refusal; physical blocked | WLOCAL missing-office-physical-receipt and missing-fidelity-physical-receipt each run createGreenShaRoot→assertWindowsLeafEvidence, reject Windows actual leaf evidence is required/no success artifact. Synthetic root positive control succeeds. F02 prerequisite/governance refusal remains narrower supporting proof. |
| P12-02 C | bounded-pass | WV incomplete/wrong-version cases each singleton/mixed versions/extra EXE; RR `requires Windows artifact nsis-exe/portable-exe`. |
| P12-03 C | bounded-pass fixture/identity consumer refusal | WLOCAL wrong-pinned-fixture-hash-at-root changes bad-crc fixture SHA and rebinds raw canonical/gate hashes; authoritative validator rejects Fixture evidence is invalid/AUTHORITATIVE_RECEIPT_INVALID, no success artifact. F02/WIN subject/client/run/binary negatives retained. Synthetic receipt, not physical qualification. |
| P12-04 H | bounded-pass extracted signer guards; protected signing blocked | WLOCAL exact PowerShell signing body missing/relative/inside-checkout cases each exit1 with expected diagnostic, no signer invocation/no success artifact. No real signer/certificate provisioned. |
| P12-05 H | bounded-pass policy; physical pre-upload blocked | AU `fails closed on invalid publisher/thumbprint/timestamp evidence`, synthetic metadata only. |
| P12-06 H | bounded-pass policy; real downloaded artifact blocked | AU invalid hash; WV wrong statement-subject digest; RR exact artifact-digest binding. No genuine download/tamper/signature run. |
| P12-07 H | bounded-pass policy; genuine EXE attestation blocked | AT wrong subject/workflow/issuer; WV certificate mutation loop; RR wrong workflow/ref/repository root cases. |
| P12-08 H | local harness correction pending; genuine physical blocked | WLOCAL forced-false-acceptance bad-crc/malformed-xml cases initially supplied only one malformed fixture: actual PHYSICAL_PREREQUISITE_MISSING/Exactly two malformed fixtures are required, not intended MALFORMED_FIXTURE_ACCEPTED. These are harness failures, not proof of the oracle. Correction under counsel; no aggregate GREEN. F02 safe seams prove ordinary preflight rejection only. |
| P12-09 H | blocked | No NSIS install→launch→save/reopen→uninstall user-data preservation execution. |
| P12-10 H | blocked | No packaged portable EXE launch/render/export from spaces/non-ASCII path. Browser portable archive proof is different. |
| P12-11 H | blocked | No actual Microsoft PowerPoint repaired/corrupted package observation/matching fidelity run. |
| P12-12 M | bounded-pass scope retention | WV raw scope/limitations; WIN retains local-physical-feasibility/memory-limit-unproven/descendant-containment-unproven. Not feature-fidelity qualification. |
| P12-13 C | bounded-pass synthetic production contracts | WIN `schema2 raw adapter -> Windows leaf consumer`, passed:true: createPhysicalReleaseEnvelope→createHostReceipt→assertWindowsLeafEvidence; raw hash/scope/limits retained. WV passed too; do not invent envelope test-file result. |
| P12-14 H | bounded-pass synthetic CLI/caller | WIN duplicate Linux=OfficeCLI/Linux=PowerPoint/OfficeCLI=PowerPoint, wrong OfficeCLI producer/raw subject/client exit1/no admission/no Windows receipt. Positive schema2 uses distinct runs; GH all duplicate pairs reject before outputs. No hosted physical download. |
| P12-15 C | bounded-pass actual CLI negatives; genuine attestation blocked | WLOCAL attestation-windows control exit0; old-source, missing-one-exe and missing-one-attested-exe each exit1 with exact source/completeness/digest-coverage diagnostic, no success artifact and unchanged input. Synthetic gh wire/dummy bytes. RP empty gh and WV/AT/RR policy proof retained. |
| P12-16 C | bounded-pass process-verifier refusal; policy harness correction pending; real trust blocked | WLOCAL actual authenticode-post capture seam invokes independent verifier with explicit exit47→CLI exit1/independent Authenticode-RFC3161-chain failed/no success artifact. Separate policy case fails at pre-upload signature, not expected post-download signature: harness correction under counsel, no aggregate GREEN. Synthetic signer/verifier result is not genuine RFC3161/trust evidence. |
| P12-17 H | bounded-pass extracted PowerShell | WIN actual preupload/postdownload/ghattestation bodies: first dummy validator exit47→caller exit1, second not consumed/downstream receipt absent; second-only positive controls exit0. Synthetic command boundary, not signing/Office/download trust. |

WV `accepts the actual pinned gh verified upstream wire shape under an exact source policy` uses genuine upstream **Python-wheel** output: adapter compatibility, not NavSlides Windows provenance. `windows-producer-genuine-wire-green.json` has actual WV/RP testResults (19 pass), but its name does not transform synthetic EXE fixtures into genuine signing evidence.

## P16 — release closeout

| ID | Status | Exact executed proof / remaining limit |
|---|---|---|
| P16-01 C | bounded-pass synthetic | F02 release-subject mismatched main-CI/receipt subject; RR stale Linux source; GH wrong-sha exit1/no outputs. |
| P16-02 C | bounded-pass synthetic; real root blocked | RR omitted gates/selected skipped/blocked/failed/not-selected; P04 per-job missing/skipped. No final hosted required run/qualified root. |
| P16-03 C | bounded-pass actual root consumer; synthetic working-tree inputs | ROOT-AFTER verify-root wrong image-file digest/wrong policyVersion each exit1; same-version changed requireRfc3161Timestamp now exits1, root preserved per Main-verified proof; legacy missing policyDigest and well-formed wrong policyDigest each exit1. Matching positive/root restoration exit0. Canonical binding added by Main; prior ROOT-RED exit0 bypass is retained historical, not current passed evidence. No hosted image/EXE qualification implied. |
| P16-04 C | bounded-pass synthetic | RR missing nsis-exe/portable-exe and `requires both mandatory release targets even when no target is selected`. |
| P16-05 H | bounded-pass real sandbox Git CLI | release-state dirty tracked/untracked, assume-unchanged/skip-worktree, wrong peeled commit/missing or noncanonical tag/version drift. Owned temp repos, not clean actual candidate. |
| P16-06 H | bounded-pass synthetic CLI | RP missing shard through CLI; RR chromium shard evidence rejection. |
| P16-07 H | bounded-pass missing-parent/attempted back-edge | ROOT-AFTER current verify-root missing-parent and attempted-child-self-back-edge-parent each exit1/windows parent receipt hash mismatch, frozen root preserved. Only missing/attempted child self/back-edge rejection is proven, not generic cycle traversal/hash fixed-point construction. Older ROOT-RED parent refusal is historical supporting proof. |
| P16-08 H | bounded-pass extracted Bash; live permissions blocked | GH denied-refresh-pr exit1/actionable owner-policy diagnostic. Synthetic gh denial/owned local remote, no permission escalation/PAT fallback. |
| P16-09 H | bounded-pass extracted Bash | GH no-diff exit0/no gh calls/unchanged refs; existing-refresh-pr exit0/no pr-create, refresh branch updated/unrelated branch unchanged. |
| P16-10 H | bounded-pass extracted Bash; live config observed, hosted run blocked | GH approved-main positive plus identity/duplicate-pair negatives/all20 passed remain synthetic. LIVE independently observes actual master/public and Actions default read/can-approve false. Synthetic main is not actual repository policy; no real candidate run selected/qualified by these receipts. |
| P16-11 H | bounded-pass RC classification; local publication guard unmapped; publish authority blocked | release-state matching final vs RC classification passed. Exact draft/RC/final authorization/no-public-effect caller oracle not executed. No publication authorized. |
| P16-12 H | bounded-pass actual invalidation/requalification journey; final targets blocked | ROOT-AFTER same-version changed shipped policy refuses frozen root/exit1; explicit create-root requalification then verify-root exit0 with new canonical policyDigest571a1916d321ee22ba852344371353c1ea4946421ea1c4da3cd4cdfbcd9d2666 versus prior3142dc9070d78961dd46e8a9613ff945a911b5a221885eec33acbe923fb4fa1e. Restoring old policy rejects requalified root/exit1; restoring matching original policy/root exits0. Eleven-row passed unchanged-source local proof; synthetic leaves/dirty working tree, not fresh physical/hosted qualification. |
| P16-13 M | bounded-pass evergreen docs scope; actual release-note proof absent | F02 release-verification docs `keeps evergreen release docs honest about matrix evidence, stale results, contract-only coverage, and debt`. No qualified release notes/physical Office output. |
| P16-14 C | bounded-pass synthetic real CLI/root | RP declaration-only/no evidence-root refusal; RR no actual Linux leaves; complete synthetic wire positive and missing/stale leaf negatives. No live CI qualification. |
| P16-15 C | bounded-pass policy/normalization; genuine release attestation blocked | AT wrong subject/workflow/issuer/unverified; WV certificate source/issuer/workflow and statement artifact digest mutations; RR wrong workflow/ref/repository and source/client/artifact/issuer bindings. RP actual sandbox bytes + synthetic gh. |

GH's20 cases run actual extracted Bash and owned local Git/file-only bare remote with **synthetic GitHub upstream**. There was no genuine gh/auth/token/API/network/permission mutation/dispatch/publication/remote push; only policy, refresh caller and release run-selection blocks executed, not dependency regeneration/hosted CI/physical acquisition. Original wrong-SHA/branch shell-control-flow RED is retained in `github-caller-boundary-smoke-pre-repair.json`; GREEN does not erase or qualify live CI.

## External prerequisites and exact recorded owners

Owner labels are from phase01 `reports/baseline-gates.json`; no named people are provided there.

| Owner | Missing prerequisite/authority | Grounded report |
|---|---|---|
| 04/16 | Candidate GitHub required graph/leaf-shard receipts; authorization to push/dispatch controlled skipped dependency. | baseline-gates gate9: candidate run; no authorization to push/dispatch. |
| 05/11 | Exact Docker image; pinned Trivy0.74.0/Syft1.52.0; genuine candidate report/SBOM/browser/invocation. | baseline-gates gate10: Docker/Trivy/Syft missing PATH; baseline.json ENOENT. Later SCAN proves disposable Trivy acquisition only, not Docker/Syft/candidate gate. |
| 12 | Qualified OfficeCLI adapter/binary-license-acquisition-fixture-process evidence; actual PowerPoint capture host/manifests/role receipts. | baseline-gates gate12; baseline.json OfficeCLI1.0.153 present and PowerPoint `not-registered`. |
| 12/16 | Authorized protected signer; final NSIS+portable; independent download; Authenticode publisher/thumbprint/RFC3161/trust/valid-at-signing-time and genuine workflow/source attestation. | baseline-gates gate13 and WIN externalBlocked. |
| 16 | Final clean subject and dependent qualification; exact source/client/policy/artifact DAG; separate publish/tag/stage authorization. | baseline-gates gate14 and phase16 steps1/7. |
| Repository owner (role) | Provision release-staging/release-publication environments and approval policy; authorize required live graph/publish operations separately. | LIVE authorized GET-only observation: repository master/public, Actions default read and can_approve_pull_request_reviews:false; both requested release environments404; full inventory only github-pages. This does not prove a protected release environment exists or authorize mutation. |

**Baseline independently reconfirmed:** `reports/baseline-gates.json` records xuan2261/NavSlidesEditor/defaultBranch:master/private:false. LIVE observes the same current repository fact at `2026-10-09T21:50:36.198Z`; auth preflight exit0, details not retained. GET-only endpoints returned Actions defaults and release environment metadata: release-publication/staging404, inventory total1/names[github-pages]. No API mutation/publication occurred (mutationCount0). Missing release-environment/approval provisioning is repository-owner work; neither local code nor synthetic main proves protection/approval configured.

Physical phase12 evidence variables must come from the same actual run: PPTX_EVIDENCE_MANIFEST, PPTX_ROLE_RECEIPTS, PPTX_CORPUS, PPTX_GOLDENS, PPTX_ACTUALS, PPTX_REPORT_DIR, SUBJECT_SHA. No self-signed substitute, synthetic receipt or bare npm command satisfies those prerequisites.

## Reachable local proof gaps (not external waivers)

- P04-07/10 and P05-14 local gaps are now closed by LOCAL's13 individually asserted cases; real hosted/candidate qualification remains separate.
- P12-01/03/04/15 now have exact local consumer/caller proof in WLOCAL. P12-08 forced false acceptance and P12-16 post-download policy-result harness corrections remain pending; the actual independent verifier exit47 refusal already passed. No WLOCAL aggregate GREEN is claimed.
- P16-03/P16-12 local consumer gaps are now closed by ROOT-AFTER's11 passed actual CLI rows: canonical policy binding, same-version refusal, explicit requalification, restored-policy refusal, missing/wrong digest refusal and original-root restoration. ROOT-RED remains historical. P16-07 current missing-parent/attempted self/back-edge rejection also passed; no generic cycle/fixed-point claim.
- P16-11 local publish authorization/no-public-effect caller remains unmapped. Actual publication, clean final candidate, physical qualification and hosted graphs remain separately blocked; LIVE supplies current environment/Actions facts but does not supply those authorities or evidence.

These are bounded discovery conclusions after broader source/raw inspection, not instructions to add tests, change scope, or lower policy. Main owns any further adjudication. No whole run, phase or release is generically declared qualified.
