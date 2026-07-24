---
title: "Upstream Parity Matrix"
date: 2026-05-23
status: draft-blocked
releaseReady: no
---

# Upstream Parity Matrix

## Scope Guard

This matrix is a draft traceability artifact, not release approval. The approved
upstream automation is unavailable because the upstream build fails in the
approved worktrees. Rows affected by unavailable upstream automation are
`Blocked` unless they later receive complete manual oracle evidence or a signed
row-level waiver.

Do not treat failed upstream build logs, local-only tests, or this draft matrix
as upstream parity `Pass` evidence.

## Metadata

| Field | Value |
|---|---|
| Approved upstream remote | `https://github.com/jbirky/parallax-presentations.git` |
| Approved upstream SHA | `ce548c535abc7701ac45cc3164560caba121adce` |
| Approver | `Xuan`, `Project owner`, `2026-05-23` |
| Oracle approval | `plans/archive/260523-0500-upstream-parity-verification-tdd/reports/upstream-oracle-approval-record.md` |
| Upstream baseline status | `upstream-baseline-failed` |
| Upstream baseline report | `plans/archive/260523-0500-upstream-parity-verification-tdd/reports/upstream-baseline-report.md` |
| Adapter harness | `plans/archive/260523-0500-upstream-parity-verification-tdd/reports/upstream-adapter-harness-design.md` |
| Phase 2 blocker decision | `plans/archive/260523-0500-upstream-parity-verification-tdd/reports/upstream-build-failure-phase-2-decision-record.md` |
| Manual oracle protocol | `plans/archive/260523-0500-upstream-parity-verification-tdd/reports/manual-oracle-capture-protocol.md` |
| Row seed source | `plans/archive/260523-0500-upstream-parity-verification-tdd/reports/pre-approval-matrix-row-seeds.md` |
| Generated date | `2026-05-23` |

## Counters

| Counter | Value |
|---|---:|
| Total rows | 18 |
| MVP P0 rows | 10 |
| Extended P1 rows | 5 |
| Extended P2 rows | 2 |
| Optional audit rows | 1 |
| Pass | 0 |
| Fail | 0 |
| Partial | 0 |
| Unknown | 0 |
| Blocked | 18 |
| Waived | 0 |
| Release-ready | 0 |

## MVP P0 Rows

| id | area | tier | securityInvariant | behaviorContract | edgeCases | upstreamEvidence | localEvidence | status | waiver | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| editor-create-save-reload | Editing core | MVP P0 | no | Precondition: approved oracle/current editor available. Action: create deck, edit text, save/reload. Expected: content persists and remains editable. State/export impact: presentation JSON stores updated content. | Empty title/content, save failure retry, reload after navigation | Upstream automation unavailable; see upstream baseline failure logs. Manual oracle evidence required before `Pass`. | `tests/e2e/editor.spec.js`; `tests/e2e/element-lifecycle.spec.js`; `plans/archive/260523-0500-upstream-parity-verification-tdd/reports/local-evidence-editor-create-save-reload-2026-05-23.md` | Blocked | n/a | Local evidence passed, but local evidence alone is not upstream parity evidence. |
| editor-rich-text-formatting | Editing core | MVP P0 | no | Precondition: text element selected. Action: apply rich text marks/styles. Expected: visible formatting applies and persists. State/export impact: TipTap/HTML state preserves marks. | Mixed marks, remove mark, reload/export | Upstream automation unavailable; manual oracle evidence required before `Pass`. | `tests/e2e/elements/text-element-rich-formatting-and-prosemirror-editing-and-persistence.spec.js`; `plans/archive/260523-0500-upstream-parity-verification-tdd/reports/local-evidence-editor-rich-text-formatting-2026-05-23.md` | Blocked | n/a | Local evidence passed for core marks/styles, but local evidence alone is not upstream parity evidence. |
| elements-representative-insert-edit-render | Element types | MVP P0 | no | Precondition: editor canvas loaded. Action: insert representative image, shape, code, table, chart/media element; edit properties. Expected: each renders and remains editable. State/export impact: element type/property state persists. | Missing media URL, invalid code language, table resize, chart data edit | Upstream automation unavailable; manual oracle evidence required before `Pass`. | `tests/e2e/elements/*.spec.js`; `tests/e2e/element-properties.spec.js`; `plans/archive/260523-0500-upstream-parity-verification-tdd/reports/local-evidence-elements-representative-insert-edit-render-2026-05-23.md` | Blocked | n/a | Local representative slice passed; split row if manual evidence is partial. Local evidence alone is not upstream parity evidence. |
| editor-undo-redo-clipboard | Editing core | MVP P0 | no | Precondition: one or more elements exist. Action: copy/cut/paste/duplicate and undo/redo. Expected: element state and selection update predictably. State/export impact: no duplicate IDs or lost content. | Multi-select, grouped elements, undo after delete, paste after reload | Upstream automation unavailable; manual oracle evidence required before `Pass`. | `tests/e2e/undo-redo.spec.js`; `client/src/hooks/use-clipboard.test.js`; `plans/archive/260523-0500-upstream-parity-verification-tdd/reports/local-evidence-editor-undo-redo-clipboard-2026-05-23.md` | Blocked | n/a | Local undo/redo and clipboard slices passed, but local evidence alone is not upstream parity evidence. |
| present-navigation | Live presentation | MVP P0 | no | Precondition: deck has multiple slides. Action: start present mode and navigate with keyboard/API. Expected: current slide changes and viewer state follows. State/export impact: no hidden slide leak unless intended. | First/last slide, hidden slide, rapid navigation | Upstream automation unavailable; manual oracle evidence required before `Pass`. | `tests/e2e/live/present-mode-keyboard-navigation-presenter-to-viewer-sync.spec.js`; `shared/tests/present-mode-section-styles.test.js`; `plans/archive/260523-0500-upstream-parity-verification-tdd/reports/local-evidence-present-navigation-2026-05-23.md` | Blocked | n/a | Local presenter/viewer navigation slice passed, but local evidence alone is not upstream parity evidence. |
| export-html-pdf-offline-archive | Export/share/import | MVP P0 | no | Precondition: deck contains text/media/representative elements. Action: export HTML, offline HTML, PDF, and project archive. Expected: artifacts exist and include expected content/assets. State/export impact: exported artifact can be opened/imported as applicable. | Missing media, fragments, large deck, offline assets | Upstream automation unavailable; manual oracle evidence required before `Pass`. | `tests/e2e/export/*.spec.js`; `client/src/utils/offlineExport.test.js`; `client/src/utils/export-project.test.js`; `plans/archive/260523-0500-upstream-parity-verification-tdd/reports/local-evidence-export-html-pdf-offline-archive-2026-05-23.md` | Blocked | n/a | Local export/offline/PDF/archive slices passed, but local evidence alone is not upstream parity evidence. |
| share-password-revoke | Export/share/import | MVP P0 | no | Precondition: share link created with password. Action: access with wrong/right password, then revoke/delete. Expected: protected access enforced and revoked link stops access. State/export impact: share token state updates correctly. | Missing password, wrong password, revoked token reuse | Upstream automation unavailable; manual oracle evidence required before `Pass`. | `tests/e2e/share/share-link-with-password-protection-and-verification.spec.js`; `tests/e2e/share/share-link-revoke-deletion-and-list-endpoint.spec.js`; `server/routes/share.test.js`; `plans/archive/260523-0500-upstream-parity-verification-tdd/reports/local-evidence-share-password-revoke-2026-05-23.md` | Blocked | n/a | Local share/password/revoke slices passed after one initial Playwright flake; local evidence alone is not upstream parity evidence. |
| security-presenter-token-cross-room | Live presentation | MVP P0 | yes | Precondition: two rooms with different presenter tokens. Action: reuse token across room. Expected: join/navigation rejected; no viewer state changes. State/export impact: no cross-room authority. | Missing token, malformed token, valid token for another room | Upstream parity is not sufficient; local security invariant must hold. | `tests/e2e/security/presenter-token-validation-rejects-invalid-and-cross-room-reuse.spec.js`; `server/services/live-rooms.test.js`; `server/services/socket-handler.test.js`; `plans/archive/260523-0500-upstream-parity-verification-tdd/reports/local-evidence-security-presenter-token-cross-room-2026-05-23.md` | Blocked | n/a | Local security invariant slice passed, but local evidence alone is not upstream parity evidence. Security invariant remains a release blocker even if upstream differs. |
| navslides-import-export-roundtrip | Export/share/import | MVP P0 | no | Precondition: project has media and manifest metadata. Action: export `.navslides`, import it back. Expected: manifest/media references and editable slide state survive roundtrip. State/export impact: archive manifest remains valid. | Missing media, duplicate names, corrupt archive, version mismatch | Upstream automation unavailable; manual oracle evidence required before `Pass`. | `client/src/utils/export-project.test.js`; `client/src/utils/import-project.test.js`; `tests/e2e/export/client-side-download-flows-for-navslides-archive-and-offline-html-and-pdf-print.spec.js`; `plans/archive/260523-0500-upstream-parity-verification-tdd/reports/local-evidence-navslides-import-export-roundtrip-2026-05-23.md` | Blocked | n/a | Local archive/export/import utility slices passed, but local evidence alone is not upstream parity evidence. Retained artifact evidence is still required if promoted. |
| pptx-import-export-smoke | Export/share/import | MVP P0 | no | Precondition: PPTX fixtures available. Action: import/export PPTX through supported flows. Expected: semantic/corpus gates remain within thresholds. State/export impact: roundtrip preserves supported content. | Unsupported elements, malformed PPTX, media references | Upstream automation unavailable; manual oracle evidence required before `Pass`. | `tests/e2e/pptx-import-fidelity.spec.js`; `tests/e2e/export/pptx-import-endpoint-roundtrip-across-multiple-fixtures.spec.js`; `npm run test:corpus` baseline log | Blocked | n/a | Corpus pass is local regression evidence, not upstream parity. |

## Extended And Optional Rows

| id | area | tier | securityInvariant | behaviorContract | edgeCases | upstreamEvidence | localEvidence | status | waiver | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| ribbon-tabs-persistence | Ribbon controls | Extended P1 | no | Ribbon tabs render and active tab persists across sessions. | Missing persisted state, inaccessible tab, narrow viewport | Upstream automation unavailable; manual oracle required before parity claim. | `tests/e2e/ribbon-layout.spec.js`; `client/src/stores/ui-store-ribbon.test.js` | Blocked | n/a | Report-only until promoted. |
| slides-layouts-templates-backgrounds | Slides | Extended P1 | no | Slide layouts/templates/backgrounds/fragments remain editable and presentable. | Hidden slides, fragment preview, background media | Upstream automation unavailable; manual oracle required before parity claim. | `tests/e2e/slides.spec.js`; `tests/e2e/templates.spec.js` | Blocked | n/a | Split if release-critical. |
| live-annotations-remote-timer | Live presentation | Extended P1 | yes | Live annotations, remote control, and timer sync between presenter/viewer. | Rejoin, concurrent updates, invalid token | Upstream automation unavailable; manual oracle required before parity claim. | `tests/e2e/live/*.spec.js`; `server/services/live-rooms.test.js` | Blocked | n/a | Security negative tests remain local obligations. |
| games-player-scoring-leaderboard | Game mode | Extended P1 | no | Player join, scoring, timer, and leaderboard update correctly. | Duplicate player, reconnect, paused game | Upstream automation unavailable; manual oracle required before parity claim. | `tests/e2e/games/game-elements.spec.js`; `server/services/game-engine-*.test.js` | Blocked | n/a | Promote only if games are MVP for release. |
| ai-tools-mock-local-canary | AI tools | Extended P2 | yes | AI copywriter/generator/translate/media flows use safe mock/local canary contracts. | Missing key, provider failure, secret redaction | Upstream automation unavailable; real providers excluded from default parity. | `tests/e2e/ai.spec.js`; `server/services/ai-endpoint-guard.test.js` | Blocked | n/a | No real credentials in parity gate. |
| cloud-rclone-mock-local-canary | Cloud sync | Extended P2 | yes | Cloud sync/rclone contract uses mock/local canary only by default. | Missing config, failed sync, secret leak | Upstream automation unavailable; real provider smoke opt-in only. | No obvious e2e parity test in inventory | Blocked | n/a | Needs local canary design before promotion. |
| version-history-restore-delete | Version history | Extended P1 | no | Named snapshots can be created, restored, and deleted. | Restore missing snapshot, delete active snapshot | Upstream automation unavailable; manual oracle required before parity claim. | `tests/e2e/version-history.spec.js` | Blocked | n/a | Promote if restore is release-critical. |
| desktop-release-readiness | Desktop/Electron | Optional audit | no | Desktop release docs/workflow stay aligned with package release. | Version mismatch, missing artifact note | Not upstream parity; local release-readiness contract only. | `tests/unit/electron-release-readiness-contract.test.js`; `.github/workflows/release.yml` | Blocked | n/a | Optional audit row, not upstream parity pass. |

## Release Decision

Release-ready: no.

Reason:
- Approved upstream automation is unavailable.
- No row has complete manual oracle evidence.
- No row has a signed waiver.
- All rows are `Blocked`.

## Unresolved Questions

- Which MVP P0 rows should receive manual oracle capture first?
- Who reviews manual oracle evidence?
- Should initial matrix status remain `draft-blocked` or become `report-only`?
