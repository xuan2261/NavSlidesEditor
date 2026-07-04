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
})
