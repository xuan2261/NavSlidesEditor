# Extended Domain Coverage Matrix

_Generated: local run_

> ⚠️ **Run results stale or missing** — statuses derived without a fresh test run. PASS counts may be optimistic; regenerate with a fresh `--reporter=json` run.

Verified (PASS only): 0/18 (0%)  |  TAGGED: 18

## ai

| Capability | Risk | Tier | Layer | Test(s) | Status |
|---|---|---|---|---|---|
| ai.endpoint-guard | high | deep | unit | server/services/ai-endpoint-guard.test.js<br>server/services/ai-provider.test.js | TAGGED |
| ai.failure | high | deep | unit | server/routes/ai.test.js | TAGGED |
| ai.generate | high | smoke | e2e | tests/e2e/ai.spec.js | TAGGED |
| ai.rewrite | high | smoke | e2e | tests/e2e/ai.spec.js | TAGGED |
| ai.translate | high | smoke | e2e | tests/e2e/ai.spec.js | TAGGED |

## element

| Capability | Risk | Tier | Layer | Test(s) | Status |
|---|---|---|---|---|---|
| element.game | low | smoke | e2e | tests/e2e/games/game-elements.spec.js | TAGGED |

## export

| Capability | Risk | Tier | Layer | Test(s) | Status |
|---|---|---|---|---|---|
| export.html | high | smoke | e2e | tests/e2e/critical-user-journeys.spec.js | TAGGED |
| export.pptx | high | smoke | e2e | tests/e2e/critical-pptx-journey.spec.js | TAGGED |

## game

| Capability | Risk | Tier | Layer | Test(s) | Status |
|---|---|---|---|---|---|
| game.score | high | smoke | e2e | tests/e2e/games/game-scoring-and-leaderboard.spec.js | TAGGED |

## history

| Capability | Risk | Tier | Layer | Test(s) | Status |
|---|---|---|---|---|---|
| history.snapshot | low | smoke | unit | server/routes/api-surface.test.js | TAGGED |

## import

| Capability | Risk | Tier | Layer | Test(s) | Status |
|---|---|---|---|---|---|
| import.markdown | low | smoke | e2e | tests/e2e/import/markdown-import.spec.js | TAGGED |
| import.pptx | high | smoke | e2e | tests/e2e/critical-pptx-journey.spec.js | TAGGED |
| import.upload-safety | high | deep | unit | server/routes/pptx-import.test.js<br>server/services/pptx-import/pptx-guards.test.js | TAGGED |

## live

| Capability | Risk | Tier | Layer | Test(s) | Status |
|---|---|---|---|---|---|
| live.presenter-authz | high | deep | e2e | tests/e2e/critical-live-reconnect.spec.js<br>tests/e2e/security/presenter-token-validation-rejects-invalid-and-cross-room-reuse.spec.js | TAGGED |
| live.reconnect | high | smoke | e2e | tests/e2e/critical-live-reconnect.spec.js | TAGGED |

## share

| Capability | Risk | Tier | Layer | Test(s) | Status |
|---|---|---|---|---|---|
| share.password | high | smoke | e2e | tests/e2e/critical-user-journeys.spec.js | TAGGED |
| share.revoke | high | smoke | e2e | tests/e2e/critical-user-journeys.spec.js | TAGGED |

## sync

| Capability | Risk | Tier | Layer | Test(s) | Status |
|---|---|---|---|---|---|
| sync.rclone-status | high | smoke | unit | server/routes/api-surface.test.js | TAGGED |

