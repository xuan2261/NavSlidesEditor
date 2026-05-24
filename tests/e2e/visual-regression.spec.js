import {
  apiUpdatePresentation,
  test,
  expect,
} from './fixtures/test-fixtures.js'
import {
  freezeUiForSnapshot,
  skipNonLinuxVisualSnapshots,
  suppressTutorialAndOverlays,
} from './pages/visual-snapshot-deterministic-freeze-and-helper.js'

function seededSlide(elements = []) {
  return {
    id: 'slide-1',
    elements,
    notes: '',
    background: { type: 'color', color: '#1e1e2e' },
  }
}

test.describe('Visual Regression', () => {
  skipNonLinuxVisualSnapshots()

  test('editor canvas baseline remains stable', async ({ page, request, testPresentation }) => {
    const presentationId = testPresentation.id
    await apiUpdatePresentation(request, presentationId, {
      title: 'Visual Regression Baseline',
      slides: [
        seededSlide([
          {
            id: 'visual-shape-1',
            type: 'shape',
            shape: 'rect',
            x: 80,
            y: 90,
            width: 240,
            height: 140,
            zIndex: 1,
            fill: '#6366f1',
            stroke: '#ffffff',
            strokeWidth: 2,
            text: 'Stable Box',
            fontSize: 24,
            textColor: '#ffffff',
          },
          {
            id: 'visual-chart-1',
            type: 'chart',
            x: 360,
            y: 90,
            width: 480,
            height: 280,
            zIndex: 2,
            chartType: 'bar',
            chartData: {
              labels: ['Q1', 'Q2', 'Q3', 'Q4'],
              datasets: [{ label: 'Revenue', data: [10, 18, 14, 22], color: '#22c55e' }],
            },
          },
          {
            id: 'visual-table-1',
            type: 'table',
            x: 120,
            y: 280,
            width: 420,
            height: 180,
            zIndex: 3,
            data: [
              ['Metric', 'Value'],
              ['Users', '1200'],
              ['NPS', '62'],
            ],
            headerRow: true,
            headerBgColor: '#334155',
            textColor: '#f8fafc',
            borderColor: '#64748b',
            fontSize: 14,
          },
        ]),
      ],
    })

    await suppressTutorialAndOverlays(page)

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/editor/${presentationId}`)
    const slideCanvas = page.locator('.slide-canvas')
    await expect(slideCanvas).toBeVisible()
    await freezeUiForSnapshot(page)

    await expect(slideCanvas).toHaveScreenshot('editor-canvas-basic.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
    })
  })
})
