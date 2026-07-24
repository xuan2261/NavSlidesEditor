# PPTX Import P1+/P2/P3 Research — Security, Perf, Capability

**Date:** 2026-07-24  
**Mode:** read-only research (no application code changes)  
**Source audit:** [`2026-07-22-pptx-import-readiness-audit.md`](./2026-07-22-pptx-import-readiness-audit.md)  
**Package-first boundary:** [`../260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/plan.md`](../260710-1757-pptx-package-first-officecli-roundtrip-deep-tdd/plan.md)  
**P0 sibling (partial complete):** [`../260722-1630-pptx-import-p0-readiness-remediation-deep-tdd/plan.md`](../260722-1630-pptx-import-p0-readiness-remediation-deep-tdd/plan.md)

## 1. Verdict

P2 work is mostly **real gaps in security hygiene, diagnostics honesty, warning memory, CRC policy, performance evidence, corpus adversarial breadth, and restart interleaving**.

P3 work is **mostly already owned by package-first** (level-4 rows, charts, OfficeCLI, oracle, platform). A separate P3 plan must **not** re-plan those gates. Residual P3 outside package-first is thin: secondary-parser cost/benefit eval, multi-tenant only if product model changes.

P1.8 (worker env allowlist) belongs with P2 security hardening — small, high leverage, independent of OfficeCLI G1.

---

## 2. Evidence inventory (exists vs missing)

### 2.1 P1.8 — Allowlist parser worker environment

| State | Evidence |
| --- | --- |
| **Exists (bad)** | `buildParserWorkerEnv` spreads full parent env: `...baseEnv` → `server/services/pptx-import/worker-runner.js:17-33`. Fork uses it at `:73-78`. |
| **Exists (contrast)** | OfficeCLI already allowlists env keys (`SystemRoot`, `TEMP`, …) and strips secrets: `server/services/pptx-import/officecli/process-contract.js:1-22`. |
| **Exists (partial isolation)** | Heap cap via filtered `execArgv`; SIGTERM→SIGKILL; silent fork; IPC result typing — `worker-runner.js:36-55`, `:57-64`, `:66-196`. |
| **Missing** | Allowlist for parser worker env (no `PATH`/`NODE_OPTIONS`/`API_KEY`/`TOKEN`/`SECRET` strip policy). |
| **Tests** | Cover `NODE_PATH` + Electron flag only — `worker-runner.test.js:37-51`. No secret-inheritance regression. |
| **Related risk** | EMF converter also inherits full env: `emf-wmf-sandbox.js:31-36`. |

**Adoption risk:** Low. Pattern already proven for OfficeCLI. Risk = over-stripping breaks `NODE_PATH`/locale/temp in Electron packaged mode — must keep explicit allowlist for those.

---

### 2.2 P2.1 — Perf matrix (1/10/50/100 MiB; 50/500/5k entries; p50/p95; peak RSS; timeout stage)

| State | Evidence |
| --- | --- |
| **Exists ceilings** | `MAX_FILE_BYTES=100MiB`, `MAX_ZIP_ENTRIES=5000`, `MAX_DECOMPRESSED_BYTES=500MiB`, `PARSER_TIMEOUT_MS=60s`, `IMPORT_TIMEOUT_MS=120s`, heap 1024MB — `constants.js:4-15`. |
| **Exists small-deck timings (audit)** | ~2–4s for multi-MiB decks; not near-limit. |
| **Exists k6 load** | REST presentations POST + Socket.IO rooms only — `package.json:44-51`, `tests/load/*`. **Not PPTX import.** |
| **Missing** | Benchmark matrix at compressed sizes / entry counts; RSS; stage timing (parse vs revalidate vs scene vs package commit); CI artifact for p50/p95. |

**Architectural fit:** Single concurrent import (`MAX_CONCURRENT_RUNNING=1`) is intentional resource safety. Perf work should measure ceilings, not raise concurrency first.

---

### 2.3 P2.2 — Archive pass reuse (hash-bound inventory only)

| State | Evidence |
| --- | --- |
| **Exists double pass** | Worker validates package: `parse-worker.js:11-12` → `validatePptxPackage`. Host reopens archive: `importer.js:64-67` → `loadPptxArchive` → full revalidate. |
| **Exists third-ish inventory path** | OPC inventory also full decompress + `checkCRC32: false` — `package-store/opc-inventory.js:93-127`. |
| **Exists safety stance (audit)** | Do not drop revalidation; only reuse inventory hash-bound to exact source blob. |
| **Missing** | Content-addressed inventory cache keyed by package SHA-256; reuse contract + invalidation tests. |

**Risk:** High if naively skipped. Reuse must bind `(sha256, limits-digest) → inventory` and still re-open bytes for mapping/media extraction when needed.

---

### 2.4 P2.3 — Warning budgets

| State | Evidence |
| --- | --- |
| **Exists unbounded accumulation** | Mapper/parsers push freely — e.g. `mapper/map-presentation.js` warning pushes; scene graph; chart/diagram parsers. No `MAX_WARNING_*` constant under `server/services/pptx-import`. |
| **Exists partial persist** | Audit: full warnings in terminal job result only; `_pptxMeta` stores selected metadata. Jobs TTL 10 min in-memory. |
| **Missing** | Global count + serialized-byte budget; `omittedCount` summary; durable bounded import report per presentation (P1.4 adjacent). |

**Note:** P0 plan explicitly deferred durable job report / full AbortController to P1; warning budget is still P2 security/memory item even if P1 owns persistence shape.

---

### 2.5 P2.4 — CRC corruption policy + regression tests

| State | Evidence |
| --- | --- |
| **Import load path** | `JSZip.loadAsync(bytes, { checkCRC32: false })` — `pptx-guards.js:98-107`; same in `opc-inventory.js:95`, `nested-package-guard.js:144`. |
| **CRC stored, not verified** | Central-directory CRC parsed into entry metadata — `raw-zip.js:36-60`. No payload CRC check found. |
| **Export/adapters enable CRC** | `checkCRC32: true` in export preflight, chart adapter, text/shape postconditions, embedded workbook inventory. |
| **Missing** | Documented accept/reject policy for CRC mismatch on **import**; fixture with bad CRC; regression test; decision whether fail-closed or warn. |

**Credibility note:** Export paths already treat CRC as integrity signal. Import intentionally lenient (or accidental). Policy must be explicit; default recommendation = **fail-closed on declared-vs-actual CRC mismatch for non-encrypted entries** after fixture proves JSZip behavior, unless real corpus false-positive rate is high.

---

### 2.6 P2.5 — Corpus breadth

| State | Evidence |
| --- | --- |
| **Exists 11-deck corpus** | `server/data/test-corpus/` — 4 real VN decks + charts, diagram shapes, math, table/media, 4:3, notes/footer — `README.md:12-24`. |
| **Exists CLI lane split (P0)** | Metrics: `test:pptx:corpus-metrics` → `--roundtrip --strict-metrics` — `package.json:52-53`. Qualification: `test:pptx:importer-qualification` → `--importer-strict` + manifest — `:58-59`. CLI mutual exclusion — `pptx-import-corpus-cli.js:108-117`. |
| **Exists qualification manifest** | Hash-bound 11 decks — `importer-qualification-manifest.json`. Same decks as metrics; stricter gates, not broader fixtures. |
| **Missing fixtures (audit list)** | Real SmartArt OOXML; EMF/WMF; macro/OLE/ActiveX/signature/encryption; external relationships; nested packages; comments/inheritance stress; animations/transitions; missing fonts; multilingual RTL/CJK; intentionally malformed ZIP/XML/media. Corpus README forbids large files unless plan needs them (`README.md:44-45`). |

**Lane truth:** Metrics = parser-relative semantic/roundtrip regression. Qualification = native/EMF/placeholder gates. Do not merge labels again.

---

### 2.7 P2.6 — Timeout message uses actual `timeoutMs`

| State | Evidence |
| --- | --- |
| **Exists custom timeout** | `const timeoutMs = options.timeoutMs \|\| PARSER_TIMEOUT_MS` — `worker-runner.js:66-68`. Timer uses `timeoutMs` at `:110-119`. |
| **Bug** | Message hardcodes `'PPTX parser timed out after 60s'` at `:115`. |
| **Tests** | Timeout test asserts message contains `'timed out'` only — `worker-runner.test.js:89-106`. Does not assert actual duration string. |

**Effort:** Trivial. Ship with P1.8 env allowlist in same micro-phase.

---

### 2.8 P2.7 — OS/container sandbox + network deny eval (parser/converters)

| State | Evidence |
| --- | --- |
| **Exists process isolation** | Forked parser; heap kill; kill escalation. Not OS sandbox. |
| **Exists binary allowlist (EMF)** | `ALLOWED_BINARIES` + `shell:false` — `emf-wmf-sandbox.js:8-36`. Still full env + host network available to child. |
| **Exists OfficeCLI env strip** | `process-contract.js` — not applied to parser. |
| **Package-first owns full containment** | Cross-phase invariant 17: stripped env, restricted identity, private workspace, denied egress, full-tree kill — package-first `plan.md` invariants; G1 phases 2/4. |
| **Missing for P2** | Written evaluation: what is achievable on Windows Electron + Linux Docker without OfficeCLI G1; residual risk acceptance for self-hosted single-user. |

**Hard boundary:** Do **not** re-implement Windows Job Object / OfficeCLI launcher under P2. P2 owns **eval + minimal parser env strip**; package-first owns production OfficeCLI containment.

---

### 2.9 P2.8 — Production-style restart / interleaving suite

| State | Evidence |
| --- | --- |
| **Exists partial durable jobs** | Package store persists jobs; route can read durable job after in-memory miss — `pptx-import.js:60-88`, GET at `:436-440`; reconcile endpoint `:483+`. Package-store restart tests e.g. `package-store.test.js:327`. Compatibility outbox tests exist. |
| **Exists P0 authority work** | Durable job / package-backed journey regressions landed in P0 phases 1–3 (P0 plan status 2026-07-24). |
| **Missing** | Production-style **interleaving** suite: crash between package publish / outbox drain / media commit / terminal HTTP complete; concurrent GET/SSE/cancel/reconcile; restart mid-import; multi-presentation store stress. Audit F-11 + P2.8. |

---

### 2.10 P3.1 — Qualify level-4 feature rows (per-row)

| State | Evidence |
| --- | --- |
| **Exists claim ladder** | Levels 1–5 named — `fidelity-contract.js:29-35`. |
| **Exists fail-closed DTO** | `maxClaimLevel`/`verifiedClaimLevel` only 0 or 1 when original verified — `:211-232`. `level5Available: false` always — `:232`. |
| **Exists matrix** | All rows `level4Promoted: false` enforced — `canonical-feature-matrix.test.js:204`. Seed text row transaction-eligible but not L4 — `canonical-feature-matrix.js:57-68`. |
| **Owner** | Package-first **G4** (phases 7–12, release by 13). |

**P3 plan action:** Do not re-plan row promotion machinery. Optionally list dependency: consume package-first G4 receipts.

---

### 2.11 P3.2 — Chart / complex-object editing gates

| State | Evidence |
| --- | --- |
| **Exists UI preserve-only** | Requires all four: `preservationTier === 'editable'`, `adapterQualified`, `transactionEligible`, `level4Promoted` — `chart-properties.jsx:6-15`. All controls `disabled={preserveOnly}` — `:41-160`. |
| **Exists matrix binding** | Chart support derives from canonical rows; `level4Promoted` always false today — `chart-support-matrix.js:28-52`. Bar candidate row ceiling `feature-editability` but unpromoted — `canonical-feature-matrix.js:94-99`. |
| **Owner** | Package-first phase 8 (charts/workbooks) + G4 promotion rules. |

**P3 plan action:** Non-goal to “turn on chart edit.” Only open when adapter + transaction + native re-import + Office evidence pass (audit P3.2). That evidence lives in package-first.

---

### 2.12 P3.3 — OfficeCLI receipt, strict native re-import, PowerPoint oracle, Electron/Docker, platform

| State | Evidence |
| --- | --- |
| **Owner** | Package-first G1 (ph 2,4), G2 re-import/export (ph 11), G3 artifacts (ph 13), G5 PowerPoint (ph 13). P0 phase 4 owns trusted PowerPoint goldens for release truth-gate (blocked on local PowerPoint evidence). |
| **Exists scaffolding** | Typed OfficeCLI gateway, qualification modules, oracle CLI modes (`test:pptx:oracle*`), no-OfficeCLI package gate. |
| **Missing (claimed)** | Real qualified OfficeCLI receipt; reviewed goldens; Electron artifact smoke for PPTX claims; composite 1:1 SLA. |

**P3 must NOT duplicate** OfficeCLI binary pinning, launcher/Job Object, 1:1 native matrix, provider PowerPoint VM, or claim wording gates.

---

### 2.13 P3.4 — Secondary parser evaluation only

| State | Evidence |
| --- | --- |
| **Exists single runtime parser** | `parse-worker.js:13-37` uses `pptxtojson` only. |
| **P0 decision** | Remove production `pptx2json` inspection/fallback claims; isolated benchmark only — P0 plan architecture decision #3. |
| **Missing** | Formal cost/benefit: corpus gain vs normalization/source-map/maintenance. No implementation until measurable gain. |

---

### 2.14 P3.5 — Multi-tenant job authorization

| State | Evidence |
| --- | --- |
| **Exists single-user model** | Explicit comment: no app-level user model; UUIDv4; one concurrent import; reverse-proxy auth assumed — `pptx-import.js:375-379`. |
| **Missing by design** | Per-job secret at creation; authorize GET/SSE/DELETE. |
| **Product gate** | Only if multi-tenant product decision. Not required for self-hosted best-effort release. |

---

## 3. Package-first overlap — what P3 must NOT re-plan

| Topic | Package-first owner | This P2/P3 research plan |
| --- | --- | --- |
| Canonical feature matrix / claim subjects | G0 ph 1 | Consume only |
| OfficeCLI pin, spawn, env allowlist for OfficeCLI, Job Object | G1 ph 2, 4 | Do not re-implement; may **mirror env-allowlist pattern** for parser only |
| OPC inventory + package lifecycle | G2/ph 3 | May optimize **hash-bound reuse** without changing authority model |
| Source map / mutation journal / L3 export | G2 ph 5, 11 | Out of scope |
| Primitive / chart / complex L4 promotion | G4 ph 7–10, 12–13 | Out of scope |
| PowerPoint oracle / protected provider | G5 + P0 ph 4 | Out of scope |
| Electron/Docker claim honesty | G3 ph 13 | Out of scope |
| 1:1 native matrix / composite SLA | G0–G5 claim gates | Out of scope |
| Parser worker secret strip, CRC import policy, warning budgets, import perf matrix, adversarial corpus, restart interleaving | **Not owned** | **In scope for P2** |
| Secondary parser eval, multi-tenant auth | Deferred product | Thin P3 residual only |

Package-first progress note (context only): `77/244` checklist items; **0/6 claim gates closed**; all 13 phases in-progress (`plan.md` frontmatter). Do not treat checkbox progress as release readiness.

P0 note: transport/evidence/package-journey phases complete; PowerPoint oracle phase **blocked**. P0 non-goals explicitly exclude P1 AbortController, durable report, EMF capability, chart edit, OfficeCLI, multi-tenant, P2/P3 perf.

---

## 4. Recommended phase grouping

### Plan A — **P2 Security / Perf / Ops Hardening Deep TDD** (recommended next after P0/P1 reliability)

| Phase | Audit bullets | Outcome | Risk |
| --- | --- | --- | --- |
| **P2-0** Contracts | P1.8, P2.6 | Worker env allowlist (+tests for secret strip + required keys); timeout message uses `timeoutMs` | Low |
| **P2-1** Warning budget | P2.3 | Cap count + serialized bytes; `omittedCount`; job response stays bounded | Low–Med |
| **P2-2** CRC policy | P2.4 | Documented policy + corrupt CRC fixture + import regression; align or consciously diverge from export `checkCRC32: true` | Med |
| **P2-3** Perf matrix | P2.1 | Synthetic fixtures 1/10/50/100 MiB and 50/500/5k entries (under ceilings); p50/p95, RSS, stage timers; CI optional smoke profile | Med |
| **P2-4** Inventory reuse | P2.2 | Optional: hash-bound inventory reuse after P2-3 proves double-pass cost; never skip safety without hash bind | High |
| **P2-5** Adversarial corpus | P2.5 subset | Malformed ZIP/XML/media; encryption/macro/OLE **as original-only fixtures**; EMF/WMF sample; external rel; nested zip. Keep metrics vs qualification lanes separate | Med |
| **P2-6** Restart interleaving | P2.8 | Crash/restart suite around package commit ↔ outbox ↔ media ↔ HTTP terminal; builds on P0 durable jobs | Med–High |
| **P2-7** Sandbox eval memo | P2.7 | Written residual risk: process isolation vs OS sandbox; network deny options on Win/Linux; **no** OfficeCLI launcher rewrite | Low (docs/eval) |

**Do not put in Plan A:** level-4 promotion, chart edit enablement, OfficeCLI qualification, PowerPoint goldens, Electron claim smoke.

### Plan B — **P3 Capability Residual** (thin; mostly coordination)

| Phase | Audit bullets | Outcome |
| --- | --- | --- |
| **P3-0** Boundary contract | P3.1–3 | One page: “capability claims owned by package-first G4/G5; this plan does not open editability” |
| **P3-1** Secondary parser eval | P3.4 | Spike report only; implement only if corpus delta ≥ maintenance threshold (define numeric bar first) |
| **P3-2** Multi-tenant (optional) | P3.5 | Only after product decision; per-job secret at create + authorize GET/SSE/DELETE |

**Prefer:** Do **not** open a large P3 TDD plan. Route capability work into package-first continuation; keep Plan B as optional product spikes.

### Sequencing vs other plans

```text
P0 (mostly done; oracle blocked)
  -> P1 reliability (AbortController, deadline, durable report, single writer, crash points)  [if not started]
  -> Plan A P2-0..P2-3  (cheap security + evidence)
  -> Plan A P2-5..P2-6  (corpus + restart)
  -> Plan A P2-4 only if perf matrix proves archive cost
  -> package-first G1/G2/G4 for capability
  -> Plan B only if product needs secondary parser or multi-tenant
```

---

## 5. Hard non-goals (this research plan family)

1. **No** OfficeCLI binary bundling, launcher, Job Object, or G1 claim closure.  
2. **No** 1:1 PowerPoint visual claim or composite SLA greenwash.  
3. **No** bulk `level4Promoted: true` or chart UI unlock without per-row evidence.  
4. **No** second production parser without measured corpus gain.  
5. **No** multi-tenant auth unless product model changes.  
6. **No** dropping host revalidation / safety passes for speed without hash-bound inventory.  
7. **No** raising concurrent imports or ceiling limits as a “perf fix.”  
8. **No** re-labeling metrics corpus as importer qualification.  
9. **No** treating package-first checkbox % as claim readiness.  
10. **No** expanding P0 into EMF conversion qualification (belongs capability track).

---

## 6. Trade-off matrix (options for P2 framing)

| Option | Perf evidence | Security | Complexity | Maintenance | Claim impact | Rank |
| --- | --- | --- | --- | --- | --- | --- |
| **A. Focused P2 hardening plan** (env, CRC, warnings, perf matrix, adversarial corpus, restart) | Strong | Strong | Med | Med | Supports honest best-effort release | **#1** |
| **B. Fold P2 into package-first ph 13 only** | Weak (ph 13 is claim/CI) | Partial | Low short-term | High coupling | Delays ops fixes behind G1 | #3 |
| **C. Big P2+P3 mega-plan** including L4/OfficeCLI | Overlapping | Confused ownership | Very high | Duplicate plans | High thrash risk | #4 reject |
| **D. Perf-only plan** (skip env/CRC/warnings) | Strong | Leaves open audit risks | Low | Low | Incomplete audit closure | #2 inferior |

**Recommendation:** Option **A**. Ranked choice for next deep-TDD plan after P1 reliability items.

---

## 7. Estimated risk ordering (implement first → last)

| Rank | Item | Why |
| --- | --- | --- |
| 1 | **P2.6 timeout message** | Trivial correctness; zero arch risk |
| 2 | **P1.8 worker env allowlist** | Secret blast-radius; pattern exists; small surface |
| 3 | **P2.3 warning budget** | Memory/DoS hygiene; clear contract |
| 4 | **P2.4 CRC policy + tests** | Integrity honesty; may break pathological real files — need fixture-driven decision |
| 5 | **P2.1 perf matrix** | Evidence debt; fixture generation cost; no product claim change |
| 6 | **P2.5 adversarial corpus** | High value for guards; fixture craft time; keep under size policy |
| 7 | **P2.8 restart interleaving** | Touches package-store races; needs careful isolation from package-first concurrent work |
| 8 | **P2.7 sandbox eval** | Mostly documentation; full OS sandbox deferred to G1 |
| 9 | **P2.2 archive reuse** | Highest correctness risk; only after measured need |
| 10 | **P3.4 secondary parser eval** | Product/cost; easy to waste months |
| 11 | **P3.1–3 capability** | Owned elsewhere; wrong plan = duplication |
| 12 | **P3.5 multi-tenant** | Product fork; not current model |

---

## 8. Source credibility

| Source | Weight | Use |
| --- | --- | --- |
| Current source (`worker-runner`, `pptx-guards`, `fidelity-contract`, `chart-properties`, corpus CLI, package-first plan) | Highest | Exists/missing claims |
| 2026-07-22 readiness audit | High | Roadmap taxonomy; fresh verification baselines |
| P0 plan status 2026-07-24 | High | What already closed / deferred |
| Package-first status sync | High for ownership, medium for “done” | Gates still open |
| Historical journals / checkbox counts | Low for readiness | Do not upgrade claims |

Multiple independent code paths confirm CRC-off import (guards + opc-inventory + nested guard) and CRC-on export/adapters — not single-source.

---

## 9. Architectural fit

- **Stack:** Express + forked Node parser + JSZip + file package-store; single-user self-host / Electron.  
- **Fit:** Env allowlist, warning caps, CRC policy, synthetic perf fixtures match existing KISS guards.  
- **Mismatch:** Full multi-tenant and OS sandbox exceed current product model; belong product decision / package-first G1.  
- **Team skill:** Local TDD + Vitest fixtures sufficient for Plan A; PowerPoint/OfficeCLI remains specialized track.

---

## 10. Limitations of this research

- Did not re-run corpus, browser audit, k6, or oracle (read-only file evidence + audit timestamps).  
- Did not empirically measure double-pass wall time or RSS (P2-3 still required).  
- Did not craft corrupt-CRC fixture to observe JSZip `checkCRC32: true` vs false behavior.  
- Did not inventory every package-store restart test exhaustively; concluded **partial** coverage from representative tests + missing interleaving suite.  
- P1 items 1–7 (AbortController, deadline metadata, single compatibility writer, etc.) only noted where they touch P2 boundaries — not fully re-audited.

---

## 11. Unresolved questions

1. CRC import policy preference: fail-closed vs warn-and-continue for real corporate PPTX with false CRC? Needs fixture experiment.  
2. Is P1 reliability plan already scheduled? P2-6 restart suite should land after or with durable report (P1.4) to avoid double work.  
3. Product decision on multi-tenant before any P3-2 design.  
4. Whether P2-4 inventory reuse is worth complexity after P2-3 numbers (may be YAGNI if double-pass ≪ 60s parser budget).  
5. Who owns adversarial EMF fixture generation vs package-first vector-media qualification.

---

## 12. Concrete recommendation

**Ship one deep-TDD plan: “PPTX Import P2 Security/Perf/Ops Hardening”** covering audit **P1.8 + all P2 bullets**, phased as §4 Plan A.  

**Do not open a capability P3 mega-plan.** Route level-4, charts, OfficeCLI, oracle, Electron/Docker to package-first. Keep optional thin spikes for secondary-parser eval and multi-tenant only after product yes.

**Success for P2 plan:** secrets not inherited by parser; timeout diagnostics honest; warnings bounded; CRC policy tested; near-limit perf evidence recorded; adversarial fixtures exercise guards; restart/interleave suite green — without claiming L4/L5 or OfficeCLI qualification.

---

Status: DONE  
Summary: P2 is real security/perf/ops debt with clear file:line gaps; P3 capability work is almost entirely owned by package-first and must not be re-planned. Recommend a focused P2 hardening TDD plan (env allowlist, CRC, warnings, perf matrix, adversarial corpus, restart suite) with hard non-goals against OfficeCLI/L4/chart unlock.  
Concerns/Blockers: CRC accept/reject policy needs one empirical fixture pass before locking fail-closed; P1 durable-report/AbortController sequencing with P2 restart suite not confirmed.  
