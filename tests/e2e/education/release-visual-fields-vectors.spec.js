import { test, expect } from '../fixtures/test-fixtures.js'
import {
  visualSession,
  fillControl,
  colorControl,
  fieldEvidence,
  styleOf,
  insideBounds,
} from './release-visual-fields.js'

test('drawing stroke controls affect saved path ink and visibility control removes and restores canvas', async ({
  page,
  request,
  testPresentation,
}, info) => {
  const s = await visualSession(page, request, testPresentation.id, 'drawing', {
    paths: [{ d: 'M 30 40 L 220 40 L 220 160' }],
  })
  await colorControl(page, 'Drawing stroke color', '#7c3aed')
  await fillControl(page, 'Drawing stroke width', 12)
  const persisted = await s.reload({ strokeColor: '#7c3aed', strokeWidth: 12 })
  const path = s.root.locator('svg > path')
  await expect(path).toHaveCSS('stroke', 'rgb(124, 58, 237)')
  await expect(path).toHaveAttribute('stroke-width', '12')
  await expect(path).toHaveAttribute('d', 'M 30 40 L 220 40 L 220 160')
  const stroke = await styleOf(path, ['stroke', 'strokeWidth'])
  await fieldEvidence(
    info,
    page,
    'drawing',
    ['strokeColor', 'strokeWidth', 'stroke'],
    { ink: '#7c3aed', thickness: 12 },
    { persisted, stroke, path: await path.getAttribute('d') }
  )
  await page.getByRole('button', { name: 'Selection Pane', exact: true }).click()
  const visibility = page.getByTestId(`selection-pane-toggle-visibility-${s.fixture.id}`)
  await visibility.click()
  await expect.poll(async () => (await s.read()).hidden).toBe(true)
  await expect(s.root).toHaveCount(0)
  const hidden = await s.read()
  await page.reload()
  await s.editor.waitForReady()
  await expect(s.root).toHaveCount(0)
  // Re-open the real layer panel after reload if its persistent UI state is closed.
  if ((await visibility.count()) === 0)
    await page.getByRole('button', { name: 'Selection Pane', exact: true }).click()
  await visibility.click()
  await expect.poll(async () => (await s.read()).hidden).toBe(false)
  await expect(path).toHaveAttribute('d', persisted.paths[0].d)
  await expect(path).toHaveCSS('stroke', 'rgb(124, 58, 237)')
  await fieldEvidence(
    info,
    page,
    'drawing',
    ['visibility'],
    { hiddenRemovesCanvas: true, reloadKeepsHidden: true, showRestoresInk: true },
    {
      hiddenSaved: hidden.hidden,
      shownSaved: (await s.read()).hidden,
      restoredPath: await path.getAttribute('d'),
    }
  )
})

test('SVG markup authoring paints a different shape while rejecting executable and external payload', async ({
  page,
  request,
  testPresentation,
}, info) => {
  const s = await visualSession(page, request, testPresentation.id, 'svg')
  const requests = []
  await page.route('https://unsafe-visual.invalid/**', (route) => {
    requests.push(route.request().url())
    return route.abort()
  })
  const markup =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="15" y="20" width="70" height="55" rx="8" onload="window.visualEscaped=1"/><script>window.visualEscaped=2</script><foreignObject><img src="https://unsafe-visual.invalid/probe" onerror="window.visualEscaped=3"/></foreignObject><a href="javascript:window.visualEscaped=4"><circle cx="50" cy="50" r="5"/></a></svg>'
  await fillControl(page, 'SVG markup', markup)
  await colorControl(page, 'SVG Fill Override', '#0891b2')
  await colorControl(page, 'SVG Stroke Override', '#9f1239')
  const persisted = await s.reload({
    content: markup,
    fillOverride: '#0891b2',
    strokeOverride: '#9f1239',
  })
  const rect = s.root.locator('rect')
  await expect(rect).toHaveAttribute('rx', '8')
  await expect(rect).toHaveAttribute('width', '70')
  await expect(rect).toHaveAttribute('height', '55')
  await expect(rect).toHaveCSS('fill', 'rgb(8, 145, 178)')
  await expect(rect).toHaveCSS('stroke', 'rgb(159, 18, 57)')
  await expect(
    s.root.locator('script,foreignObject,[onload],[onerror],[href^="javascript:"]')
  ).toHaveCount(0)
  await s.select()
  await s.root.locator('a circle').click()
  await expect(s.root).toHaveAttribute('data-selected', 'true')
  expect(await page.evaluate(() => window.visualEscaped ?? null)).toBeNull()
  expect(requests).toEqual([])
  const geometry = await insideBounds(rect, s.root)
  const paint = await styleOf(rect, ['fill', 'stroke'])
  await fieldEvidence(
    info,
    page,
    'svg',
    ['content', 'fillOverride', 'strokeOverride', 'unsafePayload'],
    { roundedRect: [70, 55, 8], paintsApplied: true, parentExecution: false, externalRequests: 0 },
    {
      persisted,
      paint,
      geometry,
      requests,
      escapeMarker: await page.evaluate(() => window.visualEscaped ?? null),
    }
  )
})

test('line style controls render actual arrows, dash and ink', async ({
  page,
  request,
  testPresentation,
}, info) => {
  const s = await visualSession(page, request, testPresentation.id, 'line')
  await colorControl(page, 'Line color', '#0f766e')
  await page.getByRole('slider', { name: 'Line width', exact: true }).press('Home')
  for (let i = 1; i < 8; i++)
    await page.getByRole('slider', { name: 'Line width', exact: true }).press('ArrowRight')
  await page.getByLabel('Line start marker', { exact: true }).selectOption('circle')
  await page.getByLabel('Line end marker', { exact: true }).selectOption('diamond')
  await page.getByLabel('Line style', { exact: true }).selectOption('10,5')
  const persisted = await s.reload({
    stroke: '#0f766e',
    strokeWidth: 8,
    arrowStart: 'circle',
    arrowEnd: 'diamond',
    dashArray: '10,5',
  })
  const path = s.root.locator('svg > path:not([data-line-hit-target])')
  await expect(path).toHaveCSS('stroke', 'rgb(15, 118, 110)')
  await expect(path).toHaveAttribute('stroke-width', '8')
  await expect(path).toHaveAttribute('stroke-dasharray', '10,5')
  await expect(path).toHaveAttribute('marker-start', /url\(#.+\)/)
  await expect(path).toHaveAttribute('marker-end', /url\(#.+\)/)
  await expect(s.root.locator('marker circle')).toHaveAttribute('r', '3')
  const vertices = await s.root
    .locator('marker polygon')
    .evaluate((node) => Array.from(node.points, (p) => [p.x, p.y]))
  expect(vertices).toEqual([
    [5, 0],
    [10, 5],
    [5, 10],
    [0, 5],
  ])
  await fieldEvidence(
    info,
    page,
    'line',
    ['stroke', 'strokeWidth', 'arrowStart', 'arrowEnd', 'dashArray', 'arrows', 'dash'],
    { circleStart: true, diamondEnd: true, dash: '10,5', ink: '#0f766e', thickness: 8 },
    {
      persisted,
      paint: await styleOf(path, ['stroke', 'strokeWidth']),
      vertices,
      dash: await path.getAttribute('stroke-dasharray'),
    }
  )
})
