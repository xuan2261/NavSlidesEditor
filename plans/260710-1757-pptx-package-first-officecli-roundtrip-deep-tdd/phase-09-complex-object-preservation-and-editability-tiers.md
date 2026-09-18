---
phase: 9
title: 'Complex-object preservation and editability tiers'
status: in-progress
effort: '4-6 weeks'
dependsOn: [4, 5, 6]
priority: P1
gates: [G4-complex-policy]
---

# Phase 9: Complex-object preservation and editability tiers

<!-- Updated: Validation Session 1 - signed, encrypted, macro-enabled, ActiveX, and OLE packages are original-recovery-only in the first release. -->

## Overview

Inventory, preserve, display, and where safely possible edit complex PowerPoint objects without executing active content or misrepresenting visual proxies as source editability. Publish an explicit tier for every object and block package mutations that could destroy unknown or unsupported structures.

No current complex-object row is claim-level-4 promoted. The first milestone is
canonical preservation/block policy proven by an adjacent supported edit through
the production transaction.

## Editability Tiers

- `native-editable`: source semantics can be edited and roundtripped through tested package operations.
- `structured-partial`: structured inspection and an explicit subset of edits are safe; unsupported properties remain source-backed.
- `replace-only-visual`: editor shows a source-backed preview and permits only whole-object replacement.
- `preserved-opaque`: bytes/relationships are retained, preview or metadata may be shown, no source mutation.
- `unsupported-blocking`: package can be recovered, but an edited package export involving the object is blocked because preservation cannot be proven.

A preview image, editable alternative text, or object replacement does not qualify as native editability.

## Delivery Slices

- **Blocking MVP:** inventory, non-execution, byte/relationship preservation, safe embedded fallback preview, and honest `preserved-opaque` or `unsupported-blocking` tiers for every complex object.
- **Expansion:** replace-whole-object and structured/native edits are promoted one object family at a time. No lower claim milestone waits for SmartArt, equation, OLE, or 3D semantic editing.

## Object Matrix

- SmartArt/diagram data, layouts, styles, colors, drawing parts, and fallback graphics.
- Equations and mathematical OOXML.
- OLE embedded/linked objects and package embeddings.
- ActiveX controls, macros/VBA, custom XML, add-in data, and digital signatures.
- Audio/video, poster frames, captions, trimming, playback flags, and external media.
- SVG, EMF, WMF, and other vector/image formats.
- 3D models, model relationships, and fallback images.
- Zoom, sections, comments, ink, icons, content parts, and vendor extension lists.
- Unknown content types, relationships, and `extLst` payloads.

## Non-Execution Policy

- Never launch, activate, calculate, fetch, deserialize into native applications, or execute embedded content during import, preview, export, tests, or evidence generation.
- Do not follow external relationships or load remote media.
- Previews come from already embedded fallback bytes or a controlled renderer with macros/active content disabled.
- Preserve original macro/ActiveX/OLE/signature/encrypted package bytes without execution.
- Presence of a digital signature, encryption/protection, VBA/macro payload, ActiveX, or OLE marks the first-release package `unsupported-blocking` for edited package export. No signature invalidation or unrelated-edit exception exists.
- Sanitize filenames/MIME metadata and keep package bytes outside public static paths.

## TDD Matrix

| Test first                   | Expected red                                   | Green behavior                                                       |
| ---------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| SmartArt import              | Flattened and source lost                      | Structure/fallback parts retained with tier                          |
| Equation adjacent edit       | Math XML dropped                               | Equation bytes untouched                                             |
| OLE/ActiveX                  | Embedded content may activate                  | No execution/network; exact original recovery, edited export blocked |
| Macro-enabled PPTM           | Extension/parts lost                           | Exact original recovery, edited export blocked                       |
| Digital signature/encryption | Silent invalidation or inaccessible content    | Exact original recovery, edited export blocked                       |
| External media/link          | Network accessed                               | Target preserved, never fetched                                      |
| 3D/Zoom/ink                  | Unknown extensions discarded                   | OPC and extension bytes retained                                     |
| Preview unavailable          | Placeholder claimed editable                   | Honest tier and recovery action                                      |
| Replace-only object          | Partial internals mutated                      | Whole-object replacement only                                        |
| Unknown relationship         | Patch proceeds blindly                         | Impact analysis blocks unsafe operation                              |
| Malformed embedding          | Parser/resource failure                        | Bounded quarantine and original recovery                             |
| Unsafe/nested XML/ZIP        | Complex parser sees hostile outer or embedding | Phase 3 recursive raw-directory/XML gate rejects before parsing      |
| Public/share payload         | Internal metadata leaks                        | Safe capability summary only                                         |

## Implementation Steps

1. Map every complex-object row into the canonical Phase 1 schema and make
   preserve/non-execution tiers the blocking MVP.
2. Require every complex-object parser/preview path to consume only outer and
   recursively embedded payloads that passed the Phase 3 raw-directory, ZIP
   recursion, relationship, and XML safety gates.
3. Extend OPC/security classification for every matrix row and unknown extensions.
4. Add source-backed object descriptors to the server source map.
5. Implement safe previews using embedded fallbacks or controlled non-executing rendering.
6. Add UI badges/actions that match tier semantics exactly.
7. Implement native/structured adapters only for rows with complete semantic and roundtrip evidence.
8. Implement whole-object replacement with relationship-closure validation where permitted.
9. Make patch impact analysis preserve unknown adjacent XML or block the mutation.
10. Add malicious fixtures for macros, ActiveX, OLE, external links, oversized embeddings, and malformed extensions.
11. Test the first-release original-only block for signed, PPTM/macro, ActiveX, OLE, password/encrypted, and protected packages.
12. Add privacy-safe diagnostic and recovery paths.
13. Publish the feature/tier matrix consumed by claim and UX code.

## File Plan

- Extend OPC inventory/security modules from Phase 3.
- Extend `ooxml-diagram-parser.js` and related complex-object parsers only for safe structured reads.
- Add complex-object policy/descriptor modules under PPTX import services.
- Add source-backed proxy renderers and property-panel tier messaging.
- Add security, package-preservation, visual, and route serialization tests.

## Verification

```powershell
npx vitest run server/services/pptx-import/diagram-preservation.test.js
npx vitest run server/services/pptx-import/complex-object-tiers.test.js
npx vitest run server/services/pptx-import/active-content-security.test.js
npm run test:corpus
npm run lint
npm run test
npm run build
```

Run hostile corpus tests in a network-restricted environment and prove no child/native application activation. Verify untouched bytes and relationships for each preserve-only object after an adjacent supported edit.

## Deep File Inventory

| Action | File/interface                                  | Planned change                                  | Test impact            |
| ------ | ----------------------------------------------- | ----------------------------------------------- | ---------------------- |
| Modify | `complex-object-policy.js`                      | Canonical row IDs/tiers/claim ceilings          | Policy migration tests |
| Modify | `package-store/opc-inventory.js`                | Complete object/security classification         | Inventory tests        |
| Modify | `package-store/corpus-tier-audit.js`            | Emit matrix hash and exact row results          | Corpus tests           |
| Modify | `export-security-preflight.js`                  | Keep active/signed/protected block aligned      | Security tests         |
| Modify | `fidelity-contract.js`                          | Include protection/unknown and safe exact tiers | DTO/route tests        |
| Create | Production adjacent-mutation preservation tests | Real transaction, not synthetic newline         | G4 policy evidence     |
| Create | Active-content and public DTO tests             | Non-execution and non-leakage                   | Security tests         |
| Delete | None                                            | Preserve opaque bytes and descriptors           | Recovery tests         |

## Function and Interface Checklist

- [ ] Preserve `describeComplexObjects()`, `securityPreflight()`, and relationship closure.
- [ ] Map every known and unknown object kind to a canonical row.
- [ ] Reconcile `ORIGINAL_ONLY_KINDS` with package security policy.
- [ ] Prevent preserve-only/blocking rows from adapter dispatch.
- [ ] Keep preview/metadata availability distinct from source editability.

## Tests Before

1. Current tier vocabulary differs from the canonical matrix.
2. `protection` and unknown kinds can diverge between policy and DTO.
3. Adjacent preservation uses a synthetic mutation rather than Phase 11.
4. Native metadata or preview can be mistaken for editability.

## Refactor

Unify policy and DTO from canonical rows, then run preservation through one real
supported adjacent transaction. Add replacement rows only as separate future work.

## Tests After

- Every complex object has one exact canonical tier and claim ceiling.
- Adjacent supported edits preserve opaque parts and relationships byte-for-byte.
- Active/signed/encrypted/protected packages block before staging.
- Public/share/live DTOs expose safe summaries only.

## Dependency Map

```text
G0 canonical rows + Phase 3 OPC/security inventory
  + Phase 6 object evidence
  -> complex preservation/block policy
  -> Phase 11 preflight/adjacent edit
  -> G4 policy evidence without editability overclaim
```

## Debug and Reports

- `reports/phase-09/complex-object-tier-matrix.json`
- `reports/phase-09/non-execution-security-results.json`
- `reports/phase-09/unknown-part-preservation.json`
- `reports/phase-09/signature-and-macro-policy.md`
- `reports/phase-09/preview-provenance.json`

## Risks and Controls

- **Active-content compromise:** strict non-execution, no external retrieval,
  bounded inspection, observed network effects, and no public byte paths. This
  does not claim independent egress isolation.
- **Misleading editability:** tier names and product copy are generated from tested matrix rows.
- **Unknown-content loss:** byte preservation plus relationship impact blocking.
- **Signature/active-content invalidation:** fail closed to exact original recovery only; consent-based invalidation is deferred.

## Success Criteria

- [x] Every corpus complex object has an explicit tier and package-preservation result.
- [x] Lower claim milestones require preservation/non-execution only; semantic complex-object editing remains independent expansion work.
- [x] Hostile fixtures cause no execution, network fetch, path escape, or unbounded resource use.
- [ ] No complex-object parser or preview runs before outer and recursively
      embedded ZIP/XML safety validation.
- [ ] Adjacent supported edits preserve opaque object parts and relationships byte-for-byte.
- [x] Replace-only and structured-partial UX cannot be mistaken for native editability.
- [x] Signed, PPTM/macro, ActiveX, OLE, encrypted, and protected packages retain exact original recovery and cannot enter edited package export.
- [ ] Canonical row IDs/tiers drive policy, DTO, corpus, and claim evidence; no
      current complex-object row is implied editable.
- [ ] Focused security/package tests, corpus, lint, unit, and client build validators pass.

## Session 4 Local Scope Rebase: Active Phase Contract

The local architecture preserves the existing editability tiers and active-content
boundary. Signed, encrypted/protected, macro-enabled, ActiveX, and OLE packages
remain original-recovery-only and never reach edited-export staging, OfficeCLI,
preview execution, or PowerPoint.

Passive complex objects remain mapped, preserved-opaque, replace-only, or blocked
by exact canonical rows. All outer and embedded package guards complete before a
parser or preview sees bytes. Adjacent supported edits must preserve opaque parts
and relationships outside declared impact closure.

Validation records no external retrieval and observed network/process effects,
but explicitly does not claim independent profile, process-tree, or egress
isolation. Run focused hostile-package, recursive guard, non-execution,
preservation, row-tier, DTO, corpus, lint, unit, and client build tests.
Completion requires exact Original recovery for every active-content class and no
claim that a passive or opaque row is natively editable.
