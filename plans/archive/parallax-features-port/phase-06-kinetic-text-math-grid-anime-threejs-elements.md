# Phase 06: Kinetic Text + Math Grid + Anime.js + Three.js Elements

**Priority:** P2 | **Effort:** Medium | **Status:** Complete

---

## Context

- Source: parallax components `KineticTextModal.jsx`, `MathGridModal.jsx`, `AnimeModal.jsx`, `ThreeModal.jsx`
- All 4 are standalone modal components that generate HTML embed content
- They share the same pattern: template list → parameter controls → preview → insert as `html` element type
- NavSlidesEditor already has `html` element type that can embed arbitrary HTML

---

## Requirements

### Functional
- **Kinetic Text:** 10 animation templates (Typewriter, Word Revolve, Revolve, Wave, Split-Flap, Fade Cascade, Circular, Glitch, Bounce, Stagger Center, Custom)
- **Math Grid:** 10 presets (Cartesian, Polar, Wave Mesh, Log Polar, Perspective, Gravity Well, Saddle, Spiral, Diamond, Sinusoidal) + custom expressions
- **Anime.js:** 12 templates (Scatter Dots, Stagger Grid, Path Morph, Orbital, Wave Bars, Particle Burst, Text Scramble, Breathing, Cascade Lines, Spring Grid, Pendulum, Fireworks, Custom)
- **Three.js:** 9 templates (Rotating Cube, Wireframe Sphere, Particle Cloud, Torus Knot, Wave Plane, Galaxy, Terrain, Instanced Spheres, Custom)
- All generate self-contained HTML and insert as `html` element type

### Non-functional
- Each modal under 200 LOC
- Each generates standalone HTML (no external server deps at runtime)
- CDN-based libraries (anime.js, Three.js, KaTeX) loaded in generated HTML

---

## Files to Create

| File | Description |
|------|-------------|
| `client/src/components/KineticTextModal.jsx` | 10 kinetic text animation templates |
| `client/src/components/MathGridModal.jsx` | Parametric surface plot generator |
| `client/src/components/AnimeModal.jsx` | 12 anime.js animation templates |
| `client/src/components/ThreeModal.jsx` | 9 Three.js 3D scene templates |

## Files to Modify

| File | Change |
|------|--------|
| `client/src/pages/EditorPage.jsx` | Add handlers: `handleAddKineticText`, `handleAddMathGrid`, `handleAddAnime`, `handleAddThree` |
| `client/src/components/Toolbar.jsx` | Add 4 new buttons in insert menu (Embed section) |
| `client/src/components/SlideCanvas.jsx` | Handle modal open/close state for each |

---

## Implementation Steps

### Step 1: KineticTextModal.jsx
```jsx
// Pattern: template list → params form → preview → onInsert(html)
const TEMPLATES = [
  { id: 'typewriter', name: 'Typewriter', desc: 'Characters appear one at a time' },
  { id: 'word-reveal', name: 'Word Reveal', desc: 'Words fade and slide in' },
  { id: 'revolve', name: 'Revolve', desc: '3D rotation around Y-axis' },
  { id: 'wave', name: 'Wave', desc: 'Letters undulate in sine wave' },
  { id: 'split-flap', name: 'Split-Flap', desc: 'Airport flip effect' },
  { id: 'fade-cascade', name: 'Fade Cascade', desc: 'Letters fade with delay' },
  { id: 'circular', name: 'Circular', desc: 'Text on rotating circle' },
  { id: 'glitch', name: 'Glitch', desc: 'Digital glitch effect' },
  { id: 'bounce', name: 'Bounce', desc: 'Letters drop with spring' },
  { id: 'stagger-center', name: 'Stagger Center', desc: 'Spread from center' },
  { id: 'custom', name: 'Custom Code', desc: 'Write your own' },
]
```
Parameters: text, font, font size, bold/italic/underline, color, animation speed, custom code (for custom template)

### Step 2: MathGridModal.jsx
```jsx
const PRESETS = [
  { name: 'Cartesian', xExpr: 'u', yExpr: 'v', ... },
  { name: 'Polar', xExpr: 'u*cos(v)', yExpr: 'u*sin(v)', ... },
  // ... 10 presets
]
```
Parameters: x expression, y expression, u range, v range, u divisions, v divisions, color, grid style

### Step 3: AnimeModal.jsx
```jsx
const TEMPLATES = [
  { id: 'scatter-dots', name: 'Scatter Dots', ... },
  // ... 12 templates including custom
]
```
Parameters: color, background, speed, custom code

### Step 4: ThreeModal.jsx
```jsx
const TEMPLATES = [
  { id: 'rotating-cube', name: 'Rotating Cube', ... },
  // ... 9 templates including custom
]
```
Parameters: color, background, speed, custom code

### Step 5: Toolbar integration
Add to insert menu under "Embed" section:
```jsx
<button onClick={onAddKineticText}>Kinetic Text</button>
<button onClick={onAddMathGrid}>Math Grid</button>
<button onClick={onAddAnime}>Anime.js</button>
<button onClick={onAddThree}>Three.js</button>
```

### Step 6: EditorPage handlers
Each handler opens the corresponding modal. Modal's `onInsert` callback creates an `html` element with the generated HTML content:
```js
const handleAddKineticText = () => setShowKineticTextModal(true)
// Modal onInsert:
const insertKineticText = (html) => {
  const newElement = {
    id: crypto.randomUUID(),
    type: 'html',
    content: html,
    x: 100, y: 100, width: 600, height: 400,
    zIndex: 2,
  }
  // add to current slide
}
```

---

## Tests

### Unit Tests
```js
// client/src/components/KineticTextModal.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import KineticTextModal from './KineticTextModal'

describe('KineticTextModal', () => {
  it('renders all template options', () => {
    render(<KineticTextModal onInsert={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Typewriter')).toBeTruthy()
    expect(screen.getByText('Glitch')).toBeTruthy()
    expect(screen.getByText('Custom Code')).toBeTruthy()
  })

  it('generates HTML on insert', () => {
    const onInsert = vi.fn()
    render(<KineticTextModal onInsert={onInsert} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Typewriter'))
    fireEvent.change(screen.getByPlaceholderText(/text/i), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByText(/insert/i))
    expect(onInsert).toHaveBeenCalledWith(expect.stringContaining('<!DOCTYPE html>'))
  })

  it('allows custom code editing', () => {
    render(<KineticTextModal onInsert={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Custom Code'))
    expect(screen.getByRole('textbox')).toBeTruthy()
  })
})
```

```js
// client/src/components/MathGridModal.test.jsx
// Similar structure — verify presets render, expressions compile, insert generates HTML
```

```js
// client/src/components/AnimeModal.test.jsx
// Verify 12 templates listed, params generate HTML, custom code option works
```

```js
// client/src/components/ThreeModal.test.jsx
// Verify 9 templates listed, Three.js CDN in generated HTML
```

### Integration Test
1. Insert Kinetic Text → select Typewriter → enter "Hello World" → verify animation in editor
2. Insert Math Grid → select Polar → verify grid renders
3. Insert Anime → select Fireworks → verify particle animation
4. Insert Three.js → select Rotating Cube → verify 3D cube rotates
5. Export to HTML → verify all 4 element types render in present mode
6. Edit custom code for each type → verify custom HTML renders

---

## Success Criteria

- [x] Kinetic Text selector created with 10 templates, under 200 LOC
- [x] Math Grid selector created with 10 presets, under 200 LOC
- [x] Anime.js selector created with 12 templates/options, under 200 LOC
- [x] Three.js selector created with 9 templates/options, under 200 LOC
- [x] All 4 accessible from Toolbar/Insert flow
- [x] All insert as `html` element type
- [x] Export HTML includes all 4 types
- [x] Unit tests pass for all 4 modals
- [x] `npm run build` succeeds
