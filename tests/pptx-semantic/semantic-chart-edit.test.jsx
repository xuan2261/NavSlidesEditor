import { describe, expect, it } from 'vitest'
import { applyChartOperation } from '../../shared/src/pptx-chart-operations'
import { familyDocumentsFixture } from './family-documents-fixture.js'
import { familyCompatibilityElement, familyRootId } from '../../shared/src/pptx-family-operations.js'
import { applyPresentationProjectionOperation } from '../../shared/src/pptx-projection-operation.js'
import { normalizeSemanticPresentation } from '../../shared/src/pptx-semantic-presentation.js'

const source = (id) => ({
  definitionId: id,
  partUri: 'ppt/charts/chart1.xml',
  preconditionHash: 'a'.repeat(64),
  path: [0, 1],
})
const points = (prefix, values) => ({
  count: values.length,
  points: values.map((value, index) => ({
    index, value, lexicalValue: String(value), source: source(`${prefix}-${index}`),
  })),
})
const chart = (families = ['barChart']) => ({
  schemaVersion: 1,
  source: {
    partUri: 'ppt/charts/chart1.xml',
    preconditionHash: 'a'.repeat(64),
    ownerDefinitionId: 'frame',
    relationshipId: 'rId1',
  },
  options: {},
  axes: [
    { id: 1, kind: 'catAx', crossAxisId: 2, options: {} },
    { id: 2, kind: 'valAx', crossAxisId: 1, options: {}, scaling: { min: 0, max: 20 } },
  ],
  plots: families.map((family, index) => ({
    family,
    options: {},
    axisIds: [1, 2],
    series: [{
      id: `series-${index}`,
      source: source(`series-${index}`),
      index,
      order: index,
      options: {},
      data: family === 'scatterChart'
        ? {
            xVal: { kind: 'numLit', cache: points(`x-${index}`, [2, 4]) },
            yVal: { kind: 'numLit', cache: points(`y-${index}`, [7, 11]) },
          }
        : {
            tx: { kind: 'text', value: `Series ${index}` },
            val: { kind: 'numRef', formula: 'Data!$B$2:$B$3', cache: points(`v-${index}`, [7, 11]) },
          },
    }],
  })),
})

describe('source-bound chart editing acceptance', () => {
  it('edits combo cached values and axis range while retaining plot/source identities through round-trip', () => {
    const original = chart(['barChart', 'lineChart'])
    const before = JSON.stringify(original)
    const converted = applyChartOperation(original, {
      type: 'chart.data.convert-local', seriesId: 'series-1', channel: 'val', basis: 'cache-snapshot',
    })
    const edited = applyChartOperation(converted, {
      type: 'chart.data.set-point', seriesId: 'series-1', channel: 'val', index: 1, value: 15,
    })
    const ranged = applyChartOperation(edited, {
      type: 'chart.options.set', target: 'axis', axisId: 2, values: { min: -5, max: 25 },
    })
    const reopened = JSON.parse(JSON.stringify(ranged))
    expect(reopened.plots.map(({ family }) => family)).toEqual(['barChart', 'lineChart'])
    expect(reopened.plots[1].series[0].data.val).toMatchObject({
      kind: 'numLit', cache: { points: [{ index: 0, value: 7 }, { index: 1, value: 15 }] },
    })
    expect(reopened.axes[1].scaling).toEqual({ min: -5, max: 25 })
    expect(reopened.plots[1].series[0].source).toEqual(source('series-1'))
    expect(original.plots[1].series[0].data.val).toMatchObject({ kind: 'numRef', formula: 'Data!$B$2:$B$3' })
    expect(JSON.stringify(original)).toBe(before)
  })

  it('edits scatter y values and axis limits without inventing x coordinates', () => {
    const original = chart(['scatterChart'])
    const edited = applyChartOperation(original, {
      type: 'chart.data.set-point', seriesId: 'series-0', channel: 'yVal', index: 1, value: 13,
    })
    const ranged = applyChartOperation(edited, {
      type: 'chart.options.set', target: 'axis', axisId: 2, values: { min: -2, max: 20 },
    })
    const reopened = JSON.parse(JSON.stringify(ranged))
    expect(reopened.plots[0].family).toBe('scatterChart')
    expect(reopened.plots[0].series[0].data.xVal.cache.points.map(({ value }) => value)).toEqual([2, 4])
    expect(reopened.plots[0].series[0].data.yVal.cache.points.map(({ value }) => value)).toEqual([7, 13])
    expect(reopened.axes[1].scaling).toEqual({ min: -2, max: 20 })
    expect(original.plots[0].series[0].data.yVal.cache.points[1].value).toBe(11)
  })

  it('rejects invalid series, out-of-range points and source-reference writes atomically', () => {
    const original = chart(['barChart'])
    const before = JSON.stringify(original)
    for (const command of [
      { type: 'chart.data.set-point', seriesId: 'missing', channel: 'val', index: 0, value: 4 },
      { type: 'chart.data.set-point', seriesId: 'series-0', channel: 'val', index: 9, value: 4 },
      { type: 'chart.data.set-point', seriesId: 'series-0', channel: 'val', index: 0, value: '=SUM(A1)' },
      { type: 'chart.options.set', target: 'axis', axisId: 2, values: { min: 20, max: 10 } },
    ]) {
      expect(() => applyChartOperation(original, command)).toThrow(TypeError)
      expect(JSON.stringify(original)).toBe(before)
    }
  })
  it('rejects invalid persisted axis ranges before admitting a chart or replaying an unrelated edit', () => {
    for (const scaling of [
      { min: 20, max: 10 },
      { min: 10, max: 10 },
      { min: 0, max: 20, logBase: 10 },
    ]) {
      const original = chart(['scatterChart'])
      original.axes[1].scaling = scaling
      const serialized = JSON.stringify(original)
      expect(() => applyChartOperation(JSON.parse(serialized), {
        type: 'chart.title.set', value: 'Unrelated title edit',
      })).toThrow(TypeError)
      expect(JSON.stringify(original)).toBe(serialized)
    }
  })

  it('persists an imported chart occurrence edit through semantic save/reload without changing its source or sibling', async () => {
    const document = (await familyDocumentsFixture()).chart
    document.instances.sibling = structuredClone(document.instances.occurrence)
    document.instances.sibling.id = 'sibling'
    const input = normalizeSemanticPresentation({
      slides: [{
        id: 's1',
        elements: ['occurrence', 'sibling'].map((id) => ({ id, type: 'chart', pptxInstanceId: id })),
      }],
      pptxSemantic: document,
    })
    const before = JSON.stringify(input)
    const definition = Object.values(input.pptxSemantic.definitions)[0]
    const componentId = familyRootId(definition)
    const originalChart = familyCompatibilityElement(input.pptxSemantic, input.slides[0].elements[0]).chartDocument
    const saved = applyPresentationProjectionOperation(input, {
      type: 'chart.edit',
      instanceId: 'occurrence',
      componentId,
      command: { type: 'chart.title.set', value: 'Occurrence-local chart title' },
    })
    const seriesId = originalChart.plots[0].series[0].id
    const axisId = originalChart.axes.find(axis => axis.kind === 'valAx').id
    let current = saved
    for (const command of [
      { type: 'chart.data.convert-local', seriesId, channel: 'val', basis: 'cache-snapshot' },
      { type: 'chart.data.set-point', seriesId, channel: 'val', index: 1, value: 19 },
      { type: 'chart.options.set', target: 'axis', axisId, values: { min: -5, max: 30 } },
    ]) current = applyPresentationProjectionOperation(current, {
      type: 'chart.edit', instanceId: 'occurrence', componentId, command,
    })
    const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(current)))
    const edited = familyCompatibilityElement(reopened.pptxSemantic, reopened.slides[0].elements[0])
    const sibling = familyCompatibilityElement(reopened.pptxSemantic, reopened.slides[0].elements[1])
    expect(edited.chartDocument.plots[0].series[0].data.val.cache.points[1].value).toBe(19)
    expect(edited.chartDocument.axes.find(axis => axis.id === axisId).scaling)
      .toMatchObject({ min: -5, max: 30 })
    expect(sibling.chartDocument).toEqual(originalChart)
    const snapshot = JSON.stringify(reopened)
    expect(() => applyPresentationProjectionOperation(reopened, {
      type: 'chart.edit', instanceId: 'occurrence', componentId,
      command: { type: 'chart.options.set', target: 'axis', axisId, values: { min: 40 } },
    })).toThrow(TypeError)
    expect(JSON.stringify(reopened)).toBe(snapshot)
    expect(edited.chartDocument.title.value).toBe('Occurrence-local chart title')
    expect(sibling.chartDocument.title).toEqual(originalChart.title)
    expect(reopened.pptxSemantic.definitions).toEqual(input.pptxSemantic.definitions)
    expect(JSON.stringify(input)).toBe(before)
    expect(reopened.pptxSemantic.instances.occurrence.overrides.components[componentId]
      .familyOperations.commands).toHaveLength(4)
  })
})


