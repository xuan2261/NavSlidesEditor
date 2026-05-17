# Phase 01: TipTap Extensions — FontWeight + LineHeight

**Priority:** P1 | **Effort:** Low | **Status:** Pending

---

## Context

- Source: `parallax-presentations/client/src/extensions/FontWeight.js`, `LineHeight.js`
- NavSlidesEditor already has: `FontFamily.js`, `FontSize.js`, `MathExtension.js`
- These extensions follow the exact same TipTap `Extension.create()` pattern

---

## Requirements

### Functional
- `FontWeight` extension: `setFontWeight(n)` / `unsetFontWeight()` commands, `fontWeight` attribute on `textStyle` marks, values 100-900
- `LineHeight` extension: `setLineHeight(n)` / `unsetLineHeight()` commands, `lineHeight` attribute on `paragraph`, `heading`, `listItem`, `bulletList`, `orderedList`
- Both extensions must integrate with existing TipTap editor in `EditorPage.jsx`
- PropertiesPanel must expose font-weight dropdown and line-height control

### Non-functional
- Keep files under 50 LOC each
- Follow existing extension pattern from `FontFamily.js` / `FontSize.js`

---

## Files to Create

| File | Description |
|------|-------------|
| `client/src/extensions/FontWeight.js` | TipTap extension for font-weight (100-900) |
| `client/src/extensions/LineHeight.js` | TipTap extension for line-height |

## Files to Modify

| File | Change |
|------|--------|
| `client/src/pages/EditorPage.jsx` | Register both extensions in TipTap `useEditor()` |
| `client/src/components/PropertiesPanel.jsx` | Add font-weight dropdown + line-height control |
| `client/src/components/Toolbar.jsx` | Add font-weight selector in text formatting section |

---

## Implementation Steps

### Step 1: Create FontWeight.js
```js
// client/src/extensions/FontWeight.js
import { Extension } from '@tiptap/core'

export const FontWeight = Extension.create({
  name: 'fontWeight',
  addOptions() { return { types: ['textStyle'] } },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontWeight: {
          default: null,
          parseHTML: el => el.style.fontWeight || null,
          renderHTML: attrs => attrs.fontWeight ? { style: `font-weight: ${attrs.fontWeight}` } : {}
        }
      }
    }]
  },
  addCommands() {
    return {
      setFontWeight: fontWeight => ({ chain }) =>
        chain().setMark('textStyle', { fontWeight }).run(),
      unsetFontWeight: () => ({ chain }) =>
        chain().setMark('textStyle', { fontWeight: null }).removeEmptyTextStyle().run()
    }
  }
})
```

### Step 2: Create LineHeight.js
```js
// client/src/extensions/LineHeight.js
import { Extension } from '@tiptap/core'

export const LineHeight = Extension.create({
  name: 'lineHeight',
  addOptions() {
    return { types: ['paragraph', 'heading', 'listItem', 'bulletList', 'orderedList'] }
  },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: el => el.style.lineHeight || null,
          renderHTML: attrs => attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {}
        }
      }
    }]
  },
  addCommands() {
    return {
      setLineHeight: lineHeight => ({ commands }) =>
        this.options.types.every(type => commands.updateAttributes(type, { lineHeight })),
      unsetLineHeight: () => ({ commands }) =>
        this.options.types.every(type => commands.resetAttributes(type, 'lineHeight'))
    }
  }
})
```

### Step 3: Register in EditorPage.jsx
- Import both extensions
- Add to `useEditor({ extensions: [...] })` array

### Step 4: Add PropertiesPanel controls
- Font weight: dropdown with values [100, 200, 300, 400, 500, 600, 700, 800, 900]
- Line height: dropdown with values [1, 1.15, 1.5, 2, 2.5, 3]

---

## Tests

### Unit Tests
```js
// client/src/extensions/FontWeight.test.js
import { describe, it, expect } from 'vitest'
import { FontWeight } from './FontWeight'

describe('FontWeight extension', () => {
  it('has correct name', () => {
    expect(FontWeight.name).toBe('fontWeight')
  })

  it('parses fontWeight from HTML', () => {
    const attrs = FontWeight.config.addGlobalAttributes()[0]
    const parser = attrs.attributes.fontWeight.parseHTML
    expect(parser({ style: 'font-weight: 700' })).toBe('700')
    expect(parser({ style: '' })).toBe(null)
  })

  it('renders fontWeight to HTML', () => {
    const attrs = FontWeight.config.addGlobalAttributes()[0]
    const renderer = attrs.attributes.fontWeight.renderHTML
    expect(renderer({ fontWeight: '700' })).toEqual({ style: 'font-weight: 700' })
    expect(renderer({ fontWeight: null })).toEqual({})
  })
})
```

```js
// client/src/extensions/LineHeight.test.js
import { describe, it, expect } from 'vitest'
import { LineHeight } from './LineHeight'

describe('LineHeight extension', () => {
  it('has correct name', () => {
    expect(LineHeight.name).toBe('lineHeight')
  })

  it('targets correct node types', () => {
    const types = LineHeight.options.types
    expect(types).toContain('paragraph')
    expect(types).toContain('heading')
    expect(types).toContain('listItem')
  })

  it('parses lineHeight from HTML', () => {
    const attrs = LineHeight.config.addGlobalAttributes()[0]
    const parser = attrs.attributes.lineHeight.parseHTML
    expect(parser({ style: 'line-height: 1.5' })).toBe('1.5')
    expect(parser({ style: '' })).toBe(null)
  })

  it('renders lineHeight to HTML', () => {
    const attrs = LineHeight.config.addGlobalAttributes()[0]
    const renderer = attrs.attributes.lineHeight.renderHTML
    expect(renderer({ lineHeight: '1.5' })).toEqual({ style: 'line-height: 1.5' })
    expect(renderer({ lineHeight: null })).toEqual({})
  })
})
```

### Integration Test
- Open editor, type text, change font-weight to 700 → verify `<span style="font-weight: 700">text</span>`
- Open editor, set paragraph line-height to 2 → verify `<p style="line-height: 2">text</p>`
- Export to HTML → verify styles persist in reveal.js output

---

## Success Criteria

- [ ] `FontWeight.js` created, < 30 LOC
- [ ] `LineHeight.js` created, < 30 LOC
- [ ] Both extensions registered in EditorPage TipTap config
- [ ] PropertiesPanel shows font-weight dropdown (100-900)
- [ ] PropertiesPanel shows line-height control (1-3)
- [ ] Unit tests pass: `npx vitest run client/src/extensions/`
- [ ] `npm run build` succeeds with no errors
