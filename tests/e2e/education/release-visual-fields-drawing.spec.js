import { test, expect } from '../fixtures/test-fixtures.js'
import { visualSession, fillControl, fieldEvidence, insideBounds } from './release-visual-fields.js'

const authoredPaths = [
  { d: 'M 40 50 L 240 50 L 240 180', stroke: '#be123c', strokeWidth: 9, opacity: 0.6 },
  { d: 'M 280 60 Q 340 20 390 160', stroke: '#0369a1', strokeWidth: 5, opacity: 1 },
]

test('drawing vector path control authors multiple meaningful strokes and preserves them after reload', async ({
  page,
  request,
  testPresentation,
}, info) => {
  const s = await visualSession(page, request, testPresentation.id, 'drawing', { paths: [] })
  await fillControl(page, 'Drawing path data', JSON.stringify(authoredPaths))
  const persisted = await s.reload({ paths: authoredPaths })
  const paths = s.root.locator('svg > path')
  await expect(paths).toHaveCount(2)
  await expect(paths.nth(0)).toHaveAttribute('d', authoredPaths[0].d)
  await expect(paths.nth(0)).toHaveCSS('stroke', 'rgb(190, 18, 60)')
  await expect(paths.nth(0)).toHaveAttribute('stroke-width', '9')
  await expect(paths.nth(0)).toHaveAttribute('opacity', '0.6')
  await expect(paths.nth(1)).toHaveAttribute('d', authoredPaths[1].d)
  await expect(paths.nth(1)).toHaveCSS('stroke', 'rgb(3, 105, 161)')
  await expect(paths.nth(1)).toHaveAttribute('stroke-width', '5')
  const geometry = await paths.evaluateAll((nodes) =>
    nodes.map((node) => {
      const length = node.getTotalLength(),
        start = node.getPointAtLength(0),
        end = node.getPointAtLength(length)
      return {
        length,
        start: { x: start.x, y: start.y },
        end: { x: end.x, y: end.y },
        bounds: node.getBoundingClientRect().toJSON(),
      }
    })
  )
  expect(geometry[0].start).toMatchObject({ x: 40, y: 50 })
  expect(geometry[0].end).toMatchObject({ x: 240, y: 180 })
  expect(geometry[0].length).toBeCloseTo(330, 0)
  expect(geometry[1].start).toMatchObject({ x: 280, y: 60 })
  expect(geometry[1].end).toMatchObject({ x: 390, y: 160 })
  expect(geometry[1].length).toBeGreaterThan(Math.hypot(110, 100))
  for (let i = 0; i < 2; i++) await insideBounds(paths.nth(i), s.root)
  await fieldEvidence(
    info,
    page,
    'drawing',
    ['paths'],
    {
      authoredLineAndCurve: true,
      endpoints: [
        [40, 50, 240, 180],
        [280, 60, 390, 160],
      ],
      perPathInkPreserved: true,
    },
    {
      persisted,
      geometry,
      renderedPaths: await paths.evaluateAll((nodes) =>
        nodes.map((node) => ({
          d: node.getAttribute('d'),
          stroke: getComputedStyle(node).stroke,
          width: node.getAttribute('stroke-width'),
          opacity: node.getAttribute('opacity'),
        }))
      ),
    }
  )
})

for (const invalid of [
  '{not-json}',
  '[{"d":"M 20 20 L"}]',
  '[{"d":"M 20 20 L 90 40","strokeWidth":-2}]',
]) {
  test(`drawing invalid authored vector retains last valid visible strokes (${invalid})`, async ({
    page,
    request,
    testPresentation,
  }) => {
    const s = await visualSession(page, request, testPresentation.id, 'drawing', { paths: [] })
    const input = page.getByRole('textbox', { name: 'Drawing path data', exact: true })
    await input.fill(JSON.stringify(authoredPaths))
    await s.reload({ paths: authoredPaths })
    await input.fill(invalid)
    await input.press('Tab')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(input).toHaveValue(invalid)
    expect((await s.read()).paths).toEqual(authoredPaths)
    await expect(s.root.locator('path').first()).toHaveAttribute('d', authoredPaths[0].d)
    await expect(s.root.locator('path').first()).toHaveCSS('stroke', 'rgb(190, 18, 60)')
    await s.reload({ paths: authoredPaths })
    await expect(s.root.locator('path')).toHaveCount(2)
    expect(JSON.parse(await input.inputValue())).toEqual(authoredPaths)
  })
}
