# Phase 04 — Replace window.prompt → Custom Popovers

## Priority: 🟡 MEDIUM
## Status: ⬜ Not started
## Effort: Medium (~2h)
## Impact: ⭐⭐⭐

## Overview
Thay thế tất cả `window.prompt()` bằng custom inline popovers/modals phù hợp với design system. Hiện có **11 lần gọi** `window.prompt` trong codebase.

## Key Insights
- `window.prompt()` gây disruption UX: modal blocking, không match dark theme, không hỗ trợ validation
- Không có `window.confirm()` nào (kiểm tra xong - 0 kết quả) → chỉ cần xử lý prompt
- Phần lớn prompt dùng cho URL input hoặc LaTeX input → có thể dùng inline popover

## Danh sách tất cả window.prompt occurrences

| # | File | Line | Purpose | Replacement |
|---|------|------|---------|-------------|
| 1 | Toolbar.jsx | 181 | Enter URL for link | Inline popover |
| 2 | Toolbar.jsx | 192 | Enter image URL | Inline popover |
| 3 | Toolbar.jsx | 542 | Video URL | Popover with URL input |
| 4 | Toolbar.jsx | 595-596 | Table rows × cols | Grid size picker popover |
| 5 | Toolbar.jsx | 1655-1656 | Table rows × cols (TipTap) | Grid size picker popover |
| 6 | Toolbar.jsx | 1731 | LaTeX inline | LaTeX input modal |
| 7 | Toolbar.jsx | 1742 | LaTeX display | LaTeX input modal |
| 8 | EditorPage.jsx | 2924 | Image URL (element) | Popover with URL input |
| 9 | MathExtension.js | 63 | Edit LaTeX on double-click | LaTeX edit modal |

## Architecture

### Approach: Reusable PromptPopover component

Thay vì tạo 9 custom popovers khác nhau, tạo **1 reusable PromptPopover** component:

```jsx
<PromptPopover
  trigger={<button>...</button>}
  title="Enter URL"
  placeholder="https://..."
  defaultValue=""
  onSubmit={(value) => { /* use value */ }}
  onCancel={() => {}}
/>
```

### Special cases:
- **Table size**: Tạo `TableSizePicker` — grid visual picker (giống Google Docs)
- **LaTeX**: Tạo `LatexInputModal` — textarea lớn hơn + preview KaTeX

---

## Related Code Files

### Files to create:
- `client/src/components/PromptPopover.jsx` — Reusable inline prompt replacement
- `client/src/components/TableSizePicker.jsx` — Visual grid size picker
- `client/src/components/LatexInputModal.jsx` — LaTeX input with preview

### Files to modify:
- `client/src/components/Toolbar.jsx` — Replace 7 prompt calls
- `client/src/pages/EditorPage.jsx` — Replace 1 prompt call
- `client/src/extensions/MathExtension.js` — Replace 1 prompt call

---

## Implementation Steps

### Step 1: Create PromptPopover.jsx

```jsx
function PromptPopover({ trigger, title, placeholder, defaultValue, onSubmit, type = 'text' }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(defaultValue || '')
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setValue(defaultValue || '')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, defaultValue])

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim())
      setOpen(false)
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {React.cloneElement(trigger, { onClick: () => setOpen(v => !v) })}
      {open && (
        <>
          <div className="popover-overlay" onClick={() => setOpen(false)} />
          <div className="prompt-popover">
            <div className="prompt-popover-title">{title}</div>
            <input
              ref={inputRef}
              className="prop-input"
              type={type}
              placeholder={placeholder}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSubmit()
                if (e.key === 'Escape') setOpen(false)
              }}
            />
            <div className="prompt-popover-actions">
              <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit}>OK</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

### Step 2: Create TableSizePicker.jsx

Visual grid picker (hover to select rows × cols):

```jsx
function TableSizePicker({ onSelect, onClose }) {
  const [hover, setHover] = useState({ r: 0, c: 0 })
  const maxR = 8, maxC = 8

  return (
    <div className="table-size-picker">
      <div className="table-size-label">
        {hover.r > 0 ? `${hover.r} × ${hover.c}` : 'Select size'}
      </div>
      <div className="table-size-grid">
        {Array.from({ length: maxR }, (_, r) =>
          Array.from({ length: maxC }, (_, c) => (
            <div
              key={`${r}-${c}`}
              className={`table-cell ${r < hover.r && c < hover.c ? 'active' : ''}`}
              onMouseEnter={() => setHover({ r: r + 1, c: c + 1 })}
              onClick={() => { onSelect(hover.r, hover.c); onClose() }}
            />
          ))
        )}
      </div>
    </div>
  )
}
```

### Step 3: Replace prompt calls in Toolbar.jsx

**Link URL (L181):**
```jsx
// Before: const url = window.prompt('Enter URL:', previousUrl || 'https://')
// After: use PromptPopover with trigger = Link button
```

**Video URL (L542):**
```jsx
// Before: const url = window.prompt('Video URL:')
// After: use PromptPopover
```

**Table (L595-596 & L1655-1656):**
```jsx
// Before: window.prompt('Rows:', '3') + window.prompt('Columns:', '3')
// After: use TableSizePicker popover
```

**LaTeX (L1731 & L1742):**
```jsx
// Before: window.prompt('LaTeX (inline):', 'E = mc^2')
// After: use LatexInputModal
```

### Step 4: CSS

```css
.popover-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
}
.prompt-popover {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 260px;
  background: var(--bg-card);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  padding: 12px;
  box-shadow: var(--shadow-lg);
  z-index: 1000;
}
.prompt-popover-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.prompt-popover-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 8px;
}

.table-size-picker {
  padding: 8px;
}
.table-size-label {
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.table-size-grid {
  display: grid;
  grid-template-columns: repeat(8, 20px);
  gap: 2px;
}
.table-cell {
  width: 20px;
  height: 20px;
  border: 1px solid var(--border);
  border-radius: 2px;
  cursor: pointer;
}
.table-cell.active {
  background: var(--accent);
  border-color: var(--accent);
}
```

---

## Todo List

- [ ] Create `PromptPopover.jsx` reusable component
- [ ] Create `TableSizePicker.jsx` visual grid picker
- [ ] Create `LatexInputModal.jsx` with textarea + preview
- [ ] Replace Toolbar.jsx prompts (7 occurrences)
- [ ] Replace EditorPage.jsx prompt (1 occurrence)
- [ ] Replace MathExtension.js prompt (1 occurrence)
- [ ] Add CSS styles
- [ ] Test all replaced prompts work correctly

## Success Criteria
1. Zero `window.prompt()` calls remaining in codebase
2. All popovers match dark theme design
3. Enter key to submit, Escape to cancel
4. Auto-focus on input when popover opens
