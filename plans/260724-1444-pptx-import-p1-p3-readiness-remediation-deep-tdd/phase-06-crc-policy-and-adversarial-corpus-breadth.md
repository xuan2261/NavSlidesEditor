---
phase: 6
title: "CRC Policy And Adversarial Corpus Breadth"
status: completed
priority: P2
effort: "3-4d"
dependencies: []
---

# Phase 6: CRC Policy And Adversarial Corpus Breadth

## Overview

Document and enforce import CRC integrity policy with regression fixtures; expand corpus with adversarial / edge-class packages (SmartArt, EMF/WMF, macro/OLE/encryption samples, external rels, nested packages, malformed ZIP/XML/media, RTL/CJK smoke). Closes audit P2.4–P2.5.

## Context Links

- Import `checkCRC32: false`: `pptx-guards.js`, `opc-inventory.js`
- Export paths often `checkCRC32: true`
- Corpus: `server/data/test-corpus/` + qualification manifest
- Lanes: metrics vs importer-qualification (P0 split — do not merge labels)

## Requirements

### Functional

**CRC**

- Policy document (docs or constants comment + test name): default **fail-closed** when declared CRC does not match payload for non-encrypted entries **if** we can enforce without JSZip-only ambiguity.
- Implementation options (pick after fixture probe in Tests Before):
  1. Enable `checkCRC32: true` on import load if JSZip rejects corrupt entries usefully; or
  2. Custom verify using raw-zip CRC fields vs inflated bytes for selected entries.
- Regression: fixture with intentional CRC mismatch → rejected with stable error code.
- If real corpus false positives force soften: document **warn-only** exception with code + count metric — product override, not silent.

**Corpus breadth**

Add **small** fixtures under e.g. `server/data/test-corpus/adversarial/` (keep sizes reasonable per corpus README):

| Class | Goal |
| --- | --- |
| EMF/WMF sample | qualification/strict gates exercise |
| SmartArt-ish diagram | mapper/diag paths |
| macro/OLE/ActiveX or encrypted stub | fail-closed / original-only behavior |
| external relationship | no remote fetch |
| nested package | nested-package-guard |
| malformed ZIP/XML | guards reject |
| RTL/CJK text smoke | best-effort mapping |
| comments/notes/animation lite | inventory warnings not crash |

- Metrics lane: adversarial may be optional/separate flag so average semantic not destroyed by intentional failures.
- Qualification lane: bind hashes when fixtures are promotion candidates; otherwise separate adversarial suite with expected reject/warn outcomes.

### Non-functional

- Do not check in huge decks.
- No Office binaries in repo.
- Fixtures must be license-safe (generated or project-owned).

## Architecture

```text
validatePptxPackage / loadPptxArchive
  -> CRC policy gate
adversarial suite runner
  -> expected: reject | warn | map
```

Prefer dedicated `npm run test:pptx:adversarial` rather than polluting metrics averages.

## File Inventory

| Path | Action |
| --- | --- |
| `pptx-guards.js` | CRC policy |
| `pptx-guards.test.js` | Corrupt CRC fixture |
| `raw-zip.js` / opc | If custom CRC verify |
| `server/data/test-corpus/adversarial/*` | Create fixtures |
| corpus README | Document classes + lanes |
| New adversarial test or CLI flag | Create |
| `docs/export-fidelity-and-limits.md` or security note | CRC policy |

## Dependency Map

- Independent of phases 1–5 for CRC.
- Corpus fixtures help package-first qualification later but must not claim L4.

## Tests Before (TDD) — no green-first baseline

1. **RED today:** minimal zip with intentional CRC mismatch → must reject with **stable error code** (test fails on current `checkCRC32: false` until fixed). If real 11-deck corpus false-positives: phase **blocked** with counted report (Validation V3) — do not ship silent warn-only as success.
2. Good CRC still imports.
3. Adversarial: nested package rejected.
4. Adversarial: external media URL does not fetch network (mock).
5. Malformed XML rejected by xml-safety.
6. `package.json` has `test:pptx:adversarial` before phase exit (expected reject table; isolated from metrics averages).

## Refactor / Implementation Steps

1. Probe JSZip CRC behavior; choose enforcement path.
2. Implement + tests.
3. Generate minimal adversarial fixtures (scripts ok under `scripts/` if needed).
4. Wire adversarial suite with expected outcomes table.
5. Document policy.

## Tests After

- Metrics 11-deck still green.
- Qualification still structured blockers ok.

## Regression Gate

```bash
npx vitest run server/services/pptx-import/pptx-guards.test.js server/services/pptx-import/nested-package-guard.test.js
npm run test:pptx:corpus-metrics
# plus new adversarial command when added
```

## Test Scenario Matrix

| ID | Scenario | Priority |
| --- | --- | --- |
| C1 | Bad CRC reject | Critical |
| C2 | Good package pass | Critical |
| C3 | Nested package | High |
| C4 | Malformed XML | High |
| C5 | External rel no fetch | High |
| C6 | EMF present → warn or strict fail as designed | Medium |

## Function / Interface Checklist

- [x] CRC verification path
- [x] Stable error code
- [x] Adversarial suite entrypoint
- [x] Documented policy

## Success Criteria

- [x] C1–C5 green
- [x] Policy written and matches code
- [x] Metrics lane not broken by adversarial fails

## Risk Assessment

| Risk | Mitigation |
| --- | --- |
| False positive CRC on valid Office files | Probe real corpus before fail-closed; soften only with evidence |
| Fixture licensing | Generate synthetic OOXML |

## Security Considerations

- CRC + malformed fixtures reduce silent corruption and expand reject surface tests.
- Do not weaken ZIP bomb limits.

## Todo

- [x] CRC probe + Tests Before
- [x] Implement policy
- [x] Adversarial fixtures + suite
- [x] Docs
- [x] Regression gate
