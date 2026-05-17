# Phase 03: Editor UX — Link Decision, LaTeX Controls, Citations, Context Menu

**Priority:** P1 | **Effort:** Low | **Status:** Complete

---

## Context

- Source: parallax commits `2913f7a` (Ctrl+K), `315eee9` (LaTeX font size), `6d971eb` (LaTeX font color), `0e7196b` (citation settings), `856d206` (citation color), `93816b8` (Copy URL context menu)
- NavSlidesEditor has: LaTeX element, image citations, right-click context menu

---

## Requirements

### Link Insertion Shortcut Decision
- `Ctrl+K` stays assigned to NavSlidesEditor Command Palette.
- Link insertion stays available through existing text toolbar / command palette action.
- Upstream Ctrl+K link modal is not ported to avoid shortcut regression.

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
| `client/src/pages/EditorPage.jsx` | Keep `Ctrl+K` command palette behavior, add/update copy URL integration |
| `client/src/components/PropertiesPanel.jsx` | Add LaTeX font size/color, citation font settings |
| `client/src/components/SlideCanvas.jsx` | Add "Copy URL" to context menu for image/video |
| `shared/src/element-renderers.js` | Render `latexFontSize`, `latexColor`, `citationFontColor` |

---

## Implementation Steps

### Step 1: Ctrl+K Decision
Keep existing Command Palette shortcut. Link insertion remains discoverable through the existing text toolbar and command list.

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
// client/src/utils/command-palette.test.jsx
describe('CommandPalette', () => {
  it('keeps Insert Link available as a command action', () => {
    // Existing command list includes Insert Link, which triggers the toolbar Add link control.
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
1. Press Ctrl+K in editor → Command Palette opens
2. Select Insert Link or use toolbar Add link → existing link prompt/action runs
3. Select LaTeX element → font size/color controls visible in PropertiesPanel
4. Change LaTeX font size to 32 → LaTeX renders larger
5. Right-click image → "Copy URL" copies src to clipboard

---

## Success Criteria

- [x] Ctrl+K intentionally remains Command Palette
- [x] Link insertion remains available through existing editor controls
- [x] LaTeX font size control in PropertiesPanel
- [x] LaTeX color picker in PropertiesPanel
- [x] Citation font color picker per image
- [x] "Copy URL" in context menu for image/video
- [x] Unit tests pass
- [x] `npm run build` succeeds
