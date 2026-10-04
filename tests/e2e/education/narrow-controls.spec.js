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

for (const width of [320, 768, 1365]) {
  test(`Format alignment and mixed writes retain selection history at ${width}px`, async ({
    page,
    request,
    testPresentation,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const geometry = [
      [100, 50, 200, 100],
      [400, 100, 100, 100],
      [250, 200, 80, 60],
      [700, 300, 120, 80],
    ]
    const elements = geometry.map(([x, y, w, h], i) => ({
      id: `format-${i}`,
      name: `Format ${i}`,
      type: 'shape',
      shape: 'rect',
      x,
      y,
      width: w,
      height: h,
      rotation: 0,
      fill: '#22c55e',
      stroke: '#111111',
      strokeWidth: 2,
      text: `Label ${i}`,
      opacity: [0.4, 0.8, 1, 1][i],
    }))
    await apiUpdatePresentation(request, testPresentation.id, {
      slides: [{ id: 'format-slide', background: { type: 'color', color: '#ffffff' }, elements }],
    })
    await page.goto(`/editor/${testPresentation.id}`)
    await page.getByTestId('slide-element-format-0').tap()
    if (width < 1280) await page.getByRole('button', { name: 'Open inspector', exact: true }).tap()
    await page.getByRole('button', { name: 'Selection Pane', exact: true }).tap()
    await page.getByRole('listitem', { name: 'Format 0, Shape', exact: true }).press('Space')
    for (const i of [1, 2]) {
      const layer = page.getByRole('listitem', { name: `Format ${i}, Shape`, exact: true })
      await layer.press('Shift+Space')
      await expect(layer).toHaveAttribute('aria-selected', 'true')
    }
    if (width < 1280) await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: 'Shape Format', exact: true }).tap()
    const readElements = async () =>
      (await apiGetPresentation(request, testPresentation.id)).slides[0].elements
    const before = await readElements()
    for (const [direction, activation, xs] of [
      ['left', 'touch', [100, 100, 100]],
      ['center-h', 'Enter', [200, 250, 260]],
      ['right', 'Space', [300, 400, 420]],
    ]) {
      const control = page.getByTestId(`format-align-${direction}`)
      const visible = await control.evaluate((node) => {
        node.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' })
        const r = node.getBoundingClientRect()
        const clips = []
        for (let p = node.parentElement; p; p = p.parentElement) {
          const s = getComputedStyle(p),
            b = p.getBoundingClientRect()
          if (/(hidden|clip|auto|scroll)/.test(s.overflowX))
            clips.push({ axis: 'x', start: b.left, end: b.right })
          if (/(hidden|clip|auto|scroll)/.test(s.overflowY))
            clips.push({ axis: 'y', start: b.top, end: b.bottom })
        }
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return {
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
          hit: Boolean(hit && node.contains(hit)),
          clips,
        }
      })
      expect(visible.left).toBeGreaterThanOrEqual(0)
      expect(visible.right).toBeLessThanOrEqual(width)
      expect(visible.top).toBeGreaterThanOrEqual(0)
      expect(visible.bottom).toBeLessThanOrEqual(900)
      expect(visible.width).toBeGreaterThanOrEqual(44)
      expect(visible.height).toBeGreaterThanOrEqual(44)
      expect(visible.hit).toBe(true)
      for (const clip of visible.clips) {
        expect(clip.axis === 'x' ? visible.left : visible.top).toBeGreaterThanOrEqual(clip.start)
        expect(clip.axis === 'x' ? visible.right : visible.bottom).toBeLessThanOrEqual(clip.end)
      }
      if (activation === 'touch') await control.tap()
      else await control.press(activation)
      const aligned = before.map((el, i) => (i < 3 ? { ...el, x: xs[i] } : el))
      await expect.poll(readElements).toEqual(aligned)
      // Native ribbon controls own their keys; history chords belong to canvas focus.
      const canvasTarget = page.getByTestId('slide-element-format-0')
      await canvasTarget.focus()
      await expect(canvasTarget).toBeFocused()
      for (const i of [0, 1, 2])
        await expect(page.getByTestId(`slide-element-format-${i}`)).toHaveAttribute(
          'data-selected',
          'true'
        )
      await page.keyboard.press('Control+z')
      await expect.poll(readElements).toEqual(before)
      for (const i of [0, 1, 2])
        await expect(page.getByTestId(`slide-element-format-${i}`)).toHaveAttribute(
          'data-selected',
          'true'
        )
      await page.keyboard.press('Control+y')
      await expect.poll(readElements).toEqual(aligned)
      await page.keyboard.press('Control+z')
      await expect.poll(readElements).toEqual(before)
    }
    const x = page.getByRole('spinbutton', { name: 'X position', exact: true })
    await expect(x).toHaveValue('')
    await expect(x).toHaveAttribute('placeholder', '—')
    await x.fill('0')
    await x.press('Enter')
    const positioned = before.map((el, i) => (i < 3 ? { ...el, x: [-150, 150, 0][i] } : el))
    await expect.poll(readElements).toEqual(positioned)
    const opacity = page.getByRole('slider', { name: 'Opacity', exact: true })
    await expect(opacity).toHaveAttribute('data-mixed', 'true')
    await opacity.press('Home')
    await opacity.press('ArrowRight')
    const faded = positioned.map((el, i) => (i < 3 ? { ...el, opacity: 0.05 } : el))
    await expect.poll(readElements).toEqual(faded)
    await expect(opacity).not.toHaveAttribute('data-mixed', 'true')
    await page.reload()
    await expect(page.getByTestId('slide-element-format-3')).toBeVisible()
    expect(await readElements()).toEqual(faded)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    ).toBeLessThanOrEqual(1)
  })
}
