import { test, expect } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { apiGetPresentation } from '../fixtures/test-fixtures.js'
import { openViewTab, seedElements, slideElement } from '../pages/canvas-actions-helper.js'

function shapeElement(id, x, y, overrides = {}) {
  return {
    id,
    type: 'shape',
    shape: 'rect',
    x,
    y,
    width: 120,
    height: 80,
    fill: '#6366f1',
    zIndex: 1,
    ...overrides,
  }
}

async function elementsById(request, presentationId) {
  const saved = await apiGetPresentation(request, presentationId)
  return Object.fromEntries(saved.slides[0].elements.map((el) => [el.id, el]))
}

async function selectMany(page, ids) {
  await slideElement(page, ids[0]).click()
  for (const id of ids.slice(1)) {
    await slideElement(page, id).click({ modifiers: ['Shift'] })
  }
  await expect(page.locator('.properties-panel')).toContainText(`${ids.length} elements selected`)
}

test.describe('group z-order and guides', () => {
  test('group and ungroup preserve member order while z-order moves the selected block', async ({
    page,
    request,
    testPresentation,
  }) => {
    await seedElements(request, testPresentation.id, [
      shapeElement('a', 100, 100, { zIndex: 1 }),
      shapeElement('b', 260, 100, { zIndex: 2 }),
      shapeElement('c', 420, 100, { zIndex: 3 }),
    ])
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    await selectMany(page, ['a', 'b'])
    await page.getByRole('tab', { name: 'Home' }).click()
    await page.locator('button[title="Group elements"]').click()

    await expect
      .poll(async () => {
        const byId = await elementsById(request, testPresentation.id)
        return { sameGroup: byId.a.groupId && byId.a.groupId === byId.b.groupId, z: [byId.a.zIndex, byId.b.zIndex, byId.c.zIndex] }
      })
      .toEqual({ sameGroup: true, z: [1, 2, 3] })

    await page.getByTestId('prop-layer-forward').click()
    await expect
      .poll(async () => {
        const byId = await elementsById(request, testPresentation.id)
        return Object.values(byId)
          .sort((left, right) => (left.zIndex || 0) - (right.zIndex || 0))
          .map((el) => el.id)
      })
      .toEqual(['c', 'a', 'b'])

    await page.getByRole('tab', { name: 'Home' }).click()
    await page.locator('button[title="Ungroup elements"]').click()
    await expect
      .poll(async () => {
        const byId = await elementsById(request, testPresentation.id)
        return [byId.a.groupId, byId.b.groupId]
      })
      .toEqual([undefined, undefined])
  })

  test('ruler guide add/remove and smart guide toggle are real canvas controls', async ({
    page,
    request,
    testPresentation,
  }) => {
    await seedElements(request, testPresentation.id, [shapeElement('a', 120, 120)])
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    await openViewTab(page)
    const smartGuides = page.getByTestId('canvas-controls-toggle-smart-guides')
    await expect(smartGuides).toHaveAttribute('aria-pressed', 'true')
    await smartGuides.click()
    await expect(smartGuides).toHaveAttribute('aria-pressed', 'false')

    await page.getByRole('button', { name: 'Toggle rulers' }).click()
    await expect(page.getByTestId('top-ruler')).toBeVisible()
    const ruler = await page.getByTestId('top-ruler').boundingBox()
    expect(ruler).toBeTruthy()
    await page.mouse.move(ruler.x + 120, ruler.y + 8)
    await page.mouse.down()
    await page.mouse.move(ruler.x + 180, ruler.y + 80, { steps: 6 })
    await page.mouse.up()
    await expect(page.getByTestId('persistent-guide-x')).toBeVisible()
    await page.getByTestId('persistent-guide-x').dblclick()
    await expect(page.getByTestId('persistent-guide-x')).toHaveCount(0)
  })
})
