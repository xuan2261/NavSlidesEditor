# Current release prerequisites — 2026-11-07

## Scope and evidence limits

Fresh read-only inspection for phases 03/04/05/11/12/16 and the current release/container/Windows scripts. No tests, builds, linters, formatters, installation, signing, dispatch, publication, environment changes or remote writes were performed. This report is capability discovery, **not qualification**. No secret values were printed. Local account paths are described generically where unnecessary.

## Observed capabilities and blockers

| Area | Fresh observation | Exact remaining prerequisite |
|---|---|---|
| Node | `C:/nvm4w/nodejs/node.exe --version` → `v22.22.0`; sibling `npm.cmd` exists. Neither node nor npm resolves on current PATH. | Parent commands must use absolute Node or process-local PATH configuration. |
| GitHub access | Origin is `xuan2261/NavSlidesEditor`. API reports default branch `master`, Actions enabled/all actions allowed, authenticated admin/maintain/push/pull/triage. Default workflow token is read; PR approval setting false. | Technical permission is not authorization to mutate or dispatch. Approved clean frozen candidate and branch relationship remain required. |
| Hosted qualification | Local HEAD `f9ed27b299e800ba2d222c77e73f89c06ea8b111`. Exact SHA/default-branch `master`/push/success CI lookup returned zero runs. Run `38060894121` is a failed push on `main` for this HEAD. | Successful exact-subject default-branch CI with complete required job/shard and artifact evidence; controlled skipped-dependency hosted graph smoke for P04. |
| Hosted policy inputs | Repository Actions variables and secrets lists both empty. Only environment is `github-pages`. Self-hosted runner count zero. | Protected signing/release environments and producer workflow/ref/event variables are unprovisioned. Zero self-hosted runners does not imply GitHub-hosted runners unavailable. |
| Hosted artifacts | API returned 19 artifacts; no named OfficeCLI/fidelity/Linux/container/root qualification artifact. One non-expired client-dist artifact belongs to another PR run. | Exact-subject client/image artifacts plus separately admitted Linux, OfficeCLI and PowerPoint producer run/artifact identities. |
| POSIX/Linux | WSL reports no installed distributions, exit 255. Git Bash reports `MINGW64_NT-10.0-18363`, not Linux. SSH client exists, but no configured runtime SSH hosts or user/system SSH configuration discovered. | Authorized actual Linux host or container execution target and isolated filesystem/volume access. Git Bash cannot prove Linux secret-file permissions. |
| Container/scanners | Docker, Trivy and Syft absent from PATH; standard Docker Desktop CLI location absent; Docker services absent. `vmcompute` exists but stopped. `DOCKER_HOST` unset. | Docker daemon and exact candidate image tar/config ID; Trivy 0.74.0/Syft 1.52.0 and DB identity; same-image SBOM/browser/OS inventories, runtime render, persistence/restart and isolated backup/restore proof. |
| PowerPoint | Installed `Program Files/Microsoft Office/root/Office16/POWERPNT.EXE`, version `16.0.10417.20197`; PowerPoint.Application COM registered. No application launch performed. | Actual current-subject physical corpus/oracle evidence and fixed-policy fidelity pass. Installation is not a physical qualification pass. |
| OfficeCLI | `OFFICECLI_PATH` is configured but target does not exist. Retained `%LOCALAPPDATA%/OfficeCli/officecli-1.0.135-pinned-937db176.exe.old` exists and matches canonical pin: 33,111,928 bytes; SHA256 `937DB176B585E874AA5BFF48D536BCE78037665CD862B5DEEFE56E79977E6588`. | Actual acquisition timestamp, reviewed clean exact subject and authoritative physical execution. The similarly named `.exe` without `.old` is wrong: 33,460,136 bytes, SHA256 `047705402974C3690A4437E55F620D03AFAC4BEBA4FDD28FDB59AF610A3AFFF2`. Do not select by filename alone. |
| Fidelity inputs | `PPTX_EVIDENCE_MANIFEST`, `PPTX_ROLE_RECEIPTS`, `PPTX_CORPUS`, `PPTX_GOLDENS`, `PPTX_ACTUALS`, `PPTX_REPORT_DIR`, `SUBJECT_SHA` unset. | Real manifest/role receipts/corpus/golden/actual/report paths bound to same source/client run, then integrity and qualification under unchanged policy. |
| Signing tools | PowerShell 7 exists. SDK SignTool exists under `Program Files (x86)/Windows Kits/10/bin/10.0.22621.0/x64/signtool.exe`: 488,936 bytes, SHA256 `DAC3D1CD1C6FF9BB4CB0172F13D373EB2407D40C32093A2053F4A7FB47488224`. SDK 10.0.19041.0 also contains SignTool. | Pin verifier/SignTool policy inputs and provide protected external signer, not a self-signed substitute. |
| Signing/download/attestation | All protected signer/verifier inputs below unset. `gh` 2.83.2 supports genuine JSON attestation verification, source digest/ref, issuer and reusable workflow checks. No actual release EXE verification performed. | Exact-client signed NSIS **and** portable files, independent downloads, direct chain/RFC3161 checks and genuine workflow/source provenance verification. |

Missing protected inputs: `WINDOWS_SIGNING_SCRIPT`, `WINDOWS_SIGNING_SUBJECT`, `WINDOWS_SIGNING_THUMBPRINT`, `RFC3161_TIMESTAMP_URL`, `WINDOWS_VERIFIER_PATH`, `WINDOWS_VERIFIER_SHA256`, `WINDOWS_VERIFIER_VERSION`, `WINDOWS_SIGNTOOL_PATH`, `WINDOWS_SIGNTOOL_SHA256`. Also required: distinct Linux/OfficeCLI/fidelity producer IDs and trusted producer workflow/ref/event policies. Repository-level settings do not prove organization-level secrets absent; none were claimed available.

## Commands available to the parent

Commands below are either safe discovery or **conditional future qualification commands**, not checks exercised by this investigation. Prerequisite placeholders must be populated with real same-run inputs. Do not dispatch release workflows: the existing release workflow contains staging/publication effects.

### Safe hosted reads

```powershell
gh api repos/xuan2261/NavSlidesEditor --jq '{default_branch,permissions}'
gh api repos/xuan2261/NavSlidesEditor/actions/permissions/workflow
gh api repos/xuan2261/NavSlidesEditor/environments --jq '[.environments[].name]'
gh run list --repo xuan2261/NavSlidesEditor --workflow github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml --limit 10 --json databaseId,headSha,headBranch,event,status,conclusion
```

### OfficeCLI physical producer — only after clean subject/acquisition admission

Canonical manifest: `server/services/pptx-import/officecli/qualification-manifest.json`, reviewed OfficeCLI 1.0.135/legal metadata. Runner requires a clean exact commit and canonical fixture paths.

```powershell
& 'C:/nvm4w/nodejs/node.exe' scripts/officecli/run-physical-feasibility.mjs `
  --binary "$env:LOCALAPPDATA/OfficeCli/officecli-1.0.135-pinned-937db176.exe.old" `
  --manifest server/services/pptx-import/officecli/qualification-manifest.json `
  --valid server/data/test-corpus/officecli/officecli-positive-powerpoint-16.pptx `
  --malformed server/data/test-corpus/adversarial/bad-crc.pptx `
  --malformed server/data/test-corpus/adversarial/malformed-xml.pptx `
  --acquired-at "$env:OFFICECLI_ACQUIRED_AT" `
  --expected-source-commit "$env:SUBJECT_SHA" `
  --out "$env:OFFICECLI_RECEIPT_OUT"
```

### Fidelity — requires all actual evidence paths

Using absolute Node avoids current PATH dependence:

```powershell
& 'C:/nvm4w/nodejs/node.exe' server/services/pptx-import/oracle/pptx-oracle-cli.js --mode integrity --evidence-manifest "$env:PPTX_EVIDENCE_MANIFEST" --role-receipts "$env:PPTX_ROLE_RECEIPTS" --corpus "$env:PPTX_CORPUS" --goldens-dir "$env:PPTX_GOLDENS" --actuals-dir "$env:PPTX_ACTUALS" --report-dir "$env:PPTX_REPORT_DIR"
if ($LASTEXITCODE -ne 0) { throw 'oracle integrity failed' }
& 'C:/nvm4w/nodejs/node.exe' server/services/pptx-import/oracle/pptx-oracle-cli.js --mode qualification --evidence-manifest "$env:PPTX_EVIDENCE_MANIFEST" --role-receipts "$env:PPTX_ROLE_RECEIPTS" --corpus "$env:PPTX_CORPUS" --goldens-dir "$env:PPTX_GOLDENS" --actuals-dir "$env:PPTX_ACTUALS" --report-dir "$env:PPTX_REPORT_DIR"
if ($LASTEXITCODE -ne 0) { throw 'oracle qualification failed' }
```

### Packaging and independent verification — conditional, not run

Correct exact-prebuilt-client sequence is phase12 lines 108–115 / reusable-windows-qualification steps: verify client manifest → `scripts/prepare-electron.js` → `runtime:verify` → `electron:builder -- --win nsis portable --publish never`. **Do not use `electron:build:win`** because it rebuilds the client and breaks the existing artifact binding. Node/npm PATH must be supplied in the parent execution process for nested package scripts.

After actual signed downloads and pinned verifier provisioning, run for **each** EXE with immediate exit checks:

```powershell
& 'C:/nvm4w/nodejs/node.exe' scripts/ci/release-receipt-workflow.mjs authenticode-post '<downloaded.exe>' evidence/authenticode
if ($LASTEXITCODE -ne 0) { throw 'independent signature verification failed' }
& 'C:/nvm4w/nodejs/node.exe' scripts/ci/release-receipt-workflow.mjs capture-attestation '<downloaded.exe>' "$env:SUBJECT_SHA" .github/workflows/reusable-windows-qualification.yml evidence/current-attestation.json
if ($LASTEXITCODE -ne 0) { throw 'attestation verification failed' }
```

Container execution must follow `.github/workflows/reusable-container-supply-chain.yml:22–57` on a real provisioned target: load exact image, inspect config ID, capture inventories, pinned SBOM/Trivy invocation, capture invocation evidence and run verifier with actual files. Keep HIGH/CRITICAL, ignore-unfixed false, complete OS/library coverage and unchanged exception policy. No local Windows/Git Bash substitute closes that gate.

## Evidence references

Observed tool outputs in this worker run: absolute Node and gh versions; repository/default-branch/Actions permission and environment APIs; CI/artifact/runners APIs; exact-subject default-branch successful-run lookup; `wsl --list --verbose`; executable discovery; PowerPoint version/COM registry inspection; redacted environment-presence checks; Docker service discovery; Node SHA256/size of retained OfficeCLI and SignTool; `ssh://` configured-host listing. Windows PowerShell `Get-FileHash` was unavailable; Node hashing succeeded. No output from a failed discovery invocation is used as positive qualification.

Conclusion: release remains **unqualified**. Fresh available tools supersede historical absence assumptions, but do not replace clean candidate identity, Linux permissions/container qualification, successful exact-subject hosted graph, physical fidelity, protected signing, independent downloads or genuine attestation evidence.
