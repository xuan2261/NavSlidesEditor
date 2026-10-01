# Evidence index và giới hạn

## Source scout slices

| Report | Phạm vi |
|---|---|
| [PresentRuntimeScout](./PresentRuntimeScout.md) | Editor popup/API/generated HTML/runtime; existing offline exporter; vendor packaging |
| [GameFixScout](./GameFixScout.md) | Ten game schemas, properties, timer/reset/score, current tests |
| [EditorControlsScout](./EditorControlsScout.md) | Format fanout/align, Shape controls, TipTap writer paths; partial result preserved despite agent-yield error |
| [ActionsSecurityScout](./ActionsSecurityScout.md) | Actions target/hidden IDs, iframe origin/sandbox, PPTX warnings |
| [TemplatesDocsScout](./TemplatesDocsScout.md) | Five quiz builtins, template gallery, inventory scopes, package scripts/e2e conventions |
| [ServerGameScout](./ServerGameScout.md) | Room/session/host capability model, wire events, learner cards, answer validation |

These are planning evidence, NOT acceptance receipts for implemented feature. Original scout path/line claims are rechecked in each phase scout; some reports cite outdated shorter paths (`components/game-interactive` rather than `components/canvas/element-renderers/game-interactive`). Owning source comes from current glob/read/LSP, not the stale citation.

## Primary-source research

- [Sandbox/offline research](../research/sandbox-offline-research.md): iframe capabilities, data origin, bundling.
- [Learning accessibility research](../research/learning-accessibility-research.md): pointer alternatives, keyboard and Reveal lifecycle.
- MDN iframe reference: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe — same-origin plus scripts on same-origin embed weakens isolation; flags can be restricted without disabling scripts.
- W3C WCAG 2.2 Dragging Movements: https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html — pointer movement alternatives required except essential dragging; keyboard alone does not satisfy pointer-only alternative.
- Reveal events: https://revealjs.com/events/ — mount/lifecycle must follow actual Reveal slides and readiness.

## Reused observed checks

Previous review executed `npx vitest run client/src/components/canvas/element-renderers client/src/components/properties/game-properties.test.jsx client/src/hooks/game-element-foundation.test.js shared/tests/element-renderers.test.js client/src/data/element-defaults.test.js --reporter=dot`: 17 files/246 tests passed. That run proves only inspected existing tests at that time; no claim that normal Present/new quiz/offline/live future functionality is green. Do not rerun solely to reconfirm known results.

Planning verification will execute `ak plan validate`, parse/link/dependency checks against the final files and 4-persona red-team. Implementation unit/e2e/smoke gates remain unchecked until Cook runs them. There is no commit/deploy approval.

## Review corrections authority

Use execution-contracts.md corrected findings as authority; not the earlier final chat's incorrect Shape missing-controls, opaque data URL top-level privileges, or primary-only alignment claim. Jeopardy double score and fontFamily/lineHeight fanout remain conditional unless reproduced. Standard Present currently generated cards, so unreachable React game play state is not considered shipped.
