---
phase: 2
title: "Visual oracle SSIM gate"
status: pending
priority: P0
effort: "3-6d"
dependencies: [1]
tdd: true
---

# Phase 2: Visual oracle SSIM gate

## Overview

Build a **measurable visual oracle** without making the **product** depend on third-party Office engines (user validation: native runtime only).

**Primary CI path (V-01):** screenshot NavSlides **present** mode vs **committed golden PNGs** per slide (fixtures under `oracle/goldens/`). SSIM gate. Goldens may be produced offline (maintainer machine with LO/PP) or regenerated optionally.

**Optional path:** `PPTX_ORACLE_LO=1` uses LibreOffice to refresh goldens — **not** required for app runtime or for CI green if goldens checked in.

Phase 02 records baseline and installs gate machinery; full 0.99 not required until later milestones.

## Requirements

### Functional
- Script/CLI: `npm run test:pptx:oracle` (name locked in package.json).
- Inputs: corpus dir (default `server/data/test-corpus`).
- For each deck:
  - Generate oracle PNGs per slide (LibreOffice headless `--convert-to png` or pdf→png pipeline).
  - Import via production path (worker+mapper) or cached presentation JSON + present URL.
  - Capture NavSlides slide screenshots (Playwright preferred; reuse browser-audit patterns).
  - Compute per-slide SSIM; write JSON report under `plans/reports/pptx-oracle-runs/`.
- Exit codes:
  - `0` when milestone thresholds pass
  - `1` on metric fail
  - `2` when oracle binary missing
- Required CI: SSIM vs **committed goldens** (no LO install required).
- Missing goldens for a corpus deck → fail (not skip).
- Optional LO refresh is maintainer tooling only.
- Capture surface = **present mode**; wait fonts/images settled.
- Claim language: **Nav present vs golden SSIM** (goldens sourced from LO/PP offline). Not “runtime uses PowerPoint”.

### Non-functional
- Deterministic viewport (e.g. 1920×1080 or 960×540 CSS px), fixed deviceScaleFactor.
- Cache oracle renders by sha256(pptx) to speed CI.
- No network font CDN flakiness: prefer local/vendor fonts for present.

## Architecture

```
.pptx ──► LibreOffice ──► ref/slide-N.png
.pptx ──► NavSlides import+present ──► act/slide-N.png
ref + act ──► ssim ──► report.json + exit code
```

Primary oracle: **LibreOffice**. Secondary (optional): PowerPoint COM — not required for phase pass.

Reuse: `plans/reports/pptx-import-real-browser-audit-*` patterns, Playwright configs.

## Related Code Files

- Create:
  - `server/services/pptx-import/oracle/render-libreoffice.js`
  - `server/services/pptx-import/oracle/ssim.js` (or thin wrapper around `ssim.js` / `pixelmatch`+policy)
  - `server/services/pptx-import/oracle/pptx-oracle-cli.js`
  - `server/services/pptx-import/oracle/*.test.js`
  - `tests/e2e/pptx-oracle-capture.spec.js` (or unit with mocked shots for pure SSIM math)
- Modify:
  - `package.json` scripts `test:pptx:oracle`
  - CI workflow (optional job)
  - `sla-contract.js` — wire V1/V2 thresholds per milestone
  - `.gitignore` for large oracle artifacts if needed (keep tiny fixtures)

## Tests (TDD) — RED first

| ID | Assert |
|----|--------|
| T2.1 | `ssim(identical buffers) === 1` (or ≥ 0.999) |
| T2.2 | `ssim(black, white)` below low bound |
| T2.3 | CLI parses args; writes report schema `{ decks: [{ file, slides: [{ index, ssim }] }], meanSsim }` |
| T2.4 | When LO missing and `PPTX_ORACLE=off`, exit 0 with `skipped: true` **only in unit test env** — production CI must not use off for required job |
| T2.5 | When LO present: at least one tiny fixture deck produces numeric SSIM (integration, `describe.skipIf(!hasLo)`) |
| T2.6 | Threshold fail: force threshold 1.0 on noisy pair → CLI exit 1 |
| T2.7 | Report path includes timestamp; gitignored bulk images |

## Implementation Steps

1. RED T2.1–T2.3 pure unit.
2. Implement SSIM helper + report writer.
3. Implement LO render wrapper (detect `soffice` / `libreoffice`).
4. Implement capture of NavSlides slides (Playwright against dev server or static present HTML).
5. Wire CLI + npm script.
6. Run baseline on full corpus; commit **baseline JSON numbers** (not all PNGs) into `server/services/pptx-import/oracle/baseline-ssim.json`.
7. Document: Phase 02 complete even if baseline mean SSIM < 0.95 — **gate records debt**.

## Success Criteria

- [ ] `npm run test:pptx:oracle` exists and documented
- [ ] T2.* green (skip LO-dependent only when LO absent with explicit flag in local dev)
- [ ] Baseline report checked in for 11 corpus decks (numeric)
- [ ] `sla-contract` V1/V2 referenced by CLI
- [ ] G0 still green

## Verify

```bash
npx vitest run server/services/pptx-import/oracle --reporter=dot
npm run test:pptx:oracle -- --corpus server/data/test-corpus --baseline-out server/services/pptx-import/oracle/baseline-ssim.json
```

If LO not installed: document skip; CI job must install LO before claiming Phase 02 done in shared pipeline.

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| LO render ≠ PP | Document primary oracle; optional PP secondary delta report |
| Font mismatch | Bundle/note fonts; accept until Phase 04/08 |
| Slow CI | Cache by sha256; shard decks |
| Flaky SSIM | Round to 4 decimals; mean+min gates; fixed chrome flags |

## Definition of Done

Oracle machinery + baseline committed. **Not** “visual 1:1 achieved”.
