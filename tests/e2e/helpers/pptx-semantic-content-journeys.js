import { expect } from '@playwright/test'
import { createRequire } from 'node:module'
import path from 'node:path'
import { activate, closeOverlay, fillField, selectOption } from './pptx-semantic-ui-journey.js'

const nodeRequire = createRequire(path.resolve('package.json'))
const manifest = nodeRequire('./tests/pptx-semantic/manifest.json')
const { materializeTextDocument } = nodeRequire('./shared/src/pptx-text-materialization.js')
const { semanticInstance } = nodeRequire('./shared/src/pptx-semantic-records.js')
const textSource = manifest.corpus.find(entry => entry.id === 'Bai_2_2.pptx')
const textMarker = 'Semantic journey text edit'
const cellMarker = 'Cell paragraph edit'
const mathMarker = 'x_new + 1'

const firstTextNode = node => {
  if (node.text !== undefined && /(?:^|:)t$/.test(node.type)) return node
  for (const child of node.children || []) {
    const found = firstTextNode(child)
    if (found) return found
  }
  return null
}
const countMathNodes = (node, type) => Number(node.type.replace(/^m:/, '') === type) +
  (node.children || []).reduce((count, child) => count + countMathNodes(child, type), 0)

export const textJourney = {
  id: 'text.content',
  family: 'text',
  source: textSource,
  target(deck) {
    const index = 16
    const slide = deck.slides[index]
    const element = slide?.elements.find(item => item.type === 'text' && item.name === 'TextBox 22')
    expect(element, 'Source TextBox 22 on slide 17').toBeTruthy()
    return { index, slide, element }
  },
  async edit({ page, target, interaction }) {
    await closeOverlay(page, interaction)
    const view = page.getByTestId(`slide-element-${target.element.id}`)
    if (interaction === 'pointer') {
      await view.click()
      await view.dblclick()
    } else {
      await view.focus()
      // Selection is already established; F2 starts the text editor once.
      await view.press('F2')
    }
    const input = page.locator('.ProseMirror[contenteditable="true"]')
    await expect(input).toBeVisible()
    await input.fill(textMarker)
    await input.press('Escape')
    await expect(input).not.toBeVisible()
  },
  assert(deck, target) {
    const text = materializeTextDocument(deck.pptxSemantic, target.element.pptxInstanceId).paragraphs
      .flatMap(paragraph => paragraph.runs.map(run => run.text || '')).join('')
    expect(text).toBe(textMarker)
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`)).toContainText(textMarker)
  },
}

export const tableCellOperation = {
  id: 'table.cell-run-text',
  async edit({ panel, target, interaction }) {
    const region = panel.getByRole('region', { name: 'Native table properties', exact: true })
    const cell = target.element.tableDocument.rows[0].cells[0]
    await selectOption(region.getByRole('combobox', { name: 'Selected native table cell', exact: true }),
      cell.componentId, interaction)
    const field = region.getByRole('textbox', { name: 'Cell 1,1 paragraph 1 run 1', exact: true })
    await fillField(field, cellMarker, interaction)
  },
  assert(deck, target) {
    const instance = semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
    const override = instance.overrides.components?.[target.element.tableDocument.componentId]?.tableDocument
    const cell = (override || target.element.tableDocument).rows[0].cells[0]
    expect(cell.textDocument.paragraphs[0].runs[0].text).toBe(cellMarker)
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`)).toContainText(cellMarker)
  },
}

const tableDocument = (deck, target) => semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
  .overrides.components?.[target.element.tableDocument.componentId]?.tableDocument || target.element.tableDocument

const tableStructureOperation = (axis, action) => ({
  id: `table.${axis}-${action}`,
  async edit({ panel, target, interaction }) {
    const region = panel.getByRole('region', { name: 'Native table properties', exact: true })
    await selectOption(region.getByRole('combobox', { name: 'Selected native table cell', exact: true }),
      target.element.tableDocument.rows[0].cells[0].componentId, interaction)
    const name = action === 'insert' ? `Insert native table ${axis} after selected cell` :
      `Delete selected native table ${axis}`
    await activate(region.getByRole('button', { name, exact: true }), interaction)
  },
  assert(deck, target) {
    const before = target.element.tableDocument
    const after = tableDocument(deck, target)
    const key = axis === 'row' ? 'rows' : 'columns'
    const oldIds = before[key].map(item => item.componentId)
    const ids = after[key].map(item => item.componentId)
    expect(ids.length).toBe(oldIds.length + (action === 'insert' ? 1 : -1))
    if (action === 'insert') {
      expect(ids.filter(id => oldIds.includes(id))).toEqual(oldIds)
      expect(oldIds.includes(ids[1])).toBe(false)
    } else expect(ids).toEqual(oldIds.slice(1))
    const other = axis === 'row' ? 'columns' : 'rows'
    expect(after[other].map(item => item.componentId)).toEqual(before[other].map(item => item.componentId))
    for (const row of after.rows) expect(row.cells).toHaveLength(after.columns.length)
  },
  async visible({ page, target }) {
    const rendered = page.getByTestId(`slide-element-${target.element.id}`)
    await expect(rendered.locator('[data-pptx-table]')).toBeVisible()
    const anchors = target.element.tableDocument.rows.flatMap(row => row.cells)
      .filter(cell => cell.anchorCellId === cell.componentId)
    await expect(rendered.locator('[data-pptx-table-cell]')).toHaveCount(anchors.length)
  },
})

export const tableRowInsertOperation = tableStructureOperation('row', 'insert')
export const tableColumnInsertOperation = tableStructureOperation('column', 'insert')
export const tableColumnDeleteOperation = tableStructureOperation('column', 'delete')
export const tableRowDeleteOperation = tableStructureOperation('row', 'delete')

export const tableMergeOperation = {
  id: 'table.merge',
  async edit({ panel, interaction }) {
    const region = panel.getByRole('region', { name: 'Native table properties', exact: true })
    await fillField(region.getByLabel('Merge column span', { exact: true }), 2, interaction)
    await activate(region.getByRole('button', { name: 'Merge selected rectangle', exact: true }), interaction)
  },
  assert(deck, target) {
    const instance = semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
    const override = instance.overrides.components?.[target.element.tableDocument.componentId]?.tableDocument
    const doc = override || target.element.tableDocument
    const merged = doc.rows[0].cells[0].merge.gridSpan
    expect(merged).toBe(2)
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`)).toBeVisible()
  },
}

export const tableJourney = {
  id: 'table.composite',
  family: 'table',
  source: textSource,
  target(deck) {
    const index = 4
    const slide = deck.slides[index]
    const element = slide?.elements.find(item => item.tableDocument && item.pptxInstanceId)
    expect(element, 'Source table on slide 5').toBeTruthy()
    return { index, slide, element }
  },
  operations: [tableCellOperation, tableRowInsertOperation, tableColumnInsertOperation,
    tableColumnDeleteOperation, tableRowDeleteOperation, tableMergeOperation],
}

export const ommlRunsOperation = {
  id: 'equation.runs',
  async edit({ panel, target, interaction }) {
    const region = panel.getByRole('region', { name: 'Native equation editor', exact: true })
    const text = firstTextNode(target.element.ommlDocument.root)
    expect(text, 'First editable math text run in equation').toBeTruthy()
    await activate(region.getByRole('button', { name: `Select ${text.type} ${text.componentId}`, exact: true }), interaction)
    const field = region.getByRole('textbox', { name: 'Math run text', exact: true })
    await fillField(field, mathMarker, interaction)
  },
  assert(deck, target) {
    const instance = semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
    const override = instance.overrides.components?.[target.element.ommlDocument.root.componentId]?.ommlDocument
    const text = firstTextNode((override || target.element.ommlDocument).root)
    expect(text.text).toBe(mathMarker)
  },
  async visible({ page, target }) {
    await expect(page.getByTestId(`slide-element-${target.element.id}`)).toContainText(mathMarker)
  },
}

export const ommlFractionOperation = {
  id: 'equation.fraction-insert',
  async edit({ panel, interaction }) {
    const region = panel.getByRole('region', { name: 'Native equation editor', exact: true })
    const insertFraction = region.getByRole('button', { name: 'Insert fraction', exact: true })
    await activate(insertFraction, interaction)
  },
  assert(deck, target) {
    const instance = semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
    const override = instance.overrides.components?.[target.element.ommlDocument.root.componentId]?.ommlDocument
    const root = (override || target.element.ommlDocument).root
    expect(countMathNodes(root, 'f'), 'One fraction is inserted, not merely an existing fraction')
      .toBe(countMathNodes(target.element.ommlDocument.root, 'f') + 1)
  },
  async visible({ page, target }) {
    const rendered = page.getByTestId(`slide-element-${target.element.id}`)
    await expect(rendered.locator('[data-omml-baseline]')).toBeVisible()
    await expect(rendered.locator('[data-omml-type="f"], [data-omml-type="m:f"]'))
      .toHaveCount(countMathNodes(target.element.ommlDocument.root, 'f'))
  },
}

export const ommlMatrixOperation = {
  id: 'equation.matrix-insert',
  async edit({ panel, interaction }) {
    const region = panel.getByRole('region', { name: 'Native equation editor', exact: true })
    const insertMatrix = region.getByRole('button', { name: 'Insert matrix', exact: true })
    await activate(insertMatrix, interaction)
  },
  assert(deck, target) {
    const instance = semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
    const override = instance.overrides.components?.[target.element.ommlDocument.root.componentId]?.ommlDocument
    const root = (override || target.element.ommlDocument).root
    expect(countMathNodes(root, 'm'), 'One matrix is inserted, not merely an existing matrix')
      .toBe(countMathNodes(target.element.ommlDocument.root, 'm') + 1)
  },
  async visible({ page, target }) {
    const rendered = page.getByTestId(`slide-element-${target.element.id}`)
    await expect(rendered.locator('[data-omml-baseline]')).toBeVisible()
    await expect(rendered.locator('[data-omml-type="m"], [data-omml-type="m:m"]'))
      .toHaveCount(countMathNodes(target.element.ommlDocument.root, 'm'))
  },
}

export const ommlScriptOperation = {
  id: 'equation.superscript-insert',
  async edit({ panel, target, interaction }) {
    const region = panel.getByRole('region', { name: 'Native equation editor', exact: true })
    const root = target.element.ommlDocument.root
    await activate(region.getByRole('button', { name: `Select ${root.type} ${root.componentId}`, exact: true }), interaction)
    await activate(region.getByRole('button', { name: 'Insert superscript', exact: true }), interaction)
  },
  assert(deck, target) {
    const instance = semanticInstance(deck.pptxSemantic, target.element.pptxInstanceId)
    const root = instance.overrides.components?.[target.element.ommlDocument.root.componentId]?.ommlDocument.root
    expect(root, 'A persisted script document override is required').toBeTruthy()
    expect(countMathNodes(root, 'sSup')).toBe(countMathNodes(target.element.ommlDocument.root, 'sSup') + 1)
    const inserted = root.children.find(node => node.type.replace(/^m:/, '') === 'sSup' &&
      !target.element.ommlDocument.root.children.some(old => old.componentId === node.componentId))
    expect(inserted, 'The inserted superscript is an exact new root child').toBeTruthy()
    expect(inserted.children.map(node => node.type.replace(/^m:/, ''))).toEqual(['e', 'sup'])
  },
  async visible({ page, target }) {
    const rendered = page.getByTestId(`slide-element-${target.element.id}`)
    await expect(rendered.locator('[data-omml-baseline]')).toBeVisible()
    await expect(rendered.locator('[data-omml-type="sSup"], [data-omml-type="m:sSup"]'))
      .toHaveCount(countMathNodes(target.element.ommlDocument.root, 'sSup'))
  },
}

export const ommlJourney = {
  id: 'equation.composite',
  family: 'equation',
  source: textSource,
  target(deck) {
    const index = 7
    const slide = deck.slides[index]
    const element = slide?.elements.find(item => item.ommlDocument && item.pptxInstanceId)
    expect(element, 'Source equation on slide 8').toBeTruthy()
    return { index, slide, element }
  },
  operations: [ommlRunsOperation, ommlFractionOperation, ommlScriptOperation, ommlMatrixOperation],
}
