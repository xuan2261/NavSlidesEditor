# Presenter Tools Integration — NavSlides Editor

## Overview

Tích hợp 6 presenter controls từ golden example + Quarto demo vào NavSlides Editor. Controls xuất hiện **trong chế độ trình chiếu** (present mode), không trong editor. User opt-in/opt-out thông qua Settings dropdown.

## Status

| Phase | Description | Priority | Status |
|-------|-------------|----------|--------|
| 01 | Vendor Plugin Setup | Critical | ✅ Complete |
| 02 | Data Model + Editor UI | Critical | ✅ Complete |
| 03 | HTML Generator — Slide Menu + Tools Tab | High | ✅ Complete |
| 04 | HTML Generator — Theme/Font/Chalkboard | High | ✅ Complete |
| 05 | Offline Export Support | Medium | ✅ Complete |
| 06 | Testing & Verification | Medium | ✅ Complete |

---

## Completed Fixes

During final review, 2 bugs were fixed:
1. Missing `presenterTools` defaults in `server/routes/presentations.js` — new blank presentations now get default values (themeToggle: true, fontZoom: true, slideMenu: false, chalkboard: false)
2. Font Awesome `fas fa-gear` icon in `shared/src/presenterTools.js` replaced with inline SVG (gear icon) — no external Font Awesome dependency needed

## Dependencies
- `reveal.js-plugins` (chalkboard + customcontrols) from rajgoel/reveal.js-plugins
- `reveal.js-menu` v2.1.0 from denehyg/reveal.js-menu
- Font Awesome 6 (subset, for pen/chalkboard icons) — already embedded in golden example
- Local vendor path: `/server/vendor/reveal-plugins/`

---

## Phase 01: Vendor Plugin Setup

### Objective
Download 3 reveal.js plugins vào `/server/vendor/`.

### Files to create
```
server/vendor/reveal-plugins/
  ├── chalkboard/
  │   └── plugin.js            (~85KB, from rajgoel/reveal.js-plugins)
  ├── customcontrols/
  │   ├── plugin.js            (~15KB)
  │   └── style.css            (~3KB)
  └── menu/
      ├── menu.js              (~45KB, from denehyg/reveal.js-menu)
      └── menu.css             (~8KB)
```

### Implementation Steps
1. `npm install reveal.js-plugins reveal.js-menu --save-dev` (hoặc download trực tiếp)
2. Copy relevant files vào `server/vendor/reveal-plugins/`
3. Verify files serve đúng qua Express static middleware
4. Font Awesome: Sử dụng inline SVG icons thay vì load toàn bộ FA library (KISS — chỉ cần 2 icons: pen + chalkboard)

### Success Criteria
- Files accessible tại `http://localhost:3002/vendor/reveal-plugins/chalkboard/plugin.js`
- No 404 errors khi load plugin scripts

---

## Phase 02: Data Model + Editor UI

### Objective
Thêm `presenterTools` config vào presentation data model + UI controls trong Settings dropdown.

### Data Model
```js
// Thêm vào presentation object
presentation.presenterTools = {
  themeToggle: true,    // Dark/Light toggle — DEFAULT ON
  fontZoom: true,       // A+ / A- buttons — DEFAULT ON
  slideMenu: false,     // Hamburger menu + Tools tab — DEFAULT OFF
  chalkboard: false,    // Pen + Chalkboard — DEFAULT OFF
}
```

### Files to modify

#### [MODIFY] `client/src/components/EditorMenuBar.jsx`
- Thêm section "Presenter Tools" vào `settingsItems` array, sau separator cuối cùng
- 4 checkboxes:
  ```
  ── separator ──
  Presenter Tools
  ☑ Dark/Light Toggle
  ☑ Font Size Zoom (A+/A-)
  ☐ Slide Menu & Tools
  ☐ Pen / Chalkboard
  ```

#### [MODIFY] `client/src/pages/EditorPage.jsx`
- Đảm bảo `presenterTools` default values khi tạo presentation mới
- Truyền xuống EditorMenuBar qua `presentation` prop (đã có sẵn)

### Success Criteria
- Mở Settings → thấy 4 checkboxes Presenter Tools
- Toggle checkboxes → `presentation.presenterTools` cập nhật → auto-save

---

## Phase 03: HTML Generator — Slide Menu + Tools Tab

### Objective
Inject reveal.js-menu plugin với Slides tab + Tools tab (6 items) vào generated HTML khi `slideMenu: true`.

### Tools Tab Items (giống Quarto demo)
```
┌──────────────────────────┐
│ [📊 Slides] [⚙ Tools] [✕]│
├──────────────────────────┤
│ f  Fullscreen            │
│ s  Speaker View          │
│ o  Slide Overview        │
│ e  PDF Export Mode       │
│ r  Scroll View Mode      │
│ ?  Keyboard Help         │
└──────────────────────────┘
```

**Cách implement Tools tab**: reveal.js-menu plugin hỗ trợ `custom` panels. Tạo custom panel HTML cho "Tools" tab.

### Files to modify

#### [MODIFY] `shared/src/htmlGenerator.js`
Trong `generateRevealHTML()`, khi `presenterTools.slideMenu === true`:

1. **Inject `<script>` tags** cho menu plugin:
   ```html
   <link rel="stylesheet" href="/vendor/reveal-plugins/menu/menu.css">
   <script src="/vendor/reveal-plugins/menu/menu.js"></script>
   ```

2. **Inject menu config** vào `Reveal.initialize()`:
   ```js
   plugins: [...existing, RevealMenu],
   menu: {
     side: 'left',
     width: 'normal',
     numbers: true,
     titleSelector: 'h1, h2, h3',
     useTextContentForMissingTitles: true,
     hideMissingTitles: false,
     markers: true,
     themes: false,
     transitions: false,
     openButton: true,
     openSlideNumber: true,
     keyboard: true,
     sticky: true,
     autoOpen: true,
     loadIcons: false,
     custom: [{
       title: 'Tools',
       icon: '<i class="fas fa-gear"></i>',
       content: toolsTabHTML  // 6 items
     }]
   }
   ```

3. **Inject JS handler** cho 6 Tools tab actions:
   - `f` Fullscreen → `document.documentElement.requestFullscreen()`
   - `s` Speaker View → `window.open(url + '?receiver')`
   - `o` Slide Overview → `Reveal.toggleOverview()`
   - `e` PDF Export Mode → Opens print-pdf view
   - `r` Scroll View Mode → `Reveal.configure({ view: 'scroll' })`
   - `?` Keyboard Help → `Reveal.toggleHelp()`

4. **Inject CSS** cho keyboard shortcut badges:
   ```css
   .km {
     display: inline-block; width: 28px; height: 28px;
     background: rgba(255,255,255,0.15); border-radius: 4px;
     text-align: center; line-height: 28px; margin-right: 10px;
     font-size: 14px; font-family: monospace;
   }
   ```

### Success Criteria
- Present mode → click ☰ → Slides tab hiện mục lục
- Click Tools tab → 6 items hiển thị đúng
- Mỗi tool item hoạt động đúng chức năng

---

## Phase 04: HTML Generator — Theme/Font/Chalkboard

### Objective
Inject theme toggle, font zoom, và chalkboard/pen controls vào generated HTML.

### A. Theme Toggle (self-implemented, ~50 LOC inline)

Khi `presenterTools.themeToggle === true`:

1. **Inject CSS variables** cho light theme override:
   ```css
   [data-theme="light"] .reveal { --r-background-color:#f5f5f5; --r-main-color:#1a1a2e; }
   [data-theme="light"] .reveal .slides section { color: #1a1a2e; }
   [data-theme="light"] .reveal .slide-background { background: #f5f5f5 !important; }
   ```

2. **Inject floating button** (góc trên phải):
   ```html
   <div class="presenter-toolbar" style="position:fixed;top:10px;right:10px;z-index:100;display:flex;gap:5px;">
     <button id="theme-btn" onclick="toggleTheme()" title="Toggle dark/light">🌓</button>
   </div>
   ```

3. **Inject JS**:
   ```js
   function toggleTheme() {
     var html = document.documentElement;
     var isLight = html.getAttribute('data-theme') === 'light';
     html.setAttribute('data-theme', isLight ? '' : 'light');
   }
   ```

### B. Font Zoom (self-implemented, ~30 LOC inline)

Khi `presenterTools.fontZoom === true`:

1. **Inject 2 buttons** vào `.presenter-toolbar`:
   ```html
   <button onclick="zoomFont(1)" title="Increase font">A+</button>
   <button onclick="zoomFont(-1)" title="Decrease font">A−</button>
   ```

2. **Inject JS**:
   ```js
   var fontScale = 100;
   function zoomFont(dir) {
     fontScale = Math.max(50, Math.min(200, fontScale + dir * 10));
     document.querySelector('.reveal .slides').style.fontSize = fontScale + '%';
   }
   ```

### C. Chalkboard/Pen (plugin-based)

Khi `presenterTools.chalkboard === true`:

1. **Inject `<script>` tags**:
   ```html
   <script src="/vendor/reveal-plugins/chalkboard/plugin.js"></script>
   <script src="/vendor/reveal-plugins/customcontrols/plugin.js"></script>
   <link rel="stylesheet" href="/vendor/reveal-plugins/customcontrols/style.css">
   ```

2. **Inject vào `Reveal.initialize()`**:
   ```js
   plugins: [...existing, RevealChalkboard, RevealCustomControls],
   chalkboard: {
     boardmarkerWidth: 4,
     chalkWidth: 5,
     chalkEffect: 0.2,
     toggleChalkboardButton: false,
     toggleNotesButton: false,
     boardmarkers: [
       { color: 'rgba(100,100,100,1)', cursor: 'crosshair' },
       { color: 'rgba(30,144,255,1)', cursor: 'crosshair' },
       { color: 'rgba(220,20,60,1)', cursor: 'crosshair' },
       { color: 'rgba(50,205,50,1)', cursor: 'crosshair' },
       { color: 'rgba(255,140,0,1)', cursor: 'crosshair' },
       { color: 'rgba(150,0,150,1)', cursor: 'crosshair' },
     ],
     chalks: [
       { color: 'rgba(255,255,255,0.5)', cursor: 'crosshair' },
       { color: 'rgba(96,154,244,0.5)', cursor: 'crosshair' },
       { color: 'rgba(237,20,28,0.5)', cursor: 'crosshair' },
     ]
   },
   customcontrols: {
     controls: [
       {
         icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
         title: 'Toggle notes canvas (C)',
         action: 'RevealChalkboard.toggleNotesCanvas();'
       },
       {
         icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M2 17h20"/><path d="M6 21h12"/></svg>',
         title: 'Toggle chalkboard (B)',
         action: 'RevealChalkboard.toggleChalkboard();'
       }
     ]
   }
   ```

3. **Inline SVG** cho pen + chalkboard icons → không cần Font Awesome

### Architecture Decision
> **Tất cả presenter controls là INLINE** — inject trực tiếp vào generated HTML. Không cần thêm component React nào trong editor. Đảm bảo:
> - Present mode hoạt động standalone (kể cả offline)
> - Exported HTML tự chứa đầy đủ
> - Zero coupling giữa editor UI và presenter controls

### Success Criteria
- Theme toggle button xuất hiện góc trên phải khi present
- Click → chuyển light/dark
- A+/A- hoạt động chính xác
- Chalkboard/Pen controls xuất hiện góc dưới trái khi enabled

---

## Phase 05: Offline Export Support

### Objective
Đảm bảo `generateOfflineHTML()` cũng inject presenter tools khi enabled.

### Files to modify

#### [MODIFY] `shared/src/htmlGenerator.js`

### Implementation
1. Theme toggle + Font zoom: Đã inline → ✅ tự hoạt động offline
2. Menu plugin: Đọc file `menu.js` → inject inline `<script>` tag
3. Chalkboard plugin: Đọc files `plugin.js` → inject inline
4. Sử dụng server-side endpoint để bundle plugins vào offline HTML

### Strategy
- Offline export gọi server endpoint → server đọc vendor files → inline vào HTML
- Hoặc: Hiển thị warning "Chalkboard/Menu plugins require network" nếu offline export + plugins enabled

### Success Criteria
- Offline HTML export vẫn có theme toggle + font zoom
- Slide menu / chalkboard: Hoạt động hoặc hiển thị warning rõ ràng

---

## Phase 06: Testing & Verification

### Automated
1. **Unit test** — `htmlGenerator.test.js`:
   - `presenterTools.themeToggle: true` → HTML chứa `toggleTheme`
   - `presenterTools.slideMenu: true` → HTML chứa `RevealMenu`
   - `presenterTools.chalkboard: true` → HTML chứa `RevealChalkboard`
   - Default (undefined) → KHÔNG chứa bất kỳ plugin nào
2. **Build verification** — `npm run build` passes

### Manual Browser
1. Tạo presentation mới → Settings → bật tất cả tools → Present
2. Verify:
   - Floating toolbar góc trên phải: Theme 🌓 | A+ | A-
   - Hamburger menu góc dưới trái → Slides tab + Tools tab
   - Tools tab: 6 items hoạt động đúng
   - Pen / Chalkboard buttons hoạt động
3. Tắt tất cả tools → Present → verify KHÔNG có controls nào
4. Export HTML → mở file → verify vẫn hoạt động
5. Export Offline HTML → verify theme/font hoạt động

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Plugin version conflict với reveal.js 5.x | Medium | High | Test trước khi commit, pin versions |
| Menu plugin CSS conflict với editor theme | Low | Medium | Namespace CSS trong `<style>` block |
| Chalkboard mobile touch issues | Medium | Low | Test tablet, add touch-action CSS |
| Offline export file quá lớn (+130KB) | Low | Low | Warning message, optional |
| Font Awesome dependency | High | Medium | ✅ Mitigated: dùng inline SVG |

---

## Estimation

| Phase | Effort | Files Modified | Files Created |
|-------|--------|---------------|--------------|
| 01 | 30min | 0 | ~6 vendor files |
| 02 | 45min | 2 (EditorMenuBar, EditorPage) | 0 |
| 03 | 2h | 1 (htmlGenerator.js) | 0 |
| 04 | 1.5h | 1 (htmlGenerator.js) | 0 |
| 05 | 1h | 1 (htmlGenerator.js) | 0 |
| 06 | 1h | 1 (test file) | 0 |
| **Total** | **~6.5h** | **~4 files** | **~6 vendor files** |
