---
title: "Pre-Approval Feature Inventory Notes"
date: 2026-05-23
status: pre-approval-notes
phase: 2
---

# Pre-Approval Feature Inventory Notes

## Scope Guard

These notes prepare Phase 2 only. They are not `docs/upstream-parity-matrix.md`,
do not contain upstream pass/fail status, and must not feed fixtures, CI gates,
or release readiness until `upstream-oracle-approval-record.md` is completed.

Schema reference for the future matrix: `pre-approval-parity-matrix-schema.md`.

## README Feature Areas

| Area | README coverage | Candidate local tests / evidence | Pre-approval note |
|---|---|---|---|
| Editing core | WYSIWYG, rich formatting, multi-select, group, align/distribute, rotation, smart guides, rulers, controls, undo/redo, clipboard, autosave, find/replace, command palette, touch | `tests/e2e/editor.spec.js`, `tests/e2e/element-lifecycle.spec.js`, `tests/e2e/element-interactions.spec.js`, `tests/e2e/find-replace.spec.js`, `tests/e2e/undo-redo.spec.js`, `tests/e2e/keyboard-shortcuts.spec.js`, `client/src/hooks/use-clipboard.test.js`, `client/src/utils/smartGuides.test.js` | Likely MVP/P0 split: create/edit/save/reload, undo/redo, clipboard, autosave failure retry, selection/deletion, find/replace |
| Ribbon controls | Home/Insert/Design/Transitions/Animations/View/Format tabs, persisted active tab | `tests/e2e/ribbon-layout.spec.js`, `tests/e2e/toolbar-elements.spec.js`, `client/src/components/ribbon/*.test.jsx`, `client/src/stores/ui-store-ribbon.test.js` | Matrix should group repeated ribbon layout/a11y rows instead of one row per button |
| Element types | text, image, shape, code, LaTeX/TikZ, inline math, HTML, Markdown, chart, video/audio, table, QR, icon, callout, drawing, line, SVG, divider, timeline, game | `tests/e2e/elements/*.spec.js`, `tests/e2e/element-properties.spec.js`, `shared/tests/element-renderers.test.js`, `client/src/components/canvas/element-renderers/*.test.jsx` | MVP should cover representative editable/render/persist/export elements; extended rows cover long tail |
| Slides | 8 layouts, templates, backgrounds, fragments, page numbers, hidden slides, footer, global settings | `tests/e2e/slides.spec.js`, `tests/e2e/slide-management.spec.js`, `tests/e2e/templates.spec.js`, `tests/e2e/animation-preview.spec.js`, `tests/e2e/parallax-element-insertion-property-controls-and-rendering.spec.js` | Phase 2 needs behavior contracts for create/reorder/delete, background persistence, fragment preview/present |
| Live presentation | broadcast, speaker view, remote control, annotations, black/white overlays, timer, keyboard navigation | `tests/e2e/live.spec.js`, `tests/e2e/live/*.spec.js`, `server/services/socket-handler.test.js`, `server/services/live-rooms.test.js`, `server/routes/live-rest-api-routes.test.js` | Security rows must include presenter token and cross-room negative cases regardless of upstream |
| Game mode | 7 game types, player route, socket handler, leaderboard, scoring, shortcuts | `tests/e2e/games/game-elements.spec.js`, `client/src/hooks/game-*.test.js`, `client/src/components/game-*.test.jsx`, `server/services/game-engine-*.test.js` | MVP can focus on player join, room lifecycle, scoring/timer sync; detailed per-game visuals can be P1/P2 |
| AI tools | copywriter, generator, translate, media library | `tests/e2e/ai.spec.js`, `server/routes/ai.test.js`, `server/services/ai-provider.test.js`, `server/services/ai-endpoint-guard.test.js` | Default parity gate should use mock/local canary only; no real provider credentials |
| Themes/templates | reveal themes, transitions, preset design themes, custom templates, editor theme toggle | `tests/e2e/templates.spec.js`, `tests/e2e/settings.spec.js`, `tests/e2e/visual/ribbon-tabs-across-all-seven-tabs-dark-theme.spec.js`, `server/routes/templates.test.js` | Extended rows likely enough except theme toggle/templates if release critical |
| Export/share/import | present mode, HTML/offline HTML/PDF/PPTX export, share password, GitHub push, Markdown import, `.navslides` import/export | `tests/e2e/export*.spec.js`, `tests/e2e/export/*.spec.js`, `tests/e2e/share/*.spec.js`, `tests/e2e/sharing.spec.js`, `client/src/utils/export-*.test.js`, `server/routes/share.test.js`, `server/routes/pptx-*.test.js` | MVP should cover HTML/PDF, `.navslides`, share password/revoke, and basic present route |
| Cloud sync | rclone sync to Proton Drive / providers, Docker rclone availability | No obvious e2e parity test in current inventory; docs/runtime coverage likely only | Keep mock/local canary by default; real provider smoke must be opt-in |
| Version history | named snapshots, restore, delete | `tests/e2e/version-history.spec.js` | Good MVP candidate if release promise depends on restore |
| Desktop/Electron | standalone desktop app, release workflow | `tests/unit/electron-release-readiness-contract.test.js`, `.github/workflows/release.yml` contract | Release-readiness row is docs/workflow contract, not upstream parity |
| Security invariants | trusted content boundary, authz, token revocation, import/upload safety, SSRF, secret redaction | `tests/e2e/security/*.spec.js`, `tests/e2e/hardening-regression.spec.js`, `tests/unit/test-fixtures-loopback-baseurl-guard.test.js`, `server/services/ai-endpoint-guard.test.js` | Security invariants override upstream parity; insecure upstream-equivalent behavior remains blocker |

## MVP P0 Candidate Rows

These are row candidates only. They become real matrix rows after oracle approval.

| Candidate row | Behavior contract seed | Candidate local evidence |
|---|---|---|
| Create/edit/save/reload presentation | Create deck, edit text/element, autosave or explicit save, reload, state persists | `tests/e2e/editor.spec.js`, `tests/e2e/element-lifecycle.spec.js` |
| Rich text editing | Text element accepts formatting and persists through TipTap/editor state | `tests/e2e/elements/text-element-rich-formatting-and-prosemirror-editing-and-persistence.spec.js` |
| Representative media/image/shape/code/table/chart elements | Insert/render/edit/persist representative elements | `tests/e2e/elements/*.spec.js`, `tests/e2e/element-properties.spec.js` |
| Undo/redo and clipboard | Undo/redo, copy/cut/paste/duplicate preserve intended element state | `tests/e2e/undo-redo.spec.js`, `client/src/hooks/use-clipboard.test.js` |
| Present navigation | Start present mode and navigate with keyboard/API | `tests/e2e/live/present-mode-keyboard-navigation-presenter-to-viewer-sync.spec.js`, `shared/tests/present-mode-section-styles.test.js` |
| Export HTML/PDF/offline/archive | Export artifact exists and includes expected content/assets | `tests/e2e/export/*.spec.js`, `client/src/utils/offlineExport.test.js`, `client/src/utils/export-project.test.js` |
| Share password and revoke | Protected share requires password; revoked/deleted share stops access | `tests/e2e/share/share-link-with-password-protection-and-verification.spec.js`, `tests/e2e/share/share-link-revoke-deletion-and-list-endpoint.spec.js` |
| Live presenter authorization | Invalid/cross-room presenter token rejected | `tests/e2e/security/presenter-token-validation-rejects-invalid-and-cross-room-reuse.spec.js` |
| `.navslides` import/export | Archive roundtrip preserves manifest/media references | `client/src/utils/export-project.test.js`, `client/src/utils/import-project.test.js`, `tests/e2e/export/client-side-download-flows-for-navslides-archive-and-offline-html-and-pdf-print.spec.js` |
| PPTX import/export smoke | Import/export endpoints and corpus gates stay green | `tests/e2e/pptx-import-fidelity.spec.js`, `tests/e2e/export/pptx-import-endpoint-roundtrip-across-multiple-fixtures.spec.js`, `npm run test:corpus` baseline log |

## Obvious Coverage Gaps To Resolve After Approval

| Gap | Why it matters | Candidate treatment |
|---|---|---|
| Upstream expected behavior links | Required for every MVP P0 matrix row | Blocked until oracle approved and worktree/harness available |
| Upstream executable smoke harness | Candidate upstream lacks Playwright/Vitest config | Define adapter in Phase 1 before upstream baseline run |
| Cloud/rclone parity | Real credentials must not be used by default | Mock/local canary only; optional real provider smoke outside default gate |
| Full AI provider parity | External provider behavior is unstable and credentialed | Mock/local canary only |
| Per-element export parity depth | README lists many long-tail element types | MVP representative set first, P1/P2 backlog for long-tail |

## Unknown Counters

These counters are pre-approval planning estimates, not matrix status:

| Counter | Value |
|---|---:|
| README feature areas represented in this note | 13 |
| Candidate MVP rows identified | 10 |
| Upstream evidence rows ready | 0 |
| Rows allowed to claim parity | 0 |

## Next Action After Approval

1. Complete `upstream-oracle-approval-record.md`.
2. Create upstream worktree at the approved SHA.
3. Define and run the reviewed adapter smoke/parity harness.
4. Convert this note into `docs/upstream-parity-matrix.md` with upstream evidence,
   local evidence, explicit status, and unknown counts.
5. Apply `pre-approval-parity-matrix-schema.md` row fields and waiver rules.

## Unresolved Questions

- Whether Vietnamese manual checklist mirror is required.
- Which candidate MVP rows are release-blocking if upstream lacks matching tooling?
