import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IconRenderer } from './icon-element-renderer'
import { LineArrowRenderer } from './line-element-renderer'
import { DrawingRenderer } from './drawing-element-renderer'
import { CalloutRenderer } from './callout-element-renderer'
import { ShapeRenderer } from './shape-element-renderer'
import TimelineElement from '../../timeline-element'

const ICON_PATHS = { Star: '<path d="M12 2l3 7h7l-6 4 2 7-6-4-6 4 2-7-6-4h7z" />' }

// `'auto'` must never reach the DOM as a literal color; it should resolve to a
// real color token (var(--ns-*)). Explicit colors must pass through unchanged.
describe('auto color sentinel resolution in canvas renderers', () => {
  it('icon: auto iconColor resolves to a token var, not literal "auto"', () => {
    const { container } = render(
      <IconRenderer element={{ iconColor: 'auto', iconName: 'Star' }} iconPaths={ICON_PATHS} />
    )
    const svg = container.querySelector('svg')
    expect(svg.getAttribute('stroke')).not.toBe('auto')
    expect(container.innerHTML).not.toContain('"auto"')
    expect(svg.getAttribute('stroke')).toContain('var(--ns-')
  })

  it('icon: explicit iconColor is preserved exactly', () => {
    const { container } = render(
      <IconRenderer element={{ iconColor: '#ff0000', iconName: 'Star' }} iconPaths={ICON_PATHS} />
    )
    expect(container.querySelector('svg').getAttribute('stroke')).toBe('#ff0000')
  })

  it('line: auto stroke resolves, explicit preserved', () => {
    const { container: autoC } = render(
      <LineArrowRenderer element={{ id: 'l1', width: 100, height: 50, stroke: 'auto' }} />
    )
    const path = autoC.querySelector('path')
    expect(path.getAttribute('stroke')).not.toBe('auto')
    expect(path.getAttribute('stroke')).toContain('var(--ns-')

    const { container: hexC } = render(
      <LineArrowRenderer element={{ id: 'l2', width: 100, height: 50, stroke: '#00ff00' }} />
    )
    expect(hexC.querySelector('path').getAttribute('stroke')).toBe('#00ff00')
  })

  it('drawing: auto strokeColor resolves, explicit preserved', () => {
    const { container: autoC } = render(
      <DrawingRenderer
        element={{ width: 100, height: 50, strokeColor: 'auto', paths: [{ d: 'M0 0 L10 10' }] }}
      />
    )
    expect(autoC.querySelector('path').getAttribute('stroke')).toContain('var(--ns-')

    const { container: hexC } = render(
      <DrawingRenderer
        element={{ width: 100, height: 50, strokeColor: '#123456', paths: [{ d: 'M0 0 L10 10' }] }}
      />
    )
    expect(hexC.querySelector('path').getAttribute('stroke')).toBe('#123456')
  })

  it('callout: auto calloutTextColor resolves, explicit preserved', () => {
    const { container: autoC } = render(
      <CalloutRenderer element={{ calloutTextColor: 'auto', calloutNumber: 3 }} />
    )
    const div = autoC.firstChild
    // jsdom's CSS parser drops `var(--ns-*)` from an HTML element's color
    // property (it validates color syntax), so we assert the literal 'auto'
    // sentinel never reaches the DOM rather than the resolved var() string.
    expect(div.style.color).not.toBe('auto')
    expect(autoC.innerHTML).not.toContain('auto')

    const { container: hexC } = render(
      <CalloutRenderer element={{ calloutTextColor: 'rgb(1, 2, 3)', calloutNumber: 3 }} />
    )
    expect(hexC.firstChild.style.color).toBe('rgb(1, 2, 3)')
  })

  it('timeline: auto lineColor/dotColor/textColor resolve, explicit preserved', () => {
    const { container: autoC } = render(
      <TimelineElement
        element={{
          width: 400,
          height: 200,
          timelineStart: '2000',
          timelineEnd: '2020',
          lineColor: 'auto',
          dotColor: 'auto',
          textColor: 'auto',
          events: [{ id: 't1', date: '2010', title: 'X' }],
        }}
      />
    )
    const line = autoC.querySelector('[data-testid="timeline-line"]')
    expect(line.getAttribute('stroke')).toContain('var(--ns-')

    const { container: hexC } = render(
      <TimelineElement
        element={{
          width: 400,
          height: 200,
          timelineStart: '2000',
          timelineEnd: '2020',
          lineColor: '#abcdef',
          events: [],
        }}
      />
    )
    expect(hexC.querySelector('[data-testid="timeline-line"]').getAttribute('stroke')).toBe('#abcdef')
  })

  it('shape: a hexagon produces polygon/path geometry, not a plain rect', () => {
    const { container } = render(
      <ShapeRenderer element={{ shape: 'hexagon', width: 200, height: 100, fill: '#6366f1' }} />
    )
    const hasPoly = container.querySelector('polygon') || container.querySelector('path')
    expect(hasPoly).toBeTruthy()
    // hexagon should NOT fall through to the default <rect>
    expect(container.querySelector('rect')).toBeFalsy()
  })

  it('shape: all 7 previously-missing shapes render non-rect geometry', () => {
    for (const shape of ['hexagon', 'pentagon', 'cloud', 'cylinder', 'parallelogram', 'trapezoid', 'bracket']) {
      const { container } = render(
        <ShapeRenderer element={{ shape, width: 200, height: 100, fill: '#6366f1' }} />
      )
      const geom = container.querySelector('polygon') || container.querySelector('path')
      expect(geom, `shape "${shape}" should render polygon/path geometry`).toBeTruthy()
      expect(container.querySelector('rect'), `shape "${shape}" must not fall through to <rect>`).toBeFalsy()
    }
  })
})
