import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PropertiesPanel from '../PropertiesPanel'
import FormatTabContent from '../ribbon/ribbon-format-tab-element-position-size-rotation-controls'
import {
  buildSelectionUpdates,
  normalizeRotation,
} from '../../utils/element-update-fanout'
import { invalidatePptxFitMetaForUpdates } from '../../utils/pptx-import-meta'

/**
 * A property/geometry edit made with several elements selected must mutate ALL
 * of them, not just the last one clicked. These cover the shared fan-out rules
 * and prove the real panel/ribbon controls route through them.
 */

const shapes = [
  { id: 'a', type: 'shape', x: 0, y: 0, width: 100, height: 50, fill: '#111111', opacity: 1, rotation: 0 },
  { id: 'b', type: 'shape', x: 200, y: 100, width: 80, height: 40, fill: '#222222', opacity: 1, rotation: 0 },
  { id: 'c', type: 'shape', x: 400, y: 300, width: 60, height: 30, fill: '#333333', opacity: 1, rotation: 0 },
]
const ids = ['a', 'b', 'c']

describe('selection fan-out helper', () => {
  it('broadcasts a style edit to every selected element', () => {
    const out = buildSelectionUpdates(shapes, ids, 'c', { fill: '#ff0000' })
    expect(out).toHaveLength(3)
    expect(out.every((u) => u.fill === '#ff0000')).toBe(true)
    expect(out.map((u) => u.id)).toEqual(['a', 'b', 'c'])
  })

  it('shifts X/Y by the primary delta so relative layout survives', () => {
    // Primary is the last id 'c' (x=400). Setting X=450 → delta +50 to all.
    const out = buildSelectionUpdates(shapes, ids, 'c', { x: 450 })
    expect(out.find((u) => u.id === 'a').x).toBe(50)
    expect(out.find((u) => u.id === 'b').x).toBe(250)
    expect(out.find((u) => u.id === 'c').x).toBe(450)
    // Not all collapsed onto 450.
    expect(out.map((u) => u.x)).not.toEqual([450, 450, 450])
  })

  it('applies W/H as the same absolute value but leaves x/y untouched', () => {
    const out = buildSelectionUpdates(shapes, ids, 'c', { width: 200 })
    expect(out.every((u) => u.width === 200)).toBe(true)
    expect(out.every((u) => !('x' in u))).toBe(true)
  })

  it('covers the grouped-click case: a delta keeps members apart, never stacked', () => {
    // Clicking one grouped element selects the whole group; an absolute X would
    // collapse them. Delta preserves the gaps between members.
    const out = buildSelectionUpdates(shapes, ids, 'a', { x: 25 })
    // Primary 'a' moves 0→25 (delta +25); the others shift by the same delta.
    expect(out.find((u) => u.id === 'a').x).toBe(25)
    expect(out.find((u) => u.id === 'b').x).toBe(225)
    expect(out.find((u) => u.id === 'c').x).toBe(425)
  })

  it('floors W/H at the minimum element size', () => {
    const out = buildSelectionUpdates(shapes, ids, 'c', { width: 5 })
    expect(out.every((u) => u.width === 40)).toBe(true)
  })

  it('normalizes rotation for every element (450 → 90, -30 → 330)', () => {
    expect(buildSelectionUpdates(shapes, ids, 'c', { rotation: 450 }).every((u) => u.rotation === 90)).toBe(true)
    expect(buildSelectionUpdates(shapes, ids, 'c', { rotation: -30 }).every((u) => u.rotation === 330)).toBe(true)
  })
})

describe('mixed-type selection gating', () => {
  // image carries no fontSize (shapes do — they own a text label), so it is the
  // honest non-owner for proving a text-only prop never leaks across types.
  const mixed = [
    { id: 't', type: 'text', x: 0, y: 0, width: 100, height: 50, fontSize: 16, opacity: 1 },
    { id: 's', type: 'image', x: 50, y: 50, width: 80, height: 40, src: '', opacity: 1 },
  ]
  const mixedIds = ['t', 's']

  it('routes a text-only prop solely to the owning element', () => {
    const out = buildSelectionUpdates(mixed, mixedIds, 's', { fontSize: 32 })
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('t')
    expect(out[0].fontSize).toBe(32)
  })

  it('broadcasts opacity to both elements regardless of type', () => {
    const out = buildSelectionUpdates(mixed, mixedIds, 's', { opacity: 0.5 })
    expect(out).toHaveLength(2)
    expect(out.every((u) => u.opacity === 0.5)).toBe(true)
  })

  it('does not pollute pptx-fit meta on a non-owning element', () => {
    // An image carrying import meta must not be handed a fontSize patch, so its
    // fit meta stays intact.
    const imageWithMeta = { ...mixed[1], _pptxImportMeta: { fitFontSizePx: 18, textLength: 5 } }
    const out = buildSelectionUpdates([mixed[0], imageWithMeta], mixedIds, 's', { fontSize: 32 })
    expect(out.find((u) => u.id === 's')).toBeUndefined()
    // Meta is only stripped when a fit-invalidating key reaches the element;
    // since it gets no patch, invalidation never fires for it.
    const wouldInvalidate = invalidatePptxFitMetaForUpdates(imageWithMeta, {})
    expect(wouldInvalidate._pptxImportMeta).toBeUndefined()
  })
})

describe('rotation normalization is shared', () => {
  it('wraps positive overflow and negative angles into 0–359', () => {
    expect(normalizeRotation(450)).toBe(90)
    expect(normalizeRotation(-30)).toBe(330)
    expect(normalizeRotation(0)).toBe(0)
    expect(normalizeRotation(359)).toBe(359)
  })
})

/**
 * Call-site proof: render the real panel and ribbon with three elements
 * selected, fire a genuine change event, and assert all three mutate. A helper
 * test alone would not prove the controls are wired through the fan-out path.
 */
function FanoutHarness({ children, primaryId }) {
  const [elements, setElements] = useState(shapes.map((s) => ({ ...s })))
  const apply = (updates) => {
    setElements((prev) => {
      const batch = buildSelectionUpdates(prev, ids, primaryId, updates)
      const map = new Map(batch.map((u) => [u.id, u]))
      return prev.map((el) => (map.has(el.id) ? { ...el, ...map.get(el.id) } : el))
    })
  }
  return children({ elements, apply })
}

describe('PropertiesPanel routes edits through the selection fan-out', () => {
  it('a fill change mutates every selected element', () => {
    let latest = []
    render(
      <FanoutHarness primaryId="c">
        {({ elements, apply }) => {
          latest = elements
          return (
            <PropertiesPanel
              slide={{ id: 's1', elements }}
              selectedElement={elements[elements.length - 1]}
              selectedElementIds={ids}
              onUpdateElement={(idOrUpdates, maybeUpdates) =>
                maybeUpdates ? undefined : apply(idOrUpdates)
              }
              onBringForward={() => {}}
              onSendBackward={() => {}}
              onDeleteElement={() => {}}
            />
          )
        }}
      </FanoutHarness>
    )

    fireEvent.change(screen.getByTestId('prop-shape-fill'), { target: { value: '#00ff00' } })
    expect(latest.map((el) => el.fill)).toEqual(['#00ff00', '#00ff00', '#00ff00'])
  })
})

describe('Format ribbon routes edits through the selection fan-out', () => {
  it('an X edit shifts every selected element by the same delta', () => {
    let latest = []
    render(
      <FanoutHarness primaryId="c">
        {({ elements, apply }) => {
          latest = elements
          return (
            <FormatTabContent
              selectedElement={elements[elements.length - 1]}
              onUpdateElement={apply}
            />
          )
        }}
      </FanoutHarness>
    )

    // Primary 'c' is at x=400; entering 450 adds +50 to all.
    fireEvent.change(screen.getByLabelText('X position'), { target: { value: '450' } })
    expect(latest.map((el) => el.x)).toEqual([50, 250, 450])
  })

  it('[cap:control.format.position depth:persistence] serializes geometry updates without dropping fields', () => {
    const state = { slides: [{ id: 's1', elements: shapes.map((s) => ({ ...s })) }] }
    const batch = buildSelectionUpdates(state.slides[0].elements, ids, 'c', {
      x: 450,
      y: 350,
      width: 120,
      height: 80,
      rotation: 450,
    })
    const map = new Map(batch.map((u) => [u.id, u]))
    const next = {
      ...state,
      slides: state.slides.map((slide) => ({
        ...slide,
        elements: slide.elements.map((el) => (map.has(el.id) ? { ...el, ...map.get(el.id) } : el)),
      })),
    }

    const restored = JSON.parse(JSON.stringify(next))
    const updated = restored.slides[0].elements.find((el) => el.id === 'c')
    expect(updated).toMatchObject({
      x: 450,
      y: 350,
      width: 120,
      height: 80,
      rotation: 90,
    })
  })
})

describe('numeric entry agrees between panel and ribbon', () => {
  it('ribbon X accepts a negative value', () => {
    const onUpdateElement = vi.fn()
    render(
      <FormatTabContent
        selectedElement={{ id: 'x', type: 'shape', x: 10, y: 0, width: 100, height: 50, rotation: 0 }}
        onUpdateElement={onUpdateElement}
      />
    )
    fireEvent.change(screen.getByLabelText('X position'), { target: { value: '-40' } })
    expect(onUpdateElement).toHaveBeenCalledWith({ x: -40 })
  })

  it('ribbon rotation wraps like the panel (450 → 90, -30 → 330)', () => {
    const onUpdateElement = vi.fn()
    render(
      <FormatTabContent
        selectedElement={{ id: 'x', type: 'shape', x: 0, y: 0, width: 100, height: 50, rotation: 0 }}
        onUpdateElement={onUpdateElement}
      />
    )
    fireEvent.change(screen.getByLabelText('Rotation degrees'), { target: { value: '450' } })
    expect(onUpdateElement).toHaveBeenLastCalledWith({ rotation: 90 })
    fireEvent.change(screen.getByLabelText('Rotation degrees'), { target: { value: '-30' } })
    expect(onUpdateElement).toHaveBeenLastCalledWith({ rotation: 330 })
  })
})

describe('single-selection edits are not regressed', () => {
  it('a one-element selection still receives the raw value', () => {
    const single = [{ id: 'only', type: 'shape', x: 10, y: 10, width: 100, height: 50, fill: '#000' }]
    const out = buildSelectionUpdates(single, ['only'], 'only', { fill: '#abcdef' })
    expect(out).toEqual([{ id: 'only', fill: '#abcdef' }])
  })

  it('a single X edit is a no-op delta on its own element (absolute result)', () => {
    const single = [{ id: 'only', type: 'shape', x: 10, y: 10, width: 100, height: 50 }]
    const out = buildSelectionUpdates(single, ['only'], 'only', { x: 75 })
    expect(out).toEqual([{ id: 'only', x: 75 }])
  })
})
