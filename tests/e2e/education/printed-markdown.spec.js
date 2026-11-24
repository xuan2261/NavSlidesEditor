import { test, expect, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { launchPresentPopup } from './present-offline-helpers.js'

const fenced =
  '  const template = "<strong>literal</strong>";\n\n  const closing = "</script> &quot;";\n  console.log(template);\n'
const markdown =
  '# Markdown parity\n\nParagraph first line\ncontinues here.\n\n' +
  'Inline `<strong>literal</strong>`\n\n```javascript\n' +
  fenced +
  '```\n\n' +
  '**Bold** and *italic*\n\nA <em>raw emphasis</em> example.\n\n' +
  'Literal entities: &quot; &amp; &lt;\n\n' +
  '[Safe reference](https://example.com) and [Unsafe reference](javascript:alert(1))\n\n3. Third\n4. Fourth\n\n' +
  '<script>window.__markdownCompromised = true</script>'

async function inspectMarkdown(root) {
  await expect(root.getByRole('heading', { name: 'Markdown parity', exact: true })).toBeVisible()
  await expect(root.locator('p').filter({ hasText: 'Paragraph first line' })).toHaveText(
    'Paragraph first line\ncontinues here.'
  )
  await expect(root.locator('p code')).toHaveText('<strong>literal</strong>')
  await expect(root.locator('pre code')).toHaveText(fenced, { useInnerText: false })
  expect(await root.locator('pre code').textContent()).toBe(fenced)
  await expect(root.locator('code strong')).toHaveCount(0)
  await expect(root.getByRole('link', { name: 'Safe reference', exact: true })).toHaveAttribute(
    'href',
    'https://example.com'
  )
  await expect(root.getByRole('link', { name: 'Unsafe reference', exact: true })).toHaveAttribute(
    'href',
    '#'
  )
  await expect(root.locator('strong')).toHaveText('Bold')
  await expect(root.locator('em')).toHaveText(['italic', 'raw emphasis'])
  await expect(root.getByText('Literal entities: " & <', { exact: true })).toBeVisible()
  await expect(root.locator('ol')).toHaveAttribute('start', '3')
  await expect(root.locator('ol li')).toHaveText(['Third', 'Fourth'])
}

test('PDF print preserves Markdown code literals, blank lines and paragraph structure', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
  await apiUpdatePresentation(request, testPresentation.id, {
    resolution: { width: 1280, height: 720 },
    codeTheme: 'monokai',
    slides: [
      {
        id: 'markdown-print',
        background: { type: 'color', color: '#f8fafc' },
        elements: [
          {
            id: 'markdown',
            type: 'markdown',
            x: 40,
            y: 40,
            width: 1000,
            height: 620,
            content: markdown,
            fontSize: 18,
            textColor: '#111111',
          },
        ],
      },
    ],
  })
  const editor = new EditorPage(page)
  await editor.gotoPresentation(testPresentation.id)
  const canvas = page.getByTestId('slide-element-markdown')
  await expect(canvas.locator('p code')).toHaveText('<strong>literal</strong>')
  const { popup: present } = await launchPresentPopup(page)
  try {
    await present.waitForFunction(() => window.Reveal?.isReady())
    await inspectMarkdown(present.frameLocator('iframe'))
    expect(await present.frames()[1].evaluate(() => window.__markdownCompromised)).toBeUndefined()
  } finally {
    await present.close()
  }
  await page.getByRole('button', { name: 'File menu', exact: true }).click()
  const printPromise = page.waitForEvent('popup')
  await page.getByRole('menuitem', { name: 'Export PDF', exact: true }).click()
  const print = await printPromise
  const errors = []
  print.on('pageerror', (error) => errors.push(error.message))
  try {
    await print.waitForFunction(() => window.__navslidesExportReady === true)
    await inspectMarkdown(print.locator('.slide-page'))
    const paint = await print.locator('pre code').evaluate((code) => {
      const colors = [],
        walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT)
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        const color = getComputedStyle(text.parentElement).color
        for (let index = 0; index < text.data.length; index++) colors.push(color)
      }
      const start = code.textContent.indexOf('const')
      return {
        keyword: colors.slice(start, start + 5),
        identifier: colors.slice(start + 6, start + 14),
      }
    })
    expect(paint.keyword).toEqual(Array(5).fill('rgb(249, 38, 114)'))
    expect(paint.identifier).toEqual(Array(8).fill('rgb(221, 221, 221)'))
    expect(
      await print
        .getByRole('heading', { name: 'Markdown parity', exact: true })
        .evaluate((node) => ({
          fontSize: getComputedStyle(node.parentElement).fontSize,
          color: getComputedStyle(node).color,
        }))
    ).toEqual({ fontSize: '18px', color: 'rgb(17, 17, 17)' })
    expect(await print.evaluate(() => window.__markdownCompromised)).toBeUndefined()
    expect(errors).toEqual([])
    await print.screenshot({ path: testInfo.outputPath('printed-markdown-literals.png') })
  } finally {
    await print.close()
  }
})
