# Red-Team Assumption Destroyer — Plan Review

**Plan:** `plans/260709-1306-pptx-import-native-ooxml-1to1-fidelity-deep-tdd`  
**Reviewer role:** Hostile Assumption Destroyer (code-reviewer)  
**Date:** 2026-07-09  
**Scope:** plan.md + phase-01…08 + red-team-and-validation.md vs live codebase  
**Verdict:** **FAIL plan assumptions** — prior plan red-team was cosmetic; 5 structural falsehoods block honest SLA claim.

---

## Destroyed assumptions (max 5)

### 1. Critical — SSIM ≥ 0.99 vs LibreOffice ≠ “looks like PowerPoint”; 0.99 likely unreachable

**Assumption destroyed:** Full-SLA row `mean SSIM ≥ 0.99` (plan.md progressive table + phase-08 T8.9) proves user SLA “slide trông như PowerPoint”.

**Why false**

1. **Oracle ≠ product claim.** Plan locks primary oracle to LibreOffice for CI (`plan.md` L192; phase-02 L46) while user SLA text says PowerPoint (`plan.md` L34). Prior red-team only “documented” LO≠PP (`red-team-and-validation.md` L14) — does not stop Phase 08 from claiming 1:1 on LO SSIM alone.
2. **Present stack is not Office.** Shared present HTML forces system UI fonts, not Calibri/theme major-minor:

```241:241:shared/src/htmlGenerator.js
    .reveal .slides section { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
```

   Font mismatch alone routinely drops full-slide SSIM well below 0.99 on text-heavy decks. Phase 02 risks admit font drift (`phase-02` L108) but still schedule 0.99 as hard Phase 08 gate without a measured ceiling first.
3. **Charts/SmartArt cannot SSIM-match LO under Chart.js/iframe path** (see Finding 3). Full-corpus mean 0.99 requires those decks not to drag mean — impossible if chart decks remain in corpus under visual SLA.
4. **No baseline exists.** Plan itself: visual SSIM “not measured” (`plan.md` L70). Setting terminal threshold before baseline is **numerology**, not engineering. Phase 02 “record debt” then Phase 08 “≥0.99” assumes debt is repayable to 0.99 without evidence.

**Evidence**

| Claim site | Code/plan site |
|------------|----------------|
| SLA full SSIM 0.99 | `plan.md` L111, L119–120; `phase-08` L15, L69 |
| LO primary oracle | `plan.md` L178, L192; `phase-02` L46 |
| System font present | `shared/src/htmlGenerator.js:241` |
| No SSIM today | `plan.md` L70 |

**Required plan fix**

- Split metrics: `V1_LO` (CI) vs `V1_PP` (Windows secondary). Full user SLA may claim only after **both** or after product rewrites SLA to “LibreOffice-parity”.
- Run Phase 02 baseline **before** locking 0.99. If measured ceiling on font-pinned core decks is e.g. 0.96, amend frontmatter SLA — do not hope.
- Exclude chart/SmartArt regions from full-slide SSIM until native visual renderer exists; use region masks or data-only gates for those classes.

---

### 2. Critical — `original.pptx` cannot bind without client race under current architecture

**Assumption destroyed:** Phase 01 “zero-loss package” + “avoid relying only on client re-upload” works as sketched without a single server transaction (`phase-01` L45–46, L120).

**Why false — actual control flow**

1. Import job completes with mapped JSON only; **temp upload deleted in `finally`**:

```41:61:server/routes/pptx-import.js
async function runImport({ jobId, filePath, originalName, importer, jobManager }) {
  // ...
  } finally {
    await fs.unlink(filePath).catch(() => {})
  }
}
```

2. Client **separately** creates presentation after SSE `done` — presentation id does not exist during import:

```674:675:client/src/pages/HomePage.jsx
      setImportProgress('Creating presentation...')
      const pres = await api.createPresentation(imported.presentation)
```

3. Job result is **ephemeral** (`JOB_TTL_MS = 10 * 60 * 1000`); cleanup drops job map entry after SSE detach (`server/services/pptx-import-job-manager.js` L3, L159–170). Artifact handle in job result dies with job if client slow/offline.
4. `createPresentation` accepts arbitrary passthrough fields (`server/middleware/schemas.js` L58–66) but **delete presentation does not cascade any original file** (`server/routes/presentations.js` L340–372` — share + history only). Plan T1.6 assumes hook that does not exist.
5. Two-step failure modes plan under-specifies:
   - Persist original before create → client never creates → **orphan forever** (unless GC by hash not in plan).
   - Persist only after create with `originalArtifactId` → client omits field / network drop after import → **bytes already unlinked** at L60 → permanent loss of “zero-loss”.
   - Persist by moving temp before unlink but bind later → same orphan/bind race.

**Evidence**

| Risk | File:line |
|------|-----------|
| Unlink before client bind | `server/routes/pptx-import.js:60` |
| Client create after import | `client/src/pages/HomePage.jsx:675` |
| Job TTL 10m | `server/services/pptx-import-job-manager.js:3` |
| Delete no original cascade | `server/routes/presentations.js:340-372` |
| Plan still allows client bind path | `phase-01` L45–46, L120 |

**Required plan fix**

- **Mandatory single transaction:** import job **creates** presentation server-side (or draft record with id) and persists `pptx-originals/{presId}.pptx` **before** `completeJob`. Client only navigates to id. Kill “originalArtifactId on create” as primary path.
- Extend DELETE cascade + cancel path tests against real orphan dir.
- Do not complete job until original hash verified on disk.

---

### 3. High — Chart.js Nav model cannot hold OOXML charts; Phase 05 E2 + SSIM 0.97 is self-contradictory

**Assumption destroyed:** “Expand chart model where Chart.js mapping is insufficient — fail tests rather than fake pass” (`phase-05` L15) still yields **native editable + visual 0.97** on chart decks (`phase-05` T5.8; plan L109).

**Why false**

1. **UI/runtime chart types are only 6 Chart.js types** — no scatter, bubble, stock, surface, combo, 3D:

```38:42:client/src/components/properties/chart-properties.jsx
        {['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'].map((t) => (
```

2. **Mapper already coerces / lies about type** (data shape wrong for SSIM and for “editable as original chart”):

```11:25:server/services/pptx-import/chart-output-to-navslides-mapper.js
function mapChartType(pptxType = '') {
  const t = String(pptxType || '').toLowerCase()
  // ...
  if (t.includes('bubble')) return 'bar'
  // ...
  if (t.includes('stock')) return 'line'
  if (t.includes('surface')) return 'bar'
  if (t.includes('scatter')) return 'line'
  return 'bar'
}
```

   Test explicitly accepts scatter→line (`chart-output-to-navslides-mapper.test.js` L196–203). That is **semantic fake pass** the plan claims to ban.
3. **Renderer is Chart.js iframe** (`chart-element-renderer.jsx` L29–35) — layout, markers, axes, 3D, combo secondary axis will never match LO/PP chart drawing ML.
4. Plan red-team amendment (`plan.md` L180) says expand or fail E2 — but **E2 alone** (type `chart` + series arrays) can go green while visual SLA fails; or SSIM lowered via progressive table while product still says “native editable charts”. Neither is user 1:1.

**Evidence**

| Item | Location |
|------|----------|
| 6 chart types UI | `client/src/components/properties/chart-properties.jsx:38` |
| Coercion map | `server/services/pptx-import/chart-output-to-navslides-mapper.js:11-25` |
| Chart.js present | `client/src/components/canvas/element-renderers/chart-element-renderer.jsx:29-35` |
| Phase 05 SSIM 0.97 | `phase-05` L64; `plan.md` L109 |

**Required plan fix**

- Publish **support matrix** of OOXML chart types → Nav representation. Unsupported = strict fail or explicit SLA carve-out (like macros), not silent map to bar/line.
- Drop “SSIM ≥ 0.97 on chart decks” until renderer is not generic Chart.js **or** replace metric with data-fidelity + editable-series only and rewrite user-facing SLA language.
- Forbid `_pptxChartMeta.originalType` as success signal; success = same chart class + editable values + visual gate that is achievable.

---

### 4. High — Progressive thresholds *do* redefine the SLA operationally

**Assumption destroyed:** Progressive table is “honest staging” that “doesn’t redefine SLA” (`plan.md` L100–113, L183).

**Why false**

- **User SLA (locked):** any unimplemented class = **error / not done**, not “good enough” (`plan.md` L34).
- **Operational SLA in CI:** Phase 04 ships with mean SSIM ≥ 0.95 and chart/SmartArt gaps still “measured” (allowed non-zero) (`plan.md` L108). Phase 05/06 ratchet. Only Phase 08 hits full row.
- That is a **product permission structure** to merge intermediate work under green gates while permanent placeholders/gaps remain for unclaimed classes — exactly the attitude baseline table labels forbidden (`plan.md` L71).
- Red-team line “Effort underestimate → progressive thresholds; no redefinition without frontmatter” (`plan.md` L183) is circular: progressive table **is** the redefinition mechanism, and implementers will treat milestone green as shippable.
- Historical corpus already shows how floors rot: fidelity report documents round-trip floor drop 99% → 50% while semantic stays 100% (`docs/pptx-import-fidelity-report.md` L30–36). Progressive SSIM will repeat that pattern.

**Evidence**

| Item | Location |
|------|----------|
| User SLA absolute | `plan.md` L32–34 |
| Progressive lower bars | `plan.md` L104–111 |
| “No redefinition” claim | `plan.md` L183 |
| Prior floor erosion precedent | `docs/pptx-import-fidelity-report.md:30-36` |

**Required plan fix**

- Rename intermediate gates to **`debt-gate` / `not-SLA`** in package scripts and CI job names. Never label Phase 04/05 green as “SLA milestone”.
- User-facing / README language: forbid “1:1 fidelity” until `test:pptx:sla-1to1` green only.
- Any threshold lower than full row requires **product-owner signed carve-out file**, not implementer table edit.

---

### 5. High — Scene graph “pure JS inventory truth” + SmartArt E3 + 19-type freeze are already false-easy

**Assumptions destroyed:**

1. Building OOXML scene graph in pure JS is a 5–10d Phase 03 with files under 200 LOC (`phase-03` L28–31, effort L6).
2. E3 `smartArtEvidence - nativeEditableDiagram == 0` is a meaningful metric (`plan.md` L124).
3. Element count can stay coherent with “optional new `diagram` type” (`phase-06` L41) under frozen 19 types.

**Why false**

1. **Current OOXML “inspection” is only relationship path counting** — not spTree geometry/inventory:

```53:99:server/services/pptx-import/ooxml-inspection.js
async function inspectOoxmlCoverage(zip) {
  // ...
  const packageChartEntries = entries.filter((entry) => /^ppt\/charts\/chart\d+\.xml$/i.test(entry))
  // slide rels → chart/smartArt targets only
```

   Phase 03 must invent real spTree walk (namespaces, grpSp transforms, graphicFrame, mc:AlternateContent, placeholders). That is multi-week OOXML engineering, not a thin module split. 200 LOC rule (`Claude.md` / `docs/code-standards.md:83`) forces many files but **does not reduce OOXML surface**; risk of incomplete walker that still “passes” T3.1 handcrafted zips.

2. **E3 metric is broken today even when diagrams import:** mapper flattens SmartArt to `shape`/`line`, never `type: 'diagram'`:

```38:38:server/services/pptx-import/mapper/map-diagram.js
    type: 'shape',
```

   Coverage counts only `element?.type === 'diagram'`:

```167:172:server/services/pptx-import/mapper/map-presentation.js
    const mappedNativeChartCount = elements.filter((element) => element?.type === 'chart').length
    const mappedNativeDiagramCount = elements.filter((element) => element?.type === 'diagram').length
    // ...
    const smartArtCoverageGapCount = Math.max(0, smartArtEvidenceCount - mappedNativeDiagramCount)
```

   So any OOXML SmartArt evidence ⇒ permanent gap warning (`native-smartart-degraded`) regardless of flatten quality. Phase 06 “gap = 0” **requires** either a new canonical type or a metric rewrite — plan treats this lightly.

3. **19 types are test-frozen**, not casually extensible:

```12:13:client/src/data/element-defaults.test.js
  it('exposes exactly 19 element types (matches README "19 element types")', () => {
    expect(Object.keys(ELEMENT_DEFAULTS)).toHaveLength(19)
```

   No `diagram` key in `ELEMENT_DEFAULTS` (`client/src/data/element-defaults.js`). Phase 06 preferred path = 20th type → README, shared typedef, registry, properties, export, present, factory — large product surface omitted from 5–12d estimate.

4. **Dual truth until content leaves pptxtojson:** Phase 03 keeps pptxtojson for payloads (`phase-03` L46) while graph is “inventory truth”. Reconciliation can be green while content still wrong — false confidence.

**Evidence**

| Item | Location |
|------|----------|
| Rels-only OOXML | `server/services/pptx-import/ooxml-inspection.js:53-99` |
| Diagram → shape flatten | `server/services/pptx-import/mapper/map-diagram.js:38` |
| E3 counts `type==='diagram'` | `server/services/pptx-import/mapper/map-presentation.js:168-172` |
| 19-type freeze | `client/src/data/element-defaults.test.js:12-13` |
| 200 LOC rule | `docs/code-standards.md:83`; phase-03 L31 |
| Dual truth admitted | `phase-03` L46–47 |

**Required plan fix**

- Rewrite E3 to count **editable diagram model** (sidecar `_pptxDiagram` or group) not missing element type — or budget full 20th type + editor surface as Phase 06 P0 scope.
- Phase 03 success = graph node count vs **hand-audited** real corpus decks (Bai_*), not only synthetic zips; add fixture for AlternateContent/group.
- Effort: treat full scene graph as multi-phase (inventory → geometry → theme/placeholder); 5–10d is inventory-only.

---

## Assumptions checked but not top-5 (brief)

| Assumption | Status | Note |
|------------|--------|------|
| Single import concurrency =1 | **Already true** | `MAX_CONCURRENT_RUNNING = 1` in `pptx-import-job-manager.js:4`. Not a false assumption; still insufficient for LO+Playwright+import **memory** during oracle (plan risk L205) — oracle must not fork N parallel soffice without separate cap. |
| Permanent placeholder ban | Directionally correct | Map-image still emits `unsupported-image` for EMF (`map-image.js:36-48`); plan Phase 07 addresses. |
| Prior red-team “conditional-pass” | **Too weak** | Missed Findings 1–2–5 structural issues. |

---

## Overall assessment

Plan architecture (Option B native OOXML) may be right product direction. **Metrics and binding design are wrong:**

1. Visual 0.99 LO SSIM is not PowerPoint 1:1 and is unproven.  
2. original.pptx under client create is not zero-loss.  
3. Chart.js cannot satisfy visual+type fidelity.  
4. Progressive gates redefine SLA in practice.  
5. SmartArt E-metrics / scene-graph effort / 19-type freeze are inconsistent.

**Recommendation to planner:** do not cook Phase 01–08 as written. Amend plan frontmatter + Phase 01/02/05/06/08 before implementation. Re-run red-team after amendments.

---

## Recommended plan amendments (priority)

1. **Server-side import→create transaction** for original.pptx (Finding 2).  
2. **Baseline SSIM first**; dual LO/PP metrics; no 0.99 lock without ceiling report (Finding 1).  
3. **Chart support matrix + drop fake type maps**; separate data vs visual gates (Finding 3).  
4. **Label intermediate gates non-SLA** (Finding 4).  
5. **Fix E3 definition + decide diagram type vs sidecar before Phase 03/06** (Finding 5).

---

## Unresolved questions

1. Will product accept **LibreOffice-parity** as published SLA, or is PowerPoint-only visual acceptance mandatory?  
2. Is Chart.js replacement (custom SVG/canvas Office-like charts) in scope, or are most OOXML chart types permanent carve-outs?  
3. Is new element type `diagram` approved (breaks 19) or must SmartArt stay shape-group + model sidecar?  
4. CI: LO install size/time approved for required job? (plan open Q1 still open.)

---

## Checklist (assumption destroyer)

- [x] SSIM 0.99 achievable — **destroyed** (Finding 1)  
- [x] LibreOffice = PowerPoint — **destroyed** (Finding 1)  
- [x] Chart.js holds all OOXML charts — **destroyed** (Finding 3)  
- [x] Scene graph pure JS easy — **destroyed** (Finding 5)  
- [x] Progressive thresholds don’t redefine SLA — **destroyed** (Finding 4)  
- [x] original.pptx bind without client race — **destroyed** (Finding 2)  
- [x] 200 LOC vs OOXML parsers — **partial destroy** (Finding 5)  
- [x] Single worker concurrency — **assumption OK; memory still open**  
- [x] Element count 19 frozen — **conflict with Phase 06** (Finding 5)  
