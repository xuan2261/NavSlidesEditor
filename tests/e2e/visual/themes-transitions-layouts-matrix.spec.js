import { apiUpdatePresentation, test, expect } from '../fixtures/test-fixtures.js'
import {
  VISUAL_MATRIX_LAYOUTS,
  VISUAL_MATRIX_SNAPSHOT_BASELINES,
  VISUAL_MATRIX_THEMES,
  VISUAL_MATRIX_TRANSITIONS,
} from '../fixtures/visual-matrix.js'
import {
  expectStableScreenshot,
  suppressTutorialAndOverlays,
} from '../pages/visual-snapshot-deterministic-freeze-and-helper.js'

const SHOULD_CAPTURE_BASELINES =
  process.platform === 'linux' && process.env.E2E_VISUAL_BASELINES === '1'

function matrixSlide(layout, key) {
  return {
    id: `slide-${key}`,
    layout: layout.id,
    elements: layout.elements,
    notes: '',
    background: { type: 'color', color: '#1e1e2e' },
  }
}

test.describe('themes, transitions, and layouts visual matrix', () => {
  test.describe.configure({ mode: 'parallel' })

  for (const theme of VISUAL_MATRIX_THEMES) {
    for (const transition of VISUAL_MATRIX_TRANSITIONS) {
      for (const layout of VISUAL_MATRIX_LAYOUTS) {
        const key = `${theme}-${transition}-${layout.id}`

        test(`renders ${key}`, async ({ page, request, testPresentation }) => {
          await apiUpdatePresentation(request, testPresentation.id, {
            title: `Visual Matrix ${key}`,
            theme,
            transition,
            slides: [matrixSlide(layout, key)],
          })
          await suppressTutorialAndOverlays(page)
          await page.setViewportSize({ width: 1280, height: 720 })
          await page.goto(`/api/presentations/${testPresentation.id}/present?preview=true`)

          const reveal = page.locator('.reveal').first()
          const section = page.locator('.reveal section').first()
          await expect(reveal).toBeVisible()
          await expect(section).toBeVisible()
          await expect(page.locator(`link[href$="/theme/${theme}.css"]`)).toHaveCount(1)

          const configuredTransition = await page.evaluate(() => window.Reveal?.getConfig?.().transition)
          expect(configuredTransition).toBe(transition)
          if (layout.expectedText) await expect(section).toContainText(layout.expectedText)

          if (SHOULD_CAPTURE_BASELINES && VISUAL_MATRIX_SNAPSHOT_BASELINES.has(key)) {
            await expectStableScreenshot(page, `visual-matrix-${key}.png`, {
              maxDiffPixelRatio: 0.02,
            })
          }
        })
      }
    }
  }
})
