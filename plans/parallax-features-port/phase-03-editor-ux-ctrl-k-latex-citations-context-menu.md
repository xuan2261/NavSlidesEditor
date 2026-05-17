# Phase 03: Editor UX — Ctrl+K Link, LaTeX Controls, Citations, Context Menu

**Priority:** P1 | **Effort:** Low | **Status:** Pending

---

## Context

- Source: parallax commits `2913f7a` (Ctrl+K), `315eee9` (LaTeX font size), `6d971eb` (LaTeX font color), `0e7196b` (citation settings), `856d206` (citation color), `93816b8` (Copy URL context menu)
- NavSlidesEditor has: LaTeX element, image citations, right-click context menu

---

## Requirements

### Ctrl+K Link Modal
- `Ctrl+K` keyboard shortcut opens link insertion modal
- Modal has URL input + optional text input
- Inserts `<a href="url">text</a>` at cursor position in TipTap editor
- Works when text element is being edited

### LaTeX Font Size & Color
- PropertiesPanel for LaTeX elements shows font size input (px)
- PropertiesPanel for LaTeX elements shows color picker
- Both stored as `latexFontSize` and `latexColor` on element

### Citation Settings
- Global citation font size setting (applies to all image citations)
- Global citation font family dropdown
- Citation font color picker on individual image elements
- Stored as `citationFontSize`, `citationFontFamily`, `citationFontColor`

### Copy URL Context Menu
- Right-click on image/video elements shows "Copy URL" option
- Copies the element's `src` or `videoUrl` to clipboard

---

## Files to Modify

| File | Change |
|------|--------|
| `client/src/pages/EditorPage.jsx` | Add `Ctrl+K` keydown handler, add `handleCopyUrl` |
| `client/src/components/PropertiesPanel.jsx` | Add LaTeX font size/color, citation font settings |
| `client/src/components/SlideCanvas.jsx` | Add "Copy URL" to context menu for image/video |
| `shared/src/element-renderers.js` | Render `latexFontSize`, `latexColor`, `citationFontColor` |

---

## Implementation Steps

### Step 1: Ctrl+K Link Modal
```js
// In EditorPage.jsx — useEffect for keyboard shortcut
useEffect(() => {
  const handler = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      setShowLinkModal(true)
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [])
```
Add a simple LinkModal component with URL + text inputs.

### Step 2: LaTeX Font Size & Color
In PropertiesPanel when `element.type === 'latex'`:
```jsx
<label>Font Size (px)
  <input type="number" value={el.latexFontSize || 20}
    onChange={e => onUpdate({ latexFontSize: +e.target.value })} />
</label>
<label>Color
  <input type="color" value={el.latexColor || '#ffffff'}
    onChange={e => onUpdate({ latexColor: e.target.value })} />
</label>
```

### Step 3: Citation Settings
In PropertiesPanel when `element.type === 'image'`:
```jsx
<label>Citation Color
  <input type="color" value={el.citationFontColor || '#999'}
    onChange={e => onUpdate({ citationFontColor: e.target.value })} />
</label>
```

### Step 4: Copy URL Context Menu
In SlideCanvas right-click handler, add menu item:
```js
{ label: 'Copy URL', action: () => {
  const url = element.src || element.videoUrl || ''
  navigator.clipboard.writeText(url)
  showToast('URL copied!')
}}
```

### Step 5: element-renderers.js
Update `renderLatex()` to use `el.latexFontSize` and `el.latexColor`.
Update `renderImage()` to use `el.citationFontColor`.

---

## Tests

### Unit Tests
```js
// client/src/components/link-modal.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LinkModal from './LinkModal'

describe('LinkModal', () => {
  it('renders URL and text inputs', () => {
    render(<LinkModal onInsert={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByPlaceholderText(/url/i)).toBeTruthy()
  })

  it('calls onInsert with URL and text', () => {
    const onInsert = vi.fn()
    render(<LinkModal onInsert={onInsert} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/url/i), { target: { value: 'https://example.com' } })
    fireEvent.click(screen.getByText(/insert/i))
    expect(onInsert).toHaveBeenCalledWith('https://example.com', expect.any(String))
  })
})
```

```js
// shared/src/latex-renderer.test.js
import { describe, it, expect } from 'vitest'
import { renderLatex } from './element-renderers'

describe('renderLatex with font size and color', () => {
  it('applies custom font size', () => {
    const el = { type: 'latex', content: 'E=mc^2', latexFontSize: 32 }
    const result = renderLatex(el, {}, () => '', () => '', {})
    expect(result).toContain('32')
  })

  it('applies custom color', () => {
    const el = { type: 'latex', content: 'E=mc^2', latexColor: '#ff0000' }
    const result = renderLatex(el, {}, () => '', () => '', {})
    expect(result).toContain('#ff0000')
  })
})
```

### Integration Test
1. Press Ctrl+K in editor → link modal appears
2. Enter URL + text → link inserted at cursor
3. Select LaTeX element → font size/color controls visible in PropertiesPanel
4. Change LaTeX font size to 32 → LaTeX renders larger
5. Right-click image → "Copy URL" copies src to clipboard

---

## Success Criteria

- [ ] Ctrl+K opens link modal
- [ ] Link modal inserts `<a>` tag in TipTap
- [ ] LaTeX font size control in PropertiesPanel
- [ ] LaTeX color picker in PropertiesPanel
- [ ] Citation font color picker per image
- [ ] "Copy URL" in context menu for image/video
- [ ] Unit tests pass
- [ ] `npm run build` succeeds
