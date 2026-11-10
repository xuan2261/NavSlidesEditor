# Physical qualification capability investigation — 2026-10-11

## Outcome

**Microsoft PowerPoint is genuinely installed and usable on this host.** An isolated COM invocation created one presentation, exported a real 960×540 PNG, saved a PPTX, reopened it with one slide, and removed its temporary files. This corrects the retained baseline's `not-registered` result and the previous inference that PowerPoint was absent. It is capability evidence, not corpus fidelity, licensing attestation, an OfficeCLI receipt, or Windows release qualification.

**Linux/container qualification is blocked.** Docker and Podman are not discoverable, Docker's usual installation directory is absent, WSL has no installed distributions, and no SSH capability host or user SSH config is provisioned. An OpenSSH client alone does not establish a reachable authorized Linux host.

**The default OfficeCLI executable is not the pinned qualification subject.** A matching binary survives in a `.exe.old` backup. Read-only bundle inspection disproves a simple missing-global-runtime or manifest/assembly-version mismatch explanation for the reported `System.IO.Pipelines` failure. The specific runtime-binding failure remains unresolved; no known failure was replayed and no global runtime was installed.

Phase 11 and Phase 12 qualification gates remain open. No source, dependency, workflow, GitHub setting, signing authority, certificate, or user worktree content was changed. No tests, builds, lint, formatters, dispatch, upload, publication, or commit commands were run.

## Scope and authority read

- `phase-11-container-runtime.md`, especially lines 39–45 and 75–95: exact candidate image identity, genuine scan/SBOM, physical runtime and recovery proof; reduced fixtures cannot substitute.
- `phase-12-windows-office-qualification.md`, especially lines 46–58, 93–113 and 124–132: physical Office inputs, exact subject/client binding, protected signer, independent verification and both NSIS/portable artifacts.
- `.github/workflows/reusable-docker-qualification.yml:24–38`, `scripts/ci/qualify-docker-runtime.sh:14–69`, `.github/workflows/reusable-container-supply-chain.yml:22–57`.
- `.github/workflows/reusable-windows-qualification.yml:28–44,64–108,128–153`.
- `server/services/pptx-import/officecli/qualification-manifest.json:9–38`: Windows, administrator-provided absolute path, exact executable hash/size/version, reviewed no-bundling policy, no runtime download.
- `scripts/officecli/physical-feasibility-support.mjs:51–125` and `run-physical-feasibility.mjs:44–69`: independent acquisition time, canonical fixtures/manifest, reviewed clean exact source and non-executing binary admission.
- `docs/pptx-visual-evidence-runbook.md:9–61,87–113`: real PowerPoint goldens, exact 11-deck corpus, environment digests, three role receipts and non-weakened visual policy.

## Current capabilities and tried commands

| Command or read-only discovery | Observed result | Meaning |
|---|---|---|
| `powershell.exe -NoProfile -Command "Get-Command docker,wsl,ssh,officecli,dotnet,pwsh,gh ..."` | WSL, SSH, OfficeCLI, dotnet, pwsh and gh found; Docker absent. Exit 1 reflects the missing requested command. | Client discovery only. |
| `wsl.exe --list --verbose` | Exit 255: no installed distributions. | No local WSL Linux route. |
| `ssh.exe -V` | Exit 0: OpenSSH_for_Windows_7.7p1, LibreSSL 2.6.5. | SSH client available, no destination qualification inferred. |
| `read ssh://` | No SSH hosts configured. | No runtime-provisioned remote host. |
| Glob user `.ssh/config` and system `ssh_config` | Neither present; user `.ssh/known_hosts` exists but was not read. | A prior known-host record is not permission or a usable target. |
| `dotnet.exe --info` | Exit 0: SDK 10.0.400; host/core runtime 10.0.11, core 8.0.3/6.0.36 and older; SDKs 3.1/5/10; no workloads. | Real runtimes exist; installation absence is not the diagnosis. |
| Redacted Node environment-presence inspection | `OFFICECLI_PATH` present but target does not exist. All actual evidence/signer/verifier/producer policy inputs listed below absent. | No secret values were printed. |
| Registry PowerPoint COM CLSID / App Paths inspection | COM registered and real `POWERPNT.EXE` path exists. | Supersedes retained baseline observation. |
| PowerPoint EXE version metadata | File version `16.0.10417.20197`, 1,886,072 bytes. | Installed application identity. |
| PowerPoint process discovery | No existing PowerPoint process before isolated smoke. | No user PowerPoint session was attached or closed. |
| Initial PS5 `Get-AuthenticodeSignature` | Exit 1: `Microsoft.PowerShell.Security` auto-load failed. | Separate host module-distribution issue, not proof of unsigned Office. |
| Absolute native PS5 Security module import, then `Get-AuthenticodeSignature POWERPNT.EXE` | Exit 0: status 0 (`Valid`); publisher Microsoft Corporation. | Genuine Office signature observed; not release EXE verification. |
| Docker/Podman/Trivy/Syft/SignTool command and Docker service discovery | None on PATH; `vmcompute` exists but stopped; no Docker service. | No daemon or scanner qualification route currently provisioned. |
| Windows SDK SignTool filesystem discovery and version metadata | Two real binaries available: SDK directories 10.0.22621.0 and 10.0.19041.0; both report file version `4.00 (WinBuild.160101.0800)`, exit 0. | SignTool is not absent, but release policy paths/hashes remain unprovisioned. |
| Read-only `assertReviewedManifest` plus `inspectPinnedBinary` on matching backup | Exit 0; SHA-256 `937DB176…77E6588`, 33,111,928 bytes; observed at `2026-10-11T00:03:16.740Z`. | No executable launch or receipt claim; retained in `261011-office-pin-admission.json`. |
| Temporary package diagnostic, `node .../261011-office-package-inspect.cjs` | Exit 0; embedded deps/runtimeconfig and DLL assembly identity inspected. | Output retained as `261011-office-package-metadata.json`; diagnostic script removed. |
| Temporary COM capability script, `powershell.exe -NoProfile -NonInteractive -File .../261011-powerpoint-capability.ps1` | Exit 0; real create/render/save/reopen succeeded; cleanup true. | Output retained as `261011-powerpoint-capability.json`; diagnostic script removed. No execution-policy bypass. |

## OfficeCLI binary mismatch and exception analysis

The reviewed manifest pins version `1.0.135`, SHA-256 `937DB176B585E874AA5BFF48D536BCE78037665CD862B5DEEFE56E79977E6588`, and 33,111,928 bytes.

| Local filename in the administrator's OfficeCli directory | Bytes | SHA-256 | Admission |
|---|---:|---|---|
| `officecli.exe` (PATH target) | 33,497,000 | `66757C7A3AC4E8B181D54534E82B9486CF734E21E5851EFF9CFAD4A3287FF50C` | Wrong subject; do not use for qualification. |
| `officecli-1.0.135-pinned-937db176.exe` | 33,460,136 | `047705402974C3690A4437E55F620D03AFAC4BEBA4FDD28FDB59AF610A3AFFF2` | Misleading filename; wrong subject. |
| `officecli-1.0.135-pinned-937db176.exe.old` | 33,111,928 | `937DB176B585E874AA5BFF48D536BCE78037665CD862B5DEEFE56E79977E6588` | Matching retained bytes. |

The parent supplied the earlier exact symptom: `officecli --version` under Windows PowerShell exited 82 with `System.IO.FileNotFoundException: System.IO.Pipelines, Version=10.0.0.0`, from `OfficeCli.Core.UpdateChecker.SaveConfig/CheckInBackground`. This report does not rerun it.

Three competing explanations were examined:

1. **Wrong OfficeCLI candidate: confirmed.** PATH bytes fail the reviewed hash and byte-length pin. The purported pinned `.exe` also fails. Filename and older baseline version strings are not acquisition or identity proof.
2. **Missing global .NET installation or embedded dependency version mismatch: not supported by evidence.** Both binaries are .NET single-file bundle format 6, with `includedFrameworks`, not a framework-dependent `framework` declaration. PATH embeds runtimepack `10.0.12`; the matching backup embeds `10.0.9`. Both embedded deps manifests declare `System.IO.Pipelines.dll`, assembly version `10.0.0.0`; both contain the 9,216-byte assembly in the bundle and its extracted metadata reports exactly `System.IO.Pipelines, Version=10.0.0.0, Culture=neutral, PublicKeyToken=cc7b13ffcd2ddd51`. The assembly is present, not absent. Installing a global runtime, copying a PowerShell DLL beside the EXE, or modifying the pinned bundle would not be an evidence-backed or policy-compliant fix.
3. **PowerShell module distribution pollution: confirmed for the separate Authenticode cmdlet failure, not established as the OfficeCLI exception cause.** PS5 inherited a `PSModulePath` placing PowerShell 7's module directory ahead of native PS5 modules. Module enumeration selected Security `7.0.0.0` with `CompatiblePSEditions = Core`; the host is Desktop PS5.1. Absolute import of the native, existing PS5 Security manifest made signature inspection work without changing global module paths or security policy. OfficeCLI is a separate native/self-contained process; this cannot by itself explain its UpdateChecker assembly binding.

Embedded offsets, runtime/dependency declarations and assembly identities are retained in `261011-office-package-metadata.json`. Assembly extraction was only for `AssemblyName.GetAssemblyName`, not execution, and temporary extraction directories were removed. The dynamic loader/timing/trimming cause of the retained UpdateChecker failure is unresolved; the evidence does not justify asserting a missing runtime or claiming OfficeCLI repaired. Read-only advice from RepairDesignAdvice concurred that global runtime installation is unnecessary and that gates must remain open.

## Genuine PowerPoint proof and timeline

- Retained `baseline.json:143–147` recorded `not-registered`; the older September OfficeCLI blocker separately recorded a successful physical PowerPoint COM spike. These are historical observations, not current prerequisites.
- On this investigation, COM registration, existing signed Office binary and version metadata were observed directly.
- At `2026-10-11T00:02:18.3560643Z`, physical COM application version `16.0`, build `10417` created/saved/reopened one temporary slide and exported a real PNG, 960×540, 4,393 bytes. It was not a double or browser renderer.
- PNG SHA-256: `caa0e3aa1eac1ac1db708cae6e0a96c25001e93b391e51df47bf2f89873b3917`.
- Temporary PPTX: 33,319 bytes; SHA-256 `48accc9e57eedecb8df7ec3bc1cc6274e3241e0e78d1dd60b6d9eecf4947060b`.
- The probe used an exclusively owned temporary directory, never opened a user deck, exited its own COM app and removed all temporary files. Only the redacted capability report survives.

This single disposable document does not establish the fixed corpus oracle, repaired-package rejection, edited-export compatibility, licensing entitlement, environment reproducibility, release subject identity, signatures of either NavSlides EXE, or a claim-capable golden bundle.

## Exact missing prerequisites and safe next steps

### Phase 11

Missing: an authorized Linux container daemon/host; exact candidate image tar/config ID and matching prebuilt client artifact/manifest; genuinely installed pinned Syft 1.52.0 and Trivy 0.74.0 with usable DB; exact-image scan/SBOM/browser evidence; disposable volumes for restart and backup/restore. No SSH endpoint was inferred from `known_hosts`, and WSL installation or daemon startup was not attempted.

After provisioning, reuse the existing Docker/supply-chain workflow commands, not a host-node substitute: verified exact client artifact → `production-prebuilt` image → actual daemon runtime script → immutable image/config ID → pinned scanner/SBOM/strict verifier. Phase 11 also requires physical render, permissions and disposable-volume backup/restore beyond merely finding an executable or running unit fixtures. Do not dispatch hosted workflows under the present authorization.

### Phase 12 OfficeCLI

Available: reviewed checked-in acquisition/legal policy, canonical positive/adversarial fixtures, exact pinned backup bytes and the production runner. Missing: a configured existing `NAVSLIDES_OFFICECLI_PATH`/valid `OFFICECLI_PATH`; independently verified administrator acquisition timestamp (`OFFICECLI_ACQUIRED_AT`); reviewed expected full source SHA; clean exact-subject checkout including untracked files; a fresh authoritative runner receipt. The existing dirty work must not be reset, stashed, committed or silently excluded. No acquired-at timestamp was invented from file creation metadata.

Once a clean reviewed subject and independent acquisition record exist, point the administrator-provided absolute path at verified retained bytes or a policy-approved preserved copy. `qualification.js:135–157` already stages an exclusive hash-bound copy named `officecli.exe`; do not rename or overwrite the operator's installed files. Use the canonical command:

```powershell
node scripts/officecli/run-physical-feasibility.mjs --binary "$env:NAVSLIDES_OFFICECLI_PATH" --manifest server/services/pptx-import/officecli/qualification-manifest.json --valid server/data/test-corpus/officecli/officecli-positive-powerpoint-16.pptx --malformed server/data/test-corpus/adversarial/bad-crc.pptx --malformed server/data/test-corpus/adversarial/malformed-xml.pptx --acquired-at "$env:OFFICECLI_ACQUIRED_AT" --expected-source-commit "$env:OFFICECLI_EXPECTED_SOURCE_COMMIT" --out plans/261009-0901-navslides-full-reliability-deep-tdd/reports/officecli-physical-feasibility.json
if ($LASTEXITCODE -ne 0) { throw 'physical OfficeCLI qualification failed' }
```

This command is conditional, not executed here. Do not use the failing unpinned PATH executable or replay its known failure merely to confirm it.

### Phase 12 PowerPoint and signing

PowerPoint capability is available; physical corpus evidence is not provisioned. All `PPTX_EVIDENCE_MANIFEST`, `PPTX_ROLE_RECEIPTS`, `PPTX_CORPUS`, `PPTX_GOLDENS`, `PPTX_ACTUALS`, `PPTX_REPORT_DIR`, and `SUBJECT_SHA` environment inputs were absent. No current exact-subject golden/evidence bundle or three matching role receipts were found in the searched canonical/report locations. This is bounded discovery, not a claim that no external bundle exists anywhere.

Capture the exact 11-deck PowerPoint goldens on this now-proven-capable host under the existing runbook, with recorded Office/font/locale/DPI and artifact/environment digests. Independently obtain package-backed actuals and app-storage/security/release role receipts for the same exact subject. Then, and only then, run the integrity and fixed-policy qualification commands in Phase 12 lines 95–99. Do not reuse the disposable capability PNG as a golden.

All protected signing/verifier inputs were absent: `WINDOWS_SIGNING_SCRIPT`, `WINDOWS_SIGNING_SUBJECT`, `WINDOWS_SIGNING_THUMBPRINT`, `RFC3161_TIMESTAMP_URL`, `WINDOWS_VERIFIER_PATH`, `WINDOWS_VERIFIER_SHA256`, `WINDOWS_VERIFIER_VERSION`, `WINDOWS_SIGNTOOL_PATH`, `WINDOWS_SIGNTOOL_SHA256`. OfficeCLI/PowerPoint producer workflow/ref/event policy inputs were also absent. `OFFICECLI_BINARY`, `OFFICECLI_MANIFEST` and `NAVSLIDES_SIGNER_SCRIPT` were absent in the parent's retained preflight. Real SDK SignTool binaries exist but are not yet authorized/pinned release-verifier inputs. No private-key or certificate store inspection was attempted, and no absence of certificates is inferred from missing environment variables.

Missing release evidence: exact-client-bound NSIS plus portable artifacts, distinct admitted Linux/OfficeCLI/PowerPoint producer run/artifact identities, protected external signing service, independent pre/post-download RFC3161/trust verification, actual download hashes and genuine workflow/source attestation. Local unsigned packaging or real Office capability cannot close these gates. No release environment/settings were queried or changed by this investigation.

## Recurrence prevention and unresolved questions

Use binary hash/size admission rather than filenames or PATH; keep administrator acquisition records separate from creation timestamps. Use the correct native PowerShell module distribution for read-only signature checks rather than mutating global `PSModulePath`. Record current physical capability separately from exact-subject qualification and retain the explicit blocked prerequisites in the parent-owned ledger.

Unresolved: why the unpinned PATH executable's UpdateChecker fails binding an assembly whose manifest, bundle entry and assembly identity all match; whether the operator has an external current authorized acquisition/evidence bundle not provisioned in this session; the later exact clean subject on which genuine end-to-end qualification can be performed without violating the no-commit restriction.
