import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LineArrowRenderer } from './line-element-renderer'

const baseLine = {
  type: 'line',
  width: 100,
  height: 20,
  stroke: '#ffffff',
  strokeWidth: 2,
  arrowStart: 'diamond',
  arrowEnd: 'arrow',
}

describe('line element renderer', () => {
  it('uses full element ids for DOM-safe marker identity', () => {
    const { container } = render(
      <div>
        <LineArrowRenderer element={{ ...baseLine, id: 'abcdefgh-1<script>' }} />
        <LineArrowRenderer element={{ ...baseLine, id: 'abcdefgh-2<script>' }} />
      </div>
    )

    const markerIds = [...container.querySelectorAll('marker')].map((marker) => marker.id)

    expect(new Set(markerIds).size).toBe(markerIds.length)
    expect(markerIds.every((id) => /^m[se]-l[a-z0-9]+$/.test(id))).toBe(true)
    expect(markerIds.some((id) => id.startsWith('ms-'))).toBe(true)
    expect(markerIds.some((id) => id.startsWith('me-'))).toBe(true)
  })

  it('renders resolved attached endpoints without changing curves or markers', () => {
    const { container } = render(
      <LineArrowRenderer
        element={{ ...baseLine, id: 'attached', x1: 24, y1: 30, x2: 88, y2: 10, cx: 50, cy: 0 }}
      />
    )

    expect(container.querySelector('path').getAttribute('d')).toBe('M 24 30 Q 50 0 88 10')
    expect(container.querySelector('path').getAttribute('marker-start')).toContain('ms-l')
    expect(container.querySelector('path').getAttribute('marker-end')).toContain('me-l')
  })
})
