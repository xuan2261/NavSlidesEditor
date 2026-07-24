# Extended Domain Coverage Matrix

_Generated: local run_

Verified (PASS only): 18/18 (100%)  |  PASS: 18

## ai

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| ai.endpoint-guard | high | deep | unit | trace | server/services/ai-endpoint-guard.test.js<br>server/services/ai-provider.test.js | PASS |
| ai.failure | high | deep | unit | trace | server/routes/ai.test.js | PASS |
| ai.generate | high | smoke | e2e | trace | tests/e2e/ai.spec.js | PASS |
| ai.rewrite | high | smoke | e2e | trace | tests/e2e/ai.spec.js | PASS |
| ai.translate | high | smoke | e2e | trace | tests/e2e/ai.spec.js | PASS |

## element

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| element.game | low | smoke | e2e | trace | tests/e2e/games/game-elements.spec.js | PASS |

## export

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| export.html | high | smoke | e2e | trace, export | tests/e2e/coverage-depth/editor-control-persistence.spec.js<br>tests/e2e/critical-user-journeys.spec.js<br>tests/e2e/import/markdown-import.spec.js | PASS |
| export.pptx | high | smoke | e2e | trace | tests/e2e/critical-pptx-journey.spec.js | PASS |

## game

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| game.score | high | smoke | e2e | trace, sync | tests/e2e/games/game-scoring-and-leaderboard.spec.js | PASS |

## history

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| history.snapshot | low | smoke | unit | trace | server/routes/api-surface.test.js | PASS |

## import

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| import.markdown | low | smoke | e2e | trace, persistence | tests/e2e/import/markdown-import.spec.js | PASS |
| import.pptx | high | smoke | e2e | trace | tests/e2e/critical-pptx-journey.spec.js | PASS |
| import.upload-safety | high | deep | unit | trace | server/routes/api-surface.test.js<br>server/routes/pptx-import.test.js<br>server/services/pptx-import/pptx-guards.test.js<br>server/services/pptx-import/zip-bomb-guard.test.js | PASS |

## live

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| live.presenter-authz | high | deep | e2e | trace, behavior | tests/e2e/critical-live-reconnect.spec.js<br>tests/e2e/security/presenter-token-validation-rejects-invalid-and-cross-room-reuse.spec.js | PASS |
| live.reconnect | high | smoke | e2e | trace, sync | tests/e2e/critical-live-reconnect.spec.js | PASS |

## share

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| share.password | high | smoke | e2e | trace | tests/e2e/critical-user-journeys.spec.js | PASS |
| share.revoke | high | smoke | e2e | trace | tests/e2e/critical-user-journeys.spec.js | PASS |

## sync

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| sync.rclone-status | high | smoke | unit | trace | server/routes/api-surface.test.js | PASS |

