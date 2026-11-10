import {
  test,
  expect,
  apiUpdatePresentation,
  apiGetPresentation,
} from '../fixtures/test-fixtures.js'

test.use({ hasTouch: true, reducedMotion: 'reduce' })

for (const width of [320, 768, 1365]) {
  test(`shape controls remain editable by touch and keyboard at ${width}px`, async ({
    page,
    request,
    testPresentation,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const shape = {
      id: 'narrow-shape',
      type: 'shape',
      shape: 'rect',
      x: 100,
      y: 100,
      width: 300,
      height: 160,
      rotation: 12,
      fill: '#22c55e',
      stroke: '#111111',
      strokeWidth: 2,
      text: 'Retained label',
      textHtml: '<strong>Retained label</strong>',
      fontSize: 24,
      textColor: '#111111',
    }
    await apiUpdatePresentation(request, testPresentation.id, {
      slides: [
        { id: 'narrow-slide', background: { type: 'color', color: '#ffffff' }, elements: [shape] },
      ],
    })
    await page.goto(`/editor/${testPresentation.id}`)
    const element = page.getByTestId('slide-element-narrow-shape')
    await expect(element).toBeVisible()
    await element.tap()
    if (width < 1280) await page.getByRole('button', { name: 'Open inspector', exact: true }).tap()
    const kind = page.getByTestId('prop-shape-kind')
    await kind.scrollIntoViewIfNeeded()
    const bounds = await kind.boundingBox()
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    expect(bounds.height).toBeGreaterThanOrEqual(44)
    await kind.selectOption('hexagon')
    await expect
      .poll(
        async () =>
          (await apiGetPresentation(request, testPresentation.id)).slides[0].elements[0].shape
      )
      .toBe('hexagon')
    await page.getByRole('button', { name: 'Selection Pane', exact: true }).click()
    const layer = page.getByRole('listitem', { name: 'shape, Shape', exact: true })
    await layer.focus()
    await layer.press(' ')
    await expect(element).toHaveAttribute('data-selected', 'true')
    expect((await layer.boundingBox()).height).toBeGreaterThanOrEqual(44)
    const saved = (await apiGetPresentation(request, testPresentation.id)).slides[0].elements[0]
    expect(saved).toMatchObject({ ...shape, shape: 'hexagon' })
    if (width < 1280) await kind.press('Escape')
    await expect(element).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await page.reload()
    await expect(element.locator('polygon')).toBeVisible()
    await expect(element).toContainText('Retained label')
  })
}

