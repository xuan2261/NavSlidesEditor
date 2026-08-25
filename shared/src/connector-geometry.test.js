import { describe, expect, it } from 'vitest'
import geometry from './connector-geometry.js'

const {
  CONNECTOR_ANCHORS,
  getConnectorAnchorPoint,
  normalizeSlideConnectorConnections,
  resolveConnectorGeometry,
} = geometry

const target = { id: 'target', type: 'shape', x: 100, y: 50, width: 80, height: 40 }
const line = {
  id: 'line', type: 'line', x: 10, y: 20, width: 300, height: 100,
  x1: 0, y1: 50, x2: 300, y2: 50,
  connections: { start: { targetId: 'target', anchor: 'center' } },
}

describe('connector geometry', () => {
  it('resolves each named rectangular anchor, including rotation', () => {
    const expected = {
      center: [140, 70], n: [140, 50], ne: [180, 50], e: [180, 70], se: [180, 90],
      s: [140, 90], sw: [100, 90], w: [100, 70], nw: [100, 50],
    }
    for (const anchor of CONNECTOR_ANCHORS) {
      expect(getConnectorAnchorPoint(target, anchor)).toEqual({ x: expected[anchor][0], y: expected[anchor][1] })
    }
    expect(getConnectorAnchorPoint({ ...target, rotation: 90 }, 'n')).toEqual({ x: 160, y: 70 })
  })

  it('[cap:connector.smart-geometry] derives local endpoint patches once and preserves curves', () => {
    const { effectiveLines, patches } = resolveConnectorGeometry([
      target,
      { ...line, cx: 150, cy: 0, connections: { start: { targetId: 'target', anchor: 'e' } } },
    ])
    expect(effectiveLines.get('line')).toMatchObject({ x1: 170, y1: 50, cx: 150, cy: 0 })
    expect(patches).toEqual([{ id: 'line', x1: 170 }])
  })

  it('keeps finite fallback coordinates for unavailable endpoints and detaches deletions', () => {
    const missing = { ...line, x1: Number.NaN, y1: Infinity, x2: undefined, y2: undefined }
    const normalized = normalizeSlideConnectorConnections([missing])
    expect(normalized[0]).toMatchObject({ x1: 0, y1: 50, x2: 300, y2: 50 })
    expect(normalized[0].connections).toBeUndefined()

    const { patches } = resolveConnectorGeometry([target, line], { deletedTargetIds: ['target'] })
    expect(patches).toEqual([{ id: 'line', connections: undefined }])
  })

  it('rejects self and connector targets while indexing the slide once', () => {
    const self = { ...line, connections: { start: { targetId: 'line', anchor: 'center' } } }
    const connectorTarget = { ...line, id: 'line-2' }
    const linked = { ...line, id: 'line-3', connections: { end: { targetId: 'line-2', anchor: 'e' } } }
    const normalized = normalizeSlideConnectorConnections([self, connectorTarget, linked])
    expect(normalized.every((element) => !element.connections)).toBe(true)
    const resolved = resolveConnectorGeometry([target, line, connectorTarget, linked])
    expect(resolved.elementIndex.size).toBe(4)
  })
})
