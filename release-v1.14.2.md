# NavSlides Editor v1.14.2

Release date: 2026-06-12

## Highlights

- Completed the 2026-06-11 monorepo review remediation across 8 TDD phases and 9 focused commits.
- Repaired game mode end-to-end with the dedicated `/games` namespace, stable player identity, duplicate-answer protection, host event authorization, and stale room cleanup.
- Hardened server trust boundaries: soft-deleted decks are blocked from serve/export/share paths, share token writes are atomic, settings preserve configured secrets, history restore creates a rollback snapshot, AI endpoint fetches pin the validated IP connection, and passwordless share links no longer call bcrypt with an undefined hash.
- Hardened untrusted import/export surfaces: markdown hrefs and PPTX background URLs are escaped or gated, PPTX package validation measures real inflated bytes with cumulative caps, worker heap limits are applied, and per-element export failures degrade to placeholders instead of failing the whole deck.
- Improved renderer, editor, and live fidelity: canvas/shared renderers align for more shapes, token colors, timeline, and game elements; vertical child slides participate in find/replace; redo history matches the undo cap; ribbon mixed-state controls work for multi-select; live annotations are scoped per slide and orphaned rooms are reaped.
- Fixed Electron release packaging so the prepared standalone server dependency tree is included in Windows release builds.
- Synchronized root and workspace package versions to `1.14.2`.

## Verification

- `npm run test` passed: 2474 tests, 0 failures, 1 skipped.
- `npm run lint` passed with 0 errors and 23 pre-existing benchmark warnings.
- `npm run build` passed.
- `npx electron-builder --win --publish never` passed and produced Windows installer + portable executables with packaged server dependencies present.
- PPTX corpus and browser-audit gates passed during the import/export remediation phases.
