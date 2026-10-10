import { test, expect } from '../fixtures/test-fixtures.js'
import {
  contentFixture,
  setupContent,
  fillControl,
  reloadContent,
  fieldEvidence,
  withPresent,
  withPortable,
  renderedStyle,
} from './release-content-fields.js'
import { findFrame } from './release-surfaces.js'
import { openPrint } from './release-content-fields-html.js'

const markdown =
  '# Qualified Markdown\n\n- **Qualified bold** and *Qualified italic*\n- Second lesson\n\nInline `lesson(19)` and [Qualified link](https://example.com/markdown-qualified).'
async function inspectMarkdown(root) {
  await expect(root.getByRole('heading', { name: 'Qualified Markdown', exact: true })).toBeVisible()
  await expect(root.locator('ul li')).toHaveText([
    'Qualified bold and Qualified italic',
    'Second lesson',
  ])
  await expect(root.locator('strong')).toHaveText('Qualified bold')
  await expect(root.locator('em')).toHaveText('Qualified italic')
  await expect(root.locator('p code')).toHaveText('lesson(19)')
  const link = root.getByRole('link', { name: 'Qualified link', exact: true })
  await expect(link).toHaveAttribute('href', 'https://example.com/markdown-qualified')
  const style = await renderedStyle(root.locator('p').filter({ hasText: 'Inline' }), [
    'fontSize',
    'color',
  ])
  expect(style).toEqual({ fontSize: '26px', color: 'rgb(22, 50, 79)' })
  return {
    heading: await root.locator('h1').textContent(),
    list: await root.locator('ul li').allTextContents(),
    bold: await root.locator('strong').textContent(),
    italic: await root.locator('em').textContent(),
    inlineCode: await root.locator('p code').textContent(),
    href: await link.getAttribute('href'),
    style,
  }
}

test('Markdown content controls qualify all semantic marks and typography in editor Present and print [cap:element.markdown.editor]', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
  const element = contentFixture('markdown', {
    content: '# Original Markdown',
    width: 950,
    height: 550,
  })
  await setupContent(page, request, testPresentation.id, element)
  await fillControl(page, 'Markdown content', markdown)
  await fillControl(page, 'Markdown font size', 26)
  await fillControl(page, 'Markdown text color', '#16324f')
  const patch = { content: markdown, fontSize: 26, textColor: '#16324f' }
  const { target, persisted } = await reloadContent(
    page,
    request,
    testPresentation.id,
    element.id,
    patch
  )
  const canvas = await inspectMarkdown(target)
  const generated = await withPresent(page, async (present) =>
    inspectMarkdown(await findFrame(present, '#out h1'))
  )
  await page.getByRole('button', { name: 'File menu', exact: true }).click()
  const pending = page.waitForEvent('popup')
  await page.getByRole('menuitem', { name: 'Export PDF', exact: true }).click()
  const print = await pending
  try {
    await print.waitForFunction(() => window.__navslidesExportReady === true)
    const printed = await inspectMarkdown(print.locator('.slide-page'))
    const screenshot = testInfo.outputPath('markdown-field-print.png')
    await print.screenshot({ path: screenshot, fullPage: true })
    await fieldEvidence(
      testInfo,
      page,
      'markdown',
      [
        'content',
        'fontSize',
        'textColor',
        'heading',
        'list',
        'bold',
        'italic',
        'inlineCode',
        'link',
        'typography',
      ],
      patch,
      { persisted, canvas, generated, printed },
      [screenshot]
    )
  } finally {
    await print.close()
  }
})

test('Markdown cannot promote authored iframe markers into executable print or portable documents [cap:element.markdown.editor]', async ({
  page,
  request,
  browser,
  testPresentation,
}, testInfo) => {
  test.setTimeout(120000)
  const attack = encodeURIComponent(
    '<script>parent.document.body.dataset.markdownEscape="escaped"</script>'
  )
  const content = `# Safe Markdown\n\n**Readable lesson**\n\n<iframe data-pdf-iframe="${attack}"></iframe>`
  const element = contentFixture('markdown', { content: '# Original', width: 950, height: 550 })
  await setupContent(page, request, testPresentation.id, element)
  await fillControl(page, 'Markdown content', content)
  const { target } = await reloadContent(page, request, testPresentation.id, element.id, {
    content,
  })
  async function inspect(root, document) {
    await expect(root.getByRole('heading', { name: 'Safe Markdown', exact: true })).toBeVisible()
    await expect(root.locator('strong')).toHaveText('Readable lesson')
    await expect(root.locator('iframe, script, [data-pdf-iframe]')).toHaveCount(0)
    expect(await document.evaluate(() => document.body.dataset.markdownEscape || null)).toBeNull()
  }
  await inspect(target, page)
  await withPresent(page, async (present) => inspect(await findFrame(present, '#out h1'), present))
  const print = await openPrint(page)
  try {
    await inspect(print.locator('.slide-page'), print)
    await print.screenshot({
      path: testInfo.outputPath('markdown-print-promotion-denied.png'),
      fullPage: true,
    })
  } finally {
    await print.close()
  }
  await withPortable(page, browser, testInfo, 'markdown-promotion-denied.html', async (offline) => {
    await inspect(await findFrame(offline, '#out h1'), offline)
    await offline.screenshot({
      path: testInfo.outputPath('markdown-portable-promotion-denied.png'),
    })
  })
})
