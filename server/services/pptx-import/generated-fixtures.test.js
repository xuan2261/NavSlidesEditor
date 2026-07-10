import { describe, expect, it } from 'vitest'
import harnessModule from './pptx-import-semantic-and-roundtrip-fidelity-tester.js'

const {
  applyStrictPerTypeGates,
  computeDetailedFidelityMetrics,
} = harnessModule.default || harnessModule

describe('generated fixture fidelity gates', () => {
  it('computes geometry/property/count metrics by type', () => {
    const source = {
      slides: [
        {
          elements: [
            { type: 'shape', shapType: 'rect', left: 10, top: 10, width: 100, height: 40 },
            { type: 'text', left: 200, top: 30, width: 120, height: 60, content: '<p>Hello</p>' },
          ],
        },
      ],
    }
    const imported = {
      slides: [
        {
          elements: [
            { type: 'shape', shape: 'rect', x: 11, y: 12, width: 102, height: 42, fill: '#fff', stroke: '#000' },
            { type: 'text', x: 200, y: 30, width: 120, height: 60, content: '<p>Hello</p>' },
          ],
        },
      ],
    }

    const metrics = computeDetailedFidelityMetrics(source, imported)
    expect(metrics.geometryDrift.maxPx).toBeGreaterThanOrEqual(0)
    expect(metrics.geometryDrift.byType.shape.count).toBe(1)
    expect(metrics.propertyCoverage.byType.shape).toBeGreaterThan(0)
    expect(metrics.elementCount.sourceByType.shape).toBe(1)
    expect(metrics.elementCount.navByType.shape).toBe(1)
  })

  it('fails strict per-type gate for generated fixtures with excessive drift', () => {
    const errors = applyStrictPerTypeGates({
      file: 'generated-line-fixture.pptx',
      geometryDrift: {
        byType: {
          line: { maxPx: 9, medianPx: 9, count: 1 },
        },
      },
      propertyCoverage: { byType: { table: 0.9, chart: 0.9 } },
    })
    expect(errors.some((error) => error.includes('line'))).toBe(true)
  })

  it('enforces the same measured thresholds on regular corpus files', () => {
    const errors = applyStrictPerTypeGates({
      file: 'Bai_2_1.pptx',
      geometryDrift: { byType: { line: { maxPx: 999, medianPx: 999, count: 1 } } },
      propertyCoverage: { byType: { table: 0.1, chart: 0.1 } },
    })
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('geometry gate failed for line'),
      expect.stringContaining('property gate failed for table'),
      expect.stringContaining('property gate failed for chart'),
    ]))
  })
})
