import { test, expect } from '../fixtures/test-fixtures.js'
import {
  contentFixture,
  setupContent,
  inspector,
  fillControl,
  rangeControl,
  reloadContent,
  fieldEvidence,
  withPresent,
  renderedStyle,
} from './release-content-fields.js'
import { illustration } from './release-ordinary-fixtures.js'

const revisedImage =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#2563eb"/><path d="M20 20L200 20L200 140Z" fill="#facc15"/></svg>'
  ).toString('base64')
async function inspectImage(root) {
  const image = root.getByRole('img', { name: 'Qualified image diagram', exact: true })
  await expect(image).toHaveAccessibleDescription('The yellow triangle occupies the blue diagram.')
  await expect
    .poll(() =>
      image.evaluate((node) => ({
        complete: node.complete,
        width: node.naturalWidth,
        height: node.naturalHeight,
      }))
    )
    .toEqual({ complete: true, width: 240, height: 160 })
  const style = await renderedStyle(image, ['objectFit', 'filter', 'transform'])
  expect(style).toEqual({
    objectFit: 'cover',
    filter: 'brightness(1.2) contrast(0.8) grayscale(0.3) saturate(0.6) sepia(0.2) blur(2px)',
    transform: 'matrix(-1, 0, 0, -1, 0, 0)',
  })
  const appearance = await image.evaluate((node) => {
    const ancestors = []
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent)
      ancestors.push({
        border: style.borderTopWidth,
        borderColor: style.borderTopColor,
        radius: style.borderRadius,
        opacity: style.opacity,
      })
    }
    return {
      border: ancestors.find((item) => item.border === '3px'),
      faded: ancestors.find((item) => item.opacity === '0.65'),
    }
  })
  expect(appearance.border).toMatchObject({
    border: '3px',
    borderColor: 'rgb(22, 50, 79)',
    radius: '12px',
  })
  expect(appearance.faded.opacity).toBe('0.65')
  const citation = root.getByRole('link', { name: 'Qualified image source', exact: true })
  await expect(citation).toHaveAttribute('href', 'https://example.com/image-qualified')
  await expect(citation).toHaveCSS('color', 'rgb(22, 50, 79)')
  await expect(citation).toHaveCSS('text-align', 'center')
  const placement = await citation.evaluate((node) => {
    const image = document.querySelector('img[alt="Qualified image diagram"]')
    return {
      top: node.getBoundingClientRect().top,
      imageBottom: image.getBoundingClientRect().bottom,
    }
  })
  expect(placement.top).toBeGreaterThanOrEqual(placement.imageBottom - 1)
  return {
    image: await image.getAttribute('src'),
    description: await image.getAttribute('aria-describedby'),
    style,
    appearance,
    citation: await citation.textContent(),
    placement,
  }
}

test('image author controls qualify source filters fit flips border opacity and accessible citation [cap:element.image.editor]', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
  test.setTimeout(120000)
  const element = contentFixture('image', { src: illustration, width: 620, height: 330 })
  await setupContent(page, request, testPresentation.id, element)
  await fillControl(page, 'Image source URL', revisedImage)
  await inspector(page).getByLabel('Image object fit', { exact: true }).selectOption('cover')
  for (const [label, value] of [
    ['brightness', 120],
    ['contrast', 80],
    ['grayscale', 30],
    ['saturation', 60],
    ['sepia', 20],
    ['blur', 2],
    ['corner radius', 12],
  ]) {
    await rangeControl(page, `Image ${label}`, value)
  }
  await rangeControl(page, 'Opacity', 65)
  await fillControl(page, 'Image border width', 3)
  await fillControl(page, 'Image border color', '#16324f')
  for (const label of ['Image horizontal flip', 'Image vertical flip'])
    await inspector(page).getByLabel(label, { exact: true }).check()
  await fillControl(page, 'Image alternative text', 'Qualified image diagram')
  await fillControl(
    page,
    'Image long description',
    'The yellow triangle occupies the blue diagram.'
  )
  await fillControl(page, 'Image citation text', 'Qualified image source')
  await fillControl(page, 'Image citation link', 'https://example.com/image-qualified')
  await fillControl(page, 'Image citation color', '#16324f')
  await inspector(page)
    .getByLabel('Image citation alignment', { exact: true })
    .selectOption('center')
  const patch = {
    src: revisedImage,
    objectFit: 'cover',
    filterBrightness: 120,
    filterContrast: 80,
    filterGrayscale: 30,
    filterSaturate: 60,
    filterSepia: 20,
    filterBlur: 2,
    opacity: 0.65,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#16324f',
    flipH: true,
    flipV: true,
    alt: 'Qualified image diagram',
    longDescription: 'The yellow triangle occupies the blue diagram.',
    citationText: 'Qualified image source',
    citationLink: 'https://example.com/image-qualified',
    citationColor: '#16324f',
    citationAlign: 'center',
  }
  const { target, persisted } = await reloadContent(
    page,
    request,
    testPresentation.id,
    element.id,
    patch
  )
  const canvas = await inspectImage(target)
  await withPresent(page, async (present) => {
    const generated = await inspectImage(present.locator('.reveal .slides section.present'))
    const screenshot = testInfo.outputPath('image-qualified-present.png')
    await present.screenshot({ path: screenshot })
    await fieldEvidence(
      testInfo,
      page,
      'image',
      [
        'src',
        'objectFit',
        'filterBrightness',
        'filterContrast',
        'filterGrayscale',
        'filterSaturate',
        'filterSepia',
        'filterBlur',
        'opacity',
        'borderRadius',
        'borderWidth',
        'borderColor',
        'flipH',
        'flipV',
        'alt',
        'longDescription',
        'citationText',
        'citationLink',
        'citationColor',
        'citationAlign',
        'fit',
        'filters',
        'border',
        'flip',
        'citation',
      ],
      patch,
      { persisted, canvas, generated },
      [screenshot]
    )
  })
})

test('decorative image author control clears descriptive accessibility rather than retaining redundant speech [cap:element.image.editor]', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
  const element = contentFixture('image', {
    src: illustration,
    alt: 'Before decorative',
    longDescription: 'Before long description',
  })
  await setupContent(page, request, testPresentation.id, element)
  await inspector(page).getByLabel('Decorative image', { exact: true }).check()
  const { target, persisted } = await reloadContent(
    page,
    request,
    testPresentation.id,
    element.id,
    { decorative: true, alt: '', longDescription: '' }
  )
  await expect(target.getByRole('img')).toHaveCount(0)
  await expect(target.locator('img')).toHaveAttribute('alt', '')
  await expect(target.locator('img')).not.toHaveAttribute('aria-describedby')
  await fieldEvidence(
    testInfo,
    page,
    'image',
    ['decorative'],
    { decorative: true, spokenDescription: null },
    {
      persisted,
      alt: await target.locator('img').getAttribute('alt'),
      describedBy: await target.locator('img').getAttribute('aria-describedby'),
    }
  )
})

test('image crop uses actual pointer handles and reloads the clipped image geometry [cap:element.image.editor]', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
  const element = contentFixture('image', { src: illustration, width: 400, height: 240 })
  const target = await setupContent(page, request, testPresentation.id, element)
  const before = await target.boundingBox()
  await target.click({ button: 'right', position: { x: 10, y: 10 } })
  await page.getByRole('button', { name: 'Crop', exact: true }).click()
  const handle = await page.getByTestId('crop-handle-nw').boundingBox()
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    handle.x + handle.width / 2 + before.width / 4,
    handle.y + handle.height / 2 + before.height / 4,
    { steps: 8 }
  )
  await page.mouse.up()
  await page.getByRole('button', { name: 'Apply crop', exact: true }).click()
  const patch = {
    width: 300,
    height: 180,
    imageW: 400,
    imageH: 240,
    imageOffsetX: -100,
    imageOffsetY: -60,
  }
  const { persisted } = await reloadContent(page, request, testPresentation.id, element.id, patch)
  const geometry = await target
    .locator('img')
    .evaluate((node) => ({
      width: parseFloat(getComputedStyle(node).width),
      height: parseFloat(getComputedStyle(node).height),
      left: parseFloat(getComputedStyle(node).left),
      top: parseFloat(getComputedStyle(node).top),
      clipWidth: parseFloat(getComputedStyle(node.parentElement).width),
      clipHeight: parseFloat(getComputedStyle(node.parentElement).height),
      overflow: getComputedStyle(node.parentElement).overflow,
    }))
  expect(geometry).toEqual({
    width: 400,
    height: 240,
    left: -100,
    top: -60,
    clipWidth: 300,
    clipHeight: 180,
    overflow: 'hidden',
  })
  const after = await target.boundingBox()
  expect(after.width / before.width).toBeCloseTo(0.75, 2)
  expect(after.height / before.height).toBeCloseTo(0.75, 2)
  await fieldEvidence(
    testInfo,
    page,
    'image',
    ['crop'],
    { cropFraction: 0.75 },
    { persisted, geometry, before, after }
  )
})
