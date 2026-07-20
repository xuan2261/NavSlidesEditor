import { describe, expect, it } from 'vitest'
import matrix from './chart-support-matrix.js'

const { supportRow, isNativeEditableChartType, NATIVE_EDITABLE } = matrix

describe('chart-support-matrix (Phase 05 scaffold)', () => {
  it('limits native editable types to the blocking MVP row', () => {
    expect(NATIVE_EDITABLE).toEqual(['bar'])
    expect(isNativeEditableChartType('line')).toBe(false)
    expect(isNativeEditableChartType('pie')).toBe(false)
  })

  it('keeps line preserve-only while allowing a line display mapping', () => {
    expect(supportRow('lineChart')).toMatchObject({
      status: 'preserve-only', navType: 'line', nativeType: 'lineChart',
    })
  })

  it('marks combo as preserve-only', () => {
    expect(supportRow('comboChart').status).toBe('preserve-only')
  })

  it('keeps three-dimensional bar variants preserve-only', () => {
    expect(supportRow('bar3DChart')).toMatchObject({
      status: 'preserve-only', navType: null, nativeType: 'bar3DChart',
    })
  })

  it('never coerces scatter', () => {
    expect(supportRow('scatterChart')).toMatchObject({ status: 'preserve-only', navType: null })
  })

  it('keeps polar area preserve-only', () => {
    expect(supportRow('polarAreaChart')).toMatchObject({
      status: 'preserve-only', navType: null,
    })
  })
})
