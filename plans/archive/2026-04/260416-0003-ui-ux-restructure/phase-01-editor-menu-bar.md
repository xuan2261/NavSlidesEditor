# Phase 01 — Editor Menu Bar (CRITICAL)

## Priority: 🔴 CRITICAL

## Status: ⬜ Not started

## Effort: Large (~4h)

## Impact: ⭐⭐⭐⭐⭐

## Overview

Thay thế 18 nút `btn-secondary` dàn hàng ngang trong `header-controls` bằng một menu bar gồm 5 dropdown menus + 1 primary CTA. Giảm từ 18 nút → 6 items trên header.

## Key Insights

- Hiện tại `header-controls` (EditorPage.jsx L1741-L2204) chứa: Save indicator + 3 selects (Background, Size, Transition) + 4 checkboxes (Grid, Footer, Page#, Auto) + Auto sub-controls (interval, Loop, Kiosk) + 18 action buttons
- CSS: `.header-controls` dùng `flex-wrap: wrap` nên tràn 2+ dòng
- Tất cả button dùng `btn btn-secondary` → cùng visual weight, không phân biệt priority

## Architecture

### Menu Bar Structure

```
┌──────────────────────────────────────────────────────────────┐
│ ← Back │ [Title] │ [Save] │ File ▾ │ View ▾ │ Settings ▾   │
│                             │ AI ▾ │ Share ▾ │ ▶ Present    │
└──────────────────────────────────────────────────────────────┘
```

### Menu Contents

#### File Menu

| Item                | Icon          | Shortcut | Current location |
| ------------------- | ------------- | -------- | ---------------- |
| Export PDF          | `Download`    | —        | L2030-2037       |
| Export PPTX         | `Download`    | —        | L2039-2046       |
| Export HTML         | `Download`    | —        | L2048-2070       |
| Export Offline HTML | `FileDown`    | —        | L2072-2094       |
| --- separator ---   |               |          |                  |
| Save to GitHub      | `Github`      | —        | L2117-2124       |
| Sync to Cloud       | `CloudUpload` | —        | L2126-2142       |
| --- separator ---   |               |          |                  |
| Version History     | `History`     | —        | L2096-2106       |

#### View Menu

| Item               | Icon            | Shortcut | Current location |
| ------------------ | --------------- | -------- | ---------------- |
| Find & Replace     | `Search`        | `Ctrl+F` | L1989-1995       |
| Animation Timeline | `Clock`         | —        | L1997-2003       |
| Custom CSS         | `Code2`         | —        | L2005-2011       |
| Speaker Notes      | `MessageSquare` | —        | L2108-2115       |

#### Settings Menu (popover with form controls)

| Item              | Type                                   | Current location |
| ----------------- | -------------------------------------- | ---------------- |
| Background Theme  | `<select>`                             | L1758-1770       |
| Slide Size        | `<select>`                             | L1772-1805       |
| Transition        | `<select>`                             | L1807-1819       |
| --- separator --- |                                        |                  |
| Show Grid         | `<checkbox>`                           | L1821-1841       |
| Show Footer       | `<checkbox>`                           | L1843-1863       |
| Show Page Numbers | `<checkbox>` + format select           | L1865-1899       |
| --- separator --- |                                        |                  |
| Auto-advance      | `<checkbox>` + interval + Loop + Kiosk | L1901-1987       |

#### AI Tools Menu

| Item               | Icon        | Current location |
| ------------------ | ----------- | ---------------- |
| AI Copywriter      | `Sparkles`  | L2144-2159       |
| AI Slide Generator | `FileText`  | L2161-2168       |
| Translate          | `Languages` | L2170-2176       |

#### Share Menu

| Item           | Icon        | Current location |
| -------------- | ----------- | ---------------- |
| Share Link     | `Share2`    | L2013-2020       |
| Present Live   | `Radio`     | L2178-2194       |
| View Analytics | `BarChart3` | L2022-2028       |

### Standalone Buttons (luôn hiển thị)

- **Present** (`btn-primary`) — L2196-2203

---

## Related Code Files

### Files to create:

- `client/src/components/EditorMenuBar.jsx` — Menu bar component chính
- `client/src/components/DropdownMenu.jsx` — Reusable dropdown menu component

### Files to modify:

- `client/src/pages/EditorPage.jsx` — Extract header-controls → EditorMenuBar
- `client/src/index.css` — Thêm styles cho dropdown menu

---

## Implementation Steps

### Step 1: Create DropdownMenu component

Tạo `DropdownMenu.jsx` — reusable component cho tất cả dropdown menus

```jsx
// API:
<DropdownMenu
  trigger={<button>File ▾</button>}
  items={[
    { type: 'button', label: 'Export PDF', icon: Download, onClick: ... },
    { type: 'separator' },
    { type: 'button', label: 'GitHub', icon: Github, onClick: ... },
  ]}
/>
```

**Yêu cầu kỹ thuật:**

- Click trigger → toggle dropdown
- Click outside → close (useEffect + document click listener)
- Escape key → close
- Multiple DropdownMenu trên cùng hàng: mở 1 thì close cái khác (shared state via context hoặc callback)
- Position: dưới trigger button, align left
- Min-width: 200px
- Z-index: 1000 (above canvas/panels)
- Hỗ trợ item types: `button`, `separator`, `checkbox`, `select`, `custom` (cho Settings panel)
- Keyboard shortcut hints hiển thị bên phải mỗi item

### Step 2: Create EditorMenuBar component

Tạo `EditorMenuBar.jsx` — orchestrator cho 5 dropdown menus

```jsx
// Nhận props từ EditorPage:
<EditorMenuBar
  presentation={presentation}
  setPresentation={setPresentation}
  presentationId={presentationId}
  onExportPDF={...}
  onExportPPTX={...}
  onExportHTML={...}
  onExportOffline={...}
  onGithub={...}
  onSync={...}
  onHistory={...}
  onFindReplace={...}
  onTimeline={...}
  onCssEditor={...}
  onSpeaker={...}
  onShare={...}
  onLive={...}
  onAnalytics={...}
  onAICopywriter={...}
  onAIGenerator={...}
  onAITranslate={...}
  showTimeline={showTimeline}
  showFindReplace={showFindReplace}
  // ... state refs
/>
```

### Step 3: Add CSS for dropdown menus

Thêm vào `index.css`:

```css
/* Editor Menu Bar */
.editor-menu-bar {
  display: flex;
  align-items: center;
  gap: 2px;
}

.menu-trigger {
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}
.menu-trigger:hover,
.menu-trigger.open {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.dropdown-panel {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  min-width: 220px;
  background: var(--bg-card);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  padding: 4px;
  box-shadow: var(--shadow-lg);
  z-index: 1000;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
}
.dropdown-item:hover {
  background: var(--bg-hover);
}
.dropdown-item .shortcut {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
}

.dropdown-separator {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

/* Settings dropdown — wider with form controls */
.dropdown-panel.settings-panel {
  min-width: 280px;
  padding: 12px 16px;
}
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
}
.settings-row label {
  font-size: 12px;
  color: var(--text-secondary);
}
```

### Step 4: Refactor EditorPage.jsx

1. Import EditorMenuBar
2. Extract hàm xử lý (handleExportPDF, handleExportPPTX, etc.) thành named functions
3. Thay thế toàn bộ `header-controls` section (L1741-L2204) bằng:

```jsx
<EditorMenuBar
  {...menuBarProps}
/>
<button className="btn btn-primary" onClick={() => presentInWindow(presentation)}>
  <Play size={14} />
  Present
</button>
```

---

## Todo List

- [ ] Create `DropdownMenu.jsx` component
  - [ ] Click toggle, click outside close, Escape close
  - [ ] Item types: button, separator, checkbox, select, custom
  - [ ] Keyboard shortcut hints
  - [ ] Shared open state (only 1 open at a time)
- [ ] Create `EditorMenuBar.jsx` component
  - [ ] File menu (7 items)
  - [ ] View menu (4 items)
  - [ ] Settings menu (form controls)
  - [ ] AI Tools menu (3 items)
  - [ ] Share menu (3 items)
- [ ] Add CSS styles for menu bar + dropdown
- [ ] Refactor `EditorPage.jsx`:
  - [ ] Extract handler functions
  - [ ] Replace `header-controls` with `EditorMenuBar`
  - [ ] Remove unused imports (if any)
- [ ] Test all menu actions work correctly
- [ ] Verify keyboard shortcuts still work (Ctrl+F, etc.)

## Success Criteria

1. Header giảm từ 2-3 dòng → 1 dòng duy nhất
2. Tất cả actions vẫn accessible qua dropdown
3. Present button luôn visible, nổi bật
4. Không break bất kỳ chức năng hiện có
5. Responsive — dropdown không bị tràn viewport

## Risk Assessment

- **High**: EditorPage.jsx rất lớn (3939 lines) → cần cẩn thận khi refactor, test kỹ
- **Medium**: Một số props cần passthrough nhiều lớp → giữ flat props thay vì context
- **Low**: E2E tests sẽ fail nếu selector dựa trên button text → cần update
