# PPTX Import — Brainstorm Findings Report

- **Run date:** 2026-05-24 17:32 local (UTC 2026-05-24T10:32:36Z)
- **Scope:** Re-evaluate fidelity + audit architecture/security of full PPTX import pipeline.
- **Corpus:** `PPTX/` (4 Vietnamese school lesson decks: Bai_2_1, Bai_2_2, Bai_2_5, STTre_Duc — 5.4MB total)
- **Command:** `npm run test:corpus` → `node server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js ./PPTX --roundtrip --strict`
- **Result:** 4/4 passed strict gates (≥95% semantic / ≥98% round-trip). Numbers improved vs 2026-04-25 baseline.
- **Code action this round:** NONE (per user). Findings only.

---

## 1. Empirical Results

### 1.1 Aggregate

| Metric | This run (2026-05-24) | Baseline (2026-04-25) | Delta |
|---|---|---|---|
| Avg semantic fidelity | **98.0%** | 97.0% | +1.0 pp |
| Avg round-trip stability | **99.0%** | 99.0% | flat |
| Strict gates | PASS | PASS | – |
| Export method | `production` (all 4) | `production` | flat |

No regression. Improvement plausibly from interim fixes (#3/#4/#7/#8 markers in mapper.js).

### 1.2 Per-deck

| File | Size | Duration | Semantic | RT Stability | Notes |
|---|---|---|---|---|---|
| Bai_2_1.pptx | 1.87 MB | 19.0s | **97.0%** | **96.0%** | Image 27→19 (−8), shape 79→87 (+8), image-property 70% (low), max shape drift 682px / median 364.5px |
| Bai_2_2.pptx | 0.53 MB | 34.7s | 99.0% | 100.0% | `other` 4→4 with 0% property coverage, table 90% (border gap), shape median drift 121px |
| Bai_2_5.pptx | 1.13 MB | 45.1s | 97.0% | 99.0% | Image 31→26 (−5), shape 245→250 (+5), image-property 84%, `other` 13→13 with 0% property coverage, max shape drift 829px / median 326.4px |
| STTre_Duc.pptx | 2.88 MB | 10.8s | **100.0%** | 100.0% | Cleanest deck (no tables, no math, no SmartArt). Confirms baseline for "ordinary" decks. |

### 1.3 Empirical regressions

> Decks that pass the average but have specific count/coverage anomalies hidden inside.

1. **Image loss — 8/27 dropped on Bai_2_1, 5/31 on Bai_2_5.** Per-element images are silently replaced by `media-missing` placeholders. `persistImageForElement` returns `null` when:
   - `getElementImagePayload` yields nothing (no `base64`/`src`/`blob`/`fill.value.base64`/`fill.value.blob`)
   - AND `element.ref` / `element.fill.value.ref` either missing or not in `mediaIndex`
   - OR `detectImage` mismatches sniffed MIME vs hinted MIME → returns `null` (see `media.js:71`)
   - OR sniffer doesn't recognize the format (WMF, EMF, SVG inside fill → unsupported)
   
   *Impact:* 30% image loss on a real-world Vietnamese school deck. Average semantic fidelity hides this — `imageCount` doesn't enter the headline %.

2. **Shape count inflation.** Bai_2_1 79→87 and Bai_2_5 245→250. Likely group/diagram flattening produces more children than the source counts (group element itself is dropped, children get individual entries). Not strictly wrong, but breaks 1:1 round-trip equivalence and inflates SVG output bytes.

3. **`other` element type has 0% property coverage.** Both Bai_2_2 (n=4) and Bai_2_5 (n=13) classify items as `other`. Round-trip says they're 100% stable (mapped to `latex`/equations), but the property-coverage metric reports 0% — either the tester doesn't score `other`/`latex`, or there are properties we're losing on math equations entirely. **The metric is dishonest here.**

4. **Shape median geometry drift 121–364 px (canvas is 960×540).** Bai_2_1 median 364px shape drift is **38% of canvas width**. Max 682–829 px is essentially the whole slide. Means roughly half of all shape boxes are placed dozens of percent off true PPTX coordinates. Median text drift is 0.5px (fine) — so the drift is shape-specific, not slide-wide.

5. **Table property coverage hard-capped at 90%.** Mapper hardcodes `borderColor: '#d1d5db'`, `borderWidth: 1` (mapper.js:411-412). Per-cell/per-side borders, table style themes, and tableborder color from PPTX completely discarded. Documented as known gap but **not fixed**.

6. **Bai_2_2 needs 34.7s, Bai_2_5 needs 45.1s.** A 1MB file taking 45s blocks the import endpoint synchronously. No progress bar on client (`HomePage.jsx:565-592` shows 3 static text states). For a 100MB worst-case file → likely tens of minutes. UX-blocker at scale.

---

## 2. Architecture Concerns (Prioritized)

| # | Severity | Area | Issue | Effort |
|---|---|---|---|---|
| P0-A | High | Mapper | `mapper.js` = **999 LOC** in one file (violates project 200-LOC rule). Mixes element-type dispatchers, group flattening, diagram flattening, slide-level orchestration, image persist, table mapping, math mapping, shape SVG generation, sanitize wiring. Hard to test, hard to extend per-type. | M |
| P0-B | High | Mapper | `mapImage` returns `null` silently dropping images (root cause of 8/27 loss on Bai_2_1). MIME-mismatch path: `detectImage` returns `null` when `hintedMime !== detected.mime` — but PPTX commonly has stale MIME hints from `r:embed`. Should trust sniffed MIME and ignore hint, or fall back to sniffed. | S |
| P0-C | High | Coverage | "Other" / `latex` element type contributes 0% to property-coverage metric while accounting for 4–13 items per real deck. Either fix metric or fix mapping coverage definition — current state masks gaps. | S |
| P0-D | High | Geometry | Shape mapper produces median drift of 121–364 px across decks. Root cause unverified — candidates: `clampBox` clipping in `mapLineGeometry`, group flattening of nested rotations, or `mapBox` rounding. Needs scout into `geometry-drift.test.js` failures and source PPTX shape coordinates. | M |
| P1-E | Med-High | Performance | 45s for 1MB file. Synchronous request blocks Express handler. No job queue, no progress streaming, no async polling. 100MB file = unusable. Worker isolation exists but is in-band. | L |
| P1-F | Med-High | Worker IPC | No ACK handshake (per journal `260425-1637`). Worker can crash silently; importer waits PARSER_TIMEOUT_MS (60s) before knowing. Also: `parse-worker.js:59` uses single `message` event — if worker sends partial, importer accepts truncated state. | M |
| P1-G | Med | Tables | Per-cell + per-side + table-theme borders dropped. Hardcoded `#d1d5db` borderColor and `borderWidth: 1` (mapper.js:411-412). Affects every table import including Bai_2_1, Bai_2_2, Bai_2_5. | M |
| P1-H | Med | Media | No SHA256 deduplication on import. Each call to `persistImageBuffer` (media.js:75) and `persistMediaBlob` (media.js:93) generates new UUID. Re-importing the same PPTX duplicates every image. Contrast: `routes/upload.js` does SHA256 dedup. Bloats `server/uploads/` and presentation JSON. | S |
| P1-I | Med | Charts | `chart-output-to-navslides-mapper.js` only handles common + scatter. PPTX 3-D charts, combo charts, custom series colors, axis titles, secondary axis — all dropped or fall to placeholder. None of the 4 corpus files exercise this — **gap is hidden by corpus**. | M |
| P1-J | Med | SmartArt | `flattenDiagramElement` hardcodes `maxNodes = 50`. Connector detection by string match on `shapType` is fragile. Connector endpoints `x1/y1/x2/y2` fallback to `(left, top)` → `(left+width, top+height)` which only works for horizontal-line connectors. Org-charts with curved/elbow connectors render wrong. | M |
| P2-K | Low-Med | Image filters | `mapper.js:268-289` divides fixed-point by 1000 — magic constant. Sharpen / colorTemperature stored only in `_pptxImportMeta` sidecar, never rendered. Half-implemented feature. | S |
| P2-L | Low-Med | Background | Slide background images not extracted (per known docs gap). For decks like Bai_2_5 with full-bleed background images, this loses major visual context. | M |
| P2-M | Low | Group depth | `MAX_GROUP_DEPTH = 10` is a hard cap. Anything deeper produces a `placeholder` rect with "Deep group locked" label. Conservative but silent — could surface as user-actionable warning. | S |
| P2-N | Low | Math fallback | `mapMath` strips ALL inline HTML (`<[a-z][^>]*>`). If equation contains `<sub>` or `<sup>` they're stripped before LaTeX is set, potentially corrupting symbol semantics. | S |
| P2-O | Low | shapeName | `mapper.js:174-204` uses `.includes()` for shape-type matching → ambiguous (`'flowChartTerminator'` contains `'flow'` and `'chart'`). Better: enum lookup table. | S |
| P3-P | Low | Test corpus | Only 4 files, all from same source (Vietnamese school decks). No animation-heavy decks, no chart-heavy decks, no SmartArt-heavy, no Office 365 modern decks, no presenter notes, no headers/footers. Coverage of types is partial. | M |
| P3-Q | Low | Magic constants | `MAX_NODES = 50`, `CANVAS_SIZE = {960, 540}`, `MAX_GROUP_DEPTH = 10`, fixed-point divisor `1000` scattered through code. Should be named constants in `constants.js`. | XS |
| P3-R | Low | Test mismatch | `mapper.test.js` = 1508 LOC and tests `mapper.js` against fixtures. Some fixtures appear synthesized rather than from real PPTX. Real-deck-driven tests would catch the image-loss + drift bugs above. | M |

---

## 3. Security Review (Upload Boundary)

PPTX import is a **real untrusted-input boundary** even though NavSlides treats authored content as trusted. Reviewed:

### 3.1 Verified safe

| Vector | Status | Source |
|---|---|---|
| Zip bomb (total size) | Bounded 500MB decompressed | `pptx-guards.js:60` |
| Zip bomb (entry count) | Bounded 5000 entries | `pptx-guards.js:55` |
| File-size DoS | Bounded 100MB upload | `constants.js:1` + multer limit |
| MIME sniffing | Magic-number check (PNG/JPEG/GIF/WebP/BMP) | `media.js:16-35` |
| Path traversal in media filenames | Mitigated by `uuidv4()` + sniffed ext | `media.js:80-82` |
| XSS in text frames | DOMPurify with allowlist tags/attrs + post-process href protocol + style sanitizer | `sanitize.js` |
| href javascript: URLs | Stripped by `validateHref` post-DOMPurify | `sanitize.js:42-47` |
| CSS `url(...)` / expression / behavior | Stripped by `sanitizeStyle` | `sanitize.js:33-35` |
| RCE in pptxtojson | Isolated in forked child process | `worker-runner.js` |
| Error message leakage | `sanitizeDiagnostic` strips XML / base64 / emails / truncates to 500 | `diagnostics.js:12-22` |

### 3.2 Issues

| # | Severity | Vector | Detail |
|---|---|---|---|
| S1 | Med | Rate limiting | `/api/pptx/import` inherits only generic `apiLimiter` (300 req/15min prod). `/api/upload` has stricter `uploadLimiter` (30 req/15min). PPTX import is heavier (60s timeout, parses 100MB) and should use `uploadLimiter` or its own tighter limit. (`server/index.js:75, 82, 108`) |
| S2 | Med | Extension allowlist | `persistMediaBlob` extracts extension from zip-entry filename (`media.js:99`). A malicious PPTX could embed `ppt/media/image1.html` and produce `<uuid>.html` in `uploads/`, which is served as static at `/uploads/<uuid>.html`. If that HTML contains JS, it becomes stored XSS — but on a different origin only if `/uploads` serves with `text/html` Content-Type (Express sets MIME by extension → YES it would). |
| S3 | Low-Med | XXE in worker | pptxtojson uses an XML parser. Not verified that external entity resolution is disabled. Even though the worker is forked, it still shares filesystem access (can read `/etc/passwd`, SSH keys via XXE). Mitigation: forked process inherits parent's filesystem privileges. |
| S4 | Low | Prototype pollution | Mapper does `{ ...element, type: 'image', base64: element.picBase64 }` and similar spreads (mapper.js:580, 588). If a malicious PPTX's parsed JSON contains `__proto__` or `constructor.prototype` keys, the spread propagates. JSZip + pptxtojson don't normally allow this from XML, but unverified. |
| S5 | Low | Worker IPC trust | Worker output is fully trusted by importer (no schema validation of `parsed.output` shape). A compromised pptxtojson could send arbitrary structured data via `process.send()`. |
| S6 | Low | Decompressed-per-entry cap | Individual zip entries are not bounded — only total. A single 400MB XML inside an otherwise small PPTX would pass the 500MB total but exhaust XML parser memory. |
| S7 | Low | No virus / content scan | Embedded media (PNG/JPEG) not scanned. PNG/JPEG with malicious payloads in EXIF or COM markers persist into `/uploads/`. Largely moot for single-user self-hosted. |
| S8 | Info | Audit context | Per README.md: "untrusted uploads or imported files executing outside the author's intent" is in-scope. S1, S2, S3 cross trust boundary; S4–S7 are defense-in-depth. |

---

## 4. Recommendations (No Code — Plan Material)

### 4.1 Top P0 fixes (if user wants quick wins before overhaul)

1. **Fix image-loss bug** (P0-B). Trust sniffed MIME over hinted MIME in `detectImage`. Add log warning when both fail, don't silently null-out.
2. **Honest property-coverage metric** (P0-C). Either include `other`/`latex` in the metric, or document why excluded.
3. **Rate-limit `/api/pptx/import`** (S1). Apply `uploadLimiter` to `/api/pptx` route mount.
4. **Extension allowlist on persistMediaBlob** (S2). Only allow `png|jpg|jpeg|gif|webp|bmp|mp4|mp3|wav|ogg|webm` — block `.html`, `.js`, `.svg`, `.exe`, etc.

### 4.2 Architecture overhaul (per user's "không có ràng buộc" mandate)

Suggested decomposition:

```
server/services/pptx-import/
├── importer.js                    (orchestrator — current)
├── pptx-guards.js                 (current)
├── parse-worker.js                (current)
├── worker-runner.js               (add ACK handshake)
├── sanitize.js                    (current)
├── media.js                       (add SHA256 dedup + extension allowlist)
├── geometry.js                    (current)
├── constants.js                   (collect all magic constants)
└── mapper/
    ├── index.js                    ← entry point: mapElement dispatcher only (≤80 LOC)
    ├── map-image.js                ← persist + crop + filter (≤150 LOC)
    ├── map-shape.js                ← shape vs line vs path (≤150 LOC)
    ├── map-table.js                ← per-cell + per-side borders (≤180 LOC)
    ├── map-text.js                 ← sanitize + metadata extract (≤120 LOC)
    ├── map-math.js                 ← latex + sub/sup preservation (≤80 LOC)
    ├── map-chart.js                ← extends current chart-output-to-navslides-mapper
    ├── group-flattener.js          ← flattenGroupElement + buildGroupMatrix (≤150 LOC)
    ├── diagram-flattener.js        ← flattenDiagramElement + connector detection (≤180 LOC)
    └── shape-name-lookup.js        ← enum table replacing .includes() (≤80 LOC)
```

### 4.3 Performance — async import

For files >5MB or duration >5s:
- Background job queue (`bull` or simple in-memory queue)
- Return `202 Accepted` + `jobId` immediately
- Client polls `/api/pptx/jobs/:id` for progress
- Progress events from worker via additional `process.send({ type: 'progress', percent })` messages
- Update `HomePage.jsx:565-592` to show real progress bar

### 4.4 Corpus expansion (P3-P)

Add at least:
- 1 chart-heavy deck (column/bar/line/pie mix)
- 1 SmartArt-heavy deck (org chart, process flow)
- 1 animation-heavy deck (to verify we drop them with appropriate warnings)
- 1 modern Office 365 deck (icons, 3D models, modern charts)
- 1 deck with background images
- 1 deck with presenter notes, headers, footers
- Target n=10–15.

Store in `server/data/test-corpus/` (currently missing per scout) so default `--strict` runs without `./PPTX` arg.

### 4.5 Honest baseline

Re-derive fidelity targets from current metric definition. Per-deck variance is large (96% → 100% on the same corpus); average can mask 30% image loss on a single deck. Add a "minimum per-deck" gate: e.g., **no deck below 95% semantic AND no element-class drop >15%**.

---

## 5. Decision Matrix for User

| Path | What it solves | Effort |
|---|---|---|
| **Quick wins only** (P0-B, P0-C, S1, S2) | Stop silent image loss; stop dishonest metric; harden upload boundary | 1–2 days |
| **Quick wins + table borders** (P0 set + P1-G) | Above + 90%→100% table property coverage | 2–3 days |
| **Mapper refactor** (P0-A + retests) | Maintainability; unlocks per-element-type unit tests; doesn't change behaviour | 3–5 days |
| **Full overhaul** (P0-A + P1-E + P1-F + P1-G + P1-H + corpus expansion + honest metric) | Production-grade import pipeline; supports large files; honest fidelity baseline | 2–3 weeks |
| **All P0+P1+P2** | Above + diagram + math + charts + background images | 4–5 weeks |

Recommendation: **quick wins first (1–2 days)** to unblock real users hitting image loss + dishonest metric, then **scope full overhaul** as a phased follow-up plan with clear acceptance gates.

---

## 6. Unresolved Questions

1. **Image-loss root cause confirmation.** Suspected MIME-mismatch + unsupported-format. Need to instrument `media.js:71` `detectImage` to log which path nulls out for the 8 lost images in Bai_2_1.
2. **`other` element classification.** What pptxtojson element types map to `other` in element counts? (Likely math/equation per round-trip `latex` mapping, but unverified.)
3. **Shape median drift 364px on Bai_2_1.** Is it the same shape repeated (one bad group), or distributed? Need per-shape drift export from tester.
4. **XXE in pptxtojson.** Unverified; would need to inspect pptxtojson's internal XML parser config or test with an XXE payload PPTX.
5. **`other → latex` round-trip 100% stable but 0% property coverage.** Contradiction in the tester; needs metric definition review.
6. **Background images.** Confirmed not extracted, or just deprioritized? `mapPptxOutput` slide-level handling not reviewed in this round.
7. **User priority.** Quick wins, refactor, or full overhaul as the first plan?
