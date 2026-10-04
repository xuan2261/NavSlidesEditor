import { test, expect } from '../fixtures/test-fixtures.js'
import { visualSession, fillControl, fieldEvidence } from './release-visual-fields.js'

test('line size controls transform all endpoint and quadratic coordinates in rendered space', async ({
  page,
  request,
  testPresentation,
}, info) => {
  const s = await visualSession(page, request, testPresentation.id, 'line', {
    x1: 20,
    y1: 50,
    x2: 300,
    y2: 170,
    cx: 120,
    cy: 90,
  })
  await fillControl(page, 'Width', 600)
  await fillControl(page, 'Height', 390)
  const persisted = await s.reload({
    width: 600,
    height: 390,
    x1: 24,
    y1: 75,
    x2: 360,
    y2: 255,
    cx: 144,
    cy: 135,
  })
  const path = s.root.locator('svg > path:not([data-line-hit-target])')
  await expect(path).toHaveAttribute('d', 'M 24 75 Q 144 135 360 255')
  const geometry = await path.evaluate((node) => {
    const length = node.getTotalLength(),
      first = node.getPointAtLength(0),
      last = node.getPointAtLength(length)
    const middle = node.getPointAtLength(length / 2)
    return {
      first: { x: first.x, y: first.y },
      last: { x: last.x, y: last.y },
      middle: { x: middle.x, y: middle.y },
      length,
    }
  })
  expect(geometry.first).toMatchObject({ x: 24, y: 75 })
  expect(geometry.last).toMatchObject({ x: 360, y: 255 })
  expect(geometry.middle.x).toBeGreaterThan(24)
  expect(geometry.middle.x).toBeLessThan(360)
  expect(geometry.middle.y).toBeGreaterThan(75)
  expect(geometry.middle.y).toBeLessThan(255)
  expect(geometry.length).toBeGreaterThan(Math.hypot(336, 180))
  await fieldEvidence(
    info,
    page,
    'line',
    ['x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'endpoints', 'curve'],
    {
      scaledEndpoints: [
        [24, 75],
        [360, 255],
      ],
      scaledControl: [144, 135],
      quadraticCurve: true,
    },
    { persisted, path: await path.getAttribute('d'), geometry }
  )
})

test('line connector target and anchor controls follow actual moved target geometry after reload', async ({
  page,
  request,
  testPresentation,
}, info) => {
  const targets = [
    {
      id: 'attach-a',
      type: 'shape',
      shape: 'rect',
      name: 'Start box',
      x: 40,
      y: 170,
      width: 80,
      height: 100,
      fill: '#16a34a',
      zIndex: 1,
    },
    {
      id: 'attach-b',
      type: 'shape',
      shape: 'rect',
      name: 'End box',
      x: 600,
      y: 170,
      width: 80,
      height: 100,
      fill: '#2563eb',
      zIndex: 1,
    },
  ]
  const s = await visualSession(
    page,
    request,
    testPresentation.id,
    'line',
    { cx: null, cy: null },
    targets
  )
  await page.getByLabel('Start connector target', { exact: true }).selectOption('attach-a')
  await page.getByLabel('Start connector anchor', { exact: true }).selectOption('e')
  await page.getByLabel('End connector target', { exact: true }).selectOption('attach-b')
  await page.getByLabel('End connector anchor', { exact: true }).selectOption('w')
  const connections = {
    start: { targetId: 'attach-a', anchor: 'e' },
    end: { targetId: 'attach-b', anchor: 'w' },
  }
  await s.reload({ connections, x1: 20, y1: 120, x2: 500, y2: 120 })
  const a = page.getByTestId('slide-element-attach-a')
  await a.focus()
  await a.press('Enter')
  await fillControl(page, 'Horizontal position', 70)
  const persisted = await s.reload({ connections, x1: 50, y1: 120, x2: 500, y2: 120 })
  const path = s.root.locator('svg > path:not([data-line-hit-target])')
  await expect(path).toHaveAttribute('d', 'M 50 120 L 500 120')
  const endpoints = await path.evaluate((node) => {
    const matrix = node.getScreenCTM()
    const p = (length) => {
      const point = node.getPointAtLength(length)
      return new DOMPoint(point.x, point.y).matrixTransform(matrix).toJSON()
    }
    return { start: p(0), end: p(node.getTotalLength()) }
  })
  const start = await a.boundingBox(),
    end = await page.getByTestId('slide-element-attach-b').boundingBox()
  expect(endpoints.start.x).toBeCloseTo(start.x + start.width, 0)
  expect(endpoints.start.y).toBeCloseTo(start.y + start.height / 2, 0)
  expect(endpoints.end.x).toBeCloseTo(end.x, 0)
  expect(endpoints.end.y).toBeCloseTo(end.y + end.height / 2, 0)
  await fieldEvidence(
    info,
    page,
    'line',
    ['connections', 'attachment'],
    { startAnchor: 'right edge', endAnchor: 'left edge', movedTargetFollowed: true },
    { persisted, endpoints, targetBounds: { start, end } }
  )
})

test('deleting an attached target detaches the connector without jumping its last rendered endpoint', async ({
  page,
  request,
  testPresentation,
}) => {
  const target = {
    id: 'detach-target',
    type: 'shape',
    shape: 'rect',
    x: 40,
    y: 170,
    width: 80,
    height: 100,
    fill: '#16a34a',
    zIndex: 1,
  }
  const s = await visualSession(
    page,
    request,
    testPresentation.id,
    'line',
    { cx: null, cy: null },
    [target]
  )
  const selector = page.getByLabel('Start connector target', { exact: true })
  await expect(selector.locator(`option[value="${s.fixture.id}"]`)).toHaveCount(0)
  await selector.selectOption('detach-target')
  await page.getByLabel('Start connector anchor', { exact: true }).selectOption('e')
  await s.reload({
    connections: { start: { targetId: 'detach-target', anchor: 'e' } },
    x1: 20,
    y1: 120,
  })
  const path = s.root.locator('svg > path:not([data-line-hit-target])')
  const before = await path.getAttribute('d')
  const box = page.getByTestId('slide-element-detach-target')
  await box.focus()
  await box.press('Enter')
  await box.press('Delete')
  await expect(box).toHaveCount(0)
  await expect.poll(async () => (await s.read()).connections ?? null).toBeNull()
  await s.reload({ x1: 20, y1: 120 })
  await expect(path).toHaveAttribute('d', before)
  await expect(page.getByLabel('Start connector target', { exact: true })).toHaveValue('')
})
