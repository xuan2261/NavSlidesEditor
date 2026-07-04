import { describe, expect, it } from 'vitest'
import { renderElement } from '../src/element-renderers.js'

const baseLine = {
  id: 'line-export',
  type: 'line',
  x: 10,
  y: 20,
  width: 200,
  height: 40,
  stroke: '#ff0000',
  strokeWidth: 12,
  arrowStart: 'arrow',
  arrowEnd: 'arrow',
}

describe('line export clipping', () => {
  it('renders line wrappers with visible overflow and marker-safe svg padding', () => {
    const html = renderElement(baseLine, {}, {})

    expect(html).toContain('overflow:visible')
    expect(html).toContain('marker-start=')
    expect(html).toContain('marker-end=')
    expect(html).toContain('viewBox="-72 -72 344 184"')
    expect(html).toContain('left:-72px;top:-72px')
  })

  it('keeps line overflow visible for print/offline shared render path', () => {
    const html = renderElement({ ...baseLine, rotation: 30 }, {}, { forPrint: true })

    expect(html).toContain('transform:rotate(30deg)')
    expect(html).toContain('overflow:visible')
    expect(html).toContain('marker-end=')
  })
})
