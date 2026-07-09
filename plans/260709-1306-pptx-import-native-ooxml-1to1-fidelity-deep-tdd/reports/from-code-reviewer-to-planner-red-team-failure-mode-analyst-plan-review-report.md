# Red-Team Failure Mode Analysis — PPTX Import Native OOXML 1:1 Plan

**From:** code-reviewer (hostile failure-mode analyst)  
**To:** planner  
**Plan:** `plans/260709-1306-pptx-import-native-ooxml-1to1-fidelity-deep-tdd`  
**Date:** 2026-07-09  
**Verdict:** **FAIL plan as written for production SLA claim** — green unit/corpus/oracle paths can all pass while user-visible 1:1 and zero-loss package guarantees break.

Prior red-team (`red-team-and-validation.md`) ranked effort fantasy Low and treated dual-write / LO / zip as Mitigated-by-note. Evidence below shows those are **still open production kill paths**, not closed amendments.

---

## Max-5 Production Failure Findings

### F1 — CRITICAL: Dual-write import→createPresentation leaves orphan / unbound `original.pptx`

**Focus:** dual-write presentation+original, cancel/partial originals

**How it fails in prod despite green tests**

Current product path is **two transactions**:

1. Job maps PPTX → in-memory `result` (`server/routes/pptx-import.js:41-61`)
2. `finally` **always** `unlink`s the upload temp (`pptx-import.js:59-61`)
3. Client then `api.createPresentation(imported.presentation)` (`HomePage.jsx:674-675`)

Phase 01 architecture still allows both:

> “server owns persistence … **OR** job result includes originalPath; HomePage createPresentation attaches it”  
> (`phase-01-…md:40-45`)

**Preferred is not mandatory.** Implementers will take the easy path (persist on job done, bind later). Then:

| Race | Outcome |
|------|---------|
| Persist original → `completeJob` → client crash / network fail before create | Orphan under `pptx-originals/`; no presentation; T1.4/T1.5 still green (happy path only) |
| Persist after map, cancel races after media written but before cancel handler | Partial media on disk (`media.js` cancel tests exist; original package has **no** equivalent rollback story in plan) |
| Soft-delete presentation | `DELETE /:id` only sets `deletedAt` (`presentations.js:303-314`) — **does not unlink files**. T1.6 “DELETE unlinks original” will likely target permanent delete only; trash lifecycle leaks disk forever (plan risk “Disk filled by originals” was Med — still open) |
| Job TTL 10 min (`pptx-import-job-manager.js:3`) drops result before client bind | `originalArtifactId` lost; create without original → **P1 silent fail** |

**Tests that go green while prod breaks**

- T1.1–T1.3: pure helper file I/O  
- T1.4: job result includes package meta (no presentation row required)  
- T1.7: cancel leaves no original — does **not** cover “done + create fails”, “SSE drop + poll after TTL”, soft-delete, or permanent-delete-only cleanup  

**Required plan amendment (blocking)**

1. **Single server transaction:** import success path **creates** presentation + binds `pptxOriginal` **before** `completeJob`; client only navigates by `presentationId`.  
2. Forbid client-only bind. Remove OR branch.  
3. Tests: T1.x for create-fail after persist (must rollback original), soft-delete retention policy explicit, permanent delete unlinks, cancel after partial media **and** partial original.  
4. Persist **copy** before temp unlink; never require re-read of unlinked path.

---

### F2 — CRITICAL: Visual oracle will greenwash 1:1 (LO missing / flaky / ≠ PowerPoint / present timing)

**Focus:** oracle flakiness, LO missing in CI, Windows vs Linux LO, Playwright present timing

**How it fails in prod despite green tests**

Phase 02 claims measurable SSIM vs LibreOffice primary, PowerPoint optional (`phase-02-…md:46-47`, `plan.md:190-194`). Production reality of **this repo**:

| Evidence | Implication |
|----------|-------------|
| CI has **no** LibreOffice install (`.github/workflows/…yml` jobs lint/unit/e2e/corpus only; `pptx-corpus` runs `npm run test:corpus` only lines 173-190) | Oracle job never exists today |
| Dockerfile production image = Playwright base + rclone — **no LO** (`Dockerfile:22-28`) | Docker deploys cannot run oracle locally either |
| Plan open Q1: “optional non-blocking until Phase 02 lands” (`plan.md:236`) + T2.4 `PPTX_ORACLE=off` exit 0 (`phase-02-…md:71`) | Default path for agents: **skip oracle, ship green** |
| Existing capture is **editor** `.slide-canvas`, not present/reveal (`pptx-import-audit-helper.js:61-63, 73-87`) | Phase 02 “reuse browser-audit patterns” captures wrong surface vs user present view |
| Screenshot: `boundingBox` + immediate `page.screenshot` — **no** `document.fonts.ready`, image decode wait, networkidle, or reveal ready (`pptx-import-audit-helper.js:73-87`) | Fonts/images half-loaded → SSIM noise or false fail/pass |
| Viewport audit = 1600×1000 (`AUDIT_VIEWPORT` line 9); plan suggests 1920×1080 or 960×540 (`phase-02-…md:34`) | Unspecified → non-reproducible baselines across agents |
| LO Linux CI ≠ LO Windows desktop ≠ PowerPoint (plan admits Med, then still uses LO as SLA truth for 0.99) | User judges against PowerPoint; CI passes LO SSIM while PP looks wrong |
| Antialias / font subset / DPI of LO `--convert-to png` unpinned | Version bump of `libreoffice` package moves SSIM by >1% → flaky CI or frozen wrong baseline |

**Green path that lies**

1. Local/CI without LO → `PPTX_ORACLE=off` → exit 0 (`T2.4`).  
2. Or LO present → editor screenshot before fonts → SSIM computed on garbage but threshold ratcheted low “baseline recorded” (`phase-02-…md:84`) → later phases inherit **debt baseline as pass**.  
3. Full SLA `mean ≥ 0.99` (`plan.md:111`) claimed against LO while product marketing says “như PowerPoint”.

**Required plan amendment (blocking)**

1. **Hard CI job** installs pinned LO version; `PPTX_ORACLE=off` **forbidden** on that job (fail if unset/off).  
2. Capture **present mode** (or shared HTML present path), not editor chrome; wait `document.fonts.ready` + all `<img>.complete` + fixed settle ms; pin viewport **960×540 CSS** matching `CANVAS_SIZE` (`constants.js:13`).  
3. Publish LO vs PP **delta report** as release gate or rewrite SLA language to “LO-oracle 1:1”, not PowerPoint.  
4. Pin LO package version + font bundle hash in baseline JSON; reject unpinned runners.

---

### F3 — CRITICAL: Corpus / G1 stays green while real user decks fail 1:1

**Focus:** corpus pass while real user decks fail

**How it fails in prod despite green tests**

Plan baseline: corpus **11/11 semantic 100%** used as infrastructure OK (`plan.md:65-66`). G1 keeps `npm run test:corpus` non-regressing (`plan.md:128`). That metric **does not measure visual or editable fidelity**.

Evidence:

- Semantic scorer matches by **bbox distance + type preferences** against **pptxtojson** JSON, not pixels (`pptx-import-semantic-and-roundtrip-fidelity-tester.js:594-653`, `402-409`).  
- Unsupported-image placeholders **count as images** (lines 347-354) — permanent raster/placeholder still scores.  
- Chart fixtures locked as **shape:2** with semanticFidelity **1.0** (`corpus-baseline.json:126-141`, `:143-159`).  
- Corpus README admits charts are shape-backed and diagram fixture is **shape-based process flow**, not SmartArt (`server/data/test-corpus/README.md:26-29`, `:20`).  
- Corpus size policy: “under 5MB” (`README.md:44-45`) — no large real decks, no EMF-heavy, no master-heavy corporate templates.  
- `Bai_*` / school decks ≠ full OOXML feature surface (animations, OLE, theme inheritance, EMF drawings).

**Green path that lies**

Phase 04–07 implement “enough” for corpus shapes → G1 green → progressive SSIM on same 11 decks → Phase 08 claims full SLA. User uploads real PowerPoint (native charts, SmartArt layouts, EMF logos, custom masters) → inventory fail / placeholders / visual miss — **outside corpus**.

**Required plan amendment (blocking)**

1. Split gates: **G1 semantic** never authorizes 1:1 claim.  
2. Add **hostile corpus** (must-fail until phases land): real native chart OOXML, real SmartArt `diagrams/data*.xml`, EMF/WMF media, multi-master theme, >50MB stress deck.  
3. E2/E3/E4 must be computed from **scene graph / OOXML evidence**, not pptxtojson type counts (Phase 03 says this; corpus baseline still shape-counts — force baseline rewrite in Phase 03, not Phase 05).  
4. Ban counting `importPlaceholderType === 'unsupported-image'` as image capture success under SLA mode.

---

### F4 — HIGH: Memory peak OOM on large decks (plan multiplies existing double-load)

**Focus:** memory OOM on large decks

**How it fails in prod despite green tests**

Existing import already multiplies memory:

| Stage | Code | Cost |
|-------|------|------|
| Host validate | `fs.readFile` + `JSZip.loadAsync` (`pptx-guards.js:92-95`) | ~1× compressed + inflated zip graph |
| Inflate measure | streams each entry (`pptx-guards.js:118-126`) | temporary inflate |
| Worker parse | **re-reads file**, `imageMode: 'base64'` (`parse-worker.js:40-50`) | full buffer + base64 images in JSON |
| Worker heap cap | `PARSER_MAX_OLD_SPACE_MB = 1024` (`constants.js:11`, `worker-runner.js:52-53`) | kills **worker only**; host still holds `packageInfo.zip` |
| Mapper | walks zip media + base64 elements | more buffers |
| Upload limit | 100MB file, 500MB decompress (`constants.js:4-6`) | legal package can still peak multi-GB host RSS |

Plan adds without a **host** budget:

- OOXML scene graph over same zip (`phase-03-…md:28-30` “reuse zip already loaded” — keeps host zip live longer)  
- LibreOffice external process rendering all slides (Phase 02)  
- Playwright Chromium screenshots (Phase 02)  
- Phase 08 original package retained on disk **and** reopened for part copy  

Risk register says “cap concurrent imports=1” (`plan.md:205`) — already true (`MAX_CONCURRENT_RUNNING=1`) — **does not reduce per-job peak**. Unit tests use tiny JSZip fixtures; corpus &lt;5MB. **No test for 80–100MB deck + oracle**.

**Prod symptom:** import job fails mid-map / LO killed / CI runner OOM; host process dies → all jobs lost; Electron desktop OOM on teacher laptops.

**Required plan amendment (blocking)**

1. Explicit **host RSS budget** + fail-fast before LO+Playwright+graph stack.  
2. Stream/discard: do not keep full JSZip + full parse JSON + scene graph + base64 media simultaneously; drop zip after media extract or map from disk entries.  
3. Stress test fixture (~80MB synthetic or generated) in CI memory job; oracle may sample first N slides for large decks.  
4. Disable `imageMode: 'base64'` for large media when scene graph path lands (or stream to disk).

---

### F5 — HIGH: Phase 08 “copy original OOXML parts” will corrupt export zips under green unit tests

**Focus:** export corrupts zip

**How it fails in prod despite green tests**

Today export is **PptxGenJS full rewrite** only (`server/utils/server-export.js:37-92` → `pptx.writeFile`). There is **no** OOXML part-merge path. `server/services/pptx-exporter.js` is raster helper only (lines 1-20).

Phase 08 invents:

```
export: if !dirty(node) && original.pptx → copy part; else generate from Nav model
```

(`phase-08-…md:38-43`) with dirty tracking `_pptxSource.nodeId` + content hash.

**Corruption modes unit tests miss**

| Mode | Why green tests miss it |
|------|-------------------------|
| Slide part copied but `[Content_Types].xml` / rels / theme not updated | T8.4 “marker / part hash strategy” (`phase-08-…md:64`) — hash equality ≠ openable PPTX |
| Edited text node dirty but sibling graphicFrame shares slide XML | Partial XML splice invalidates slide; LO may still open with repair, PP fails |
| Media rIds collide between generated and original parts | Fixture with one image passes |
| CRC / central directory mismatch after JSZip round-trip | `checkCRC32: false` on import (`pptx-guards.js:94`) already trains pipeline to ignore CRC |
| Soft-deleted original missing at export | Export falls back silently → “round-trip stable” on regenerated content while user expected zero-loss bytes |
| Concurrent export while original file replaced | No file lock story |

Round-trip harness today re-imports exported PPTX and scores structural stability (`pptx-import-semantic-and-roundtrip-fidelity-tester.js:1108-1137`) — **does not open in PowerPoint/LO for package validity**, and already lives at ~70% avg with 50% floor (fidelity report). Raising R1 to 0.90 via part-copy can **inflate R1 while shipping broken zips**.

**Required plan amendment (blocking)**

1. Export hybrid is a **sub-phase with package-level oracle**: after every export, `JSZip` load **with CRC**, LO `--convert-to pdf` must succeed, optional PP open on Windows.  
2. Prefer **whole-slide** or **whole-package** restore for unedited decks; forbid partial spTree splice until proven.  
3. T8.4/T8.5 must fail if LO cannot open; not only part-hash match.  
4. If original missing → hard error in strict mode, not silent regenerate.

---

## Cross-cutting: cancel / partial originals (covered in F1, residual)

Additional cancel gap not fully absorbed by F1:

- `runImport` checks abort **after** full `importer()` returns (`pptx-import.js:51-54`). If cancel fires during final `completeJob` race, media may already be dedup-indexed (`media.js` has rollback tests; original package plan does not wire into that).  
- Abort mid-mapper is partial (`map-presentation.js` throwIfAborted only at slide boundaries) — leftover uploads possible. Phase 01 T1.7 only checks `pptx-originals/`, not `server/uploads/`.

**Amendment:** cancel cleanup checklist = temp + original artifact + job-scoped media keys.

---

## What prior red-team under-ranked

| Prior severity | Topic | This analysis |
|----------------|-------|---------------|
| Med | LO ≠ PP | **Critical** for user SLA wording |
| Med | Disk originals | **Critical** with soft-delete + dual-write |
| Low | Effort fantasy | Out of scope here; still implies phases will cut hybrid export tests first — accelerates F5 |
| — | Dual-write bind | **Not listed** as open attack — **Critical** |
| — | Playwright present timing | Mentioned only as “fixed chrome flags” — insufficient |
| — | Export zip corruption | “Heavy zip tests; CRC; open in LO” is a note, not a hard TDD gate |

---

## Verdict for planner

**Do not cook Phase 01–08 as written for a “1:1 / zero-loss” user claim.**

Minimum plan rewrites before implementation:

1. **Atomic server import→presentation+original** (kill dual-write OR).  
2. **Required LO-pinned CI oracle** + present-mode capture waits; ban `PPTX_ORACLE=off` on required job.  
3. **Hostile corpus + OOXML evidence metrics**; stop treating semantic 100% as fidelity.  
4. **Host memory budget + large-deck test**.  
5. **Export package validity oracle** before any original-part reuse ships.

Until then: progressive thresholds and TDD lists will produce **green milestones and red production**.

---

## Unresolved questions

1. Product owner: is SLA “looks like PowerPoint” or “SSIM vs pinned LibreOffice”? These diverge.  
2. Soft-delete: keep original for trash restore (disk cost) or delete on soft-delete (zero-loss restore fail)? Plan must pick one.  
3. Electron self-host: who installs LO for oracle on teacher machines — never, or optional diagnostics only?

---

## Evidence index (file:line)

| Claim | Location |
|-------|----------|
| Temp unlink always | `server/routes/pptx-import.js:59-61` |
| Client create after job | `client/src/pages/HomePage.jsx:674-675` |
| Soft-delete only | `server/routes/presentations.js:303-314` |
| Job TTL 10m | `server/services/pptx-import-job-manager.js:3` |
| Full zip load host | `server/services/pptx-import/pptx-guards.js:92-95` |
| Worker re-read + base64 | `server/services/pptx-import/parse-worker.js:40-50` |
| Worker heap only | `server/services/pptx-import/constants.js:9-11` |
| Semantic placeholder scoring | `…/pptx-import-semantic-and-roundtrip-fidelity-tester.js:347-354` |
| Chart baseline as shape | `…/corpus-baseline.json:126-141` |
| Corpus chart admission | `server/data/test-corpus/README.md:26-29` |
| Editor screenshot timing | `tests/e2e/pages/pptx-import-audit-helper.js:61-87` |
| CI corpus no LO | `.github/workflows/github-actions-ci-pipeline-…yml:173-190` |
| Docker no LO | `Dockerfile:22-28` |
| Export = PptxGenJS only | `server/utils/server-export.js:37-92` |
| Phase 01 dual-write OR | `phase-01-…md:40-45` |
| Phase 02 skip LO | `phase-02-…md:71` |
| Phase 08 part copy | `phase-08-…md:38-43, 64-65` |
