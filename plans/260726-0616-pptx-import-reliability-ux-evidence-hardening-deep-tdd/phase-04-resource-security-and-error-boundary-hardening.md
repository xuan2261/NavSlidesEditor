---
phase: 4
title: "Resource Security And Error Boundary Hardening"
status: pending
priority: P1
effort: "6-9d"
dependencies: [1, 3]
---

# Phase 4: Resource Security And Error Boundary Hardening

## Overview

Harden parser/host resource boundaries, converter execution, imported external media, cancellation settlement, bounded reports, and typed error propagation. This phase owns resource/error producers and security tests; Phase 3 owns package publication and route/job DTO integration.

## Requirements

- Functional: parser worker retains its narrow environment; optional EMF/WMF conversion uses a verified administrator-configured absolute executable path and minimal environment, with no PATH lookup or reparse ambiguity.
- Functional: explicit parser/output/resource/snapshot errors retain stable `type`, `code`, `reasonCode`, `stage`, and bounded failure-status metadata through worker → importer → Phase 3 job DTO.
- Functional: synchronous admission/upload limits retain compatible HTTP status behavior; asynchronous failures after 202 are terminal job/SSE DTO data, not impossible later POST HTTP 413/422 claims.
- Functional: external imported URLs are blocked by default. Opt-in external media requires full configured origin, scheme/host/port validation, private/loopback/link-local rejection, redirect policy, and restrictive media CSP.
- Functional: background data URLs use a shared aggregate budget or a separately bounded named policy; per-item allowance cannot bypass import-wide accounting.
- Functional: canonical snapshot ceilings fail before package publication with typed stage/count details.
- Functional: worker, archive, scene graph, image decode, vector conversion, and media cleanup honor cooperative cancellation and operation settlement; active non-preemptive work is documented.
- Functional: reports bound warning type cardinality/key bytes and total serialized size; raw child stderr, paths, URLs, source ZIP entry names, token-like data, and secrets never enter durable/editor/external reports.
- Non-functional: parser heap cap remains child-only; no OS/network sandbox or whole-server RSS isolation claim is made without a separate implementation gate.
- Non-functional: top-level CRC fail-closed and intentional nested-package CRC scope are described accurately.

## Architecture

```text
admission status
  -> guards / parser child typed error
  -> host archive + scene/map typed error
  -> media/background/snapshot typed error
  -> bounded Phase-3 terminal job DTO

security boundaries:
  verified converter executable + minimal env
  imported URL policy/CSP
  bounded archive/media/report inputs
  private operational diagnostics != editor/external DTO
```

Resource controls remain layered. Reserve or estimate before allocation where possible; report host-memory limitations honestly. `workerClosed`/child/decode/converter settlement is part of the operation lifecycle owned by Phase 3, while this phase supplies the producer checks and tests.

## Related Code Files

| Action | File/area | Change |
|---|---|---|
| Modify | `server/services/pptx-import/worker-runner.js`, `parse-worker.js`, `output-usability.js`, `diagnostics.js` | Typed error preservation, bounded sanitizer, child settlement contract |
| Modify | `server/services/pptx-import/emf-wmf-sandbox.js` | Absolute executable verification and minimal converter env |
| Modify | `server/services/pptx-import/importer.js`, `ooxml-scene-graph/index.js` | Abort propagation and host-stage resource boundaries |
| Modify | `server/services/pptx-import/media.js`, `mapper/map-media.js`, `mapper/map-presentation.js`, `mapper/map-image.js`, `vector-media-convert.js` | Media/background accounting, URL policy, decode/converter checks |
| Modify | `server/services/pptx-import/canonical-snapshot.js` | Typed stage limits and bounded counts |
| Modify | `server/services/pptx-import/pptx-guards.js`, `nested-package-guard.js` | Status/reason matrix and exact CRC scope |
| Modify/test | `server/services/pptx-import/import-report.js` | Type/key/byte caps and private message policy |
| Test/integrate | Phase 3 job/error DTO adapters | Consume package/job contract; no `import-commit.js` edits |

## Implementation Steps

1. Characterize current error/status behavior: POST 202 before async work, `output-empty` type loss, generic snapshot failure, and raw converter stderr.
2. Preserve explicit `err.type` before message classification; map to allowlisted `{type, code, reasonCode, stage, failureStatus}` and bounded user message. Keep GET/SSE status lookup HTTP-successful while terminal DTO carries async failure class.
3. Add a converter executable builder requiring configured absolute path, regular-file/non-reparse verification, allowed root/version/hash policy, `shell:false`, and a fixed minimal env. Do not use PATH to resolve `magick`, `convert`, or `inkscape`.
4. Block imported external URLs by default. For explicit opt-in, validate complete origin and reject loopback/private/link-local targets, redirects, and downgrade; emit relative server-owned media paths where possible and update CSP policy tests.
5. Pass a shared media budget into background mapping, reserve before retained allocation where feasible, and define deterministic reject/omit/placeholder reason codes for overflow.
6. Add cooperative abort checks before/after archive, scene graph, image decode, vector conversion, and media writes. Await child close/decode/converter cleanup through the Phase 3 settlement contract; never claim mid-read preemption.
7. Add host-stage memory/time telemetry and preflight/estimator tests. Do not claim OS isolation; record high-water/denial reasons without content.
8. Enforce all canonical snapshot limits before clone/publication and emit bounded counts/stage/reason. Add direct tests for slides, elements, depth, keys, string bytes, and snapshot bytes.
9. Bound report type cardinality/key bytes and total serialized report. Keep raw child output only in a private operational sink with explicit redaction/retention if needed; editor/external reports use fixed codes/user-authored text.
10. Document top-level CRC checking versus intentional nested-package CRC behavior and preserve fail-closed adversarial coverage.
11. Provide Phase 3 with the typed terminal error contract; do not change `import-commit.js` in this phase.

## Tests Before

- Converter inherits the full process environment and resolves by PATH/basename.
- `output-empty` becomes `parse-failed`.
- Async parser/resource failures are reduced to message-only job errors after 202.
- Localhost background URLs are accepted and preserved.
- Background data URLs bypass aggregate media reservation.
- Large decode/worker close is not fully represented in operation settlement.
- Snapshot overflow lacks typed stage/count detail.
- Diagnostics can contain raw stderr, paths, or source names.

## Tests After

- Converter exact path/env tests prove secret-like variables and PATH lookup are absent; required temp/locale variables remain.
- Invalid configured path, reparse file, hash/version mismatch, and missing binary fail closed.
- `output-empty` and all typed errors survive worker/importer/job DTO serialization.
- Admission failures use documented HTTP statuses; async failures use bounded terminal DTO fields.
- Localhost/private/link-local/alternate-port/downgrade/redirect external media is blocked by default policy.
- Background aggregate overflow is deterministic and reported without package publication.
- Worker/decode/vector cleanup is awaited before operation release; cancellation cannot commit after safe abort point.
- Snapshot limit table is fully covered and publication/clone is not reached after preflight failure.
- Final reports are bounded and contain no raw stderr, paths, source entry names, authority IDs, capabilities, secrets, or token-shaped values.
- CRC tests reflect actual top-level/nested policy.

## Function / Interface Checklist

- [ ] Parser and converter env builders are separate.
- [ ] Converter uses verified absolute executable authority, not PATH lookup.
- [ ] Explicit error type survives message classification.
- [ ] Async error DTO is separate from HTTP admission status.
- [ ] External URL policy validates full origin and private-network safety.
- [ ] Background URLs use shared or explicitly bounded budget.
- [ ] `workerClosed` and host cleanup settlement are observable to Phase 3.
- [ ] Snapshot limits have typed stage/count errors.
- [ ] Report sanitizer is circular-safe, bounded, and fixed-code based.
- [ ] Raw diagnostics cannot enter editor/external DTOs.
- [ ] CRC scope and host-memory limitation are documented honestly.

## Test Scenario Matrix

| Scenario | Expected |
|---|---|
| EMF conversion enabled | Verified absolute binary, minimal env, shell-free call |
| Unsafe converter path/reparse/hash mismatch | Fail closed before spawn |
| Empty parser output | `output-empty` reason preserved |
| Malformed upload | Synchronous admission/guard status per existing contract |
| Async parser/resource/snapshot failure | HTTP status lookup remains compatible; typed terminal DTO |
| Loopback/private external background URL | Blocked by default |
| Background budget overflow | Deterministic reject/omit/placeholder, no head |
| Abort during decode/conversion | No later commit; cleanup waits for settle |
| Snapshot overflow | Typed stage error before publication/clone |
| Diagnostic child stderr with path/token-shaped text | Fixed redacted code/message only |
| Nested CRC | Report matches intentional scoped policy |

## Regression Gate

```bash
npx vitest run server/services/pptx-import/worker-runner.test.js server/services/pptx-import/output-usability.test.js server/services/pptx-import/pptx-guards.test.js server/services/pptx-import/import-report.test.js server/services/pptx-import/emf-wmf-sandbox.test.js server/services/pptx-import/media.test.js server/services/pptx-import/background-allowlist.test.js
npx vitest run server/services/pptx-import/mapper/map-media.test.js server/services/pptx-import/mapper/map-presentation.test.js server/services/pptx-import/mapper/map-image.test.js server/services/pptx-import/vector-media-convert.test.js server/services/pptx-import/resource-budgets.test.js
npm run test:pptx:adversarial
```

If a named focused suite is not present, add it under this phase's ownership before implementation; do not cite nonexistent tests as a current gate.

## Success Criteria

- [ ] Converter executable/env boundary is least privilege and path-pinned.
- [ ] External imported URLs are blocked or fully origin-pinned by explicit policy.
- [ ] Async error/status contract is compatible and typed.
- [ ] Background/media/snapshot budgets are bounded before publication.
- [ ] Worker/decode/converter settlement is represented honestly.
- [ ] Reports are bounded, fixed-code, and safe for editor/external DTO separation.
- [ ] No OS/network/RSS isolation claim exceeds evidence.

## Risk Assessment

- Risk: URL blocking changes existing decks. Mitigation: default block, explicit admin opt-in with full-origin policy, migration/warning counts.
- Risk: converter pinning breaks unconfigured local installs. Mitigation: conversion remains default-off and reports structured unavailable.
- Risk: aggregate media accounting rejects valid decks. Mitigation: baseline corpus, bounded omit/placeholder reason, no silent partial success.
- Risk: host-memory hardening is mistaken for sandboxing. Mitigation: separate metrics and claim labels.

## Security Considerations

Treat imported PPTX, converter output, URLs, diagnostics, and evidence artifacts as untrusted. Never pass server secrets to child processes, never fetch private-network imported URLs by default, and never persist raw child stderr/source paths into external presentation data. Do not print secret values in tests or reports.

## Next Steps

Phase 3 integrates typed errors and settlement into job DTOs/package lifecycle. Phase 5 consumes the safe report contract. Phase 7 reruns adversarial/performance/evidence lanes after these changes.
