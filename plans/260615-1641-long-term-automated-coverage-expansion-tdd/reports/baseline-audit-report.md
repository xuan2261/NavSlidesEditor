# Baseline Audit Report

Date: 2026-06-15  
Phase: Phase 01 - Baseline Audit And Risk Taxonomy  
Scope: read-only audit, no production/test behavior changed.

## Baseline Commands

| Command | Result | Evidence |
|---|---|---|
| `npm run test` | Timed out after 126s | Full Vitest suite did not finish inside local command budget. |
| `npx vitest run --reporter=json --outputFile=scripts/feature-inventory/run-results-vitest.json` | Timed out after 300s | Existing `run-results-vitest.json` stayed stale. |
| `npm run matrix:baseline-report` | Failed after matrix/gate pass | Matrix: `100/100 verified`, `GAP:0`, `DEEP-GAP:0`; baseline gap writer refused stale/missing run results. |
| `npm run matrix:gate` via baseline-report prefix | Passed | Inventory wrote 118 capabilities; gate reported 0 warnings, 0 failures. |

Stale run-result evidence: `scripts/feature-inventory/run-results-vitest.json` last modified `2026-05-31 21:33:38`.

## Current Inventory

Capability inventory regenerated 118 capabilities:

| Category | Count |
|---|---:|
| ai | 5 |
| canvas | 10 |
| command | 9 |
| control | 14 |
| element | 19 |
| export | 2 |
| flow | 5 |
| game | 1 |
| history | 1 |
| import | 3 |
| live | 2 |
| share | 2 |
| shortcut | 44 |
| sync | 1 |

Current test file inventory, excluding `node_modules` and build output:

| Layer/domain | Files |
|---|---:|
| client unit/component | 169 |
| server unit/integration | 66 |
| shared unit/golden | 21 |
| top-level unit governance | 29 |
| Playwright E2E/visual/a11y | 109 |

## Findings

- Matrix is green at capability trace level, but Phase 1 confirms the freshness contract is fragile: baseline report generation blocks if Vitest JSON is stale, and the local full Vitest run exceeded 5 minutes.
- Existing E2E surface is broad: critical journeys, live, share, games, import/export, visual, a11y, security, sync, and element workflows are present.
- Manual smoke still carries release evidence for artifact/security workflows that are not represented as depth-aware proof.
- Several manual rows already have likely automated coverage and should become report links, not repeated release labor.
- External/provider workflows should remain contract/local unless hermetic adapters or test credentials exist.

## Risk Tiers

| Tier | Meaning | Required proof |
|---|---|---|
| P0 | Release-blocking user journey, security, or data-loss risk | E2E or integration plus persistence/export/security evidence |
| P1 | High-value workflow where regression hurts trust | E2E for composed UI or contract plus targeted integration |
| P2 | Rotating domain or medium workflow | Component/integration plus one happy/error path |
| P3 | Low-risk UI affordance | Unit/component smoke; manual optional |

## Missing Proof Types

| Proof type | Gap |
|---|---|
| Fresh run proof | `matrix:baseline-report` cannot complete until Vitest JSON is refreshed. |
| Persistence proof | History, archive import/export, and some element workflows need saved/reloaded state proof. |
| Export artifact proof | Archive/PPTX/HTML should inspect artifact content, not only UI success. |
| Live/game sync proof | Live baseline exists; game score and leaderboard need presenter/player state proof. |
| Error path proof | AI malformed/provider failure needs UI-facing non-corruption proof. |
| Security proof | Secret/artifact scan is manual-only. |
| External boundary proof | rclone/sync/provider flows stay contract/local without real credentials. |

## Actionable Backlog

| Capability | Risk | Missing proof | Target layer | Owner phase | Test budget | Manual disposition |
|---|---|---|---|---|---:|---|
| `manual-risk: secret/artifact leak` | P0 | Automated artifact scan before sharing reports | Script + CI/local check | Phase 05/07 | 1 script + 1 CI check | Replace manual row with automated gate; keep release exception review |
| `import.markdown` | P1 | UI import, slide split, persisted state | Existing/expanded Playwright E2E | Phase 04 | 1 spec, `<2m` | Move rotating manual row to automated evidence |
| `manual-risk: archive media integrity` | P1 | `.navslides` export/import keeps local media refs | Playwright + artifact inspection | Phase 04 | 1 spec, `<3m` | Keep manual only for large media edge cases |
| `history.snapshot` | P1 | Save/restore/delete changes persisted deck state | Existing/expanded Playwright E2E | Phase 04 | 1 spec, `<2m` | Replace rotating row after stable green |
| `element.game`, `game.score` | P1 | Presenter-visible score update and leaderboard ordering | Playwright game flow | Phase 04 | 1-2 specs, `<4m` | Reduce manual to release spot-check until stable |
| `ai.generate`, `ai.rewrite`, `ai.translate`, `ai.failure` | P1 | Generic UI errors; malformed JSON does not corrupt deck | Vitest contract + local/mock Playwright | Phase 03/05 | 1 contract extension + 1 E2E | Keep real provider behavior contract/manual-only |
| `sync.rclone-status` | P2 | Configured/unconfigured UI without exposing credentials | Component/contract | Phase 05 | 1-2 tests, `<1m` | Keep real credential flow manual |
| `share.password`, `share.revoke` | P0 | Link exact existing specs into release evidence | Matrix/report metadata | Phase 02 | 0-1 report row | Remove from always-manual once evidence linked |
| `live.reconnect`, `live.presenter-authz` | P0 | Ensure reconnect/authz assertions are depth-mapped | Matrix/report metadata | Phase 02 | 0-1 report row | Release strict lane only |
| `import.pptx`, `export.pptx` | P0 | Link existing journey/corpus/browser audit evidence | Matrix/report metadata | Phase 02 | 0-1 report row | Manual sample only when PPTX changed |
| `export.html`, `flow.autosave`, `canvas.align` | P0 | Confirm marker/color persistence and HTML artifact proof | Existing E2E + shared renderer | Phase 02/04 | 0-1 mapping update | Reduce manual once specs are linked |

## Manual Rows To Automate First

1. Secret/artifact scan: highest security value, low automation cost.
2. Markdown import + archive export/import: current manual data-loss risk.
3. History snapshot save/restore/delete: compact state workflow.
4. Game scoring + leaderboard: real player/presenter composition risk.
5. AI local/mock failure path: prove UI error and deck non-corruption.

## Phase 2 Inputs

- Add freshness state to coverage reports so stale Vitest run results are explicit before baseline generation.
- Add depth labels only as warn-first metadata until Phase 7 promotion evidence exists.
- Preserve current PASS semantics for `[cap:*]`; add depth proof beside it.
- Treat manual smoke reductions as evidence-linking work, not as deletion of risk.

## Unresolved Questions

- Should full Vitest baseline be split into smaller CI-aligned shards for local Phase 1 evidence?
- Should non-editor-core manual risks become first-class capability IDs or a separate release-risk backlog?
