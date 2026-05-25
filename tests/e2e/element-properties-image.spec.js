import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from './fixtures/test-fixtures.js'

function seededSlide(elements = []) {
  return {
    id: 'slide-1',
    elements,
    notes: '',
    background: { type: 'color', color: '#1e1e2e' },
  }
}

async function seedSingleElement(request, presentationId, element) {
  await apiUpdatePresentation(request, presentationId, {
    slides: [seededSlide([element])],
  })
}

async function savedElement(request, presentationId, elementId) {
  const saved = await apiGetPresentation(request, presentationId)
  return saved.slides[0].elements.find((el) => el.id === elementId)
}

test.describe('Element Properties Persistence', () => {
  let editor
  let presentationId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Element Properties Persistence')
    presentationId = pres.id
    editor = new EditorPage(page)
  })

  test.afterEach(async ({ request }) => {
    await apiDeletePresentation(request, presentationId)
  })

  test('persists chart type, labels, series values, and add series action', async ({ page, request }) => {
    const elementId = 'chart-1'
    await seedSingleElement(request, presentationId, {
      id: elementId,
      type: 'chart',
      x: 100,
      y: 90,
      width: 520,
      height: 300,
      zIndex: 1,
      chartType: 'bar',
      chartData: {
        labels: ['A', 'B'],
        datasets: [{ label: 'Series 1', data: [1, 2], color: '#6366f1' }],
      },
    })

    await editor.gotoPresentation(presentationId)
    await page.getByTestId(`slide-element-${elementId}`).click()

    await page.getByTestId('prop-chart-type').selectOption('line')
    await page.getByTestId('prop-chart-labels').fill('Jan, Feb, Mar')
    await page.getByTestId('prop-chart-values-0').fill('10, 20, 30')
    await page.getByTestId('prop-chart-color-0').fill('#ef4444')
    await page.getByTestId('prop-chart-add-series').click()
    await page.getByTestId('prop-chart-series-label-1').fill('Series 2')
    await page.getByTestId('prop-chart-values-1').fill('7, 8, 9')
    await page.getByTestId('prop-chart-color-1').fill('#22c55e')

    await expect
      .poll(async () => {
        const el = await savedElement(request, presentationId, elementId)
        return {
          chartType: el.chartType,
          labels: el.chartData?.labels || [],
          datasets: (el.chartData?.datasets || []).map((dataset) => ({
            label: dataset.label,
            data: dataset.data,
            color: (dataset.color || '').toLowerCase(),
          })),
        }
      })
      .toEqual({
        chartType: 'line',
        labels: ['Jan', 'Feb', 'Mar'],
        datasets: [
          { label: 'Series 1', data: [10, 20, 30], color: '#ef4444' },
          { label: 'Series 2', data: [7, 8, 9], color: '#22c55e' },
        ],
      })
  })

  test('persists table row/column operations, table styles, and edited cell values', async ({
    page,
    request,
  }) => {
    const elementId = 'table-1'
    await seedSingleElement(request, presentationId, {
      id: elementId,
      type: 'table',
      x: 80,
      y: 100,
      width: 560,
      height: 300,
      zIndex: 1,
      data: [
        ['Header 1', 'Header 2'],
        ['A1', 'B1'],
      ],
      headerRow: true,
      headerBgColor: '#6366f1',
      textColor: '#ffffff',
      borderColor: '#555555',
      fontSize: 14,
      cellStyles: {
        textColors: [],
        bgColors: [],
        isBold: [],
        aligns: [],
        vAligns: [],
      },
    })

    await editor.gotoPresentation(presentationId)
    await page.getByTestId(`slide-element-${elementId}`).click()

    await page.getByTestId('prop-table-add-row').click()
    await page.getByTestId('prop-table-add-col').click()
    await page.getByTestId('prop-table-header-row').uncheck()
    await page.getByTestId('prop-table-header-bg').fill('#334155')
    await page.getByTestId('prop-table-text-color').fill('#f8fafc')
    await page.getByTestId('prop-table-font-size').fill('16')
    await page.getByTestId('prop-table-cell-1-1').fill('Edited Cell')

    await expect
      .poll(async () => {
        const el = await savedElement(request, presentationId, elementId)
        return {
          rows: el.data.length,
          cols: el.data[0].length,
          headerRow: el.headerRow,
          headerBgColor: (el.headerBgColor || '').toLowerCase(),
          textColor: (el.textColor || '').toLowerCase(),
          fontSize: el.fontSize,
          editedCell: el.data[1][1],
        }
      })
      .toEqual({
        rows: 3,
        cols: 3,
        headerRow: false,
        headerBgColor: '#334155',
        textColor: '#f8fafc',
        fontSize: 16,
        editedCell: 'Edited Cell',
      })
  })
})
