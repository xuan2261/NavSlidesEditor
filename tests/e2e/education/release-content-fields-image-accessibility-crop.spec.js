import { test, expect } from '../fixtures/test-fixtures.js'
import { contentFixture, setupContent, inspector, reloadContent, fieldEvidence } from './release-content-fields.js'
import { illustration } from './release-ordinary-fixtures.js'
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
