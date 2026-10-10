import { test, expect } from '../fixtures/test-fixtures.js'
import { gameFixture } from './release-game-fixtures.js'
import {
  commonSession,
  selectCommon,
  geometry,
  commonObservation,
  captureCommon,
} from './common-editor.js'

test('common native game geometry, protections, fragments, actions and multiselect alignment', async ({
  page,
  request,
  testPresentation,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const second = {
    ...gameFixture('countdown'),
    name: 'Second game',
    x: 480,
    y: 300,
    width: 200,
    height: 140,
  }
  const sentinel = {
    id: 'common-unselected',
    type: 'shape',
    shape: 'rect',
    name: 'Unselected sentinel',
    x: 710,
    y: 90,
    width: 140,
    height: 100,
    fill: '#22c55e',
  }
  const s = await commonSession(
    page,
    request,
    testPresentation.id,
    { x: 100, y: 100, width: 240, height: 160 },
    [second, sentinel]
  )
  const panel = page.getByRole('complementary', { name: 'Properties panel', exact: true })
  await selectCommon(s.target)
  const before = await geometry(s.target)
  const beforeBounds = await s.target.boundingBox()
  for (const [field, value] of [
    ['x', 120],
    ['y', 90],
    ['width', 300],
    ['height', 200],
    ['rotation', 15],
  ]) {
    await panel.getByTestId(`prop-${field}`).fill(String(value))
    await panel.getByTestId(`prop-${field}`).blur()
  }
  const changedGeometry = { x: 120, y: 90, width: 300, height: 200, rotation: 15 }
  await expect.poll(() => geometry(s.target)).toEqual(changedGeometry)
  await expect
    .poll(s.read)
    .toEqual(s.original.map((el, i) => (i === 0 ? { ...el, ...changedGeometry } : el)))
  await panel.getByTestId('prop-rotation').fill('0')
  await panel.getByTestId('prop-rotation').blur()
  changedGeometry.rotation = 0
  await expect.poll(() => geometry(s.target)).toEqual(changedGeometry)
  const changedBounds = await s.target.boundingBox()
  expect(changedBounds.width / beforeBounds.width).toBeCloseTo(300 / 240, 2)
  expect(changedBounds.height / beforeBounds.height).toBeCloseTo(200 / 160, 2)

  await panel.getByTestId('prop-fragment-toggle').check()
  await panel.getByTestId('prop-fragment-index').fill('2')
  await panel.getByTestId('prop-fragment-animation').selectOption('fade-in')
  await panel.getByRole('combobox', { name: 'Element action', exact: true }).selectOption('next')
  await panel.getByRole('textbox', { name: 'Action label', exact: true }).fill('Next lesson')
  await panel.getByRole('checkbox', { name: 'Transparent hotspot', exact: true }).check()
  await expect(s.target).toContainText('▶ 2')
  await expect(s.target).toContainText('Hotspot')
  const authored = {
    ...s.original[0],
    ...changedGeometry,
    fragment: true,
    fragmentIndex: 2,
    fragmentAnimation: 'fade-in',
    action: { kind: 'next', label: 'Next lesson', hotspot: true },
  }
  await expect.poll(s.read).toEqual([authored, ...s.original.slice(1)])
  const editorUrl = page.url()
  for (const key of ['Enter', 'Space']) await s.target.press(key)
  expect(page.url()).toBe(editorUrl)
  await expect(page.getByRole('dialog', { name: 'Try game', exact: true })).toHaveCount(0)
  expect(await s.read()).toEqual([authored, ...s.original.slice(1)])
  const actionState = await s.read()

  await panel.getByTestId('prop-lock-toggle').check()
  const locked = { ...authored, locked: true }
  await expect.poll(s.read).toEqual([locked, ...s.original.slice(1)])
  await expect(page.getByTestId('resize-handle-se')).toHaveCount(0)
  await expect(page.getByTestId('rotation-handle')).toHaveCount(0)
  await s.target.focus()
  await s.target.press('Delete')
  await s.target.press('Shift+ArrowRight')
  const lockBounds = await s.target.boundingBox()
  const start = { x: lockBounds.x + lockBounds.width / 2, y: lockBounds.y + lockBounds.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 48, start.y + 24, { steps: 8 })
  await page.mouse.up()
  expect(await geometry(s.target)).toEqual(changedGeometry)
  expect(await s.read()).toEqual([locked, ...s.original.slice(1)])
  const lockedState = await s.read()
  const lockArtifact = await captureCommon(info, page, 'common-locked-game')

  await page.getByRole('button', { name: 'Selection Pane', exact: true }).click()
  await panel.getByTestId(`selection-pane-toggle-visibility-${s.fixture.id}`).click()
  await expect(s.target).toBeHidden()
  const hidden = { ...locked, hidden: true }
  await expect.poll(s.read).toEqual([hidden, ...s.original.slice(1)])
  const hiddenArtifact = await captureCommon(info, page, 'common-hidden-game')
  await page.reload()
  await s.editor.waitForReady()
  await expect(s.target).toBeHidden()
  expect(await s.read()).toEqual([hidden, ...s.original.slice(1)])
  const hiddenReload = await s.read()
  await page.getByTestId('slide-element-common-unselected').click()
  await page.getByRole('button', { name: 'Selection Pane', exact: true }).click()
  await panel.getByTestId(`selection-pane-toggle-visibility-${s.fixture.id}`).click()
  await expect(s.target).toBeVisible()
  await panel.getByTestId(`selection-pane-toggle-lock-${s.fixture.id}`).click()
  const restored = { ...authored, locked: false, hidden: false }
  await expect.poll(s.read).toEqual([restored, ...s.original.slice(1)])
  await selectCommon(s.target)
  await expect(page.getByTestId('resize-handle-se')).toBeVisible()

  const other = page.getByTestId(`slide-element-${second.id}`)
  await other.click({ modifiers: ['Shift'], position: { x: 5, y: 5 } })
  await expect(panel).toContainText('2 elements selected')
  for (const target of [s.target, other])
    await expect(target).toHaveAttribute('data-selected', 'true')
  await expect(page.getByTestId('slide-element-common-unselected')).toHaveAttribute(
    'data-selected',
    'false'
  )
  await page.getByRole('tab', { name: 'Format', exact: true }).click()
  await page.getByTestId('format-align-left').click()
  const aligned = [restored, { ...s.original[1], x: 120 }, s.original[2]]
  await expect.poll(s.read).toEqual(aligned)
  const alignedGeometry = await Promise.all([geometry(s.target), geometry(other)])
  expect(alignedGeometry.map((el) => el.x)).toEqual([120, 120])
  await s.target.focus()
  await s.editor.undo()
  await expect.poll(s.read).toEqual([restored, ...s.original.slice(1)])
  const undoState = await s.read()
  for (const target of [s.target, other])
    await expect(target).toHaveAttribute('data-selected', 'true')
  await s.editor.redo()
  await expect.poll(s.read).toEqual(aligned)
  const redoState = await s.read()
  await page.reload()
  await s.editor.waitForReady()
  expect(await s.read()).toEqual(aligned)
  expect(await geometry(s.target)).toEqual(changedGeometry)
  expect(await geometry(other)).toMatchObject({ x: 120, y: 300, width: 200, height: 140 })
  await selectCommon(s.target)
  await expect(panel.getByTestId('prop-fragment-index')).toHaveValue('2')
  await expect(panel.getByRole('combobox', { name: 'Element action', exact: true })).toHaveValue(
    'next'
  )

  await page.getByRole('tab', { name: 'Animations', exact: true }).click()
  await page.getByRole('button', { name: 'Preview animation', exact: true }).click()
  const preview = page.getByRole('dialog', { name: 'Animation Preview', exact: true })
  await expect(preview).toBeVisible()
  const fragment = preview
    .frameLocator('iframe[title="Animation Preview"]')
    .locator(`.fragment[data-ns-element-id="${s.fixture.id}"]`)
  await expect(fragment).toHaveCount(1)
  await expect(preview).toContainText('Initial state')
  await expect(fragment).toBeHidden()
  const readFragment = () =>
    fragment.evaluate((node) => ({
      index: node.getAttribute('data-fragment-index'),
      opacity: getComputedStyle(node).opacity,
      visibility: getComputedStyle(node).visibility,
      classes: node.className,
    }))
  const initialFragment = await readFragment()
  await preview.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(fragment).toBeVisible()
  await expect(fragment).toHaveCSS('opacity', '1')
  await expect(preview).toContainText('Fragment 2')
  const revealedFragment = await readFragment()
  const fragmentArtifact = await captureCommon(info, page, 'common-fragment-revealed')
  await preview.getByRole('button', { name: 'Replay', exact: true }).click()
  await expect(fragment).toBeHidden()
  const replayedFragment = await readFragment()
  await preview.getByRole('button', { name: 'Close preview', exact: true }).click()
  expect(await s.read()).toEqual(aligned)
  await commonObservation(
    info,
    page,
    'geometry-lock-hidden-fragments-actions-align-multiselect',
    {
      geometry: changedGeometry,
      lockedGeometry: changedGeometry,
      hiddenReload: hidden,
      fragmentOrder: 2,
      previewStates: ['hidden', 'visible', 'hidden'],
      action: authored.action,
      alignmentXs: [120, 120],
      unselected: s.original[2],
    },
    {
      before,
      beforeBounds,
      changedBounds,
      alignedGeometry,
      actionState,
      lockedState,
      hiddenReload,
      undoState,
      redoState,
      initialFragment,
      revealedFragment,
      replayedFragment,
      editorUrlAfterActionKeys: page.url(),
      reloaded: await s.read(),
    },
    [lockArtifact, hiddenArtifact, fragmentArtifact]
  )
})
