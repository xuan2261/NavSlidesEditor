import { test, expect } from '../fixtures/test-fixtures.js'
import { commonSession, selectCommon, commonObservation, captureCommon } from './common-editor.js'

test('common keyboard edits inputs without stealing native keys and operates native game controls', async ({
  page,
  request,
  testPresentation,
}, info) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.addInitScript(() => {
    window.__commonInputKeys = []
    document.addEventListener('keydown', (event) => {
      if (event.target.getAttribute?.('aria-label') !== 'Item 1 label') return
      queueMicrotask(() =>
        window.__commonInputKeys.push({
          key: event.key,
          ctrl: event.ctrlKey,
          prevented: event.defaultPrevented,
          trusted: event.isTrusted,
        })
      )
    })
  })
  const s = await commonSession(page, request, testPresentation.id)
  await selectCommon(s.target)
  const panel = page.getByRole('complementary', { name: 'Properties panel', exact: true })
  const item = panel.getByRole('textbox', { name: 'Item 1 label', exact: true })
  await item.focus()
  await item.press('Control+a')
  const selection = await item.evaluate((node) => ({
    start: node.selectionStart,
    end: node.selectionEnd,
    value: node.value,
  }))
  expect(selection).toEqual({
    start: 0,
    end: s.original[0]['name-picker'].items[0].label.length,
    value: s.original[0]['name-picker'].items[0].label,
  })
  await page.keyboard.type('Keyboard learner')
  await item.press('Home')
  expect(await item.evaluate((node) => node.selectionStart)).toBe(0)
  await item.press('ArrowRight')
  expect(await item.evaluate((node) => node.selectionStart)).toBe(1)
  await item.press('Delete')
  await expect(item).toHaveValue('Kyboard learner')
  await item.press('End')
  expect(await item.evaluate((node) => node.selectionStart)).toBe('Kyboard learner'.length)
  await item.press('Control+a')
  await page.keyboard.type('Keyboard learner')
  await item.press('Tab')
  await expect(item).not.toBeFocused()
  const authored = structuredClone(s.original[0])
  authored['name-picker'].items[0].label = 'Keyboard learner'
  await expect.poll(s.read).toEqual([authored])
  await expect(s.target).toHaveAttribute('data-selected', 'true')
  const inputKeys = await page.evaluate(() => window.__commonInputKeys)
  for (const key of ['Home', 'ArrowRight', 'Delete', 'End', 'a', 'Tab']) {
    const events = inputKeys.filter((event) => event.key === key)
    expect(events, `Native input key ${key} must have been exercised`).not.toEqual([])
    for (const event of events) expect(event).toMatchObject({ prevented: false, trusted: true })
  }

  await s.target.focus()
  await s.target.press('Shift+ArrowRight')
  const moved = { ...authored, x: authored.x + 10 }
  await expect.poll(s.read).toEqual([moved])
  await s.editor.undo()
  await expect.poll(s.read).toEqual([authored])
  await s.editor.redo()
  await expect.poll(s.read).toEqual([moved])
  await page.reload()
  await s.editor.waitForReady()
  expect(await s.read()).toEqual([moved])
  await selectCommon(s.target)

  const sections = panel.getByRole('tablist', { name: 'Game property sections', exact: true })
  const content = sections.getByRole('tab', { name: 'Content', exact: true })
  const display = sections.getByRole('tab', { name: 'Display', exact: true })
  await content.focus()
  await content.press('ArrowRight')
  await expect(display).toBeFocused()
  await expect(display).toHaveAttribute('aria-selected', 'true')
  await display.press('ArrowLeft')
  await expect(content).toBeFocused()
  await expect(content).toHaveAttribute('aria-selected', 'true')

  const launcher = panel.getByRole('button', { name: 'Try game', exact: true })
  await launcher.focus()
  await launcher.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Try game', exact: true })
  await expect(dialog.getByRole('button', { name: 'Close Try game', exact: true })).toBeFocused()
  const root = dialog.locator('[data-ns-game]')
  const pick = root.locator('[data-ns-command="pick"]')
  await pick.focus()
  await pick.press('Space')
  await expect(root.locator('[data-ns-winner]')).toHaveText('Keyboard learner')
  const picked = await root.innerText()
  await root.getByRole('button', { name: 'Reset', exact: true }).press('Enter')
  await expect(root.locator('[data-ns-winner]')).toHaveText('Choose a name')
  const reset = await root.innerText()
  const gameArtifact = await captureCommon(info, page, 'common-keyboard-native-reset')
  await dialog.getByRole('button', { name: 'Close Try game', exact: true }).press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(launcher).toBeFocused()
  expect(await s.read()).toEqual([moved])
  await commonObservation(
    info,
    page,
    'keyboard',
    {
      typedLabel: 'Keyboard learner',
      nativeDelete: 'Kyboard learner',
      nudgeX: authored.x + 10,
      winner: 'Keyboard learner',
      resetWinner: 'Choose a name',
      restoredFocus: 'Try game',
    },
    {
      selection,
      inputKeys,
      picked,
      reset,
      reloaded: await s.read(),
      focusedAfterEscape: await launcher.evaluate((node) => node === document.activeElement),
    },
    [gameArtifact]
  )
})
