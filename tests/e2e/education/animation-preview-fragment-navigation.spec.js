import {
  test,
  expect,
  apiGetPresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { selectCommon } from './common-editor.js'

const shape = (id, x, y) => ({
  id,
  name: id,
  type: 'shape',
  shape: 'rect',
  x,
  y,
  width: 170,
  height: 80,
  fill: '#22c55e',
  zIndex: 1,
})
const config = ({ slides, layoutMasters, resolution, theme, transition, presenterTools }) => ({
  slides,
  layoutMasters,
  resolution,
  theme,
  transition,
  presenterTools,
})

async function openPreview(page) {
  await page.getByRole('tab', { name: 'Animations', exact: true }).click()
  await page.getByRole('button', { name: 'Preview animation', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Animation Preview', exact: true })
  await expect(dialog).toBeVisible()
  const iframe = dialog.locator('iframe[title="Animation Preview"]')
  await expect
    .poll(() =>
      iframe.evaluate((node) => {
        const deck = node.contentWindow?.Reveal
        return Boolean(deck?.isReady() && deck.getConfig().keyboard === false)
      })
    )
    .toBe(true)
  return { dialog, iframe, frame: dialog.frameLocator('iframe[title="Animation Preview"]') }
}

async function saveSnapshot(editor, page, name) {
  await editor.clickQuickAccessSave()
  await editor.openHistoryModal()
  const history = page.getByRole('dialog', { name: 'Version History', exact: true })
  await history.getByPlaceholder('Snapshot name (optional)').fill(name)
  await history.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(history.getByText(name, { exact: true })).toBeVisible()
  await history.getByRole('button', { name: 'Close Version History', exact: true }).click()
}

test('preview navigates sparse visible groups, rewinds and replays without changing authored configuration', async ({
  page,
  request,
  testPresentation,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const id = testPresentation.id
  await apiUpdatePresentation(request, id, {
    slides: [
      {
        id: 'preview-groups',
        elements: [
          shape('hidden-first', 80, 60),
          shape('group-two', 320, 60),
          shape('group-five-a', 80, 220),
          shape('group-five-b', 320, 220),
        ],
      },
    ],
  })
  const original = config(await apiGetPresentation(request, id))
  const editor = new EditorPage(page)
  await editor.gotoPresentation(id)
  const panel = page.getByRole('complementary', { name: 'Properties panel', exact: true })
  for (const [elementId, order] of [
    ['hidden-first', 1],
    ['group-two', 2],
    ['group-five-a', 5],
    ['group-five-b', 5],
  ]) {
    const target = page.getByTestId(`slide-element-${elementId}`)
    await selectCommon(target)
    await panel.getByTestId('prop-fragment-toggle').check()
    await panel.getByTestId('prop-fragment-index').fill(String(order))
    await panel.getByTestId('prop-fragment-animation').selectOption('fade-in')
  }
  await page.getByRole('button', { name: 'Selection Pane', exact: true }).click()
  await page.getByTestId('selection-pane-toggle-visibility-hidden-first').click()
  const expected = structuredClone(original)
  expected.slides[0].elements = expected.slides[0].elements.map((element, index) => ({
    ...element,
    fragment: true,
    fragmentIndex: [1, 2, 5, 5][index],
    fragmentAnimation: 'fade-in',
    ...(index === 0 ? { hidden: true } : {}),
  }))
  await expect.poll(async () => config(await apiGetPresentation(request, id))).toEqual(expected)
  await saveSnapshot(editor, page, 'Sparse preview authored')
  await page.reload()
  await editor.waitForReady()
  expect(config(await apiGetPresentation(request, id))).toEqual(expected)

  const { dialog, iframe, frame } = await openPreview(page)
  const fragment = (elementId) => frame.locator(`.fragment[data-ns-element-id="${elementId}"]`)
  const two = fragment('group-two'),
    fiveA = fragment('group-five-a'),
    fiveB = fragment('group-five-b')
  const documentStart = await iframe.evaluate((node) => node.contentWindow.performance.timeOrigin)
  const visibility = async (showTwo, showFive) => {
    for (const [element, shown] of [
      [two, showTwo],
      [fiveA, showFive],
      [fiveB, showFive],
    ]) {
      if (shown) {
        await expect(element).toBeVisible()
        await expect(element).toHaveCSS('opacity', '1')
      } else await expect(element).toBeHidden()
    }
  }
  await expect(fragment('hidden-first')).toHaveCount(0)
  await expect(dialog).toContainText('Step 0 / 2')
  await expect(dialog).toContainText('Initial state')
  await visibility(false, false)
  await dialog.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(dialog).toContainText('Fragment 2')
  await visibility(true, false)
  await dialog.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(dialog).toContainText('Fragment 5')
  await visibility(true, true)
  await expect(dialog.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Previous', exact: true }).click()
  await expect(dialog).toContainText('Fragment 2')
  await visibility(true, false)
  await dialog.getByRole('button', { name: 'Replay', exact: true }).click()
  await expect(dialog).toContainText('Initial state')
  await visibility(false, false)
  await dialog.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(dialog).toContainText('Fragment 5')
  await visibility(true, true)
  await expect(dialog.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Replay', exact: true }).click()
  await expect(dialog).toContainText('Initial state')
  await visibility(false, false)
  expect(await iframe.evaluate((node) => node.contentWindow.performance.timeOrigin)).toBe(
    documentStart
  )
  await dialog.getByRole('button', { name: 'Close preview', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await openPreview(page)
  await expect(dialog).toContainText('Initial state')
  await visibility(false, false)
  await dialog.getByRole('button', { name: 'Close preview', exact: true }).click()
  expect(config(await apiGetPresentation(request, id))).toEqual(expected)
})

test('preview includes inherited-only rendered fragment groups and excludes layout-hidden groups', async ({
  page,
  request,
  testPresentation,
}) => {
  const id = testPresentation.id
  await apiUpdatePresentation(request, id, {
    layoutMasters: [
      {
        id: 'preview-master',
        name: 'Preview master',
        placeholders: [],
        fixedElements: [
          { ...shape('master-hidden', 80, 60), fragment: true, fragmentIndex: 1 },
          { ...shape('master-group', 320, 60), fragment: true, fragmentIndex: 4 },
        ],
      },
    ],
    slides: [
      {
        id: 'inherited-preview',
        layoutId: 'preview-master',
        elements: [],
        layoutOverrides: { hiddenElementIds: ['master-hidden'] },
      },
    ],
  })
  const editor = new EditorPage(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await editor.gotoPresentation(id)
  await saveSnapshot(editor, page, 'Inherited preview authored')
  const before = config(await apiGetPresentation(request, id))
  const { dialog, frame } = await openPreview(page)
  const inherited = frame.locator(
    '.fragment[data-ns-element-id="layout-fixed:preview-master:master-group"]'
  )
  await expect(frame.locator('.fragment')).toHaveCount(1)
  await expect(dialog).toContainText('Step 0 / 1')
  await expect(inherited).toBeHidden()
  await dialog.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(dialog).toContainText('Fragment 4')
  await expect(inherited).toBeVisible()
  await expect(inherited).toHaveCSS('opacity', '1')
  await expect(dialog.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Replay', exact: true }).click()
  await expect(inherited).toBeHidden()
  await dialog.getByRole('button', { name: 'Close preview', exact: true }).click()
  expect(config(await apiGetPresentation(request, id))).toEqual(before)
})
