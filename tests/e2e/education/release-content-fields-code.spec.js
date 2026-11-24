import { test, expect } from '../fixtures/test-fixtures.js'
import {
  contentFixture,
  setupContent,
  inspector,
  fillControl,
  rangeControl,
  sourceControl,
  reloadContent,
  fieldEvidence,
  withPresent,
  renderedStyle,
} from './release-content-fields.js'

const python = 'def qualified_sum(a, b):\n    result = a + b\n    return result'
async function inspectCode(root, canvas) {
  const code = root.locator('pre code')
  if (canvas) await expect(code.locator('[data-code-line]')).toHaveText(python.split('\n'))
  else await expect(code).toHaveText(python, { useInnerText: false })
  await expect(code.locator('.hljs-keyword').first()).toHaveText('def')
  const style = await renderedStyle(root.locator('pre'), ['fontSize'])
  expect(style.fontSize).toBe('24px')
  const clipping = await root.locator('pre').evaluate((node) => {
    for (let parent = node; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent)
      if (parseFloat(style.borderRadius) === 18)
        return { radius: style.borderRadius, overflow: style.overflow }
    }
    throw new Error('Rounded code clipping ancestor not rendered')
  })
  expect(clipping).toEqual({ radius: '18px', overflow: 'hidden' })
  return {
    lines: python.split('\n').map((_, index) => index + 1),
    renderedText: await code.textContent(),
    keyword: await code.locator('.hljs-keyword').first().textContent(),
    style,
    clipping,
  }
}

test('code source language font and radius author controls qualify readable rendered source [cap:element.code.editor]', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
  const element = contentFixture('code', { content: 'Original code', width: 700, height: 300 })
  await setupContent(page, request, testPresentation.id, element)
  await sourceControl(page, 'code', python)
  await inspector(page).getByLabel('Code language', { exact: true }).selectOption('python')
  await fillControl(page, 'Code font size', 24)
  await rangeControl(page, 'Code corner radius', 18)
  const patch = { content: python, language: 'python', fontSize: 24, borderRadius: 18 }
  const { target, persisted } = await reloadContent(
    page,
    request,
    testPresentation.id,
    element.id,
    patch
  )
  const canvas = await inspectCode(target, true)
  await withPresent(page, async (present) => {
    const generated = await inspectCode(present.locator('.reveal .slides section.present'), false)
    const screenshot = testInfo.outputPath('code-field-source-present.png')
    await present.screenshot({ path: screenshot })
    await fieldEvidence(
      testInfo,
      page,
      'code',
      ['content', 'language', 'fontSize', 'borderRadius', 'font', 'rounding'],
      patch,
      { persisted, canvas, generated },
      [screenshot]
    )
  })
})

test('code walkthrough controls move default active lines and survive reload [cap:element.code.editor]', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
  const element = contentFixture('code', {
    content: python,
    language: 'python',
    width: 700,
    height: 300,
  })
  await setupContent(page, request, testPresentation.id, element)
  const panel = inspector(page)
  await panel.getByTestId('prop-code-walkthrough-add').click()
  await fillControl(page, 'Walkthrough step 1 label', 'Signature')
  await panel.getByTestId('prop-code-walkthrough-add').click()
  await fillControl(page, 'Walkthrough step 2 label', 'Return calculation')
  await fillControl(page, 'Walkthrough step 2 start line', 2)
  await fillControl(page, 'Walkthrough step 2 end line', 3)
  await panel.getByLabel('Default walkthrough step', { exact: true }).selectOption('0')
  const target = page.getByTestId(`slide-element-${element.id}`)
  await expect(target.locator('[data-walkthrough-active="true"]')).toHaveText([
    python.split('\n')[0],
  ])
  await panel.getByLabel('Default walkthrough step', { exact: true }).selectOption('1')
  const patch = {
    defaultStepIndex: 1,
    walkthroughSteps: [
      { label: 'Signature', startLine: 1, endLine: 1 },
      { label: 'Return calculation', startLine: 2, endLine: 3 },
    ],
  }
  const { persisted } = await reloadContent(page, request, testPresentation.id, element.id, patch)
  const inspect = async (root) => {
    const active = root.locator('[data-walkthrough-active="true"]')
    await expect(active).toHaveText(python.split('\n').slice(1))
    await expect(active.first()).toHaveCSS('background-color', 'rgba(250, 204, 21, 0.18)')
    return {
      activeLines: await active.evaluateAll((nodes) =>
        nodes.map((node) => Number(node.getAttribute('data-code-line')))
      ),
      text: await active.allTextContents(),
      background: await active.first().evaluate((node) => getComputedStyle(node).backgroundColor),
    }
  }
  const canvas = await inspect(target)
  await withPresent(page, async (present) => {
    const generated = await inspect(present.locator('.reveal .slides section.present'))
    const screenshot = testInfo.outputPath('code-field-walkthrough.png')
    await present.screenshot({ path: screenshot })
    await fieldEvidence(
      testInfo,
      page,
      'code',
      ['walkthroughSteps', 'defaultStepIndex', 'walkthrough'],
      { activeLines: [2, 3] },
      { persisted, canvas, generated },
      [screenshot]
    )
  })
})
