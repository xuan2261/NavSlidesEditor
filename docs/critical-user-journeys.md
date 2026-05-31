# Critical User Journeys

Generated from Phase 03 of `plans/260531-0511-full-feature-verification-gap-closure-tdd`.

| Journey | Spec | Coverage | Status |
|---|---|---|---|
| `journey:create-edit-persist` | `tests/e2e/critical-user-journeys.spec.js` | UI creates a presentation, inserts/edits text, verifies persisted JSON, reloads editor, checks visible final state. | Playwright |
| `journey:share-password-revoke` | `tests/e2e/critical-user-journeys.spec.js` | Protected share rejects missing/wrong password, does not expose marker before auth, renders the shared reveal slide after correct password, revoked token returns 404. | Playwright |
| `journey:insert-format-arrange-export` | `tests/e2e/critical-user-journeys.spec.js` | UI inserts text and shape, formats shape fill/size, aligns shape through Shape Format controls, verifies persisted JSON, downloads Export HTML, and inspects HTML artifact for marker/section/shape fill. | Playwright |
| `journey:live-reconnect` | `tests/e2e/critical-live-reconnect.spec.js` | Uses separate browser contexts for presenter/viewer/auditor, joins a real Socket.IO live room, disconnects viewer, verifies server state before reconnect, verifies reconnect catches current slide once without duplicate navigate effects, rejects viewer navigation mutation, and cleans room/token state with presenter token. | Playwright |
| `journey:pptx-import-edit-export` | `tests/e2e/critical-pptx-journey.spec.js` | Imports a real corpus PPTX through the async API, opens the imported deck in the editor, edits an imported text element through the UI, verifies persisted JSON, exports PPTX through the File menu, and inspects the downloaded ZIP for package parts plus edited slide text. | Playwright |
| `journey:ai-failure-handling` | `server/routes/ai.test.js` | Verifies local contract failure paths for malformed outline JSON, provider failures, malformed translate JSON, and missing AI configuration without external API keys or real provider calls. | Vitest contract |

AI coverage is contract/local failure coverage only; it does not claim full external provider E2E.
