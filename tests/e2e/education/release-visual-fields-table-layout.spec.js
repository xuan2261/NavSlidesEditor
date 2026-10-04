import { test, expect } from '../fixtures/test-fixtures.js'
import {
  visualSession,
  fillControl,
  colorControl,
  fieldEvidence,
  styleOf,
} from './release-visual-fields.js'

async function tableDimensions(root) {
  return root.locator('table').evaluate((table) => {
    const rows = Array.from(table.rows)
    return {
      table: table.getBoundingClientRect().toJSON(),
      rowHeights: rows.map((row) => row.getBoundingClientRect().height),
      columnWidths: Array.from(rows[1].cells, (cell) => cell.getBoundingClientRect().width),
      mergedWidth: rows[0].cells[0].getBoundingClientRect().width,
    }
  })
}
function assertWeights(actual, expected) {
  const total = actual.reduce((sum, value) => sum + value, 0)
  const weight = expected.reduce((sum, value) => sum + value, 0)
  actual.forEach((value, index) => expect(value / total).toBeCloseTo(expected[index] / weight, 2))
}

test('table padding, default body fill, border thickness and header weight are authored and rendered', async ({
  page,
  request,
  testPresentation,
}, info) => {
  const s = await visualSession(page, request, testPresentation.id, 'table', {
    data: [
      ['Header A', 'Header B'],
      ['Body A', 'Body B'],
    ],
    mergedCells: [],
    colWidths: [],
    rowHeights: [],
    cellStyles: {},
  })
  await fillControl(page, 'Table cell padding', 14)
  await fillControl(page, 'Table border width', 4)
  await colorControl(page, 'Table cell background color', '#fef3c7')
  await page.getByLabel('Table header bold', { exact: true }).uncheck()
  const persisted = await s.reload({
    cellPadding: 14,
    borderWidth: 4,
    cellBgColor: '#fef3c7',
    headerIsBold: false,
  })
  const header = s.root.locator('tr').first().locator('td').first()
  const body = s.root.locator('tr').nth(1).locator('td').first()
  await expect(body).toHaveCSS('padding-top', '14px')
  await expect(body).toHaveCSS('padding-right', '14px')
  await expect(body).toHaveCSS('border-top-width', '4px')
  await expect(body).toHaveCSS('background-color', 'rgb(254, 243, 199)')
  await expect(header).toHaveCSS('font-weight', '400')
  await fieldEvidence(
    info,
    page,
    'table',
    ['cellPadding', 'padding', 'borderWidth', 'cellBgColor', 'headerIsBold'],
    { paddingPixels: 14, borderPixels: 4, defaultBodyFill: '#fef3c7', headerNotBold: true },
    {
      persisted,
      header: await styleOf(header, ['fontWeight']),
      body: await styleOf(body, [
        'paddingTop',
        'paddingRight',
        'borderTopWidth',
        'backgroundColor',
      ]),
    }
  )
})

test('table relative row/column author sizes and merged cell geometry persist without discarding covered data', async ({
  page,
  request,
  testPresentation,
}, info) => {
  const data = [
    ['Merge label', 'Covered but retained', 'Third heading'],
    ['A', 'B', 'C'],
    ['D', 'E', 'F'],
  ]
  const s = await visualSession(page, request, testPresentation.id, 'table', {
    width: 600,
    height: 300,
    data,
    mergedCells: [],
    colWidths: [],
    rowHeights: [],
    cellStyles: {},
  })
  const columns = [120, 180, 300],
    rows = [60, 90, 150]
  for (let index = 0; index < 3; index++) {
    await fillControl(page, `Table column ${index + 1} width`, columns[index])
    await fillControl(page, `Table row ${index + 1} height`, rows[index])
  }
  await page.getByLabel('Table cell row 1 column 1', { exact: true }).focus()
  await page.getByRole('button', { name: 'Merge selected cell right', exact: true }).click()
  const mergedCells = [{ row: 0, col: 0, rowSpan: 1, colSpan: 2 }]
  const persisted = await s.reload({ data, colWidths: columns, rowHeights: rows, mergedCells })
  const merged = s.root.locator('tr').first().locator('td').first()
  await expect(merged).toHaveAttribute('colspan', '2')
  await expect(merged).toHaveText('Merge label')
  await expect(s.root.locator('tr').first().locator('td')).toHaveCount(2)
  await expect(page.getByLabel('Table cell row 1 column 2', { exact: true })).toBeDisabled()
  const dimensions = await tableDimensions(s.root)
  assertWeights(dimensions.columnWidths, columns)
  assertWeights(dimensions.rowHeights, rows)
  expect(dimensions.mergedWidth).toBeCloseTo(
    dimensions.columnWidths[0] + dimensions.columnWidths[1],
    0
  )
  await fieldEvidence(
    info,
    page,
    'table',
    ['colWidths', 'columnSizes', 'rowHeights', 'rowSizes', 'mergedCells'],
    {
      columnRatios: [0.2, 0.3, 0.5],
      rowRatios: [0.2, 0.3, 0.5],
      mergedSpan: 2,
      coveredDataRetained: true,
    },
    {
      persisted,
      dimensions,
      renderedMergedText: await merged.textContent(),
      span: await merged.getAttribute('colspan'),
    }
  )
  await page.getByRole('button', { name: 'Unmerge selected cell', exact: true }).click()
  const unmerged = await s.reload({ data, mergedCells: [], colWidths: columns, rowHeights: rows })
  await expect(s.root.locator('tr').first().locator('td')).toHaveCount(3)
  await expect(s.root.locator('tr').first().locator('td').nth(1)).toHaveText('Covered but retained')
  expect(unmerged.data[0][1]).toBe('Covered but retained')
})
