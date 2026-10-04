import { test, expect } from '../fixtures/test-fixtures.js'
import {
  visualSession,
  fillControl,
  colorControl,
  rangeControl,
  styleOf,
  fieldEvidence,
} from './release-visual-fields.js'

test('shape plain label, rounded geometry and paint survive author controls and reload', async ({
  page,
  request,
  testPresentation,
}, info) => {
  const s = await visualSession(page, request, testPresentation.id, 'shape', {
    text: '',
    textHtml: '',
    shape: 'rect',
    borderRadius: 0,
  })
  await fillControl(page, 'Shape label text', 'Authored plain geometry')
  await fillControl(page, 'Shape label text size', 30)
  await colorControl(page, 'Shape label text color', '#112233')
  await colorControl(page, 'Shape fill color', '#16a34a')
  await colorControl(page, 'Shape stroke color', '#dc2626')
  await rangeControl(page, 'Shape stroke width', 6)
  await rangeControl(page, 'Shape corner radius', 24)
  await rangeControl(page, 'Shape opacity', 65)
  await fillControl(page, 'Rotation', 20)
  const persisted = await s.reload({
    text: 'Authored plain geometry',
    fontSize: 30,
    textColor: '#112233',
    fill: '#16a34a',
    stroke: '#dc2626',
    strokeWidth: 6,
    borderRadius: 24,
    opacity: 0.65,
    rotation: 20,
  })
  await expect(s.root.locator('svg text')).toHaveText('Authored plain geometry')
  await expect(s.root.locator('svg text')).toHaveAttribute('font-size', '30')
  await expect(s.root.locator('svg text')).toHaveCSS('fill', 'rgb(17, 34, 51)')
  await expect(s.root.locator('rect')).toHaveAttribute('rx', '24')
  await expect(s.root.locator('svg > g')).toHaveCSS('fill', 'rgb(22, 163, 74)')
  await expect(s.root.locator('svg > g')).toHaveCSS('stroke', 'rgb(220, 38, 38)')
  await expect(s.root.locator('svg > g')).toHaveAttribute('stroke-width', '6')
  await expect(s.root.locator('[data-element-content]')).toHaveCSS('opacity', '0.65')
  const paint = await styleOf(s.root.locator('svg > g'), ['fill', 'stroke', 'strokeWidth'])
  const transform = await s.root.evaluate((node) => node.style.transform)
  expect(transform).toContain('rotate(20deg)')
  await fieldEvidence(
    info,
    page,
    'shape',
    [
      'text',
      'fontSize',
      'textColor',
      'fill',
      'stroke',
      'strokeWidth',
      'borderRadius',
      'opacity',
      'rotation',
      'style',
    ],
    { readableLabel: 'Authored plain geometry', roundedCorner: 24, rotationDegrees: 20 },
    { persisted, paint, transform, label: await s.root.locator('text').textContent() }
  )
  await page.getByLabel('Shape kind', { exact: true }).selectOption('hexagon')
  const changed = await s.reload({
    shape: 'hexagon',
    text: persisted.text,
    fill: persisted.fill,
    stroke: persisted.stroke,
  })
  const points = await s.root
    .locator('polygon')
    .evaluate((node) => Array.from(node.points, (point) => [point.x, point.y]))
  expect(points).toEqual([
    [125, 6],
    [375, 6],
    [494, 130],
    [375, 254],
    [125, 254],
    [6, 130],
  ])
  await expect(s.root.locator('text')).toHaveText(persisted.text)
  await fieldEvidence(
    info,
    page,
    'shape',
    ['shape', 'shapeKind'],
    { kind: 'hexagon', vertices: 6, labelPreserved: true },
    { persisted: changed, points }
  )
})

test('shape rich label authors marks with effective inherited size and color', async ({
  page,
  request,
  testPresentation,
}, info) => {
  const s = await visualSession(page, request, testPresentation.id, 'shape', {
    text: 'Initial rich label',
    textHtml: '<p>Initial rich label</p>',
  })
  const label = page.getByRole('textbox', { name: 'Shape rich label', exact: true })
  await label.fill('Rich revised ')
  await label.press('End')
  await label.press('Control+b')
  await label.pressSequentially('bold')
  await label.press('Control+b')
  await label.pressSequentially(' ')
  await label.press('Control+i')
  await label.pressSequentially('italic')
  await label.press('Control+i')
  await label.press('Tab')
  await fillControl(page, 'Shape label text size', 28)
  await colorControl(page, 'Shape label text color', '#166534')
  const persisted = await s.reload({
    text: 'Rich revised bold italic',
    fontSize: 28,
    textColor: '#166534',
  })
  expect(persisted.textHtml).toMatch(/<strong>bold<\/strong>/)
  expect(persisted.textHtml).toMatch(/<em>italic<\/em>/)
  const rendered = s.root.locator('foreignObject')
  await expect(rendered.locator('strong')).toHaveText('bold')
  await expect(rendered.locator('em')).toHaveText('italic')
  await expect(rendered.locator('strong')).toHaveCSS('font-size', '28px')
  await expect(rendered.locator('em')).toHaveCSS('color', 'rgb(22, 101, 52)')
  const effective = await styleOf(rendered.locator('strong'), ['fontSize', 'color', 'fontWeight'])
  expect(Number(effective.fontWeight)).toBeGreaterThanOrEqual(600)
  await fieldEvidence(
    info,
    page,
    'shape',
    ['textHtml', 'text', 'fontSize', 'textColor'],
    {
      text: 'Rich revised bold italic',
      effectiveSize: 28,
      effectiveColor: '#166534',
      boldAndItalic: true,
    },
    { persisted, effective, italic: await styleOf(rendered.locator('em'), ['fontStyle', 'color']) }
  )
})
