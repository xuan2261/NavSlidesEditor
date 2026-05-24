import { test, expect } from '@playwright/test'
import { EditorPage } from '../pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'

const CHART_TYPES = ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea']

function chartElement(chartType, idx = 0) {
  return {
    id: `chart-${chartType}`,
    type: 'chart',
    x: 80 + idx * 10,
    y: 80,
    width: 480,
    height: 280,
    zIndex: idx + 1,
    chartType,
    chartData: {
      labels: ['A', 'B', 'C'],
      datasets: [{ label: 'Series', data: [4, 7, 5], color: '#6366f1' }],
    },
  }
}

test.describe('Chart Types Smoke', () => {
  let editor
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Chart types smoke')
    presId = pres.id
    editor = new EditorPage(page)
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  for (const chartType of CHART_TYPES) {
    test(`renders ${chartType} chart from seed`, async ({ page, request }) => {
      await apiUpdatePresentation(request, presId, {
        slides: [{
          id: 'slide-1',
          elements: [chartElement(chartType)],
          notes: '',
          background: { type: 'color', color: '#1e1e2e' },
        }],
      })
      await editor.gotoPresentation(presId)
      const wrapper = page.getByTestId(`slide-element-chart-${chartType}`)
      await expect(wrapper).toBeVisible()
      const iframe = wrapper.locator('iframe[title="Chart"]')
      await expect(iframe).toBeVisible()
      await expect.poll(async () => {
        const saved = await apiGetPresentation(request, presId)
        return saved.slides[0].elements[0].chartType
      }).toBe(chartType)
    })
  }

  test('switches chart type via property panel', async ({ page, request }) => {
    await apiUpdatePresentation(request, presId, {
      slides: [{
        id: 'slide-1',
        elements: [chartElement('bar')],
        notes: '',
        background: { type: 'color', color: '#1e1e2e' },
      }],
    })
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-chart-bar').click()
    await page.getByTestId('prop-chart-type').selectOption('doughnut')
    await expect.poll(async () => {
      const saved = await apiGetPresentation(request, presId)
      return saved.slides[0].elements[0].chartType
    }).toBe('doughnut')
  })
})
