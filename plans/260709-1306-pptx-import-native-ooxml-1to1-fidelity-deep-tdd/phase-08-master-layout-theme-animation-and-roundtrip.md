---
phase: 8
title: "Master layout theme animation and roundtrip"
status: pending
priority: P1
effort: "8-16d"
dependencies: [4, 5, 6, 7]
tdd: true
---

# Phase 8: Master layout theme animation and roundtrip

<!-- Updated: Red Team Session 1 - RT-09 split into 08a/08b/08c -->

## Overview

Close remaining SLA gaps. **Do not implement as one undivided blob** (RT-09). Sub-phases:

| Sub | Scope | Depends |
|-----|--------|---------|
| **08a** | Full master/layout/theme resolution | Phase 04 (+03) — **not** blocked on 05–07 |
| **08b** | Transitions + animation MVP + unsupported classification | 08a |
| **08c** | Round-trip original-part reuse + package-open oracle + composite `test:pptx:sla-1to1` | 04–07, 08a–b |

Full visual milestone **mean SSIM ≥ 0.99** (oracle-LO) only at **08c** success — engineering target; if ceiling lower, amend plan frontmatter with measured ceiling (not silent). Permanent placeholders **0**, E2/E3 **0**, original.pptx present.

**Dependencies note:** Layout/theme (08a) can start after primitives; do not wait for EMF/SmartArt.

## Requirements

### Functional
- Resolve slide master + layout placeholders completely for text/media positions
- Theme: color scheme + major/minor fonts applied consistently
- Transitions: map PP transitions to Nav transitions with documented table; unknown → explicit warning **and** strict inventory entry (not drop)
- Animations: map entrance basics to fragment model where possible; unmapped animation → strict debt list
- Round-trip (08c):
  - Unedited presentation re-export may embed/restore original slide parts when safe
  - Edited elements rewrite correctly
  - **Package-open oracle (RT-13):** every exported pptx must open in LibreOffice (or unzip+CRC+Content_Types) before merge; hash tests alone insufficient
  - `avgRoundTripStability` milestone ≥ **0.90** first, target **0.95+** before claim full SLA
- Unsupported: macros, OLE, ActiveX → classified `unsupported-feature` with count; strict mode fails if policy is zero-unknown; product may set allowlist only via sla-contract change
- `npm run test:pptx:sla-1to1` runs package + oracle + coverage + roundtrip composite gate

### Non-functional
- Export time bounded; original package reuse must not corrupt zip
- Document final SLA matrix in `docs/pptx-import-fidelity-report.md`

## Architecture

```
import: scene graph + masters/layouts/theme/animation timelines
export: if !dirty(node) && original.pptx → copy part; else generate from Nav model
present: SSIM ≥ 0.99 vs oracle
```

Dirty tracking: `_pptxSource.nodeId` + content hash on element.

## Related Code Files

- Modify:
  - placeholder/theme resolve (from Phase 04) → full
  - `pptx-exporter.js` hybrid path
  - corpus CLI thresholds
  - `sla-contract.js` final thresholds
- Create:
  - `ooxml-animation.js` + tests
  - `roundtrip-original-parts.js` + tests
  - `scripts` or npm `test:pptx:sla-1to1`

## Tests (TDD) — RED first

| ID | Assert |
|----|--------|
| T8.1 | Master title font/theme applied on empty slide body from layout |
| T8.2 | Transition present on mapped slide when source has transition |
| T8.3 | Animation timeline non-empty when source has entrance anim (fixture) |
| T8.4 | Unedited deck export zip contains marker / part hash strategy test |
| T8.5 | Edit one text → export reflects new text; other parts stable when policy applies |
| T8.6 | Macro-only object classified not silent-missing |
| T8.7 | Composite SLA script fails if any of P1/V1/V2/E2/E3/E4/R1 fail |
| T8.8 | Corpus avg round-trip ≥ 0.90 under new policy |
| T8.9 | Oracle mean SSIM ≥ 0.99 on full corpus (LO) |

## Implementation Steps

1. RED T8.1–T8.3 layout/theme/anim fixtures.
2. Full placeholder inheritance.
3. Animation mapping MVP.
4. RED T8.4–T8.5 export original-part reuse.
5. Implement dirty tracking + export policy.
6. Composite `test:pptx:sla-1to1`.
7. Raise corpus round-trip floor in strict mode carefully.
8. Final docs + README claim language (“1:1 SLA” only if green).

## Success Criteria

- [ ] Full SLA table row green (plan.md)
- [ ] T8.* green
- [ ] `npm run test:pptx:sla-1to1` exit 0 on CI with LO
- [ ] Fidelity report updated with final numbers
- [ ] No permanent placeholders; gaps only via explicit unsupported carve-out list

## Verify

```bash
npx vitest run server/services/pptx-import server/services/pptx-exporter --reporter=dot
npm run test:corpus
npm run test:pptx:oracle -- --milestone phase-08
npm run test:pptx:sla-1to1
```

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| 0.99 SSIM unreachable with font/AA | Pin fonts; adjust only with measured ceiling report + product amend SLA frontmatter |
| Original part reuse corrupts PPTX | Heavy zip tests; CRC; open in LO |
| Animation model mismatch | MVP subset; unmapped counted |
| Schedule | Split 08a layout/theme, 08b anim, 08c roundtrip if needed (sub-phases same folder) |

## Definition of Done

**Only phase that may claim user SLA fully met** when all verify commands pass.
