# Extended Domain Coverage Matrix

_Generated: local run_

Verified (PASS only): 7/7 (100%)  |  PASS: 7
Other statuses: TAGGED: 11

## ai

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| ai.endpoint-guard | high | deep | unit | trace | server/services/ai-endpoint-guard.test.js<br>server/services/ai-provider.test.js | PASS |
| ai.failure | high | deep | unit | trace | server/routes/ai.test.js | PASS |
| ai.generate | high | smoke | e2e | - | tests/e2e/ai.spec.js | TAGGED |
| ai.rewrite | high | smoke | e2e | - | tests/e2e/ai.spec.js | TAGGED |
| ai.translate | high | smoke | e2e | - | tests/e2e/ai.spec.js | TAGGED |

## analytics

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| analytics.view-tracking | high | smoke | - | - | (none) | INVENTORY |

## electron

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| electron.data-path | high | smoke | - | - | (none) | INVENTORY |
| electron.package | high | smoke | - | - | (none) | INVENTORY |
| electron.preload | high | smoke | - | - | (none) | INVENTORY |
| electron.startup | high | smoke | - | - | (none) | INVENTORY |

## element

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| element.game | low | deep | unit,e2e | trace, behavior, export, persistence | client/src/components/canvas/element-renderers/canvas-game-element-renderer-phase-03.contract.test.jsx<br>client/src/components/properties/game-properties.test.jsx<br>client/src/components/ribbon/ribbon-plugin-insert.test.jsx<br>client/src/pages/game-player-matching-card.test.jsx<br>client/src/utils/exportPptx.test.js<br>shared/tests/element-renderers.test.js<br>tests/e2e/games/game-elements.spec.js | PASS |

## explore

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| explore.browse | low | smoke | - | - | (none) | INVENTORY |

## export

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| export.html | high | smoke | e2e | - | tests/e2e/coverage-depth/editor-control-persistence.spec.js<br>tests/e2e/critical-user-journeys.spec.js<br>tests/e2e/import/markdown-import.spec.js | TAGGED |
| export.pptx | high | smoke | e2e | - | tests/e2e/critical-pptx-journey.spec.js | TAGGED |

## game

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| game.score | high | smoke | e2e | - | tests/e2e/games/game-scoring-and-leaderboard.spec.js | TAGGED |

## history

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| history.snapshot | low | smoke | unit | trace | server/routes/api-surface.test.js | PASS |

## import

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| import.markdown | low | smoke | e2e | - | tests/e2e/import/markdown-import.spec.js | TAGGED |
| import.pptx | high | smoke | unit,e2e | trace | server/services/pptx-import/mutation-journal.test.js<br>server/services/pptx-import/ooxml-scene-graph/attach-source-nodes.test.js<br>server/services/pptx-import/source-map.test.js<br>tests/e2e/critical-pptx-journey.spec.js | PASS |
| import.upload-safety | high | deep | unit | trace | server/routes/api-surface.test.js<br>server/routes/pptx-import.test.js<br>server/services/pptx-import/pptx-guards.test.js<br>server/services/pptx-import/zip-bomb-guard.test.js | PASS |

## live

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| live.presenter-authz | high | deep | e2e | - | tests/e2e/critical-live-reconnect.spec.js<br>tests/e2e/security/presenter-token-validation-rejects-invalid-and-cross-room-reuse.spec.js | TAGGED |
| live.reconnect | high | smoke | e2e | - | tests/e2e/critical-live-reconnect.spec.js | TAGGED |

## marketplace

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| marketplace.browse | low | smoke | - | - | (none) | INVENTORY |

## plugin

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| plugin.runtime | high | smoke | - | - | (none) | INVENTORY |
| plugin.sandbox | high | smoke→deep | - | - | (none) | INVENTORY |

## share

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| share.password | high | smoke | e2e | - | tests/e2e/critical-user-journeys.spec.js | TAGGED |
| share.revoke | high | smoke | e2e | - | tests/e2e/critical-user-journeys.spec.js | TAGGED |

## sync

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| sync.rclone-status | high | smoke | unit | trace | server/routes/api-surface.test.js | PASS |

## variant

| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |
|---|---|---|---|---|---|---|
| variant.chart | high | smoke | - | - | (none) | INVENTORY |
| variant.design-preset | low | smoke | - | - | (none) | INVENTORY |
| variant.fx-background | low | smoke | - | - | (none) | INVENTORY |
| variant.game-subtype | high | smoke | - | - | (none) | INVENTORY |
| variant.insert-subaction | low | smoke | - | - | (none) | INVENTORY |
| variant.reveal-theme | low | smoke | - | - | (none) | INVENTORY |
| variant.shape | low | smoke | - | - | (none) | INVENTORY |
| variant.slide-layout | high | smoke | - | - | (none) | INVENTORY |
| variant.transition | low | smoke | - | - | (none) | INVENTORY |
