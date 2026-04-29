import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/EditorPage.js'
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

async function setRangeByTestId(page, testId, value) {
  await page.getByTestId(testId).evaluate((node, nextValue) => {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    descriptor.set.call(node, String(nextValue))
    node.dispatchEvent(new Event('input', { bubbles: true }))
    node.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
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

  test('persists common position, rotation, lock, and shadow controls', async ({ page, request }) => {
    const elementId = 'shape-common-1'
    await seedSingleElement(request, presentationId, {
      id: elementId,
      type: 'shape',
      shape: 'rect',
      x: 100,
      y: 120,
      width: 220,
      height: 140,
      zIndex: 1,
      fill: '#6366f1',
      stroke: '#ffffff',
      strokeWidth: 1,
      text: '',
    })

    await editor.gotoPresentation(presentationId)
    await page.getByTestId(`slide-element-${elementId}`).click()

    await page.getByTestId('prop-x').fill('240')
    await page.getByTestId('prop-y').fill('180')
    await page.getByTestId('prop-width').fill('360')
    await page.getByTestId('prop-height').fill('200')
    await page.getByTestId('prop-rotation').fill('45')

    await page.getByTestId('prop-lock-toggle').check()
    await expect(page.getByTestId('resize-handle-se')).toHaveCount(0)
    await page.getByTestId('prop-lock-toggle').uncheck()

    await page.getByTestId('prop-shadow-x').fill('6')
    await page.getByTestId('prop-shadow-y').fill('8')
    await page.getByTestId('prop-shadow-blur').fill('12')
    await page.getByTestId('prop-shadow-color').fill('#112233')

    await expect
      .poll(async () => {
        const el = await savedElement(request, presentationId, elementId)
        return {
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          rotation: el.rotation,
          locked: el.locked || false,
          shadowX: el.shadowX,
          shadowY: el.shadowY,
          shadowBlur: el.shadowBlur,
          shadowColor: (el.shadowColor || '').toLowerCase(),
        }
      })
      .toEqual({
        x: 240,
        y: 180,
        width: 360,
        height: 200,
        rotation: 45,
        locked: false,
        shadowX: 6,
        shadowY: 8,
        shadowBlur: 12,
        shadowColor: '#112233',
      })
  })

  test('persists shape controls including fill, stroke, radius, and label styling', async ({
    page,
    request,
  }) => {
    const elementId = 'shape-style-1'
    await seedSingleElement(request, presentationId, {
      id: elementId,
      type: 'shape',
      shape: 'rect',
      x: 80,
      y: 80,
      width: 240,
      height: 140,
      zIndex: 1,
      fill: '#6366f1',
      stroke: '#ffffff',
      strokeWidth: 2,
      opacity: 1,
      borderRadius: 0,
      text: 'Initial',
      fontSize: 16,
      textColor: '#ffffff',
    })

    await editor.gotoPresentation(presentationId)
    await page.getByTestId(`slide-element-${elementId}`).click()

    await page.getByTestId('prop-shape-fill').fill('#a855f7')
    await page.getByTestId('prop-shape-stroke').fill('#f97316')
    await setRangeByTestId(page, 'prop-shape-stroke-width', 5)
    await setRangeByTestId(page, 'prop-shape-opacity', 85)
    await setRangeByTestId(page, 'prop-shape-border-radius', 24)
    await page.getByTestId('prop-shape-label').fill('Updated Label')
    await page.getByTestId('prop-shape-text-size').fill('22')
    await page.getByTestId('prop-shape-text-color').fill('#10b981')

    await expect
      .poll(async () => {
        const el = await savedElement(request, presentationId, elementId)
        return {
          fill: (el.fill || '').toLowerCase(),
          stroke: (el.stroke || '').toLowerCase(),
          strokeWidth: el.strokeWidth,
          opacity: el.opacity,
          borderRadius: el.borderRadius,
          text: el.text,
          fontSize: el.fontSize,
          textColor: (el.textColor || '').toLowerCase(),
        }
      })
      .toEqual({
        fill: '#a855f7',
        stroke: '#f97316',
        strokeWidth: 5,
        opacity: 0.85,
        borderRadius: 24,
        text: 'Updated Label',
        fontSize: 22,
        textColor: '#10b981',
      })
  })

  test('persists image controls including object fit and filters', async ({ page, request }) => {
    const elementId = 'image-1'
    await seedSingleElement(request, presentationId, {
      id: elementId,
      type: 'image',
      x: 120,
      y: 100,
      width: 320,
      height: 220,
      zIndex: 1,
      src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="orange"/></svg>',
      objectFit: 'contain',
      filterBrightness: 100,
      filterContrast: 100,
      filterGrayscale: 0,
      borderRadius: 0,
    })

    await editor.gotoPresentation(presentationId)
    await page.getByTestId(`slide-element-${elementId}`).click()

    await page.getByTestId('prop-image-object-fit').selectOption('cover')
    await setRangeByTestId(page, 'prop-image-brightness', 120)
    await setRangeByTestId(page, 'prop-image-contrast', 90)
    await setRangeByTestId(page, 'prop-image-grayscale', 30)
    await setRangeByTestId(page, 'prop-image-border-radius', 18)

    await expect
      .poll(async () => {
        const el = await savedElement(request, presentationId, elementId)
        return {
          objectFit: el.objectFit,
          filterBrightness: el.filterBrightness,
          filterContrast: el.filterContrast,
          filterGrayscale: el.filterGrayscale,
          borderRadius: el.borderRadius,
        }
      })
      .toEqual({
        objectFit: 'cover',
        filterBrightness: 120,
        filterContrast: 90,
        filterGrayscale: 30,
        borderRadius: 18,
      })
  })

  test('persists code properties and edit dialog changes', async ({ page, request }) => {
    const elementId = 'code-1'
    await seedSingleElement(request, presentationId, {
      id: elementId,
      type: 'code',
      x: 90,
      y: 90,
      width: 560,
      height: 320,
      zIndex: 1,
      content: 'const value = 1;',
      language: 'javascript',
      fontSize: 14,
      borderRadius: 0,
    })

    await editor.gotoPresentation(presentationId)
    await page.getByTestId(`slide-element-${elementId}`).click()

    await page.getByTestId('prop-code-language').selectOption('python')
    await page.getByTestId('prop-code-font-size').fill('18')
    await setRangeByTestId(page, 'prop-code-border-radius', 12)

    await page.getByTestId('prop-code-edit').click()
    const codeDialog = page.getByRole('dialog')
    await expect(codeDialog.getByRole('heading', { name: 'Code Block' })).toBeVisible()
    await codeDialog.locator('textarea').fill('print("persisted from modal")')
    await codeDialog.getByRole('button', { name: 'Apply' }).click()

    await expect
      .poll(async () => {
        const el = await savedElement(request, presentationId, elementId)
        return {
          language: el.language,
          fontSize: el.fontSize,
          borderRadius: el.borderRadius,
          content: el.content,
        }
      })
      .toEqual({
        language: 'python',
        fontSize: 18,
        borderRadius: 12,
        content: 'print("persisted from modal")',
      })
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
