# Windows workflow caller-boundary evidence

## Result and scope

**PASS — executable synthetic command-boundary / production-contract evidence only.** This closes the locally reachable caller evidence gaps for P12-17 and adapter/producer binding evidence for P12-13/P12-14; it does **not** qualify a physical Windows release.

Executed command:

```text
node plans/261009-0901-navslides-full-reliability-deep-tdd/reports/.tmp-windows-caller-boundary-smoke.mjs
```

Exit status: **0**. Observed wall time: **12.66 seconds**. The runner was subsequently deleted. Durable machine-readable evidence: [windows-caller-boundary-smoke.json](windows-caller-boundary-smoke.json).

Scope is the exact extracted bodies and contract inputs fingerprinted in the JSON, not a repository-wide runtime identity gate. No workflow, product, permanent test, or configuration files changed. The extraction was performed after Main announced SOURCE_FROZEN. Workflow commands and PowerShell loop/exit checks were preserved; only ordinary GitHub expression interpolation was rendered for the attestation body. No declaration-based qualification or source-string assertion substitutes for execution were used.

## P12-17: execute the actual PowerShell loops

Each owned sandbox contained two plain-text `.exe`-named files: `000-owned-first-fails.exe` and `001-owned-second-would-pass.exe`. Neither file was executed. A PowerShell `node` command boundary invoked a real native Node subprocess, recording arguments and returning **47** for the first artifact and **0** for the second. `$LASTEXITCODE` was set by that native process, not manually fabricated. Native automatic error promotion was disabled so the workflow's own immediate exit-code checks were responsible for aborting.

The second-artifact positive control was executed independently for every operation and exited **0**. Each extracted workflow body then exited **1**, with exactly **one** validator call, to the first artifact. No second-artifact call or appended downstream Windows receipt sentinel was reached; no passed receipt existed.

| Actual workflow body | Lines | Result |
|---|---:|---|
| Independent pre-upload signature loop | 106–109 | Immediate pre-upload failure; second EXE not consumed |
| Independent post-download signature loop, including subsequent copy | 131–135 | Immediate post-download failure; second EXE not consumed; subsequent evidence copy not reached |
| Per-EXE provenance loop and aggregate normalization | 139–148 | Immediate `capture-attestation` failure; second EXE not consumed; no aggregate evidence or normalization call |

All line references are to `.github/workflows/reusable-windows-qualification.yml`. Exact bodies, body SHA-256, rendered-body SHA-256, interpolation inputs, PowerShell invocation/status/stderr, native call sequence, positive controls, and absence assertions are retained in the JSON. Body hashes:

- Pre-upload: `788a435f563594844767796271686027016e089a6cf40ec46fbdfb623b7f61ca`
- Post-download: `7c454a52ee6739186cd27677ac43d652f6e86841fca04cf12d3b5c47e82bd340`
- Attestation: `6f2aa98357a333dad5f1aeaca379cd58fc52b529dc849a5ca288ec24a98262ef`

The appended passed-receipt sentinel was a harness observation, not the production Windows receipt generator. It proves downstream reachability is prevented when these blocks throw; actual production receipt publication/hosted action execution was not attempted.

## P12-13/P12-14: actual adapter and consumer contracts

Inspected existing coverage:

- `scripts/ci/windows-verification-evidence.test.js:98–117`: positive raw schema-2 envelope, retained raw hash/scope/limitations, wrong subject/hash/run rejection. It did not itself feed that adapter output into the Windows leaf consumer or check a wrong client digest.
- `scripts/ci/release-receipts.test.js:25–31,118–123`: synthetic receipt DAG positive and wrong child subject/client/parent edge rejection.
- `scripts/ci/release-evidence-producer.test.js:64–90`: actual Linux CLI positive/negative synthetic wire inputs. No direct duplicate Linux/OfficeCLI/PowerPoint run CLI test was located in the inspected CI test scope.

Executed missing evidence at the smallest actual contract/CLI boundary, without adding permanent tests:

1. Fed the existing explicitly synthetic schema-2 raw receipt through production `createPhysicalReleaseEnvelope`, `createHostReceipt`, and `assertWindowsLeafEvidence`. **Accepted**, retaining raw bytes/hash, `local-physical-feasibility` claim scope, and both memory/descendant-containment limitations. Other Windows evidence fields came from the repository's explicitly synthetic Windows leaf fixture; they are not genuine signature/physical proof.
2. Production envelope rejected wrong producer run, wrong producer workflow, wrong source subject, and wrong client digest. Production Windows leaf consumer rejected wrong OfficeCLI envelope subject and client digest.
3. Executed the existing `stageSyntheticLinuxCli` fixture through the actual `release-receipt-workflow.mjs linux` CLI: **exit 0**. Used that produced Linux receipt and its default-branch admission as the actual physical-preflight consumer inputs.
4. Actual `physical-preflight` CLI rejected all three equal-run pairs: Linux=OfficeCLI, Linux=PowerPoint, OfficeCLI=PowerPoint. Each exited **1**, specifically reporting `CI/OfficeCLI/fidelity producer run IDs must be distinct`.
5. Actual `physical-preflight` CLI also rejected wrong OfficeCLI producer workflow, wrong raw subject, and wrong raw/client binding. Each exited **1** for the intended identity/binding reason, not module/file setup failure. No physical admission or Windows passed receipt was created.

Complete command arguments, statuses, rejection messages, source/input hashes, and synthetic-fixture scope are in the JSON. Existing tests were inspected; this report does not claim a Vitest suite rerun. The actual production contracts and CLI described above were executed directly.

## Explicit external blockers

Not exercised and not claimed:

- Genuine protected Windows signer, independent certificate-chain/RFC3161 trust, post-download bytes, and genuine gh provenance verification.
- Genuine physical OfficeCLI acquisition/receipt or environment-bounded PowerPoint oracle acquisition.
- Real gh authentication/API, producer-run capture, GitHub artifact download/upload, hosted Windows workflow, or release/push operations.
- A complete positive `physical-preflight`/`windows` CLI qualification using genuine PowerPoint evidence. The positive adapter-to-Windows result is a production validator contract with synthetic external fixtures, not physical qualification.

The observed Node module-type warnings were retained unchanged in raw stderr. No unexpected verification failure or genuine caller defect occurred, so no source repair or failure-counsel branch was needed.

## Cleanup proof

- All **54** owned temporary fixture/script/log files beneath `.tmp-windows-caller-boundary-owned` were removed in the runner's `finally` block; the runner checked that its owned root was absent.
- The standalone `.tmp-windows-caller-boundary-smoke.mjs` runner was removed afterward by tool-confirmed delete.
- Only the durable JSON and this Markdown report remain. There are no permanent wiring tests, workflow/product edits, executed dummy EXEs, real signing calls, or real gh operations from this assignment.
