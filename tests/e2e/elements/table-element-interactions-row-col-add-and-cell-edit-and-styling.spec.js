import { test, expect } from '@playwright/test'
import { EditorPage } from '../pages/EditorPage.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'

function tableEl(overrides = {}) {
  return {
    id: 'table-1',
    type: 'table',
    x: 80,
    y: 100,
    width: 560,
    height: 280,
    zIndex: 1,
    data: [
      ['Header A', 'Header B', 'Header C'],
      ['A1', 'B1', 'C1'],
      ['A2', 'B2', 'C2'],
    ],
    headerRow: true,
    headerBgColor: '#6366f1',
    textColor: '#ffffff',
    borderColor: '#555555',
    fontSize: 14,
    cellStyles: { textColors: [], bgColors: [], isBold: [], aligns: [], vAligns: [] },
    ...overrides,
  }
}

async function seedSlide(request, presId, elements) {
  await apiUpdatePresentation(request, presId, {
    slides: [{
      id: 'slide-1',
      elements,
      notes: '',
      background: { type: 'color', color: '#1e1e2e' },
    }],
  })
}

test.describe('Table element interactions row column add remove cell edit and styling', () => {
  let editor
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Table interactions')
    presId = pres.id
    editor = new EditorPage(page)
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('renders seeded 3x3 table with header row', async ({ page, request }) => {
    await seedSlide(request, presId, [tableEl()])
    await editor.gotoPresentation(presId)
    const wrapper = page.getByTestId('slide-element-table-1')
    await expect(wrapper).toBeVisible()
    const rows = wrapper.locator('tr')
    await expect(rows).toHaveCount(3)
    await expect(wrapper.locator('td').first()).toContainText('Header A')
  })

  test('persists table data via API seed and reload', async ({ page, request }) => {
    await seedSlide(request, presId, [tableEl()])
    await editor.gotoPresentation(presId)
    const saved = await apiGetPresentation(request, presId)
    expect(saved.slides[0].elements[0].type).toBe('table')
    expect(saved.slides[0].elements[0].data).toEqual([
      ['Header A', 'Header B', 'Header C'],
      ['A1', 'B1', 'C1'],
      ['A2', 'B2', 'C2'],
    ])
  })

  test('adds a row via property panel', async ({ page, request }) => {
    await seedSlide(request, presId, [tableEl()])
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-table-1').click()
    await page.getByTestId('prop-table-add-row').click()
    await expect.poll(async () => {
      const saved = await apiGetPresentation(request, presId)
      return saved.slides[0].elements[0].data.length
    }).toBe(4)
  })

  test('adds a column via property panel', async ({ page, request }) => {
    await seedSlide(request, presId, [tableEl()])
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-table-1').click()
    await page.getByTestId('prop-table-add-col').click()
    await expect.poll(async () => {
      const saved = await apiGetPresentation(request, presId)
      return saved.slides[0].elements[0].data[0].length
    }).toBe(4)
  })

  test('toggles header row off and persists', async ({ page, request }) => {
    await seedSlide(request, presId, [tableEl()])
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-table-1').click()
    await page.getByTestId('prop-table-header-row').uncheck()
    await expect.poll(async () => {
      const saved = await apiGetPresentation(request, presId)
      return saved.slides[0].elements[0].headerRow
    }).toBe(false)
  })

  test('edits cell value and persists', async ({ page, request }) => {
    await seedSlide(request, presId, [tableEl()])
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-table-1').click()
    await page.getByTestId('prop-table-cell-1-0').fill('Edited A1')
    await expect.poll(async () => {
      const saved = await apiGetPresentation(request, presId)
      return saved.slides[0].elements[0].data[1][0]
    }).toBe('Edited A1')
  })

  test('changes header background color and persists', async ({ page, request }) => {
    await seedSlide(request, presId, [tableEl()])
    await editor.gotoPresentation(presId)
    await page.getByTestId('slide-element-table-1').click()
    await page.getByTestId('prop-table-header-bg').fill('#0f766e')
    await expect.poll(async () => {
      const saved = await apiGetPresentation(request, presId)
      return (saved.slides[0].elements[0].headerBgColor || '').toLowerCase()
    }).toBe('#0f766e')
  })
})
