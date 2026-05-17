# Phase 05: Timeline Element

**Priority:** P2 | **Effort:** Medium | **Status:** Pending

---

## Context

- Source: parallax commits `9d3288e`, `78b62e5`, `fe5deaa`, `778a764`, `3471ab6`, `56067fd`, `2e28069`, `a6f42a8`, `2ba20cd`, `69c8195`
- NavSlidesEditor has: 17 element types, no timeline
- Timeline is the most complex new element — self-contained component with date ranges, events, images, tick spacing

---

## Requirements

### Functional
- New element type `timeline` with:
  - Date range (start date, end date)
  - Configurable tick spacing (years, decades, centuries)
  - Events with: date, title, description, optional image
  - Click-to-expand events with detailed description
  - Negative year support (BCE dates)
  - Per-event connector length offset
  - Text-above-image layout for top-side items
  - 45° tick labels for long ranges
  - Export support in HTML generator

### Non-functional
- Timeline component under 200 LOC
- Self-contained — no external dependencies
- Works in both editor and present mode

---

## Files to Create

| File | Description |
|------|-------------|
| `client/src/components/TimelineElement.jsx` | Timeline renderer component |

## Files to Modify

| File | Change |
|------|--------|
| `client/src/pages/EditorPage.jsx` | Add `handleAddTimeline()`, timeline element handling |
| `client/src/components/PropertiesPanel.jsx` | Add timeline properties panel (date range, events, tick spacing) |
| `client/src/components/Toolbar.jsx` | Add "Timeline" button in insert menu |
| `client/src/components/SlideCanvas.jsx` | Render TimelineElement for timeline type |
| `shared/src/element-renderers.js` | Add `renderTimeline()` for HTML export |
| `shared/src/htmlGenerator.js` | Include timeline CSS in generated HTML |

---

## Implementation Steps

### Step 1: Define timeline element model
```js
{
  id: 'uuid',
  type: 'timeline',
  x: 50, y: 100, width: 800, height: 400,
  zIndex: 2,
  timelineStart: '2000-01-01',
  timelineEnd: '2025-01-01',
  tickSpacing: 'yearly', // yearly, decadal, century
  tickLabelRotation: 0,   // 0 or 45
  connectorOffset: 0,
  events: [
    {
      id: 'evt-1',
      date: '2015-06-15',
      title: 'Event Title',
      description: 'Detailed description...',
      imageUrl: '/uploads/...',
      side: 'top', // top or bottom
    }
  ]
}
```

### Step 2: Create TimelineElement.jsx
```jsx
// client/src/components/TimelineElement.jsx
export default function TimelineElement({ element, onUpdate }) {
  // Parse dates, calculate positions
  // Render timeline line, tick marks, event markers
  // Handle click-to-expand
  // Support BCE dates (negative years)
}
```
Key rendering logic:
- Calculate pixel positions from dates using linear interpolation
- Render SVG line + tick marks
- Render event markers (circles on the line)
- Render event cards (title + description + optional image)
- Click handler toggles expanded state

### Step 3: PropertiesPanel timeline section
When element.type === 'timeline':
- Date range inputs (start, end)
- Tick spacing dropdown (yearly, decadal, century, custom)
- Tick label rotation toggle (0° or 45°)
- Connector offset slider
- Event list with add/edit/delete
- Event editor: date, title, description, image, side (top/bottom)

### Step 4: element-renderers.js renderTimeline()
```js
function renderTimeline(el, style, wrap, vis, opts) {
  // Generate static HTML/CSS timeline for export
  // Calculate positions from dates
  // Render as positioned divs with absolute positioning
}
```

### Step 5: htmlGenerator.js
Add timeline-specific CSS to generated HTML:
```css
.timeline-element { position: relative; }
.timeline-line { position: absolute; height: 2px; background: #6366f1; }
.timeline-event { position: absolute; }
.timeline-event-card { ... }
```

---

## Tests

### Unit Tests
```js
// client/src/components/TimelineElement.test.jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TimelineElement from './TimelineElement'

describe('TimelineElement', () => {
  const mockElement = {
    type: 'timeline',
    timelineStart: '2000-01-01',
    timelineEnd: '2025-01-01',
    tickSpacing: 'yearly',
    events: [
      { id: '1', date: '2010-01-01', title: 'Event A', description: 'Desc A', side: 'top' }
    ]
  }

  it('renders timeline line', () => {
    render(<TimelineElement element={mockElement} />)
    expect(screen.getByTestId('timeline-line')).toBeTruthy()
  })

  it('renders event markers', () => {
    render(<TimelineElement element={mockElement} />)
    expect(screen.getByText('Event A')).toBeTruthy()
  })

  it('handles BCE dates', () => {
    const el = { ...mockElement, timelineStart: '-0500-01-01', timelineEnd: '2000-01-01' }
    render(<TimelineElement element={el} />)
    expect(screen.getByTestId('timeline-line')).toBeTruthy()
  })

  it('expands event on click', async () => {
    render(<TimelineElement element={mockElement} />)
    fireEvent.click(screen.getByText('Event A'))
    expect(screen.getByText('Desc A')).toBeTruthy()
  })
})
```

```js
// shared/src/timeline-renderer.test.js
import { describe, it, expect } from 'vitest'
import { renderTimeline } from './element-renderers'

describe('renderTimeline', () => {
  it('generates timeline HTML for export', () => {
    const el = {
      type: 'timeline',
      timelineStart: '2000-01-01',
      timelineEnd: '2025-01-01',
      events: [{ id: '1', date: '2010-01-01', title: 'Test', side: 'top' }]
    }
    const html = renderTimeline(el, {}, () => '', () => '', { isExport: true })
    expect(html).toContain('timeline')
    expect(html).toContain('Test')
  })
})
```

### Integration Test
1. Insert timeline element → verify it renders on canvas
2. Set date range 2000-2025 → verify tick marks appear
3. Add event at 2010 → verify marker and card visible
4. Click event → verify description expands
5. Export to HTML → verify timeline renders in present mode
6. Test with BCE dates → verify negative year handling

---

## Success Criteria

- [ ] `TimelineElement.jsx` created, under 200 LOC
- [ ] Timeline renders on SlideCanvas
- [ ] Date range and tick spacing configurable
- [ ] Events with title, description, image, side
- [ ] Click-to-expand works
- [ ] BCE dates supported
- [ ] Export HTML includes timeline
- [ ] Unit tests pass
- [ ] `npm run build` succeeds
