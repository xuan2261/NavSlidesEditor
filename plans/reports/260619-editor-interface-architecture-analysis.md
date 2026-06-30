# NavSlides Editor — Phân tích kiến trúc giao diện

> Phạm vi: EditorPage core · Ribbon + Properties + Controls + shell · Elements pipeline · Live + Game + Export
> Loại: as-is + chẩn đoán + ma trận vấn đề + roadmap refactor
> Nguồn scout: đọc trực tiếp EditorPage.jsx (1,765 LOC), 3 store, ribbon/, properties/, canvas/, shared/element-renderers.js, docs/code-standards.md, plan đang dở `260618-0737-teaching-interactivity-elements-controls-tdd`
> LOC đã verify bằng `wc -l` (xem Phụ lục)

---

## 0. TL;DR

1. **EditorPage.jsx = god-component 1,765 dòng** (1 component, 33 `useCallback` + 15 `useEffect` + 16 `useRef`). Không phải 77k LOC — đó là *bytes*. Bloat tập trung ở 4 cụm inline: auto-save engine (322–459), undo/redo orchestration (643–665 + 911–978), TipTap wiring 17 extension (537–579), 25 keyboard closure (1211–1324).
2. **Kiến trúc document KHÔNG khớp thực tế**: `docs/code-standards.md` nói `presentation-store` owns "presentation data, current slide index, slide operations" — nhưng store đó là **stub 21 dòng**, không page nào dùng. EditorPage giữ toàn bộ state đó trong local `useState`. `useAutosave` hook được docs liệt kê nhưng là **dead code** (zero import).
3. **Dual-renderer duplication — rủi ro drift thực**: 19 element type render 2 lần — canvas (React, `canvas-element-wrapper.jsx` 542 + registry) và shared/export (`shared/src/element-renderers.js` **857 LOC**, HTML string). Logic chart-config/table-styling/latex-detection/line-marker/timeline-math/mermaid-doc bị copy-divergent. (Color/token ĐÃ unified qua `design-tokens.js` — precedent tốt.)
4. **3 switch type song song, không single source of truth**: `formatTabLabel` (ribbon-tabs-config) + `ContextualControls` (format-tab) + `ElementTypeProperties` (PropertiesPanel). Thêm 1 type = sửa 3 nơi + 2 renderer + defaults + properties. Không có `ELEMENT_TYPES` constant trung tâm.
5. **12 file vi phạm constraint <200 LOC** (CLAUDE.md). Nặng nhất: insert-tab panel **810**, SlidePanel **634**, PropertiesPanel **476**, design-tab **447**, game-properties **435**, misc-properties **405**, format-tab **377**, game-element-renderer **1420** (8× mức khuyến nghị 150).
6. **Plan đang dở (P1, in-progress) đang thêm 3 game subtype** (poll/word-cloud/drag-drop, phases 4–6) và đã **lock element count = 19** để né chi phí thêm type → xác thực mạnh đề xuất unify type registry.

**Top 3 đề xuất (xem §7):** (1) Slim EditorPage bằng hook extraction (parallel-safe với plan đang dở); (2) Unify element-type registry → collapse 3 switch (nên land TRƯỚC phases 4–6 nếu có thể); (3) Unify canvas+shared renderer logic (sau plan đang dở).

---

## 1. Methodology

- Scout song song 3 Explore agent (EditorPage, Elements pipeline, controls/ribbon) + đọc trực tiếp README, element-defaults.js, code-standards.md, presentation-store.js, plan đang dở.
- Verify LOC bằng `wc -l` (Phụ lục).
- Verify 2 claim then chốt bằng grep: `use-autosave` (chỉ xuất hiện trong chính nó → dead), `presentation-store` (chỉ trong chính nó + test + dead hook → không dùng).
- Không sửa code. Đây là phân tích.

---

## 2. Cluster A — EditorPage Core

### 2.1 As-is

```
EditorPage.jsx (1,765 LOC, 1 component, no sub-components)
├─ Store wiring (178–253): useEditorStore (~21 selector) + useUIStore (~25 setter)
│   └─ presentation-store KHÔNG import → presentation/currentSlideIndex = local useState
├─ Refs (260–320): 16 ref, ~half chỉ để mirror state cho stable callback
├─ Auto-save engine INLINE (322–459): debounce + in-flight queue + attempt-id race
│   + keepalive fetch + sync-XHR fallback (tab close). Chỉ flushPendingSave được extract.
├─ TipTap useEditor INLINE (537–579): 17 extension + onUpdate→setPresentation
├─ Lifecycle effects (582–1023): clear-on-load, reset-on-slide, autosave, unmount-flush,
│   undo-history push, hljs CSS inject, custom-CSS inject (2 effect mutate document.head)
├─ Element CRUD (667–835): update/delete inline; creation delegate useElementCreation
├─ Undo/redo INLINE (643–665 + 911–978): 2 ref làm stack, 3 flag phối (fragile)
├─ Keyboard (1211–1324): delegate useKeyboard NHƯNG pass ~25 inline closure
│   (arrow-nudge batch z-order + game emit live-socket/CustomEvent)
├─ Ribbon/Canvas/Properties/DesignIdeas render (1366–1714): ~40+30+30 inline prop callback
└─ Modals (1717–1759): delegate <EditorModals> — phần SẠCH nhất
```

Đã extract tốt: `useSlideOperations`, `useElementCreation`, `useClipboard`, `useExportActions`, `useAiActions`, `EditorModals`. pattern đúng, chỉ chưa đủ.

### 2.2 Chẩn đoán

| # | Vấn đề | Bằng chứng | Severity |
|---|---|---|---|
| A1 | God-component, state+tất cả logic trong 1 body | 1,765 LOC, 33 useCallback, 16 ref mirror | P1 |
| A2 | Presentation state ở local useState, không store | presentation-store stub 21 dòng, 0 dùng; docs nói ngược lại | P1 |
| A3 | Auto-save engine hand-roll inline (140 dòng) | 322–459, XMLHttpRequest inline 449–453; `use-autosave.js` dead | P1 |
| A4 | Undo/redo orchestration inline, 3-flag coupling | 643–665 + 911–978, seededRef/applyingUndoRef/isFirstLoad | P1 |
| A5 | TipTap wiring 17 extension inline | 537–579 + onUpdate trực tiếp setPresentation | P2 |
| A6 | Keyboard: nửa logic còn trong page | 1211–1324 pass 25 closure, nudge + game emit inline | P2 |
| A7 | 25 modal setter plumbing | 232–253 destructured chỉ để thread vào ribbon/EditorModals | P2 |
| A8 | 2 effect mutate document.head bằng <style> inject | 999–1023 (hljs + custom CSS) | P2 |
| A9 | Dead code + doc drift | `use-autosave.js` zero import; docs liệt kê như live | P2 |

---

## 3. Cluster B — Ribbon + Properties + Controls + Shell

### 3.1 As-is

```
Ribbon (7 tab: home/insert/design/format/transitions/animations/view)
├─ activeTab: ui-store, persist localStorage, validate vs VALID_RIBBON_TABS
├─ Format tab contextual: Ẩn khi !selection; relabel qua formatTabLabel switch (7 case)
│   Auto-activate lần đầu chọn; bounce home khi clear (ui-store.setFormatContext)
├─ 2 Tabs.Root (header trigger + panel content) cùng store value, mỗi bên re-derive effectiveTab
└─ Tab content: RibbonTabContentRow → RibbonSection; primitive (RibbonFloatingOverlay, RibbonBigButton) gọn

Properties (PropertiesPanel.jsx 476 LOC)
├─ ElementTypeProperties switch (8 type tường minh) → 9 type fallback MiscProperties (405 LOC) → re-switch
├─ game-properties (435) bị chôn trong fallback MiscProperties
└─ CommonElementControls (277) cho mọi type: position/lock/z-order

Shell: SlidePanel (634) trái · StatusBar (175) ngoài editor tree · QuickAccessToolbar (96) · CommandPalette (139)
ui-store (158): 22 modal flag + 17 verbose setter (+ generic open/close/toggle) = migration debt
```

### 3.2 Chẩn đoán

| # | Vấn đề | Bằng chứng | Severity |
|---|---|---|---|
| B1 | 3 switch type song song, không SSoT | formatTabLabel + ContextualControls + ElementTypeProperties | P1 |
| B2 | insert-tab panel 810 LOC, 5 sub-component inline | ShapeGallery/GameGalleryDropdown/TableSizePicker/AdvancedActionButton/InsertTabContent | P2 |
| B3 | SlidePanel 634 LOC monolith | thumbnail + DnD + context-menu + multi-select + vertical-child | P2 |
| B4 | PropertiesPanel 476 + misc-properties 405 (catch-all 9 type) | game-properties chôn fallback; không 1-file-per-type nhất quán | P2 |
| B5 | format-tab 377 LOC, 6 per-type control inline + switch | ContextualControls song song PropertiesPanel switch | P2 |
| B6 | ui-store 17 verbose setter + generic helper trùng lặp | comment nói giữ hình useState API = migration debt | P2 |
| B7 | CommandPalette inline style cứng, lệch theme token | `#1e1e2e`, `rgba(0,0,0,0.5)`; không dùng ModalShell/bg-card | P2 |
| B8 | StemSimulationPresetModal render inline trong Insert tab, không qua EditorModals | ribbon-insert...:794 | P2 |
| B9 | Format tab chỉ "fully contextual" cho 7 type; ~17 type fallback generic "Format" + MiscProperties | gap tiềm ẩn | P2 |

---

## 4. Cluster C — Elements Pipeline

### 4.1 Lifecycle

```
CREATE:  Ribbon onAdd* → useElementCreation (393 LOC)
         → createElement / createGameElement / createPluginElement
         → merge ELEMENT_DEFAULTS + DEFAULT_POSITIONS + overrides (crypto.randomUUID)
         → appendElement (mapActiveSlide cho vertical child) → setPresentation → select

CANVAS:  CanvasElement wrapper (542 LOC) — position/transform/selection chrome/lock/drag/badge
         → 6 type inline (text/image/code/html/video/audio — TipTap/DOM coupling, SANCTIONED by docs)
         → 12 type qua elementRendererRegistry → <Renderer element/>
         → plugin:* → PluginSandbox

PROPERTIES: PropertiesPanel → ElementTypeProperties switch
         → type panel (shape/image/chart/code/media/table/timeline) HOẶC MiscProperties fallback
         → CommonElementControls (position/lock/z-order) cho mọi type
         → onUpdateElement(id, patch)

EXPORT/PRESENT: shared/element-renderers.js (857 LOC) → renderSlideElements → RENDERERS[type]
         → HTML string (iframe srcdoc cho html/chart/markdown/latex/qrcode ở present;
            data-pdf-iframe/<canvas data-*> cho print)
         → game → static placeholder card (by design, runtime-interactive)
```

### 4.2 Chẩn đoán

| # | Vấn đề | Bằng chứng | Severity |
|---|---|---|---|
| C1 | Dual renderer: 19 type render 2 lần, logic copy-divergent | canvas React vs shared 857 LOC string; chart/table/latex/line/timeline/mermaid | P1 |
| C2 | Không có ELEMENT_TYPES constant / type-metadata registry | type list = union của ELEMENT_DEFAULTS keys + registry keys + 6 inline + shared RENDERERS keys | P1 |
| C3 | Properties dispatch split 2 switch, game chôn fallback | PropertiesPanel:19–49 + misc-properties re-switch; game-properties 435 | P2 |
| C4 | game-element-renderer 1420 LOC (8× khuyến nghị 150) | hot file trong plan đang dở phases 4–6 | P1 |
| C5 | `poll` subtype propagate không đồng đều | createGameElement + GAME_TYPES có poll; ELEMENT_DEFAULTS.game KHÔNG; canvas GAME_TYPE_LABELS có, placeholder renderer KHÔNG; shared renderGame có | P1 (in-flight, phase 4) |
| C6 | Mermaid document builder duplicate | use-element-creation:buildMermaidEmbedContent + shared:buildMermaidDocument (near-identical) | P2 |
| C7 | game-element-placeholder-renderer.jsx (65) có vẻ orphan | registry import từ game-element-renderer.jsx, không phải placeholder | P2 |
| C8 | timeline-element-renderer 5 dòng (delegate) lệch pattern peer | inconsistent với renderer đầy đủ | P2 |
| C9 | use-element-creation 393 LOC, nhiều wrapper duplicate default | addTimelineElement re-pass default đã có trong ELEMENT_DEFAULTS | P2 |

---

## 5. Cluster D — Live + Game + Export

### 5.1 As-is

- **Live**: `socket-handler.js` + `live-rooms.js` (server); client `use-live-presentation`/`use-annotation-sync`/`use-live-timer-sync`. Presenter token, slide-change broadcast, annotation sync, timer sync, B/W overlay.
- **Game**: `game-socket-handler.js` (227 LOC) + `game-room-manager-singleton-service.js` (server); client `use-game-socket`, `game-player-join-page.jsx`, `game-element-renderer.jsx` (**1,420 LOC**, lazy sub-renderer trong `game-interactive/`), `game-properties.jsx` (435, tabbed Content/Display/Scoring + question-editor 200). 7 (sắp 8+) subtype.
- **Export**: `shared/htmlGenerator.js` (726) → reveal.js HTML; PPTX hybrid (`pptxgenjs` + Playwright raster fallback); offline HTML inline; PDF. `shared/element-renderers.js` (857) là lõi render string.

### 5.2 Chẩn đoán

| # | Vấn đề | Bằng chứng | Severity |
|---|---|---|---|
| D1 | game-element-renderer 1,420 LOC — lớn nhất repo, đang được thêm subtype | plan phases 4–6 thêm poll/word-cloud/drag-drop vào đúng file này | P1 |
| D2 | shared renderGame = static placeholder, divergence cố ý với canvas interactive | by design (runtime-interactive), nhưng mỗi subtype mới phải đảm bảo placeholder path | P2 |
| D3 | htmlGenerator 726 + element-renderers 857 = lõi export nặng, chạm bởi plan mermaid/stem/poll | conflict risk với plan đang dở | P1 |
| D4 | Export fidelity cho live/html/DOM content = raster fallback + structured warning | plan lock "no false PPTX parity"; mỗi feature mới phải thêm warning matrixRowId | P2 (process, không phải bug) |

---

## 6. Ma trận vấn đề (gộp)

| ID | File | Vấn đề | Sev | Effort | Hướng fix |
|---|---|---|---|---|---|
| A1 | EditorPage.jsx | god-component 1,765 LOC | P1 | L | extract hook (roadmap P1) |
| A2 | presentation-store.js + EditorPage | state ở local, store stub, doc drift | P1 | M–L | activate store (roadmap P5) + sửa doc |
| A3 | EditorPage 322–459 | auto-save inline + dead use-autosave.js | P1 | M | extract useAutoSave, xóa dead hook |
| A4 | EditorPage 643–665/911–978 | undo/redo inline 3-flag coupling | P1 | M | extract useUndoRedo |
| A5 | EditorPage 537–579 | TipTap wiring 17 ext inline | P2 | M | extract useSlideEditor |
| A6 | EditorPage 1211–1324 | keyboard nửa logic trong page | P2 | S–M | đẩy nudge+game-emit vào useKeyboard |
| A7 | EditorPage 232–253 | 25 modal setter plumbing | P2 | S | useUIStoreActions() selector |
| A8 | EditorPage 999–1023 | effect mutate document.head | P2 | S | effect util / hook |
| A9 | use-autosave.js + docs | dead code + doc drift | P2 | S | xóa + sửa code-standards.md |
| B1 | 3 switch type | không SSoT, 3 edit/type | P1 | M | type-metadata registry (roadmap P2) |
| B2 | ribbon-insert...810 | 5 sub-component inline | P2 | M | split gallery/picker |
| B3 | SlidePanel 634 | monolith | P2 | M | split thumbnail/DnD/menu |
| B4 | PropertiesPanel 476 + misc 405 | dispatch split, game chôn | P2 | M | 1-file-per-type + registry lookup |
| B5 | format-tab 377 | 6 per-type control inline + switch | P2 | M | split + registry lookup |
| B6 | ui-store 158 | 17 verbose setter debt | P2 | S | consolidate |
| B7 | command-palette 139 | inline style lệch theme | P2 | S | token + ModalShell |
| B8 | stem modal | không qua EditorModals | P2 | S | route qua EditorModals |
| C1 | canvas + shared/element-renderers | dual renderer drift | P1 | L | shared logic module (roadmap P3) |
| C2 | (không có) | không ELEMENT_TYPES registry | P1 | M | registry (roadmap P2) |
| C3 | properties dispatch | split 2 switch | P2 | S | gộp vào registry |
| C4 | game-element-renderer 1,420 | 8× khuyến nghị, hot file | P1 | L | split per-subtype (sau plan) |
| C5 | poll subtype | propagate không đồng đều | P1 | S | in-flight phase 4 — sync 3 renderer |
| C6 | mermaid doc builder | duplicate | P2 | S | 1 module shared |
| C7 | game-element-placeholder-renderer | orphan | P2 | S | verify + xóa |
| C8 | timeline renderer 5 dòng | lệch pattern | P2 | S | đồng nhất |
| D1 | game-element-renderer | = C4 | P1 | L | roadmap P4 |
| D3 | htmlGenerator + element-renderers | conflict risk với plan | P1 | — | roadmap P3 sau plan |
| C9 | use-element-creation 393 | wrapper duplicate default | P2 | S | dọn |

**Đếm**: P1 = 9 · P2 = 18. P1 tập trung ở 3 gốc: EditorPage bloat, type registry thiếu, dual renderer.

---

## 7. Roadmap refactor (ưu tiên)

Nguyên tắc: TDD-gated, **không đổi behavior**, tôn trọng plan đang dở `260618-0737-teaching-interactivity-elements-controls-tdd` (phases 4–6 Pending, chạm game files).

### Phase 0 — Hygiene (ngay, zero risk, S effort)
- Xóa `use-autosave.js` (verify 0 import — đã xác nhận).
- Sửa `docs/code-standards.md`: (a) bỏ/sửa entry `useAutosave` thành `use-editor-save-queue`; (b) sửa bảng store — `presentation-store` hiện là stub, EditorPage đang giữ state local (hoặc kích hoạt store rồi mới sửa doc).
- Verify + xóa `game-element-placeholder-renderer.jsx` nếu orphan (C7).
- Route `StemSimulationPresetModal` qua `EditorModals` (B8).
- CommandPalette: token + ModalShell (B7).
- Sync `poll` qua 3 renderer (C5) — phối hợp phase 4 plan đang dở.
- **Gate**: lint + build + test + `npm run matrix:gate`.

### Phase 1 — Slim EditorPage (parallel-safe với plan đang dở, file khác)
- Extract `useAutoSave(presentation, {isTemplate})` từ inline 322–459 (A3).
- Extract `useUndoRedo(presentation, setPresentation)` từ 643–665/911–978 (A4) — `utils/history-stack` đã có.
- Extract `useSlideEditor(...)` cho TipTap wiring 537–579 (A5).
- Đẩy arrow-nudge + game-emit vào `useKeyboard`/`useEditorShortcuts` (A6).
- `useUIStoreActions()` collapse 25 setter (A7).
- Đích: EditorPage ≤ ~800 LOC, chỉ composition.
- **Gate**: TDD (lock behavior trước), e2e selector contract không đổi (`data-testid`), `npm run test:e2e` xanh.

### Phase 2 — Element-type registry (nên land TRƯỚC phases 4–6 nếu có thể)
- Tạo `client/src/constants/element-types-registry.js`: `ELEMENT_TYPES` + metadata mỗi type `{ defaults, defaultPosition, canvasRenderer, propertiesPanel, formatTabLabel, formatTabControls, sharedRenderer, inlineInWrapper? }`.
- Collapse 3 switch (B1, C2, C3): `formatTabLabel`/`ContextualControls`/`ElementTypeProperties` → registry lookup.
- Pure refactor, không đổi behavior. Thêm type mới = 1 entry registry (giảm từ 5 edit → 1).
- **Lý do ưu tiên**: plan đang dở phases 4–6 thêm game subtype (chạm GAME_TYPES + 3 switch). Registry làm phase 4–6 rẻ hơn. Nhưng nếu team đang mid-flight, phối hợp để tránh conflict.
- **Gate**: `npm run matrix:element-control` + `matrix:gate`; test switch behavior (format tab label/visibility per type).

### Phase 3 — Unify canvas + shared renderer logic (SAU plan đang dở)
- Extract shared logic module: chart-config, table-styling, latex-detection, line-marker, timeline-math, mermaid-document (C1, C6). Follow precedent `design-tokens.js` (color ĐÃ unified).
- Canvas React renderer + shared string renderer cùng import logic, chỉ khác shell (React vs string).
- **Lý do defer**: `shared/element-renderers.js` đang bị plan mermaid/stem/poll chạm → conflict. Land sau phase 10 plan đang dở.
- **Gate**: PPTX corpus + browser-audit (`npm run test:pptx:strict`); round-trip fidelity không giảm.

### Phase 4 — Split oversized files (sau khi behavior lock)
- `ribbon-insert-tab-element-galleries-panel.jsx` 810 → tách ShapeGallery/GameGalleryDropdown/TableSizePicker/AdvancedActionButton (B2).
- `SlidePanel.jsx` 634 → thumbnail / DnD / context-menu / multi-select (B3).
- `game-element-renderer.jsx` 1,420 → split per-subtype (C4/D1) — **sau phases 4–6** để gộp 3 subtype mới vào cấu trúc split.
- `game-properties.jsx` 435 + `misc-properties.jsx` 405 → per-type file + registry lookup (B4).
- `format-tab` 377 → per-type control file (B5).
- **Gate**: mỗi file ≤ 200 LOC (trừ ngoại lệ documented); `npm run lint`.

### Phase 5 — Activate presentation-store (cuối, blast radius lớn)
- Mở rộng `presentation-store.js` (stub 21 → full): `presentation`, `currentSlideIndex`, `verticalEdit`, `saving`, `saveStatus` + slide operations (A2).
- Move state từ EditorPage local `useState` sang store. Cần Phase 1 xong trước (hook extract đã tách logic).
- Đồng bộ `docs/code-standards.md` (lúc này doc đúng).
- **Gate**: TDD + e2e full; verify không regression auto-save/undo/selection.

### Sequencing
```
Phase 0 (hygiene) ──┐
Phase 1 (EditorPage slim) ──┴─► parallel với plan đang dở (file khác)
Phase 2 (type registry) ─────► TRƯỚC plan phases 4–6 (làm chúng rẻ hơn) — phối hợp
Phase 3 (renderer unify) ────► SAU plan phase 10 (tránh conflict shared/element-renderers.js)
Phase 4 (file split) ────────► SAU plan phases 4–6 (gộp subtype mới)
Phase 5 (presentation-store) ─► SAU Phase 1
```

---

## 8. Quan hệ với plan đang dở

`260618-0737-teaching-interactivity-elements-controls-tdd` (P1, in-progress, 15–25 dev-day):
- Phases 1–3 (mermaid, stem) **Completed**. Phases 4–6 (poll, word-cloud, drag-drop) **Pending** — serialized vì share `GAME_TYPES`/`game-properties.jsx`/player UI/server services.
- Locked: **element count = 19** (né thêm type) → chính là triệu chứng của C2/B1 (thêm type đắt). Registry (Phase 2) trực tiếp giảm chi phí này.
- Phase 4 (poll) sẽ phải giải C5 (sync poll qua 3 renderer) — nên gộp vào Phase 0 hoặc phase 4 plan.
- Roadmap KHÔNG duplicate plan: Phase 1 chạm EditorPage (plan không chạm); Phase 2 chạm registry (plan thêm subtype, complement); Phase 3/4 explicitly defer sau plan.

---

## 9. Success Metrics & Validation

- EditorPage.jsx ≤ ~800 LOC (từ 1,765).
- 0 file > 200 LOC trong ribbon/properties/canvas trừ ngoại lệ documented (game renderer sau split).
- 1 `ELEMENT_TYPES` registry duy nhất; 3 switch collapse → lookup.
- Canvas + shared renderer share logic module (color đã precedent).
- `presentation-store` active, doc khớp thực tế.
- Gates: `npm run lint` · `npm run build` · `npm run test` · `npm run test:e2e` · `npm run matrix:gate` · `npm run matrix:element-control` · `npm run test:pptx:strict` (cho Phase 3).
- Không regression behavior (TDD-first, e2e selector contract `data-testid` không đổi).

---

## 10. Unresolved Questions

1. **Phase 2 timing**: land registry TRƯỚC phases 4–6 plan đang dở (làm chúng rẻ hơn) hay sau (tránh conflict)? Cần quyết của owner plan.
2. **`use-autosave.js`**: dead code chắc chắn (0 import) — xóa luôn hay đang là WIP migration nên giữ? (Khuyến nghị xóa.)
3. **presentation-store activation (Phase 5)**: trong scope near-term hay giữ EditorPage-local? Blast radius lớn, cần Phase 1 trước.
4. **game-element-renderer split (Phase 4)**: split per-subtype NGAY hay sau khi phases 4–6 thêm 3 subtype mới (gộp luôn)? (Khuyến nghị sau.)
5. **Format tab contextual cho 17 type còn lại (B9)**: có muốn "fully contextual" cho tất cả 19 type, hay chấp nhận generic fallback cho type ít dùng?

---

## 11. Phụ lục — LOC verify (`wc -l`)

| File | LOC | Cap 200? |
|---|---|---|
| EditorPage.jsx | 1,765 | ✗ (P1) |
| game-element-renderer.jsx | 1,420 | ✗ (P1, cap khuyến nghị 150) |
| shared/element-renderers.js | 857 | ✗ (shared, grandfathered) |
| ribbon-insert-tab-element-galleries-panel.jsx | 810 | ✗ |
| shared/htmlGenerator.js | 726 | ✗ (shared) |
| SlidePanel.jsx | 634 | ✗ |
| canvas-element-wrapper.jsx | 542 | ✗ (6 type inline, sanctioned) |
| PropertiesPanel.jsx | 476 | ✗ |
| design-tab-content.jsx | 447 | ✗ |
| game-properties.jsx | 435 | ✗ |
| use-element-creation.js | 393 | ✗ |
| misc-properties.jsx | 405 | ✗ |
| ribbon-format-tab-...controls.jsx | 377 | ✗ |
| common-element-controls.jsx | 277 | ✗ |
| game-socket-handler.js | 227 | (server) |
| use-keyboard.js | 160 | ✓ |
| ui-store.js | 158 | ✓ |
| editor-store.js | 84 | ✓ |
| presentation-store.js | 21 | ✓ (stub) |

**Tổng 19 file chính = 10,214 LOC.** P1 debt tập trung EditorPage + element-renderers (client+shared) + game renderer + 3 type switch.
