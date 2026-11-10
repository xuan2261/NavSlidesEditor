import { pathToFileURL } from 'node:url'
import {
  test,
  expect,
  apiGetPresentation,
  apiCreateShareLink,
} from '../fixtures/test-fixtures.js'
import { local, inherited, hostileLabel, author, readState, waitReady, pick } from './standalone-runtime-fixture.js'


test('effective tuples pause pending picks, resume once and isolate inherited copies', async ({
  page,
  request,
  testPresentation,
}) => {
  await author(request, testPresentation)
  await page.clock.install()
  await page.goto(`/api/presentations/${testPresentation.id}/present`)
  await waitReady(page)
  const roots = await page.locator('[data-ns-game]').evaluateAll((nodes) =>
    nodes.map((root) => ({
      slide: root.closest('[data-ns-effective-slide-id]').dataset.nsEffectiveSlideId,
      element: root.dataset.nsElementId,
    }))
  )
  expect(roots).toEqual(
    expect.arrayContaining([
      { slide: 'parent', element: 'local' },
      { slide: 'parent', element: inherited },
      { slide: 'child', element: inherited },
      { slide: 'second', element: inherited },
    ])
  )
  expect(roots.filter((root) => root.slide === 'hidden')).toEqual([])
  const leave = await page.evaluate(() => {
    const root = document.querySelector('[data-ns-element-id="local"]')
    root.querySelector('[data-ns-command="pick"]').click()
    const before = NavSlidesEducation.mount(root).getState()
    Reveal.slide(0, 1)
    return { before, paused: root.classList.contains('ns-education-paused') }
  })
  expect(leave.before).toMatchObject({ phase: 'picking', picks: 0 })
  expect(leave.paused).toBe(true)
  // Run the browser timers beyond the abandoned pick's 700ms completion deadline.
  await page.clock.runFor(900)
  expect(await readState(page, 'parent', 'local')).toMatchObject({ phase: 'picking', picks: 0 })
  await pick(page, '[data-ns-effective-slide-id="child"] [data-ns-game]')
  await page.evaluate(() => Reveal.slide(0, 0))
  await expect
    .poll(() => readState(page, 'parent', 'local'))
    .toMatchObject({ picks: 1, phase: 'result' })
  expect(await readState(page, 'parent', inherited)).toMatchObject({ picks: 0 })
  expect(await readState(page, 'child', inherited)).toMatchObject({ picks: 1 })
  expect(await readState(page, 'second', inherited)).toMatchObject({ picks: 0 })
  const generation = (await readState(page, 'parent', 'local')).generation
  await page.evaluate(() => {
    const api = NavSlidesEducation.mount(document.querySelector('[data-ns-element-id="local"]'))
    api.reset()
    document.querySelector('[data-ns-element-id="local"] [data-ns-command="pick"]').click()
    api.reset()
  })
  // The cancelled generation's timer has now had its full opportunity to fire.
  await page.clock.runFor(900)
  expect(await readState(page, 'parent', 'local')).toMatchObject({
    picks: 0,
    phase: 'ready',
    generation: generation + 2,
  })
})

test('UI Present, hosted Preview/Share and downloaded file use safe native gameplay', async ({
  page,
  context,
  request,
  testPresentation,
}, testInfo) => {
  test.setTimeout(90000)
  await author(request, testPresentation)
  const before = await apiGetPresentation(request, testPresentation.id)
  await page.goto(`/editor/${testPresentation.id}`)
  await expect(page.getByRole('textbox', { name: 'Presentation title' })).toBeVisible()
  await page.getByRole('button', { name: 'Present', exact: true }).first().click()
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('menuitem', { name: 'From beginning (F5)', exact: true }).click()
  const popup = await popupPromise
  await waitReady(popup)
  await pick(popup)
  expect(await readState(popup, 'parent', 'local')).toMatchObject({ picks: 1 })
  await popup.close()
  const share = await apiCreateShareLink(request, testPresentation.id)
  const apiOrigin = new URL(process.env.PLAYWRIGHT_API_BASE_URL).origin
  const hosted = await context.newPage()
  for (const url of [
    `/api/presentations/${testPresentation.id}/present?preview=true`,
    `${apiOrigin}/share/${share.token}`,
  ]) {
    await hosted.goto(url)
    await waitReady(hosted)
    await pick(hosted)
    expect(await readState(hosted, 'parent', 'local')).toMatchObject({ picks: 1 })
  }
  await hosted.close()
  await page.getByRole('button', { name: 'File menu', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Export HTML', exact: true }).click()
  const download = await downloadPromise
  const output = testInfo.outputPath('native-portable.html')
  await download.saveAs(output)
  const offline = await context.browser().newContext({ offline: true })
  try {
    const file = await offline.newPage()
    const attempted = []
    file.on('request', (request) => {
      if (/^https?:/.test(request.url())) attempted.push(request.url())
    })
    file.on('websocket', (socket) => attempted.push(socket.url()))
    await file.goto(pathToFileURL(output).href)
    await waitReady(file)
    const parsed = await file
      .locator(`${local} [data-ns-game-config]`)
      .evaluate((node) => JSON.parse(node.textContent))
    expect(parsed.items[0].label).toBe(hostileLabel)
    for (const mode of ['wheel', 'dice', 'button']) {
      await file.locator(`${local} select`).selectOption(mode)
      await pick(file)
      const state = await readState(file, 'parent', 'local')
      expect(state).toMatchObject({ mode, picks: 1, excludedIds: [state.lastWinner.id] })
      if (mode === 'dice')
        expect(state.diceValues).toEqual([expect.any(Number), expect.any(Number)])
      await file.locator(`${local} [data-ns-command="reset"]`).click()
      expect(await readState(file, 'parent', 'local')).toMatchObject({
        phase: 'ready',
        picks: 0,
        excludedIds: [],
        lastWinner: null,
      })
    }
    await file.locator(`${local} select`).selectOption('button')
    const control = file.locator(`${local} [data-ns-command="pick"]`)
    await control.focus()
    await file.keyboard.press('Space')
    await expect.poll(() => readState(file, 'parent', 'local')).toMatchObject({ picks: 1 })
    expect(await file.evaluate(() => Reveal.getIndices())).toMatchObject({ h: 0, v: 0 })
    await file.locator(`${local} [data-ns-command="reset"]`).click()
    await control.focus()
    await file.keyboard.press('Enter')
    await expect.poll(() => readState(file, 'parent', 'local')).toMatchObject({ picks: 1 })
    expect(await file.evaluate(() => Reveal.getIndices())).toMatchObject({ h: 0, v: 0 })
    await file.evaluate(() => {
      document.activeElement.blur()
      document.body.tabIndex = -1
      document.body.focus()
    })
    await file.keyboard.press('ArrowRight')
    await expect.poll(() => file.evaluate(() => Reveal.getIndices().h)).toBe(1)
    expect(attempted).toEqual([])
  } finally {
    await offline.close()
  }
  expect(await apiGetPresentation(request, testPresentation.id)).toEqual(before)
})

