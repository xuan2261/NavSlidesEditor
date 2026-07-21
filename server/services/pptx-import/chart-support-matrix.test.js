import { describe, expect, it } from 'vitest'
import matrix from './chart-support-matrix.js'

const {
  supportRow, assertStrictChartSupport, isNativeEditableChartType, NATIVE_EDITABLE,
} = matrix

describe('chart-support-matrix (Phase 05 scaffold)', () => {
  it('limits native editable types to the blocking MVP row', () => {
    expect(NATIVE_EDITABLE).toEqual(['bar'])
    expect(isNativeEditableChartType('line')).toBe(false)
    expect(isNativeEditableChartType('pie')).toBe(false)
  })

  it('binds the editable bar row to the canonical matrix', () => {
    expect(supportRow('barChart')).toMatchObject({
      rowId: 'chart.bar-column.embedded-workbook.literal-range',
      tier: 'structured-partial',
      claimCeiling: 'feature-editability',
      matrixHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
  })

  it('fails closed when a caller requires an unqualified editable chart', () => {
    expect(() => assertStrictChartSupport('barChart', true, { requireEditable: true }))
      .toThrow(/unsupported/i)
  })

  it('keeps line preserve-only while allowing a line display mapping', () => {
    expect(supportRow('lineChart')).toMatchObject({
      status: 'preserve-only', navType: 'line', nativeType: 'lineChart',
      tier: 'preserved-opaque', rowId: 'chart.line.preserved',
    })
  })

  it('marks combo as preserve-only', () => {
    expect(supportRow('comboChart')).toMatchObject({
      status: 'preserve-only', rowId: 'chart.combo.preserved',
    })
  })

  it('binds common OOXML aliases to exact canonical rows', () => {
    expect(supportRow('columnChart')).toMatchObject({
      status: 'conditional', rowId: 'chart.bar-column.embedded-workbook.literal-range',
    })
    expect(supportRow('pie3DChart')).toMatchObject({
      status: 'preserve-only', rowId: 'chart.unknown.preserved',
    })
    expect(supportRow('line3DChart')).toMatchObject({
      status: 'preserve-only', rowId: 'chart.unknown.preserved',
    })
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
