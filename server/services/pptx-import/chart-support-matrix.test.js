import { describe, expect, it } from 'vitest'
import matrix from './chart-support-matrix.js'

const { supportRow, isNativeEditableChartType, NATIVE_EDITABLE } = matrix

describe('chart-support-matrix (Phase 05 scaffold)', () => {
  it('lists native editable Chart.js types', () => {
    expect(NATIVE_EDITABLE).toContain('bar')
    expect(isNativeEditableChartType('pie')).toBe(true)
  })

  it('marks combo as unsupported-strict', () => {
    expect(supportRow('comboChart').status).toBe('unsupported-strict')
  })

  it('coerces scatter to line', () => {
    expect(supportRow('scatterChart')).toMatchObject({ status: 'coerced', navType: 'line' })
  })

  it('classifies polarAreaChart as native before broad area coercion', () => {
    expect(supportRow('polarAreaChart')).toEqual({
      status: 'native',
      navType: 'polarArea',
    })
  })
})
