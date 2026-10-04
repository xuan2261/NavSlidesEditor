import { test, expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { launchPresentPopup } from './present-offline-helpers.js'

const source = '\n  const label = "<strong>literal</strong>";\n\n  console.log(label);\n'
const walkthrough = 'const a = 1;\nconst b = 2;\nreturn a + b;'
const box = { width: 540, height: 180, zIndex: 1 }
const image =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160"><rect width="300" height="160" fill="#22c55e"/></svg>'
  ).toString('base64')

async function inspectCode(page) {
  const plain = page.locator('pre:not([data-code-walkthrough]) code')
  await expect.poll(() => plain.textContent()).toBe(source)
  await expect(plain.locator('.hljs-keyword').first()).toHaveText('const')
  await expect(plain.locator('strong')).toHaveCount(0)
  const lines = page.locator('[data-code-line]')
  await expect(lines).toHaveText(walkthrough.split('\n'))
  const active = page.locator('[data-walkthrough-active="true"]')
  await expect(active).toHaveText(['const b = 2;', 'return a + b;'])
  await expect(active.first()).toHaveCSS('background-color', 'rgba(250, 204, 21, 0.18)')
}

async function inspectImage(page) {
  const img = page.locator('img[alt="Accessible diagram"]')
  const descriptionId = await img.getAttribute('aria-describedby')
  await expect(img).toHaveAccessibleDescription('Diagram detail')
  const description = page.locator(`#${descriptionId}`)
  await expect(description).toHaveText('Diagram detail')
  const hidden = await description.evaluate((node) => {
    const style = getComputedStyle(node)
    return {
      width: style.width,
      height: style.height,
      clipPath: style.clipPath,
      overflow: style.overflow,
      position: style.position,
    }
  })
  expect(hidden).toEqual({
    width: '1px',
    height: '1px',
    clipPath: 'inset(50%)',
    overflow: 'hidden',
    position: 'absolute',
  })
  const citation = page.getByRole('link', { name: 'Source A', exact: true })
  await expect(citation).toBeVisible()
  const positions = await citation.evaluate((node) => {
    const image = document.querySelector('img[alt="Accessible diagram"]')
    const parent = image.closest('[style*="overflow:visible"]')
    return {
      citationTop: node.getBoundingClientRect().top,
      imageBottom: parent.getBoundingClientRect().bottom,
    }
  })
  expect(positions.citationTop).toBeGreaterThanOrEqual(positions.imageBottom - 1)
}

test('generated Present and print preserve source, walkthrough and accessible cropped citation', async ({
  page,
  request,
}) => {
  const presentation = await apiCreatePresentation(request, 'Generated code and image regression')
  let popup
  try {
    await apiUpdatePresentation(request, presentation.id, {
      resolution: { width: 1280, height: 720 },
      slides: [
        {
          id: 'render-regression',
          background: { type: 'color', color: '#f8fafc' },
          elements: [
            {
              ...box,
              id: 'ordinary',
              type: 'code',
              x: 30,
              y: 40,
              language: 'javascript',
              content: source,
              fontSize: 18,
            },
            {
              ...box,
              id: 'walkthrough',
              type: 'code',
              x: 30,
              y: 310,
              language: 'javascript',
              content: walkthrough,
              walkthroughSteps: [
                { label: 'First', startLine: 1, endLine: 1 },
                { label: 'Return', startLine: 2, endLine: 3 },
              ],
              defaultStepIndex: 1,
            },
            {
              ...box,
              id: 'image',
              type: 'image',
              x: 650,
              y: 160,
              width: 420,
              src: image,
              alt: 'Accessible diagram',
              longDescription: 'Diagram detail',
              imageW: 460,
              imageH: 200,
              imageOffsetX: -20,
              imageOffsetY: -10,
              citationText: 'Source A',
              citationLink: 'https://example.com',
            },
          ],
        },
      ],
    })
    const editor = new EditorPage(page)
    await editor.gotoPresentation(presentation.id)
    await expect(page.locator('img[alt="Accessible diagram"]').last()).toHaveAccessibleDescription(
      'Diagram detail'
    )
    ;({ popup } = await launchPresentPopup(page))
    await popup.waitForFunction(() => window.Reveal?.isReady())
    await inspectCode(popup)
    await inspectImage(popup)
    await popup.close()
    await page.getByRole('button', { name: 'File menu', exact: true }).click()
    const printPopup = page.waitForEvent('popup')
    await page.getByRole('menuitem', { name: 'Export PDF', exact: true }).click()
    popup = await printPopup
    await popup.waitForLoadState('domcontentloaded')
    await inspectCode(popup)
    await inspectImage(popup)
  } finally {
    await popup?.close()
    await apiDeletePresentation(request, presentation.id)
  }
})
