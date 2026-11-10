import { expect } from '@playwright/test'
import { createRequire } from 'node:module'
import path from 'node:path'
import { activate, fillField, selectOption } from './pptx-semantic-ui-journey.js'

const nodeRequire = createRequire(path.resolve('package.json'))
const { semanticInstance } = nodeRequire('./shared/src/pptx-semantic-records.js')
const { modelKey } = nodeRequire('./shared/src/pptx-smartart-document.js')
const sameModel = (a, b) => modelKey(a) === modelKey(b)
const diagramDocument = (deck, target) => semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
  .overrides.components?.[target.element.smartArtDocument.componentId]?.smartArtDocument || target.element.smartArtDocument
const logicalPoints = document => document.points.filter(point => ['node', 'asst'].includes(point.type))
const leafPoint = document => {
  const point = logicalPoints(document).findLast(candidate => !document.connections.some(edge =>
    edge.type === 'parOf' && sameModel(edge.sourceId, candidate.modelId)))
  expect(point, 'An actual logical leaf is required for deletion/reparenting').toBeTruthy()
  return point
}
const parentEdge = (document, point) => {
  const edges = document.connections.filter(edge => edge.type === 'parOf' && sameModel(edge.destinationId, point.modelId))
  expect(edges, 'Exact single incoming hierarchy edge').toHaveLength(1)
  return edges[0]
}
const reparentSelection = document => {
  const point = leafPoint(document), edge = parentEdge(document, point)
  const parent = document.points.find(candidate => ['doc', 'node', 'asst'].includes(candidate.type) &&
    candidate.componentId !== point.componentId && !sameModel(candidate.modelId, edge.sourceId))
  expect(parent, 'A different real parent is required').toBeTruthy()
  return { point, edge, parent }
}
const reorderSelection = document => {
  for (const point of logicalPoints(document)) {
    const edge = parentEdge(document, point)
    const siblings = document.connections.filter(candidate => candidate.type === 'parOf' &&
      sameModel(candidate.sourceId, edge.sourceId)).sort((a, b) => a.sourceOrder - b.sourceOrder)
    if (siblings.length > 1 && siblings[0].componentId === edge.componentId) return { point, siblings }
  }
  throw new Error('The source must offer two real siblings for reorder')
}
const layoutSelection = document => {
  const declaration = document.layout.declarations.find(entry => entry.type === 'constr' &&
    Number.isFinite(entry.attributes.fact) && entry.attributes.fact > 0)
  expect(declaration, 'A real authored numeric layout factor is required').toBeTruthy()
  return { declaration, value: declaration.attributes.fact * 0.9 }
}

const chartSource = {
  id: 'chart-bars-lines.pptx',
  path: 'server/data/test-corpus/chart-bars-lines.pptx',
  sha256: 'fe9f5f6daf514a5d8c711a9a0247b75e05a7a45eae7f44435d83e0831682af29',
  provenance: 'synthetic-corpus',
}

const smartArtSource = {
  id: 'resume-smartart-completion-native-resaved.pptx',
  path: '.omo/evidence/pptx-semantic/resume-smartart-completion-native-capture-a1bbb6ec-2787-4fa0-a299-e894394d380e/resume-smartart-completion-native-resaved.pptx',
  sha256: '620da96e6fef0a22de88b823d05e136be7443f60e4535fbf7a19f064c87fb057',
  provenance: 'xml-authored-powerpoint-resaved-auxiliary',
}

const pointMarker = 42.5
const smartArtMarker = 'Authored node label'

export const chartDataOperation = {
  id: 'chart.data',
  async prepare({ panel, target, interaction }) {
    const container = panel.locator('[data-native-chart-properties]')
    const plot = target.element.chartDocument.plots[0]
    const series = plot.series[0]
    const label = series.data.tx?.kind === 'text' ? series.data.tx.value : series.id
    const convert = container.getByRole('button', {
      name: `Convert ${label} val cache to project-local data`, exact: true,
    })
    if (await convert.isVisible()) await activate(convert, interaction)
  },
  async edit({ panel, target, interaction }) {
    const container = panel.locator('[data-native-chart-properties]')
    const plot = target.element.chartDocument.plots[0]
    const series = plot.series[0]
    const label = series.data.tx?.kind === 'text' ? series.data.tx.value : series.id
    const field = container.getByRole('textbox', { name: `${label} val point 0`, exact: true })
    await fillField(field, pointMarker, interaction)
  },
  assert(deck, target) {
    const instance = semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
    const override = instance.overrides.components?.[target.element.chartDocument.source.ownerDefinitionId]?.chartDocument
    const series = (override || target.element.chartDocument).plots[0].series[0]
    expect(series.data.val.cache.points[0].value).toBe(pointMarker)
  },
  async visible({ page, target }) {
    const rendered = page.getByTestId(`slide-element-${target.element.id}`)
    await expect(rendered).toBeVisible()
  },
}

export const chartSeriesOperation = {
  id: 'chart.series-name',
  async edit({ panel, target, interaction }) {
    const container = panel.locator('[data-native-chart-properties]')
    const plot = target.element.chartDocument.plots[0]
    const series = plot.series[0]
    const input = container.getByRole('textbox', { name: `${series.id} series name`, exact: true })
    await fillField(input, 'Renamed Series', interaction)
  },
  assert(deck, target) {
    const instance = semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
    const override = instance.overrides.components?.[target.element.chartDocument.source.ownerDefinitionId]?.chartDocument
    const series = (override || target.element.chartDocument).plots[0].series[0]
    expect(series.data.tx?.value).toBe('Renamed Series')
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`)).toBeVisible()
  },
}

export const chartAxesOperation = {
  id: 'chart.axis-maximum',
  async edit({ panel, target, interaction }) {
    const container = panel.locator('[data-native-chart-properties]')
    const axis = target.element.chartDocument.axes[0]
    const input = container.getByRole('textbox', { name: `Axis ${axis.id} max`, exact: true })
    await fillField(input, 150, interaction)
  },
  assert(deck, target) {
    const instance = semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
    const override = instance.overrides.components?.[target.element.chartDocument.source.ownerDefinitionId]?.chartDocument
    const axis = (override || target.element.chartDocument).axes[0]
    expect(axis.scaling?.max).toBe(150)
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`)).toBeVisible()
  },
}

export const chartStyleOperation = {
  id: 'chart.style',
  async edit({ panel, interaction }) {
    const container = panel.locator('[data-native-chart-properties]')
    const input = container.getByRole('textbox', { name: 'Chart style', exact: true })
    await fillField(input, 12, interaction)
  },
  assert(deck, target) {
    const instance = semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
    const override = instance.overrides.components?.[target.element.chartDocument.source.ownerDefinitionId]?.chartDocument
    expect((override || target.element.chartDocument).style).toBe(12)
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`)).toBeVisible()
  },
}

export const chartJourney = {
  id: 'chart.composite',
  family: 'chart',
  source: chartSource,
  target(deck) {
    const index = 0
    const slide = deck.slides[index]
    const element = slide?.elements.find(item => item.chartDocument && item.pptxInstanceId)
    expect(element, 'Chart element on slide 1').toBeTruthy()
    return { index, slide, element }
  },
  operations: [chartDataOperation, chartSeriesOperation, chartAxesOperation, chartStyleOperation],
}

export const smartArtLabelOperation = {
  id: 'diagram.label',
  async prepare({ panel, target, interaction }) {
    const region = panel.getByRole('region', { name: 'SmartArt editor', exact: true })
    const node = target.element.smartArtDocument.points.find(point => ['node', 'asst'].includes(point.type))
    expect(node, 'A real SmartArt logical node is required').toBeTruthy()
    await selectOption(region.getByRole('combobox', { name: 'SmartArt node', exact: true }), node.componentId, interaction)
    const create = region.getByRole('button', { name: 'Create label', exact: true })
    if (await create.isVisible()) await activate(create, interaction)
  },
  async edit({ panel, target, interaction }) {
    const region = panel.getByRole('region', { name: 'SmartArt editor', exact: true })
    const node = target.element.smartArtDocument.points.find(point => ['node', 'asst'].includes(point.type))
    await selectOption(region.getByRole('combobox', { name: 'SmartArt node', exact: true }), node.componentId, interaction)
    const field = region.getByRole('textbox', { name: /^Label run / }).first()
    await fillField(field, smartArtMarker, interaction)
  },
  assert(deck, target) {
    const instance = semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
    const override = instance.overrides.components?.[target.element.smartArtDocument.componentId]?.smartArtDocument
    const node = (override || target.element.smartArtDocument).points.find(p => ['node', 'asst'].includes(p.type))
    const text = node.textDocument.paragraphs[0].runs[0].text
    expect(text).toBe(smartArtMarker)
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`)).toContainText(smartArtMarker)
  },
}

export const smartArtInsertOperation = {
  id: 'diagram.node-insert',
  async edit({ panel, target, interaction }) {
    const region = panel.getByRole('region', { name: 'SmartArt editor', exact: true })
    const node = target.element.smartArtDocument.points.find(point => ['node', 'asst'].includes(point.type))
    await selectOption(region.getByRole('combobox', { name: 'SmartArt node', exact: true }), node.componentId, interaction)
    const addBtn = region.getByRole('button', { name: 'Add node', exact: true })
    await activate(addBtn, interaction)
  },
  assert(deck, target) {
    const instance = semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
    const override = instance.overrides.components?.[target.element.smartArtDocument.componentId]?.smartArtDocument
    const before = target.element.smartArtDocument
    const after = override || before
    const added = after.points.filter(point => !before.points.some(old => old.componentId === point.componentId))
    expect(added).toHaveLength(1)
    expect(added[0].type).toBe('node')
    expect(after.points.filter(point => point.componentId !== added[0].componentId)).toEqual(before.points)
    const edges = after.connections.filter(edge => !before.connections.some(old => old.componentId === edge.componentId))
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({ type: 'parOf', sourceId: logicalPoints(before)[0].modelId,
      destinationId: added[0].modelId })
    expect(after.connections.filter(edge => edge.componentId !== edges[0].componentId)).toEqual(before.connections)
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`).locator('[data-smartart-root]')).toBeVisible()
  },
}

export const smartArtStyleOperation = {
  id: 'diagram.node-style',
  async edit({ panel, target, interaction }) {
    const region = panel.getByRole('region', { name: 'SmartArt editor', exact: true })
    const node = target.element.smartArtDocument.points.find(point => ['node', 'asst'].includes(point.type))
    await selectOption(region.getByRole('combobox', { name: 'SmartArt node', exact: true }), node.componentId, interaction)
    const styleInput = region.getByLabel('SmartArt presStyleLbl', { exact: true })
    await fillField(styleInput, 'customStyleLabel', interaction)
  },
  assert(deck, target) {
    const instance = semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
    const override = instance.overrides.components?.[target.element.smartArtDocument.componentId]?.smartArtDocument
    const node = (override || target.element.smartArtDocument).points.find(p => ['node', 'asst'].includes(p.type))
    const prop = node.properties.find(p => p.name === 'presStyleLbl')
    expect(prop?.value).toBe('customStyleLabel')
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`).locator('[data-smartart-root]')).toBeVisible()
  },
}

export const smartArtDeleteOperation = {
  id: 'diagram.node-delete',
  async edit({ panel, target, interaction }) {
    const region = panel.getByRole('region', { name: 'SmartArt editor', exact: true })
    const point = leafPoint(target.element.smartArtDocument)
    await selectOption(region.getByRole('combobox', { name: 'SmartArt node', exact: true }), point.componentId, interaction)
    await activate(region.getByRole('button', { name: 'Delete node', exact: true }), interaction)
  },
  assert(deck, target) {
    const before = target.element.smartArtDocument, after = diagramDocument(deck, target)
    const point = leafPoint(before)
    expect(after.points).toEqual(before.points.filter(candidate => candidate.componentId !== point.componentId))
    const references = ['sourceId', 'destinationId', 'parentTransitionId', 'siblingTransitionId', 'presentationId']
    expect(after.connections).toEqual(before.connections.filter(edge => !references.some(key =>
      Object.hasOwn(edge, key) && sameModel(edge[key], point.modelId))))
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`).locator('[data-smartart-root]')).toBeVisible()
  },
}

export const smartArtReparentOperation = {
  id: 'diagram.node-reparent',
  async edit({ panel, target, interaction }) {
    const region = panel.getByRole('region', { name: 'SmartArt editor', exact: true })
    const { point, parent } = reparentSelection(target.element.smartArtDocument)
    await selectOption(region.getByRole('combobox', { name: 'SmartArt node', exact: true }), point.componentId, interaction)
    await selectOption(region.getByRole('combobox', { name: 'SmartArt parent', exact: true }), parent.componentId, interaction)
  },
  assert(deck, target) {
    const before = target.element.smartArtDocument, after = diagramDocument(deck, target)
    const { edge, parent } = reparentSelection(before)
    const orders = before.connections.filter(candidate => candidate.componentId !== edge.componentId &&
      candidate.type === 'parOf' && sameModel(candidate.sourceId, parent.modelId)).map(candidate => candidate.sourceOrder)
    expect(after.points).toEqual(before.points)
    expect(after.connections).toEqual(before.connections.map(candidate => candidate.componentId === edge.componentId ?
      { ...candidate, sourceId: parent.modelId, sourceOrder: orders.length ? Math.max(...orders) + 1 : 0 } : candidate))
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`).locator('[data-smartart-root]')).toBeVisible()
  },
}

export const smartArtReorderOperation = {
  id: 'diagram.node-reorder',
  async edit({ panel, target, interaction }) {
    const region = panel.getByRole('region', { name: 'SmartArt editor', exact: true })
    const { point } = reorderSelection(target.element.smartArtDocument)
    await selectOption(region.getByRole('combobox', { name: 'SmartArt node', exact: true }), point.componentId, interaction)
    await activate(region.getByRole('button', { name: 'Move node later', exact: true }), interaction)
  },
  assert(deck, target) {
    const before = target.element.smartArtDocument, after = diagramDocument(deck, target)
    const { siblings } = reorderSelection(before)
    const reordered = [...siblings]
    ;[reordered[0], reordered[1]] = [reordered[1], reordered[0]]
    const orders = new Map(reordered.map((edge, index) => [edge.componentId, index]))
    expect(after.points).toEqual(before.points)
    expect(after.connections).toEqual(before.connections.map(edge => orders.has(edge.componentId) ?
      { ...edge, sourceOrder: orders.get(edge.componentId) } : edge))
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`).locator('[data-smartart-root]')).toBeVisible()
  },
}
export const smartArtLayoutOperation = {
  id: 'diagram.layout-factor',
  async edit({ panel, target, interaction }) {
    const region = panel.getByRole('region', { name: 'SmartArt editor', exact: true })
    const { declaration, value } = layoutSelection(target.element.smartArtDocument)
    await selectOption(region.getByRole('combobox', { name: 'SmartArt layout declaration', exact: true }),
      declaration.componentId, interaction)
    await fillField(region.getByRole('spinbutton', { name: 'SmartArt layout factor', exact: true }), value, interaction)
  },
  assert(deck, target) {
    const before = target.element.smartArtDocument, after = diagramDocument(deck, target)
    const { declaration, value } = layoutSelection(before)
    expect(after).toEqual({ ...before, layout: { ...before.layout,
      declarations: before.layout.declarations.map(entry => entry.componentId === declaration.componentId ?
        { ...entry, attributes: { ...entry.attributes, fact: value } } : entry),
    } })
  },
  async visible({ page, target }) {
    // An alert/flattened fallback is not successful layout rendering.
    const rendered = page.getByTestId(`slide-element-${target.element.id}`)
    await expect(rendered.locator('[data-smartart-root]')).toBeVisible()
  },
}


export const smartArtJourney = {
  id: 'diagram.composite',
  family: 'diagram',
  source: smartArtSource,
  target(deck) {
    const index = 0
    const slide = deck.slides[index]
    const element = slide?.elements.find(item => item.smartArtDocument && item.pptxInstanceId)
    expect(element, 'SmartArt element on slide 1').toBeTruthy()
    return { index, slide, element }
  },
  operations: [smartArtLabelOperation, smartArtInsertOperation, smartArtStyleOperation,
    smartArtReorderOperation, smartArtReparentOperation, smartArtDeleteOperation, smartArtLayoutOperation],
}
