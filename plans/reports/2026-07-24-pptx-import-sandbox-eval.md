# PPTX Import Sandbox Evaluation (Self-Hosted)

**Date:** 2026-07-24  
**Phase:** 7 — Perf Matrix, Archive Reuse, Sandbox Eval  
**Scope:** Parser worker + EMF/WMF converters **without** OfficeCLI G1 Job Objects/seccomp  
**Non-goals:** No Job Object / seccomp implementation in this phase

## Executive recommendation

| Deployment claim | Recommendation |
| --- | --- |
| **Single-user self-hosted** (desktop Electron or personal Docker; operator trusts the host) | **Accept residual risk** after phase-5 env allowlist + existing ZIP/XML budgets. Do **not** claim OS-level sandbox isolation. |
| **Package-first / multi-tenant / higher security claims** | **Block** on package-first OfficeCLI G1 containment (stripped env, private workspace, denied egress, full-tree kill). Parser-only fork is insufficient. |

## 1. Environment allowlist status (phase 5)

| Control | Status | Location |
| --- | --- | --- |
| Parser worker env allowlist (deny secrets by omission) | **Shipped** | `worker-runner.js` → `PARSER_WORKER_ENV_ALLOWLIST` + `buildParserWorkerEnv` |
| `NODE_OPTIONS` omitted (no inherited debug/inspect/heap tricks) | **Shipped** | Allowlist comment + omission |
| `NODE_PATH` rebuilt to repo node_modules | **Shipped** | `buildParserWorkerEnv` |
| Heap cap via `--max-old-space-size` | **Shipped** | `buildParserExecArgv` + `PARSER_MAX_OLD_SPACE_MB` |
| EMF converter env strip | **Not shipped** | `emf-wmf-sandbox.js` still spreads `process.env` when conversion enabled |

**Honesty:** Parser child no longer inherits API keys/tokens by default. Converter path remains full-env when `PPTX_EMF_CONVERT=1`.

## 2. Network egress residual

| Surface | Residual |
| --- | --- |
| Parser worker (`fork` of `parse-worker.js`) | Same host network namespace as Node process. No OS egress deny. Malicious or buggy native/JS in worker **can** open sockets if code path exists. |
| Host importer / Express | Full process network (expected for app). |
| EMF binary (`spawnSync`, `shell: false`) | Child inherits host network; binary allowlist only (`magick`/`convert`/`inkscape`). |
| External relationships in PPTX | Classified/guarded in inventory paths; not a full network sandbox. |

**No** iptables, Windows Firewall app-container, or container `network=none` is enforced by the importer itself.

### What operators can do without code changes

- **Linux Docker:** run import-capable service with restricted egress (user-defined network, no default route, or proxy allowlist). Residual: misconfiguration still allows egress.
- **Windows Electron:** user desktop identity + user network; no Job Object network isolation in-app.

## 3. Process isolation residual

| Control | Present? | Residual |
| --- | --- | --- |
| Separate process for parser | Yes (`fork`) | Shares user, FS view (minus cwd policy), and kernel resources with host |
| Timeout + SIGTERM→SIGKILL | Yes | Best-effort; no guaranteed cgroup memory kill on all platforms |
| Heap ceiling on worker | Yes (`--max-old-space-size`) | Does not cap native allocations outside V8 |
| Silent fork / typed IPC | Yes | Not a security boundary against hostile worker code |
| Job Objects (Windows) | **No** (package-first G1) | No CPU/memory/kill-tree OS job |
| seccomp / landlock / AppArmor profile | **No** | No syscall filter from this codebase |
| Private temp workspace per import | Partial (temp upload dirs) | Not a sealed mount namespace |

## 4. Ceilings that *are* in place (resource, not sandbox)

From `constants.js`:

- 100 MiB file, 5000 ZIP entries, 500 MiB decompress, 256 MiB parsed output
- 60s parser / 120s import timeouts
- Warning budgets (`MAX_IMPORT_WARNINGS`, `MAX_IMPORT_WARNING_BYTES`)
- `MAX_CONCURRENT_RUNNING = 1` (job manager) — **must not** be raised as a “perf fix”

These limit DoS blast radius; they do **not** equal multi-tenant sandboxing.

## 5. Deployment matrix

### Windows Electron (single-user desktop)

- **Strengths:** Local files; operator is the threat boundary; env allowlist reduces secret leak into worker.
- **Weaknesses:** Full user token, full network, optional EMF binary with host env, no Job Object tree kill from importer.
- **Claim language:** “Hardened best-effort import for a trusted single user” — **not** “sandboxed untrusted Office pipeline.”

### Linux Docker (self-hosted)

- **Strengths:** Operator can add read-only rootfs, dropped caps, non-root user, memory/cpu limits, network policy **outside** this repo.
- **Weaknesses:** Default compose (if any) is not proven network-deny for import workers; app code does not install seccomp profiles.
- **Claim language:** Same as single-user unless ops documents and tests container isolation.

## 6. Mapping to package-first G1

Package-first owns full OfficeCLI containment (cross-phase invariant: stripped env, restricted identity, private workspace, denied egress, full-tree kill). **This phase explicitly does not implement those OS controls.**

Any marketing or SLA that implies “untrusted PPTX cannot reach network or peer tenants” **requires package-first G1** (or equivalent external sandbox), not parser fork alone.

## 7. Residual risk acceptance statement

For **single-user** NavSlides Editor deployments:

1. Accept that parser/converter isolation is **process + budget + env allowlist**, not OS sandbox.
2. Keep EMF conversion **off by default** (`PPTX_EMF_CONVERT` unset).
3. Do not store long-lived cloud secrets in the same env as the import service without understanding allowlist scope (parser strip yes; host + EMF no).
4. Defer archive-pass reuse until hash-bound safety is proven (see companion decision note).

For **higher claims** (shared host, multi-tenant, hostile document model):

- **Block** release claims on package-first G1 completion.

## 8. Artifacts

| Artifact | Path |
| --- | --- |
| Perf harness | `server/services/pptx-import/perf/` |
| CLI | `scripts/pptx-import-perf-matrix.js` |
| Tiny/opt-in reports | `plans/reports/*-pptx-import-perf-matrix*.json` |
| Archive reuse decision | `plans/reports/2026-07-24-pptx-import-archive-reuse-decision.md` |
| This eval | `plans/reports/2026-07-24-pptx-import-sandbox-eval.md` |

## 9. Verification commands

```bash
npx vitest run server/services/pptx-import/perf/stage-timers.test.js
npx vitest run server/services/pptx-import/perf/report-schema.test.js
npx vitest run server/services/pptx-import/perf/run-matrix.test.js
node scripts/pptx-import-perf-matrix.js --tiny
# heavy (optional):
# PPTX_PERF=1 node scripts/pptx-import-perf-matrix.js --full
```
