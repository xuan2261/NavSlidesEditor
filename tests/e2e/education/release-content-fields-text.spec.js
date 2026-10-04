import { test, expect } from '../fixtures/test-fixtures.js'
import {
  contentFixture,
  setupContent,
  inspector,
  fillControl,
  reloadContent,
  readContent,
  fieldEvidence,
  withPresent,
  renderedStyle,
} from './release-content-fields.js'

async function inspectRich(root) {
  const item = root.locator('ul li')
  await expect(item).toHaveText('Qualified rich lesson')
  await expect(item.locator('strong')).toHaveText('Qualified rich lesson')
  await expect(item.locator('em')).toHaveText('Qualified rich lesson')
  await expect(item.locator('u')).toHaveText('Qualified rich lesson')
  const link = item.getByRole('link', { name: 'Qualified rich lesson', exact: true })
  await expect(link).toHaveAttribute('href', 'https://example.com/qualified-rich')
  const styled = item.locator('span[style*="font-family"]').first()
  const style = await renderedStyle(styled, ['fontFamily'])
  expect(style.fontFamily).toContain('Georgia')
  const paragraph = item.locator('p')
  const spacing = await renderedStyle(paragraph, ['lineHeight', 'fontSize'])
  expect(parseFloat(spacing.lineHeight) / parseFloat(spacing.fontSize)).toBeCloseTo(2, 2)
  return {
    text: await item.textContent(),
    href: await link.getAttribute('href'),
    style,
    spacing,
    marks: {
      bold: await item.locator('strong').textContent(),
      italic: await item.locator('em').textContent(),
      underline: await item.locator('u').textContent(),
    },
  }
}

test('text controls qualify persisted rich content marks font family line height list and link [cap:element.text.editor]', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
  const element = contentFixture('text', { content: '<p>Original lesson</p>', height: 300 })
  const target = await setupContent(page, request, testPresentation.id, element)
  await target.dblclick()
  const prose = page.locator('.ProseMirror')
  await prose.press('Control+a')
  await prose.fill('Qualified rich lesson')
  await prose.press('Control+a')
  await page.getByRole('tab', { name: 'Home', exact: true }).click()
  for (const label of ['Bold', 'Italic', 'Underline']) {
    await page.getByRole('button', { name: label, exact: true }).click()
  }
  await page.getByRole('button', { name: 'Paragraph', exact: true }).click()
  await page.getByRole('menu').getByRole('button', { name: 'Bullet list', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Font family', exact: true })
    .selectOption('Georgia, serif')
  await page.getByRole('button', { name: 'Paragraph', exact: true }).click()
  await page.getByRole('menu').getByRole('combobox').selectOption('2')
  await prose.press('Control+a')
  await prose.press('Control+k')
  const palette = page.getByRole('dialog', { name: 'Command palette', exact: true })
  await palette.getByRole('textbox', { name: 'Search commands', exact: true }).fill('Insert Link')
  await palette.getByRole('button', { name: 'Insert Link', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Link URL', exact: true })
    .fill('https://example.com/qualified-rich')
  await page.getByRole('button', { name: 'Insert link', exact: true }).click()
  await prose.press('Escape')
  await expect
    .poll(async () => (await readContent(request, testPresentation.id, element.id)).content)
    .toContain('qualified-rich')
  const authored = await readContent(request, testPresentation.id, element.id)
  expect(authored.content).not.toBe(element.content)
  const { persisted } = await reloadContent(page, request, testPresentation.id, element.id, {
    content: authored.content,
  })
  const canvas = await inspectRich(target)
  const generated = await withPresent(page, (present) =>
    inspectRich(present.locator('.reveal .slides section.present'))
  )
  await fieldEvidence(
    testInfo,
    page,
    'text',
    ['content', 'richMarks', 'fontFamily', 'lineHeight', 'list', 'link'],
    {
      text: 'Qualified rich lesson',
      fontFamily: 'Georgia',
      lineHeight: 2,
      link: 'https://example.com/qualified-rich',
    },
    { persistedContent: persisted.content, canvas, generated }
  )
})

test('text top-level size and color controls change rendered typography after reload [cap:element.text.editor]', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
  const element = contentFixture('text', { content: '<p>Element typography</p>' })
  const target = await setupContent(page, request, testPresentation.id, element)
  await fillControl(page, 'Text font size', 28)
  const color = inspector(page)
    .getByRole('button', { name: 'Text Formatting', exact: true })
    .locator('..')
    .locator('input[type="color"]')
  await expect(color).toBeVisible()
  // Exercise the existing native input boundary; the Chromium chooser is outside the page.
  await color.evaluate((node, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, value)
    node.dispatchEvent(new Event('input', { bubbles: true }))
    node.dispatchEvent(new Event('change', { bubbles: true }))
  }, '#16324f')
  const { persisted } = await reloadContent(page, request, testPresentation.id, element.id, {
    fontSize: 28,
    textColor: '#16324f',
  })
  const style = await renderedStyle(target.locator('p'), ['fontSize', 'color'])
  expect(style).toEqual({ fontSize: '28px', color: 'rgb(22, 50, 79)' })
  await fieldEvidence(
    testInfo,
    page,
    'text',
    ['fontSize', 'textColor'],
    { fontSize: 28, textColor: '#16324f' },
    { persisted, style }
  )
})
