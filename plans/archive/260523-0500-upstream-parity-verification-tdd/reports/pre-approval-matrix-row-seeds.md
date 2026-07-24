---
title: "Pre-Approval Matrix Row Seeds"
date: 2026-05-23
status: pre-approval-row-seeds
phase: 2
---

# Pre-Approval Matrix Row Seeds

## Scope Guard

These are candidate row seeds for the future `docs/upstream-parity-matrix.md`.
They are not the matrix, are not release evidence, and do not claim upstream
parity. Do not convert them into matrix rows until
`upstream-build-failure-phase-2-decision-record.md` is approved or the upstream
build blocker is resolved.

Because approved upstream automation is unavailable, candidate MVP P0 rows below
default to `Blocked` unless complete manual oracle evidence or a signed waiver
is later attached.

## Metadata Seed

| Field | Seed value |
|---|---|
| Approved upstream remote | `https://github.com/jbirky/parallax-presentations.git` |
| Approved upstream SHA | `ce548c535abc7701ac45cc3164560caba121adce` |
| Approver | `Xuan`, `Project owner`, `2026-05-23` |
| Adapter harness | `upstream-adapter-harness-design.md` |
| Upstream baseline status | `upstream-baseline-report.md`: `upstream-baseline-failed` |
| Phase 2 blocker decision | `upstream-build-failure-phase-2-decision-record.md`: `pending-decision` |
| Manual oracle protocol | `manual-oracle-capture-protocol.md` |

## MVP P0 Row Seeds

| id | area | tier | securityInvariant | behaviorContract | edgeCases | upstreamEvidenceSeed | localEvidenceSeed | defaultStatus | waiver |
|---|---|---|---|---|---|---|---|---|---|
| editor-create-save-reload | Editing core | MVP P0 | no | Precondition: approved oracle/current editor available. Action: create deck, edit text, save/reload. Expected: content persists and remains editable. State/export impact: presentation JSON stores updated content. | Empty title/content, save failure retry, reload after navigation | Upstream automation unavailable; manual oracle required | `tests/e2e/editor.spec.js`; `tests/e2e/element-lifecycle.spec.js` | Blocked | n/a |
| editor-rich-text-formatting | Editing core | MVP P0 | no | Precondition: text element selected. Action: apply rich text marks/styles. Expected: visible formatting applies and persists. State/export impact: TipTap/HTML state preserves marks. | Mixed marks, remove mark, reload/export | Upstream automation unavailable; manual oracle required | `tests/e2e/elements/text-element-rich-formatting-and-prosemirror-editing-and-persistence.spec.js` | Blocked | n/a |
| elements-representative-insert-edit-render | Element types | MVP P0 | no | Precondition: editor canvas loaded. Action: insert representative image, shape, code, table, chart/media element; edit properties. Expected: each renders and remains editable. State/export impact: element type/property state persists. | Missing media URL, invalid code language, table resize, chart data edit | Upstream automation unavailable; manual oracle required | `tests/e2e/elements/*.spec.js`; `tests/e2e/element-properties.spec.js` | Blocked | n/a |
| editor-undo-redo-clipboard | Editing core | MVP P0 | no | Precondition: one or more elements exist. Action: copy/cut/paste/duplicate and undo/redo. Expected: element state and selection update predictably. State/export impact: no duplicate IDs or lost content. | Multi-select, grouped elements, undo after delete, paste after reload | Upstream automation unavailable; manual oracle required | `tests/e2e/undo-redo.spec.js`; `client/src/hooks/use-clipboard.test.js` | Blocked | n/a |
| present-navigation | Live presentation | MVP P0 | no | Precondition: deck has multiple slides. Action: start present mode and navigate with keyboard/API. Expected: current slide changes and viewer state follows. State/export impact: no hidden slide leak unless intended. | First/last slide, hidden slide, rapid navigation | Upstream automation unavailable; manual oracle required | `tests/e2e/live/present-mode-keyboard-navigation-presenter-to-viewer-sync.spec.js`; `shared/tests/present-mode-section-styles.test.js` | Blocked | n/a |
| export-html-pdf-offline-archive | Export/share/import | MVP P0 | no | Precondition: deck contains text/media/representative elements. Action: export HTML, offline HTML, PDF, and project archive. Expected: artifacts exist and include expected content/assets. State/export impact: exported artifact can be opened/imported as applicable. | Missing media, fragments, large deck, offline assets | Upstream automation unavailable; manual oracle required | `tests/e2e/export/*.spec.js`; `client/src/utils/offlineExport.test.js`; `client/src/utils/export-project.test.js` | Blocked | n/a |
| share-password-revoke | Export/share/import | MVP P0 | no | Precondition: share link created with password. Action: access with wrong/right password, then revoke/delete. Expected: protected access enforced and revoked link stops access. State/export impact: share token state updates correctly. | Missing password, wrong password, revoked token reuse | Upstream automation unavailable; manual oracle required | `tests/e2e/share/share-link-with-password-protection-and-verification.spec.js`; `tests/e2e/share/share-link-revoke-deletion-and-list-endpoint.spec.js` | Blocked | n/a |
| security-presenter-token-cross-room | Live presentation | MVP P0 | yes | Precondition: two rooms with different presenter tokens. Action: reuse token across room. Expected: join/navigation rejected; no viewer state changes. State/export impact: no cross-room authority. | Missing token, malformed token, valid token for another room | Upstream parity is not sufficient; local invariant required | `tests/e2e/security/presenter-token-validation-rejects-invalid-and-cross-room-reuse.spec.js` | Blocked | n/a |
| navslides-import-export-roundtrip | Export/share/import | MVP P0 | no | Precondition: project has media and manifest metadata. Action: export `.navslides`, import it back. Expected: manifest/media references and editable slide state survive roundtrip. State/export impact: archive manifest remains valid. | Missing media, duplicate names, corrupt archive, version mismatch | Upstream automation unavailable; manual oracle required | `client/src/utils/export-project.test.js`; `client/src/utils/import-project.test.js`; `tests/e2e/export/client-side-download-flows-for-navslides-archive-and-offline-html-and-pdf-print.spec.js` | Blocked | n/a |
| pptx-import-export-smoke | Export/share/import | MVP P0 | no | Precondition: PPTX fixtures available. Action: import/export PPTX through supported flows. Expected: semantic/corpus gates remain within thresholds. State/export impact: roundtrip preserves supported content. | Unsupported elements, malformed PPTX, media references | Upstream automation unavailable; manual oracle required | `tests/e2e/pptx-import-fidelity.spec.js`; `tests/e2e/export/pptx-import-endpoint-roundtrip-across-multiple-fixtures.spec.js`; `npm run test:corpus` baseline log | Blocked | n/a |

## Extended Row Seeds

| id | area | tier | defaultStatus | notes |
|---|---|---|---|---|
| ribbon-tabs-persistence | Ribbon controls | Extended P1 | Blocked | Needs manual oracle or upstream automation decision before parity claim |
| slides-layouts-templates-backgrounds | Slides | Extended P1 | Blocked | Split into MVP only if release-critical |
| live-annotations-remote-timer | Live presentation | Extended P1 | Blocked | Security-sensitive; local negative tests still required |
| games-player-scoring-leaderboard | Game mode | Extended P1 | Blocked | MVP candidate if release depends on games |
| ai-tools-mock-local-canary | AI tools | Extended P2 | Blocked | Default gate must avoid real provider credentials |
| cloud-rclone-mock-local-canary | Cloud sync | Extended P2 | Blocked | Real provider smoke opt-in only |
| version-history-restore-delete | Version history | Extended P1 | Blocked | Promote if restore is release-critical |
| desktop-release-readiness | Desktop/Electron | Optional audit | Blocked | Current release-readiness contract is local docs/workflow evidence, not upstream parity |

## Counters

| Counter | Value |
|---|---:|
| MVP P0 seeds | 10 |
| Extended/optional seeds | 8 |
| Seeds with `Pass` status | 0 |
| Seeds defaulted to `Blocked` | 18 |
| Seeds requiring manual oracle or waiver before release-ready | 18 |

## Conversion Rules

- Copy these rows only after the Phase 2 blocker decision is approved or the
  upstream build blocker is resolved.
- Preserve stable `id` values.
- Replace `upstreamEvidenceSeed` with actual approved upstream automation,
  manual oracle evidence, or waiver data.
- Do not convert `defaultStatus = Blocked` to `Pass` without row-scoped upstream
  or manual oracle evidence and passing local evidence.
- Security invariant rows remain release blockers even if upstream behavior is
  insecure or unavailable.

## Unresolved Questions

- Which MVP P0 rows, if any, may use manual oracle capture first?
- Who owns manual oracle capture review?
- Are any MVP P0 waivers allowed before release?
