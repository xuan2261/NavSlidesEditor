import { render, fireEvent, cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShapeRenderer } from './shape-element-renderer'
import { geometryProjectionFixture } from '../../../../../tests/pptx-semantic/geometry-projection-fixture'

afterEach(cleanup)
function geometryScreenMatrix() {
  const previous = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getScreenCTM')
  Object.defineProperty(SVGElement.prototype, 'getScreenCTM', {
    configurable: true,
    value: () => ({ a: -2, b: 0, c: 1, d: 3, e: 50, f: 60 }),
  })
  return () => {
    if (previous) Object.defineProperty(SVGElement.prototype, 'getScreenCTM', previous)
    else delete SVGElement.prototype.getScreenCTM
  }
}
function pointerCapture(element) {
  const captured = new Set()
  element.setPointerCapture = vi.fn((id) => captured.add(id))
  element.hasPointerCapture = (id) => captured.has(id)
  element.releasePointerCapture = vi.fn((id) => captured.delete(id))
}

describe('ShapeRenderer', () => {
  it('renders a source-bound image fill on editable geometry with the immutable asset supplied separately', () => {
    const geometry = structuredClone(
      geometryProjectionFixture().pptxSemantic.definitions.definition.content.geometry
    )
    geometry.style = {
      fill: { blip: { bindingId: 'imageBinding', stretch: {} } },
      stroke: { color: { kind: 'none' } },
    }
    const before = JSON.stringify(geometry)
    const { container } = render(
      <ShapeRenderer
        element={{
          id: 'i1',
          type: 'shape',
          pptxInstanceId: 'i1',
          width: 100,
          height: 80,
          fill: '#ffffff',
          stroke: 'none',
          strokeWidth: 0,
          pptxGeometry: geometry,
          pptxBlipAsset: { src: '/uploads/source.png', width: 32, height: 24, format: 'png' },
          pptxOccurrenceMatrix: [1, 0, 0, 1, 952500, 952500],
        }}
        isSelected={true}
      />
    )
    expect(container.querySelector('image').getAttribute('href')).toBe('/uploads/source.png')
    expect(container.querySelector('[data-pptx-geometry-path]')).toBeTruthy()
    expect(JSON.stringify(geometry)).toBe(before)
  })
  it('moves a collapsed-grid point through shape-local displacement without losing its guide or source bounds', () => {
    const restore = geometryScreenMatrix()
    try {
      const onUpdate = vi.fn()
      const geometry = {
        schemaVersion: 1,
        kind: 'custom',
        componentId: 'geometry',
        width: 0,
        height: 80,
        paths: [
          {
            componentId: 'path',
            width: 100,
            height: 80,
            fill: 'none',
            stroke: true,
            commands: [
              { kind: 'moveTo', points: [{ componentId: 'start', x: 0, y: 0 }] },
              {
                kind: 'lnTo',
                points: [{ componentId: 'end', x: 50, y: 'h', localOffset: { x: 95250, y: 0 } }],
              },
            ],
          },
        ],
      }
      const before = JSON.stringify(geometry)
      render(
        <ShapeRenderer
          element={{
            id: 'i1',
            type: 'shape',
            pptxInstanceId: 'i1',
            width: 0,
            height: 80,
            fill: '#ffffff',
            stroke: '#123456',
            strokeWidth: 2,
            pptxGeometry: geometry,
          }}
          isSelected={true}
          geometryPointEditing={true}
          onUpdateElement={onUpdate}
        />
      )
      const handle = screen.getByLabelText('Move geometry point 2')
      expect(handle.closest('[data-geometry-point]').getAttribute('transform')).toBe(
        'translate(10 80)'
      )
      pointerCapture(handle)
      fireEvent.pointerDown(handle, { pointerId: 8, button: 0, clientX: 110, clientY: 300 })
      fireEvent.pointerMove(handle, { pointerId: 8, clientX: 90, clientY: 300 })
      fireEvent.pointerUp(handle, { pointerId: 8, clientX: 90, clientY: 300 })
      expect(onUpdate).toHaveBeenCalledExactlyOnceWith('i1', {
        pptxProjectionOperation: {
          type: 'geometry.edit',
          instanceId: 'i1',
          componentId: 'geometry',
          command: { type: 'control-point', componentId: 'end', localOffset: { x: 190500, y: 0 } },
        },
      })
      expect(JSON.stringify(geometry)).toBe(before)
    } finally {
      restore()
    }
  })
  it.each([
    [0, 80, 0, 762000],
    [100, 0, 952500, 0],
  ])(
    'renders a positive SVG viewport without changing zero authored %i x %i bounds',
    (width, height, nativeWidth, nativeHeight) => {
      const element = {
        id: 'zero-leaf',
        type: 'shape',
        width,
        height,
        fill: '#ffffff',
        stroke: '#123456',
        strokeWidth: 2,
        pptxGeometry: {
          schemaVersion: 1,
          kind: 'custom',
          componentId: 'geometry',
          width: nativeWidth,
          height: nativeHeight,
          paths: [
            {
              componentId: 'path',
              fill: 'none',
              stroke: true,
              commands: [
                { kind: 'moveTo', points: [{ componentId: 'start', x: 0, y: 0 }] },
                { kind: 'lnTo', points: [{ componentId: 'end', x: 'w', y: 'h' }] },
              ],
            },
          ],
        },
      }
      const before = JSON.stringify(element)
      const { container } = render(<ShapeRenderer element={element} />)
      const svg = container.querySelector('svg')
      expect(svg.getAttribute('width')).toBe(String(Math.max(1, width)))
      expect(svg.getAttribute('height')).toBe(String(Math.max(1, height)))
      expect(svg.getAttribute('viewBox')).toBe(`0 0 ${Math.max(1, width)} ${Math.max(1, height)}`)
      expect(svg.innerHTML).not.toMatch(/NaN|Infinity/)
      expect(JSON.stringify(element)).toBe(before)
    }
  )
  it('previews and commits a reflected/skewed control-point drag in canonical local coordinates once', () => {
    const restore = geometryScreenMatrix()
    try {
      const deck = geometryProjectionFixture(),
        onUpdate = vi.fn(),
        parentDown = vi.fn()
      const geometry = deck.pptxSemantic.definitions.definition.content.geometry
      const source = JSON.stringify(geometry)
      const { container } = render(
        <div onPointerDown={parentDown}>
          <ShapeRenderer
            element={{ ...deck.slides[0].elements[0], pptxGeometry: geometry }}
            isSelected={true}
            geometryPointEditing={true}
            onUpdateElement={onUpdate}
          />
        </div>
      )
      const handle = screen.getByLabelText('Move geometry point 2')
      expect(handle).toBeTruthy()
      pointerCapture(handle)
      fireEvent.pointerDown(handle, { pointerId: 8, button: 0, clientX: 10, clientY: 90 })
      fireEvent.pointerMove(handle, { pointerId: 8, clientX: -29, clientY: 171 })
      expect(container.querySelector('path[data-pptx-geometry-path]').getAttribute('d')).toContain(
        'C 58 37'
      )
      expect(onUpdate).not.toHaveBeenCalled()
      expect(parentDown).not.toHaveBeenCalled()
      fireEvent.pointerUp(handle, { pointerId: 8, clientX: -29, clientY: 171 })
      expect(onUpdate).toHaveBeenCalledExactlyOnceWith('i1', {
        pptxProjectionOperation: {
          type: 'geometry.edit',
          instanceId: 'i1',
          componentId: 'geometry',
          command: { type: 'control-point', componentId: 'control', x: 58, y: 37 },
        },
      })
      expect(JSON.stringify(geometry)).toBe(source)
      fireEvent.lostPointerCapture(handle, { pointerId: 8 })
      expect(onUpdate).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })
  it('cancels a point gesture without persistence and supports keyboard point movement', () => {
    const restore = geometryScreenMatrix()
    try {
      const deck = geometryProjectionFixture(),
        onUpdate = vi.fn()
      const geometry = deck.pptxSemantic.definitions.definition.content.geometry
      const { container } = render(
        <ShapeRenderer
          element={{ ...deck.slides[0].elements[0], pptxGeometry: geometry }}
          isSelected={true}
          geometryPointEditing={true}
          onUpdateElement={onUpdate}
        />
      )
      const handle = screen.getByLabelText('Move geometry point 2')
      pointerCapture(handle)
      fireEvent.pointerDown(handle, { pointerId: 8, button: 0, clientX: 10, clientY: 90 })
      fireEvent.pointerMove(handle, { pointerId: 8, clientX: -29, clientY: 171 })
      fireEvent.keyDown(handle, { key: 'Escape' })
      expect(onUpdate).not.toHaveBeenCalled()
      expect(container.querySelector('path[data-pptx-geometry-path]').getAttribute('d')).toContain(
        'C 25 10'
      )
      fireEvent.keyDown(handle, { key: 'ArrowRight' })
      expect(onUpdate).toHaveBeenCalledExactlyOnceWith('i1', {
        pptxProjectionOperation: {
          type: 'geometry.edit',
          instanceId: 'i1',
          componentId: 'geometry',
          command: { type: 'control-point', componentId: 'control', x: 26 },
        },
      })
    } finally {
      restore()
    }
  })
  it('renders canonical custom curves instead of a preset alias while retaining separate rich text', () => {
    const geometry = {
      schemaVersion: 1,
      componentId: 'geometry',
      kind: 'custom',
      width: 100,
      height: 80,
      paths: [
        {
          componentId: 'path',
          commands: [
            { kind: 'moveTo', points: [{ componentId: 'start', x: 0, y: 0 }] },
            {
              kind: 'cubicBezTo',
              points: [
                { componentId: 'a', x: 25, y: 10 },
                { componentId: 'b', x: 60, y: 50 },
                { componentId: 'end', x: 100, y: 80 },
              ],
            },
            { kind: 'close' },
          ],
        },
      ],
    }
    const { container } = render(
      <ShapeRenderer
        element={{
          shape: 'rect',
          width: 200,
          height: 160,
          fill: '#123456',
          stroke: '#234567',
          strokeWidth: 2,
          pptxGeometry: geometry,
          textHtml: '<strong>Label</strong>',
        }}
      />
    )
    const path = container.querySelector('path[data-pptx-geometry-path="path"]')
    expect(path.getAttribute('d')).toBe('M 0 0 C 25 10 60 50 100 80 Z')
    expect(path.getAttribute('transform')).toBe('matrix(2 0 0 2 0 0)')
    expect(container.querySelector('rect')).toBeNull()
    expect(container.querySelector('foreignObject strong').textContent).toBe('Label')
  })
  it('renders sanitized rich shape text when textHtml is present', () => {
    const { container } = render(
      <ShapeRenderer
        element={{
          shape: 'rect',
          width: 160,
          height: 80,
          fill: '#ffffff',
          text: 'Bold rest',
          textHtml:
            '<strong>Bold</strong> <span style="color:#112233;font-size:18pt;background-image:url(javascript:bad)">rest</span><script>bad()</script>',
        }}
      />
    )

    expect(container.querySelector('foreignObject')).toBeTruthy()
    expect(container.innerHTML).toContain('<strong>Bold</strong>')
    expect(container.innerHTML).toContain('color: #112233')
    expect(container.innerHTML).toContain('font-size: 24px')
    expect(container.innerHTML).not.toContain('background-image')
    expect(container.innerHTML).not.toContain('<script')
  })

  it('applies imported text insets to rich shape text content', () => {
    const { container } = render(
      <ShapeRenderer
        element={{
          shape: 'rect',
          width: 160,
          height: 80,
          textHtml: '<span>Inset</span>',
          _pptxImportMeta: {
            textInsets: { left: 10, right: 11, top: 5, bottom: 6 },
            textInsetsUnit: 'px',
          },
        }}
      />
    )

    const textContent = container.querySelector('foreignObject div')
    expect(textContent.style.paddingLeft).toBe('10px')
    expect(textContent.style.paddingRight).toBe('11px')
    expect(textContent.style.paddingTop).toBe('5px')
    expect(textContent.style.paddingBottom).toBe('6px')
  })

  it('converts legacy unmarked shape text insets from pt to px', () => {
    const { container } = render(
      <ShapeRenderer
        element={{
          shape: 'rect',
          width: 160,
          height: 80,
          textHtml: '<span>Legacy inset</span>',
          _pptxImportMeta: {
            textInsets: { left: 7.2, right: 7.2, top: 3.6, bottom: 3.6 },
          },
        }}
      />
    )

    const textContent = container.querySelector('foreignObject div')
    expect(textContent.style.paddingLeft).toBe('9.6px')
    expect(textContent.style.paddingTop).toBe('4.8px')
  })

  it('applies wrap-safe layout to imported rich shape text', () => {
    const { container } = render(
      <ShapeRenderer
        element={{
          shape: 'rect',
          width: 160,
          height: 80,
          textHtml: '<span>Long Vietnamese shape text</span>',
          _pptxImportMeta: { textFit: 'wrap', version: 1 },
        }}
      />
    )

    const textContent = container.querySelector('foreignObject div')
    expect(textContent.style.overflowWrap).toBe('anywhere')
    expect(textContent.style.whiteSpace).toBe('pre-wrap')
    expect(textContent.style.wordBreak).toBe('normal')
  })

  it('does not emit negative rect dimensions when stroke exceeds shape size', () => {
    const { container } = render(
      <ShapeRenderer
        element={{
          shape: 'rect',
          width: 3,
          height: 3,
          strokeWidth: 8,
          fill: '#ffffff',
          stroke: '#000000',
        }}
      />
    )

    const rect = container.querySelector('rect')
    expect(Number(rect.getAttribute('width'))).toBeGreaterThanOrEqual(0)
    expect(Number(rect.getAttribute('height'))).toBeGreaterThanOrEqual(0)
  })

  it('renders an imported gradient fill as an SVG linearGradient', () => {
    const { container } = render(
      <ShapeRenderer
        element={{
          id: 'shape-9',
          shape: 'rect',
          width: 200,
          height: 100,
          fill: 'gradient',
          fillGradient: {
            type: 'gradient',
            angle: 90,
            stops: [
              { offset: 0, color: '#ffffff' },
              { offset: 1, color: '#000000' },
            ],
          },
        }}
      />
    )

    const gradient = container.querySelector('linearGradient')
    expect(gradient).toBeTruthy()
    expect(container.querySelectorAll('linearGradient stop').length).toBe(2)
    const filledGroup = container.querySelector('g')
    expect(filledGroup.getAttribute('fill')).toMatch(/^url\(#.*shape-9.*\)$/)
    expect(container.innerHTML).not.toContain('fill="gradient"')
  })
})
