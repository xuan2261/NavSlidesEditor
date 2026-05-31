---
title: "PPTX Import Real Browser Fidelity Fixes"
description: "Fix real-browser PPTX import fidelity defects found across 227 imported slides: text overflow, image clipping, unexpected out-of-canvas elements, and SVG negative rect console errors."
status: complete
priority: P0
effort: "9-13 dev-days"
issue:
branch: master
tags: [bugfix, pptx-import, fidelity, frontend, backend, e2e, tdd]
blockedBy: []
blocks: []
created: 2026-05-27
createdBy: ck-plan-skill
source: skill
mode: "--deep --tdd"
---

# PPTX Import Real Browser Fidelity Fixes

## Overview

Goal: make imported PPTX decks render correctly in real browser, not only semantic import tests. Current headed Chromium audit imported 5 decks and 227 slides successfully, but detected 222 problematic slides: 655 text overflows, 28 image clipping hits, 141 out-of-canvas hits, and 16 SVG console errors.

## Cross-Plan Dependencies

| Relationship | Plan | Status |
| --- | --- | --- |
| Builds on | [PPTX Import Full Overhaul](../260524-1729-pptx-import-review/plan.md) | complete |
| Builds on | [PPTX Import Unit-Conversion + Scale-Propagation Fixes](../260525-1450-pptx-import-unit-conversion-and-scale-fixes/plan.md) | implemented |
| Evidence | [Real Browser Audit](../reports/pptx-import-real-browser-audit.md) | current |

## Defect Baseline

| Deck | Slides | Failed slides | Text | Image clip | Out canvas | Console |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Bai3_HinhChieuVuongGoc.pptx | 82 | 78 | 59 | 14 | 135 | 16 |
| Bai_2_1.pptx | 41 | 40 | 130 | 6 | 2 | 0 |
| Bai_2_2.pptx | 39 | 39 | 225 | 0 | 1 | 0 |
| Bai_2_5.pptx | 45 | 45 | 174 | 8 | 1 | 0 |
| STTre_Duc.pptx | 20 | 20 | 67 | 0 | 2 | 0 |
| Total | 227 | 222 | 655 | 28 | 141 | 16 |

## Phases

| Phase | Name | Status |
| ---: | --- | --- |
| 1 | [Lock Real Browser Audit Gate](./phase-01-lock-real-browser-audit-gate.md) | Complete |
| 2 | [Trace Text Overflow Root Cause](./phase-02-trace-text-overflow-root-cause.md) | Complete |
| 3 | [Fix Imported Text Layout Fidelity](./phase-03-fix-imported-text-layout-fidelity.md) | Complete |
| 4 | [Fix Shape Geometry And SVG Console Errors](./phase-04-fix-shape-geometry-and-svg-console-errors.md) | Complete |
| 5 | [Fix Image Fit Crop And Wrapper Fidelity](./phase-05-fix-image-fit-crop-and-wrapper-fidelity.md) | Complete |
| 6 | [Align Shared Export Renderers With Editor](./phase-06-align-shared-export-renderers-with-editor.md) | Complete |
| 7 | [Enforce Corpus Acceptance Gates](./phase-07-enforce-corpus-acceptance-gates.md) | Complete |
| 8 | [Final Verification Docs And Release Readiness](./phase-08-final-verification-docs-and-release-readiness.md) | Complete |

## Dependencies

- Node.js 20+, npm, Playwright Chromium.
- Existing PPTX corpus in `PPTX/`.
- Existing reports: `plans/reports/pptx-import-real-browser-audit.{md,json}`.
- Main verification commands: `npm run test`, `npm run build`, `npm run test:corpus`, targeted Playwright audit.

## Success Criteria

- All 5 PPTX files import through real browser UI.
- Browser audit result: `failedSlides=0`, `text=0`, `image=0`, `unexpectedOut=0`, `zero=0`, `consoleErrors=0`.
- Any intentional bleed/overscan element is explicitly classified and tested, not silently ignored.
- Strict pass cannot be achieved by self-declared renderer flags, broad heuristics, unreadable text shrink, or hiding defects as accepted bleed/crop.
- Security regression fixtures cover hostile PPTX archive/media/rich-text/SVG/export surfaces before release.
- No regression in semantic/roundtrip corpus gates.
- Docs updated with actual thresholds, limitations, and before/after metrics.

## Red Team Review

### Session - 2026-05-27
**Findings:** 15 (14 accepted, 1 rejected)
**Severity breakdown:** 9 Critical, 5 High, 1 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Baseline must be immutable and non-circular | Critical | Accept | Phase 01 |
| 2 | Accepted bleed classifier can hide geometry bugs | Critical | Accept | Phase 01, Phase 04 |
| 3 | `0 DOM overflow` alone does not prove PowerPoint fidelity | Critical | Accept | Phase 03, Phase 08 |
| 4 | Runtime shrink lacks export/shared contract | Critical | Accept | Phase 03, Phase 06 |
| 5 | Full browser gate cannot be optional/decide-later | Critical | Accept | Phase 07 |
| 6 | Untrusted PPTX import security boundary missing | Critical | Accept | Phase 01, Phase 05, Phase 07 |
| 7 | Rich-text/SVG/export sanitization not explicit enough | Critical | Accept | Phase 03, Phase 04, Phase 06 |
| 8 | Text root-cause investigation is unbounded | Critical | Accept | Phase 02 |
| 9 | `_pptxImportMeta` lifecycle and backward compatibility missing | High | Accept | Phase 03, Phase 06 |
| 10 | Image crop audit trusts renderer-owned intent | High | Accept | Phase 05 |
| 11 | Shared renderer surface inventory incomplete | High | Accept | Phase 06 |
| 12 | Audit artifacts may leak slide content or race between runs | High | Accept | Phase 01, Phase 07, Phase 08 |
| 13 | Phase 02 mixes investigation and product changes | High | Accept | Phase 02 |
| 14 | SVG clamp can hide visual loss when stroke exceeds dimensions | Medium | Accept | Phase 04 |
| 15 | Lower P0 target to partial threshold/MVP | Critical | Reject | N/A |

Rejected rationale: plan purpose is a P0 fidelity fix for real-browser imported decks; lowering target counts would undercut the requested outcome. The accepted changes instead prevent false green gates and require explicit limitations if true PowerPoint source behavior proves a case intentional.

## Cook Handoff

Run implementation with:

```bash
ck cook C:\Work\NavSlidesEditor\plans\260527-1131-pptx-import-real-browser-fidelity-fixes
```

## Validation Log

### Session 1 - 2026-05-27
**Trigger:** `/ck:plan validate C:\Work\NavSlidesEditor\plans\260527-1131-pptx-import-real-browser-fidelity-fixes\plan.md`
**Questions asked:** 4

#### Questions & Answers

1. **[Scope/Gate]** Full 5-deck browser audit should be release-blocking or PR-blocking?
   - Options: Release-blocking full audit, PR only runs strict smoke subset (Recommended) | PR-blocking full 5-deck audit | Manual local only, not CI-blocking
   - **Answer:** Release-blocking full audit, PR only runs strict smoke subset.
   - **Rationale:** Keeps P0 release quality strict while avoiding expensive/flaky full-corpus browser work on every PR.

2. **[Fidelity]** For text overflow, should bounded shrink-to-fit be allowed if CSS wrapping/import normalization is insufficient?
   - Options: Yes, with min readable font-size and before/after visual evidence (Recommended) | No, only wrapping/metadata fixes, no auto-shrink | Allow free shrink if audit `text=0`
   - **Answer:** Yes, with min readable font-size and before/after visual evidence.
   - **Rationale:** Allows browser-real fitting for hard PowerPoint text cases without passing by making text unreadable.

3. **[Classification]** How should decorative bleed/out-of-canvas be accepted?
   - Options: Only with source PPTX geometry evidence or explicit allowlist with screenshot/reason (Recommended) | Accept by shape/line heuristic if not text/image | Accept no bleed; fix all out-of-canvas into canvas
   - **Answer:** Only with source PPTX geometry evidence or explicit allowlist with screenshot/reason.
   - **Rationale:** Prevents the audit from hiding geometry bugs behind broad heuristics.

4. **[Security/Artifacts]** How should audit artifacts containing screenshots/text diagnostics be handled?
   - Options: Redact text diagnostics, screenshots local/CI trusted only, failure-only short-retention artifacts (Recommended) | Commit full screenshots/report to repo | No screenshots, JSON counts only
   - **Answer:** Redact text diagnostics, screenshots local/CI trusted only, failure-only short-retention artifacts.
   - **Rationale:** Keeps review evidence available without leaking slide content through public docs or fork PR artifacts.

#### Confirmed Decisions

- Browser gating: PR uses deterministic strict smoke subset; release signoff requires full 5-deck strict audit.
- Text fitting: bounded shrink is allowed only after wrapping/import normalization is insufficient, with readability guardrails and visual evidence.
- Bleed classification: strict pass cannot rely on heuristics alone; source geometry evidence or explicit allowlist evidence is required.
- Artifact policy: redact text diagnostics; keep screenshots out of repo and restrict CI uploads to trusted/failure-only short-retention contexts.

#### Action Items

- [ ] Phase 03 must define the exact min readable font-size/line-count guard before enabling shrink.
- [ ] Phase 07 must implement PR smoke vs release full-audit policy explicitly.
- [ ] Phase 08 must record full-audit command, artifact run id, environment, and signoff owner.

#### Impact on Phases

- Phase 01: audit classifier and artifact policy are confirmed.
- Phase 03: bounded shrink-to-fit is permitted with readability and visual evidence constraints.
- Phase 04: decorative bleed acceptance remains evidence/allowlist based.
- Phase 07: PR/release gate split is confirmed.
- Phase 08: final report must include release-blocking full-audit evidence and sanitized artifact handling.
