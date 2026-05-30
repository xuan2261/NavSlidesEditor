---
phase: 5
title: "Extract Export And AI Hooks"
status: pending
priority: P1
effort: "2-2.5d"
dependencies: [4]
---

# Phase 5: Extract Export And AI Hooks

> **Red Team — applied/acknowledged.**
> - **#15 (Medium, applied):** `onApplyTranslations` writes `el.content = t.translatedHtml` directly from the `/api/ai/translate` response (`EditorPage.jsx:1822`) with no client sanitization — an external-provider trust boundary. When relocating "verbatim," wrap `t.translatedHtml` in the client sanitizer at the assignment and add a hook test that a script/`onerror` payload in `translationMap` is neutralized.
> - **#12 sequencing (acknowledged):** Phase 5 moves `addElement`/`updateElement`/`deleteElement` (`:520/:539/:564`) into `use-element-creation` "verbatim," then Phase 6 reopens those same callbacks to generalize them for child addressing (`mapActiveSlide`). This is relocate-then-rewrite. User decision: **keep the 1→…→6 order**; mitigate the churn by having Phase 6 edit the extracted hook (not the original site) and re-running the characterization suite after each. Flagged so the executor expects the second pass, not as a defect.
> - **#11 (High, acknowledged — scope KEPT by user):** several Phase 5 closures (`onExportPDF:1295`, `onExportPPTX:1296`, `onExportHTML:1306`, `onExportOffline:1314`, `onExportProject:1330`, `onOpenProject:1338`, `onAICopywriter:1392`, `onCreatePresentation:1767`) are single-call-site inline props — extracting them is closer to a lateral move than a decoupling win, and the 200-LOC cap stays unreachable this round (~1300 target). User chose to keep the full extraction. Acknowledged trade-off: the value here is readability/cohesion + testability of the handler clusters, NOT call-site decoupling. Do not expand scope further (KISS); `use-element-creation` (the genuinely large `:563-843` block) is the real lever.

## Overview

Second extraction pass with THREE hooks: element-creation handlers, export actions, and AI/live actions. Pure refactor — characterization suite stays GREEN. This is the second-biggest LOC lever (the element-creation block alone is ~280 lines at `:563-843`).

## Requirements

- Functional: every element add/insert/edit handler, all exports/import, GitHub/sync/history/share/live/analytics triggers, and AI copywriter/generator/translate behave identically.
- Non-functional: three new hooks each < 200 LOC; EditorPage becomes mostly composition + render, landing at ≤ ~1350 LOC (cumulative with Phases 2 & 4; floor revised up from ~1300 because reachable game wiring stays — see plan.md LOC note).

## Architecture

- **`use-element-creation`**: wraps the unified `addElement` (`:564`) + all thin wrappers and editor-open/commit handlers (`:582-843`): `addTextElement`, `addImageElement`, `addQrCodeElement`, `addTimelineElement`, `insertEmbedHtml`, `handleInsertFromFileBrowser`, `addDividerElement`, `addGameElement`, `addPluginElement`, `addHtmlElement`/`openHtmlEditor`/`commitHtmlEdit`, `addCodeElement`/`openCodeEditor`/`commitCodeEdit`, `addLatexElement`/`openLatexEditor`/`commitLatexEdit`, `addMarkdownElement`, `addChartElement`, `addCalloutElement`, `addIconElement`, `addShapeElement`, `addVideoElement`, `addAudioElement`, `addTableElement`, `addDrawingElement`, `addLineElement`, `addSvgElement`. Takes `setPresentation`, `currentSlideIndexRef`, `setSelectedElementIds`, and the modal setters (for html/code/latex editor states from Phase 4 hook). Returns the handler set + `addElement`. Net ~200 lines moved.
- **`use-export-actions`**: wraps the export/import closures at `:1295-1370` (`onExportPDF`, `onExportPPTX` w/ dynamic import, `onExportHTML`, `onExportOffline`, `onExportProject`, `onOpenProject`). Takes `presentation` + `api`; returns the handler set. Keep `alert`/`console.error` error UX verbatim.
- **`use-ai-actions`**: wraps `onAICopywriter` guard (`:1392-1399`), `onCreatePresentation` (now using `buildSlidesFromOutline` from Phase 3), and the AITranslate apply logic (`:1814-1839`). Takes `presentation`/`setPresentation`/`selectedElementId`; returns handlers + the translate apply callback. **Security (#15):** when moving `onApplyTranslations`, do NOT carry the unsanitized `el.content = t.translatedHtml` (`:1822`) verbatim — wrap `t.translatedHtml` in the client sanitizer (`client/src/utils/content-safety.js`) at the assignment point. AI-provider responses are an untrusted boundary.
- Live-room creation (`onLive` `:1375-1390`) + `liveRoomCode`/`livePresenterToken`: move into `use-ai-actions` ONLY if clean; else a tiny `use-live-room` hook. Prefer fewest files that respect 200 LOC.
- These hooks orchestrate existing utils/factories (`createElement`, `createGameElement`, `createPluginElement`, `generateHTML`, `exportPptx`, `export-project`, `import-project`, `build-slides-from-outline`); they do not reimplement logic — DRY.

## Related Code Files

- Create: `client/src/hooks/use-element-creation.js`
- Create: `client/src/hooks/use-element-creation.test.js`
- Create: `client/src/hooks/use-export-actions.js`
- Create: `client/src/hooks/use-export-actions.test.js`
- Create: `client/src/hooks/use-ai-actions.js`
- Create: `client/src/hooks/use-ai-actions.test.js`
- Modify: `client/src/pages/EditorPage.jsx` — replace the element-creation block (`:563-843`) with `useElementCreation(...)`; replace inline closures in `RibbonHeaderBar` props (`:1294-1403`) and AI modal callbacks (`:1747-1842`) with hook-provided handlers.
- Read for context: `client/src/utils/element-factory.js`, `client/src/constants/game-element-types-constants.js`, `client/src/plugins/index.js`, `client/src/utils/generateHTML.js`, `client/src/utils/export-project.js`, `client/src/utils/import-project.js`, `client/src/utils/slide-notes.js`, `client/src/components/AITranslateModal.jsx`

## Implementation Steps

1. **RED (element-creation)**: `use-element-creation.test.js` — assert `addElement('text')` appends a text element with `ELEMENT_DEFAULTS.text` and selects it; `addShapeElement('circle')` centers a 200×200 circle; `addCalloutElement()` auto-numbers from existing callouts; `addHtmlElement` appends + opens the html editor state; `addGameElement(type)` uses `createGameElement`; `addPluginElement(fullType)` uses `createPluginElement`. Fails (hook absent).
2. **GREEN (element-creation)**: implement `useElementCreation(...)` moving `:564-843` verbatim; wire into EditorPage RibbonPanel/SlideCanvas props. Remove the migrated closures from EditorPage.
3. **RED (export)**: `use-export-actions.test.js` — mock util modules; assert `onExportPDF` calls `exportPDF(presentation)`; `onExportPPTX` dynamic-imports and surfaces warnings via `alert`; `onExportOffline` builds blob+anchor (mock `URL.createObjectURL`); `onOpenProject` validates+rehydrates+creates (mock `api`). Fails.
4. **GREEN (export)**: implement `useExportActions(presentation, api)` moving the closures verbatim; wire into RibbonHeaderBar props.
5. **RED (ai)**: `use-ai-actions.test.js` — `onAICopywriter` alerts when no text element selected, opens modal when a text element is selected; `onCreatePresentation` appends slides via `buildSlidesFromOutline` (no fetch); translate apply maps `translationMap` keyed `${si}-${ei}-content` + notes key (reuse `slide-notes` helpers). **Security case (#15): a `translationMap` value containing `<img src=x onerror=...>`/`<script>` must be neutralized in the written `el.content` (sanitizer applied), not stored raw.** Fails.
6. **GREEN (ai)**: implement `useAiActions(...)`; wire into EditorPage AI modal callbacks. Move `onCreatePresentation` logic (already fixed in Phase 3) here unchanged.
7. Run Phase 1 + Phase 3 + new hook tests → all GREEN.
8. **REFACTOR**: remove now-dead inline closures and unused imports from EditorPage (`createElement`, `createGameElement`, `createPluginElement` imports move to the hook); measure LOC. Lint.

## Success Criteria

- [ ] `use-element-creation` + `use-export-actions` + `use-ai-actions` each < 200 LOC, unit-tested.
- [ ] All element-add/insert/edit + export/import/AI/live triggers behave identically (characterization + new tests GREEN).
- [ ] AITranslate apply sanitizes `t.translatedHtml` before writing `el.content` (security test GREEN); no raw provider HTML reaches state.
- [ ] EditorPage reduced to ≤ ~1350 LOC (cumulative w/ Phases 2 & 4).
- [ ] No behavior change; Phase 1 suite GREEN.
- [ ] Lint clean; dynamic `import('../utils/exportPptx')` preserved (code-splitting intact).

## Risk Assessment

- **Risk:** `use-element-creation` has many call-site dependencies (modal setters from Phase 4, refs, store setters) → wiring churn. **Mitigation:** pass them as a single options object; characterization render test catches any undefined handler.
- **Risk:** Closures captured stale `presentation`. **Mitigation:** hooks receive current `presentation` as arg each render (same as inline closures did); add a test mutating presentation then invoking handler.
- **Risk:** Moving `onCreatePresentation` re-introduces fetch. **Mitigation:** Phase 3 already removed it; test asserts no fetch.
- **Risk:** Over-splitting (too many micro-hooks). **Mitigation:** cap at 3 (+ optional `use-live-room` only if coupling forces it); honor KISS.
