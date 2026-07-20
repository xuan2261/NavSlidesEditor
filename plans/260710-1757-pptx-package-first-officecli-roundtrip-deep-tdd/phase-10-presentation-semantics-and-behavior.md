---
phase: 10
title: 'Presentation semantics and behavior'
status: in-progress
effort: '6-8 weeks'
dependsOn: [4, 5, 6]
priority: P1
gates: [G4-presentation]
---

# Phase 10: Presentation semantics and behavior

<!-- Updated: Validation Session 1 - rich notes and hidden-slide state are preserve-only for the first edited-roundtrip milestone. -->

## Overview

Preserve and selectively edit presentation-level structure and behavior: slide
order/identity, add/delete/duplicate, sections, hidden slides, notes, comments,
hyperlinks, transitions, timing XML, media behavior, headers/footers, and custom
show settings. Structural operations must compile into authoritative journal
entries consumable by package export. Full animation timing-tree modeling is
deferred while timing remains preserve-only.

The existing add/delete/reorder/duplicate implementation is a standalone
candidate, not level-4 promotion, because the authoritative planner currently
accepts only property changes. Notes, hidden state, transitions, timing, and show
settings remain preserve-only.

## Existing Seams

- `server/services/pptx-import/ooxml-animation.js`
- supplemental transition/theme/layout/notes parsing in PPTX import services
- presentation and slide operations in client hooks/stores
- `server/routes/presentations.js`
- reveal.js presentation behavior and export paths

The current animation parser is an inventory, not a complete PowerPoint timing-tree model. Hidden slides and several show settings are currently dropped. Phase completion must be feature-row specific rather than claiming universal behavioral parity.

## Delivery Slices

- **Blocking MVP:** slide add/delete/reorder/duplicate, stable identities, relationship closure, and internal-target repair/blocking.
- **Preservation baseline:** hidden-slide state and rich notes are explicitly preserve-only for the first edited-roundtrip milestone, alongside comments, transitions, timing trees, media behavior, sections, and show settings. No notes or hidden-state edit control is enabled.
- **Matrix expansion:** semantic editing for each preserved behavior family is promoted independently. Lower claim milestones do not wait for full timing-tree or custom-show editing.

## Semantics Matrix

- Slide add, delete, reorder, duplicate, section membership, IDs, relationship sequence, and references.
- Hidden-slide state retained in package/source metadata; editor preview, NavSlides slideshow, and PDF behavior are non-authoritative and outside the first edited-roundtrip claim.
- Speaker notes retained as source-backed rich content without selecting `notesHtml` or a structured editable representation in the first release.
- Comments, authors, timestamps, replies/threads where supported.
- Hyperlinks, action settings, internal slide targets, relative/absolute external targets, and safety.
- Transitions, duration, advance rules, sounds, and extension variants.
- Animation timing XML and relationship closure are inventory/preservation scope
  only. Semantic sequence/parallel/trigger/effect modeling is deferred.
- Audio/video playback, trimming, poster frames, autoplay, loop, and slide-show timing.
- Sections, custom shows, kiosk/loop/narration settings, slide ranges, headers/footers, date/time, and slide numbers.

## Behavioral Policy

- Preserve behavior not represented by NavSlides as source-backed metadata with an explicit tier.
- Never approximate a package mutation using reveal.js behavior and call it PowerPoint equivalent.
- Structural edits update every required relationship/reference closure.
- Broken internal targets after deletion must be repaired, removed with consent, or block export.
- First-release edited-roundtrip evidence covers package preservation of hidden state only. Any future editor/slideshow/PDF equivalence or hidden-state editing claim requires a separate surface-specific decision and tests.
- External actions are preserved but never executed during import/testing.

## TDD Matrix

| Test first                    | Expected red                                | Green behavior                                                          |
| ----------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| Reorder hidden slide          | Index identity breaks                       | Part identity stable; sequence changes only                             |
| Duplicate slide               | IDs/rels collide                            | New part/native IDs and relationship closure                            |
| Delete referenced slide       | Links/custom shows dangle                   | Repair/block policy applied                                             |
| Rich notes                    | Flattened text                              | Structured/source-backed notes retained                                 |
| Transition variants           | Reduced to generic                          | Exact supported properties or preserved tier                            |
| Timing XML                    | Flat animation list                         | Source bytes/relationships preserved; editing unavailable               |
| Media trigger                 | Behavior dropped                            | Source preserved and tier explicit                                      |
| Internal hyperlink            | Wrong target after reorder                  | Relationship target remains correct                                     |
| External action               | Test invokes URL                            | Preserve without execution                                              |
| Comments/authors              | Metadata lost                               | Parts/relationships retained                                            |
| Custom show/sections          | Dropped on edit                             | Structures patched or preserved                                         |
| Hidden-state mutation control | Preserve-only source state appears editable | No first-release editor control; package/source state remains unchanged |
| Structural rollback           | Half-created parts remain                   | Staging discarded, prior revision valid                                 |

## Implementation Steps

1. Consume the canonical Phase 1 schema, make the four structural operations
   exact candidate rows, and keep all other behavior rows preserve-only.
2. Add a package-level presentation model for slide IDs, relationship order, sections, shows, and settings.
3. Implement journal operations for slide add/delete/reorder/duplicate and reference repair.
4. Add preserve-only notes/comments descriptors that retain source-backed richness and safe serialization without first-release editing.
5. Retain a bounded timing-part inventory and exact source/relationship hashes
   without constructing a new semantic timing-tree model.
6. Extend only transition, hyperlink/action, media, header/footer, and
   show-setting parsers selected by exact candidate rows.
7. Add narrow patch adapters per supported behavior property.
8. Validate all internal targets and relationship closure after structural edits.
9. Add editor capability/tier UI that disables notes/hidden-state mutation and does not present reveal.js/PDF behavior as PowerPoint evidence.
10. Re-import and compare package semantics after every structural operation.
11. For claim-level-5 promotion only, use protected PowerPoint provider tests for representative slideshow behavior where deterministic.
12. Add rollback, concurrent structural save, repeated reorder, and bounded
    timing-XML preservation tests.

## File Plan

- Keep `ooxml-animation.js` as a bounded diagnostic inventory; do not create a
  full timing-tree model in this phase.
- Add presentation-structure and relationship patch modules under PPTX services.
- Extend shared presentation/slide types only for safe editor-visible semantics.
- Modify slide operations and notes/timeline UI based on capability metadata.
- Add semantic, package, provider, route, and client tests.

## Verification

```powershell
npx vitest run server/services/pptx-import/animation-preservation.test.js
npx vitest run server/services/pptx-import/transition-preservation.test.js
npx vitest run server/services/pptx-import/slide-structure-roundtrip.test.js
npm run test:corpus
npm run lint
npm run test
npm run build
```

Verify every promoted structural row has a complete touched-part closure, no dangling internal targets, and rollback at every failure boundary. Run protected PowerPoint open/slideshow probes only for rows seeking claim level 5.

## Deep File Inventory

| Action | File/interface                                      | Planned change                                   | Test impact             |
| ------ | --------------------------------------------------- | ------------------------------------------------ | ----------------------- |
| Modify | `presentation-capabilities.js`                      | Canonical candidate/preserve-only rows           | Matrix tests            |
| Modify | `slide-structure-journal.js`, `mutation-journal.js` | One operation/source identity contract           | Journal tests           |
| Modify | `slide-structure-mutation.js`                       | Transaction-compatible structural adapter        | Mutation/rollback tests |
| Modify | `transactional-patch-planner.js`                    | Route four structural operations                 | Planner tests           |
| Modify | `source-map.js`                                     | Successor lineage for structural changes         | Identity tests          |
| Modify | relationship/animation parsers                      | Preserve complete closure and unknown behavior   | Preservation tests      |
| Create | Structural transaction integration fixtures         | Full G4 evidence per operation                   | Route/corpus tests      |
| Create | Transition/timing preservation tests                | Keep behavior rows preserve-only                 | Negative tests          |
| Delete | None                                                | Standalone seams migrate into shared transaction | Architecture tests      |

## Function and Interface Checklist

- [ ] Preserve `inspectPresentationStructure()` and structural mutation seams.
- [ ] Unify generic and structure journal operation shapes.
- [ ] Register each structural candidate with planner/transaction dispatch.
- [ ] Allocate and tombstone source lineage deterministically.
- [ ] Validate all internal references and dependent relationships.

## Tests Before

1. Planner rejects all non-`property-change` structural operations.
2. Standalone structural and generic journals disagree on operation shape.
3. New/duplicate/delete lineage is not published with package state.
4. Notes/hidden/transition/timing preservation is incomplete per operation.

## Refactor

Integrate one structural row at a time through the existing transaction. Preserve
all behavior not explicitly represented, and do not use reveal.js as PowerPoint proof.

## Tests After

- Add/delete/reorder/duplicate each pass journal, planner, transaction, native
  re-import, reference closure, rollback, and corpus evidence.
- Repeated reorder remains identity-stable and idempotent.
- Notes, hidden state, comments, transitions, timing, and custom shows remain
  source-backed and byte-preserved.

## Dependency Map

```text
G0 presentation rows + Phase 5 journal/source map
  + Phase 6 evidence
  -> structural candidate adapters
  -> Phase 11 transaction/validators
  -> G4 exact structural rows
```

## Debug and Reports

- `reports/phase-10/presentation-semantics-matrix.json`
- `reports/phase-10/timing-preservation-coverage.json`
- `reports/phase-10/relationship-reference-audit.json`
- `reports/phase-10/hidden-slide-surface-policy.md`
- `reports/phase-10/behavior-provider-results.json`

## Risks and Controls

- **Behavioral false equivalence:** separate reveal.js preview from PowerPoint package/provider evidence.
- **Reference corruption:** graph validation after every structural mutation.
- **Timing complexity:** preserve exact source XML and defer semantic modeling
  until an editable row is separately approved.
- **Rich notes model churn:** versioned schema and migration tests before exposing edits.

## Success Criteria

- [x] Slide add/delete/reorder/duplicate preserve stable identity and valid package references.
- [ ] Structural MVP implementations remain candidates until each passes the
      authoritative transaction and evidence pipeline; preserve-only behavior rows
      do not block level 3.
- [x] Hidden slide, notes, comments, hyperlink, transition, animation, and show-setting rows have explicit tiers.
- [x] Rich notes and hidden-slide state remain source-backed and uneditable in the first milestone; adjacent structural edits preserve their package bytes/relationships.
- [ ] Promoted structural edits roundtrip semantically and roll back atomically
      through the authoritative transaction.
- [x] Unsupported behavior XML is preserved by adjacent edits.
- [x] Editor/reveal.js behavior is never used as sole proof of PowerPoint equivalence.
- [ ] Focused, corpus, lint, unit, and client build validators pass; protected provider validators additionally pass for level-5 rows.

## Session 4 Local Scope Rebase: Active Phase Contract

This section supersedes contradictory active protected-provider wording above.

- Preserve the existing structural, relationship, notes, hidden-slide, transition,
  animation, hyperlink, and show-setting row details. Rich notes and hidden-slide
  state remain preserve-only for the first milestone.
- Promote each structural or behavior row only after stable identity, journal,
  impact closure, patch, native re-import, semantic/behavior, untouched-part, and
  roundtrip evidence passes for the exact matrix subject.
- Keep reveal.js and reconstructed previews diagnostic only. They never prove
  PowerPoint behavior or compatibility.
- For a row requesting `G5`, local Microsoft PowerPoint must open the exact
  published package without repair or blocking prompts and verify the required
  behavior under the recorded Windows, Office, fonts, locale, DPI, corpus,
  thresholds, and artifact hashes.
- Route every behavior mutation surface through canonical row gating and
  independent server authorization. Unsupported behavior XML is preserved.

Run focused identity/reference, structural transaction, behavior preservation,
row-gating, native re-import, and roundtrip tests, followed by corpus, lint, unit,
and client build validators. Run the local PowerPoint behavior oracle serially
only for exact rows requesting `G5`. Completion requires environment-bounded
local evidence, not a protected provider or universal compatibility claim.
