import { test, expect } from '../fixtures/test-fixtures.js'
import {
  VISUAL_TYPES,
  visualSession,
  fillControl,
  fieldEvidence,
  dragResize,
  insideBounds,
} from './release-visual-fields.js'

for (const type of VISUAL_TYPES) {
  test(`${type} width/height controls change saved canvas geometry`, async ({
    page,
    request,
    testPresentation,
  }, info) => {
    const s = await visualSession(page, request, testPresentation.id, type)
    await fillControl(page, 'Width', 560)
    await fillControl(page, 'Height', 320)
    const persisted = await s.reload({ width: 560, height: 320 })
    await expect(s.root).toHaveCSS('width', '560px')
    await expect(s.root).toHaveCSS('height', '320px')
    const canvas = page.locator('.slide-canvas')
    const bounds = await insideBounds(s.root, canvas)
    const scale = (await canvas.boundingBox()).width / 960
    expect(bounds.inner.width / scale).toBeCloseTo(560, 0)
    expect(bounds.inner.height / scale).toBeCloseTo(320, 0)
    await fieldEvidence(
      info,
      page,
      type,
      ['width', 'height'],
      { width: 560, height: 320, canvasContained: true },
      { persisted, bounds, scale }
    )
    if (type === 'shape')
      await fieldEvidence(
        info,
        page,
        type,
        ['geometry'],
        { width: 560, height: 320 },
        { persisted, bounds, scale }
      )
  })

  test(`${type} forward control changes actual occlusion and persisted layer`, async ({
    page,
    request,
    testPresentation,
  }, info) => {
    const cover = {
      id: 'layer-cover',
      type: 'shape',
      shape: 'rect',
      name: 'Cover',
      x: 80,
      y: 80,
      width: 600,
      height: 350,
      fill: '#f97316',
      zIndex: 50,
    }
    const s = await visualSession(page, request, testPresentation.id, type, { zIndex: 1 }, [cover])
    const point = await s.root.evaluate((node) => {
      const path = node.querySelector('[data-line-hit-target]')
      if (path) {
        const point = path.getPointAtLength(path.getTotalLength() / 2)
        const screen = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM())
        return { x: screen.x, y: screen.y }
      }
      const r = node.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })
    const topAt = () =>
      page.evaluate(
        ({ x, y }) =>
          document
            .elementFromPoint(x, y)
            ?.closest('[data-element-id]')
            ?.getAttribute('data-element-id'),
        point
      )
    expect(await topAt()).toBe('layer-cover')
    const savedLayer = () =>
      page.waitForResponse(
        (response) =>
          response.url().includes(`/api/presentations/${testPresentation.id}`) &&
          response.request().method() === 'PUT'
      )
    const forwardSave = savedLayer()
    await page.getByTestId('prop-layer-forward').click()
    await expect.poll(topAt).toBe(s.fixture.id)
    expect((await forwardSave).ok()).toBe(true)
    const authored = await s.read()
    const persisted = await s.reload({ zIndex: authored.zIndex })
    expect(await topAt()).toBe(s.fixture.id)
    await fieldEvidence(
      info,
      page,
      type,
      ['zIndex'],
      { authoredElementOccludesCover: true, layerSaved: true },
      { persistedLayer: persisted.zIndex, hitElement: await topAt(), hitPoint: point }
    )
    const backwardSave = savedLayer()
    await page.getByTestId('prop-layer-backward').click()
    await expect.poll(topAt).toBe(cover.id)
    expect((await backwardSave).ok()).toBe(true)
    const backward = await s.read()
    await s.reload({ zIndex: backward.zIndex })
    await expect.poll(topAt).toBe(cover.id)
  })
}

for (const type of ['callout', 'drawing']) {
  test(`${type} actual corner handle preserves content through resize and reload`, async ({
    page,
    request,
    testPresentation,
  }, info) => {
    const changes =
      type === 'drawing'
        ? { width: 400, height: 220, paths: [{ d: 'M 30 40 L 220 40 L 220 160' }] }
        : { width: 90, height: 90, calloutNumber: 19 }
    const s = await visualSession(page, request, testPresentation.id, type, changes)
    const before = await s.root.boundingBox()
    await dragResize(page, s.root, 80, 60)
    await expect.poll(async () => Math.round((await s.read()).width)).toBe(changes.width + 80)
    const resized = await s.read()
    const persisted = await s.reload({ width: resized.width, height: resized.height })
    expect(persisted.width).toBeCloseTo(changes.width + 80, 0)
    expect(persisted.height).toBeCloseTo(changes.height + 60, 0)
    const after = await s.root.boundingBox()
    expect(after.x).toBeCloseTo(before.x, 0)
    expect(after.y).toBeCloseTo(before.y, 0)
    if (type === 'drawing') {
      expect(persisted.paths).toEqual(changes.paths)
      await expect(s.root.locator('path')).toHaveAttribute('d', changes.paths[0].d)
      const bounds = await s.root.locator('path').evaluate((node) => {
        const start = node.getPointAtLength(0),
          end = node.getPointAtLength(node.getTotalLength())
        return {
          start: { x: start.x, y: start.y },
          end: { x: end.x, y: end.y },
          screen: node.getBoundingClientRect().toJSON(),
        }
      })
      expect(bounds.start).toMatchObject({ x: 30, y: 40 })
      expect(bounds.end).toMatchObject({ x: 220, y: 160 })
      await insideBounds(s.root.locator('path'), s.root)
      await fieldEvidence(
        info,
        page,
        type,
        ['resize'],
        { pathPreserved: true, anchorFixed: true, resizeDelta: [80, 60] },
        { persisted, before, after, pathBounds: bounds }
      )
    } else {
      await expect(s.root).toContainText('19')
      await fieldEvidence(
        info,
        page,
        type,
        ['resize'],
        { readableNumber: 19, anchorFixed: true, resizeDelta: [80, 60] },
        { persisted, before, after, label: await s.root.innerText() }
      )
    }
  })
}
