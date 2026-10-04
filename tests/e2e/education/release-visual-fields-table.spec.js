import { test, expect } from '../fixtures/test-fixtures.js'
import {
  visualSession,
  fillControl,
  colorControl,
  fieldEvidence,
  styleOf,
} from './release-visual-fields.js'

test('table cell data and all per-cell style controls survive reload and affect only selected cell', async ({
  page,
  request,
  testPresentation,
}, info) => {
  const s = await visualSession(page, request, testPresentation.id, 'table', {
    data: [
      ['Heading A', 'Heading B'],
      ['Initial body', 'Untouched body'],
    ],
    mergedCells: [],
    colWidths: [],
    rowHeights: [],
    cellStyles: {},
  })
  await page.getByLabel('Table cell row 2 column 1', { exact: true }).fill('Authored styled cell')
  await colorControl(page, 'Selected cell row 2 column 1 background color', '#fef08a')
  await colorControl(page, 'Selected cell row 2 column 1 text color', '#9f1239')
  await page.getByLabel('Selected cell row 2 column 1 bold', { exact: true }).check()
  await page
    .getByLabel('Selected cell row 2 column 1 horizontal alignment', { exact: true })
    .selectOption('right')
  await page
    .getByLabel('Selected cell row 2 column 1 vertical alignment', { exact: true })
    .selectOption('bottom')
  const persisted = await s.reload({
    data: [
      ['Heading A', 'Heading B'],
      ['Authored styled cell', 'Untouched body'],
    ],
  })
  const values = Object.fromEntries(
    ['bgColors', 'textColors', 'isBold', 'aligns', 'vAligns'].map((key) => [
      key,
      persisted.cellStyles[key][1][0],
    ])
  )
  expect(values).toEqual({
    bgColors: '#fef08a',
    textColors: '#9f1239',
    isBold: true,
    aligns: 'right',
    vAligns: 'bottom',
  })
  const styled = s.root.locator('tr').nth(1).locator('td').nth(0)
  const untouched = s.root.locator('tr').nth(1).locator('td').nth(1)
  await expect(styled).toHaveText('Authored styled cell')
  await expect(styled).toHaveCSS('background-color', 'rgb(254, 240, 138)')
  await expect(styled).toHaveCSS('color', 'rgb(159, 18, 57)')
  await expect(styled).toHaveCSS('font-weight', '600')
  await expect(styled).toHaveCSS('text-align', 'right')
  await expect(styled).toHaveCSS('vertical-align', 'bottom')
  await expect(untouched).toHaveText('Untouched body')
  await expect(untouched).toHaveCSS('font-weight', '400')
  await expect(untouched).toHaveCSS('text-align', 'left')
  await fieldEvidence(
    info,
    page,
    'table',
    ['data', 'cellData', 'cellStyles', 'cellStyle'],
    {
      authoredCell: 'Authored styled cell',
      perCellColorBoldAlignment: true,
      otherCellUnchanged: true,
    },
    {
      persisted,
      effective: await styleOf(styled, [
        'backgroundColor',
        'color',
        'fontWeight',
        'textAlign',
        'verticalAlign',
      ]),
      untouched: await styleOf(untouched, ['fontWeight', 'textAlign']),
    }
  )
})

test('table header toggle, header colors, body color, font and border style visibly persist', async ({
  page,
  request,
  testPresentation,
}, info) => {
  const s = await visualSession(page, request, testPresentation.id, 'table', {
    data: [
      ['Heading A', 'Heading B'],
      ['Body A', 'Body B'],
    ],
    mergedCells: [],
    cellStyles: {},
  })
  await colorControl(page, 'Table Header BG', '#bfdbfe')
  await colorControl(page, 'Table Header Text', '#1e3a8a')
  await colorControl(page, 'Table Text Color', '#166534')
  await colorControl(page, 'Table Border', '#b91c1c')
  await page.getByLabel('Table border style', { exact: true }).selectOption('dashed')
  await fillControl(page, 'Table font size', 22)
  const persisted = await s.reload({
    headerBgColor: '#bfdbfe',
    headerTextColor: '#1e3a8a',
    textColor: '#166534',
    borderColor: '#b91c1c',
    borderStyle: 'dashed',
    fontSize: 22,
  })
  const header = s.root.locator('tr').first().locator('td').first()
  const body = s.root.locator('tr').nth(1).locator('td').first()
  await expect(header).toHaveCSS('background-color', 'rgb(191, 219, 254)')
  await expect(header).toHaveCSS('color', 'rgb(30, 58, 138)')
  await expect(body).toHaveCSS('color', 'rgb(22, 101, 52)')
  await expect(body).toHaveCSS('font-size', '22px')
  await expect(body).toHaveCSS('border-top-style', 'dashed')
  await expect(body).toHaveCSS('border-top-color', 'rgb(185, 28, 28)')
  await fieldEvidence(
    info,
    page,
    'table',
    [
      'headerBgColor',
      'headerTextColor',
      'textColor',
      'fontSize',
      'borderColor',
      'borderStyle',
      'border',
    ],
    { headerDistinctFromBody: true, fontPixels: 22, border: 'dashed red' },
    {
      persisted,
      header: await styleOf(header, ['color', 'backgroundColor']),
      body: await styleOf(body, ['color', 'fontSize', 'borderTopColor', 'borderTopStyle']),
    }
  )
  await page.getByTestId('prop-table-header-row').uncheck()
  const unheaded = await s.reload({ headerRow: false })
  await expect(header).toHaveCSS('color', 'rgb(22, 101, 52)')
  await expect(header).toHaveCSS('font-weight', '400')
  await expect(header).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await fieldEvidence(
    info,
    page,
    'table',
    ['headerRow', 'header'],
    { firstRowUsesBodyStyle: true, headerDisabled: true },
    {
      persisted: unheaded,
      firstRow: await styleOf(header, ['color', 'fontWeight', 'backgroundColor']),
    }
  )
})
