import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { apiGetPresentation } from './fixtures/test-fixtures.js'
import { historyJourney, titleInput, quick, holdNextSave, saved, slide, text } from './helpers/p06-history-acceptance.js'
import { createHistoryPackage } from './helpers/p06-history-package.js'

test('P06-09/10 queued save persists and a pending route save cannot replace its destination', async ({ page, browser, request }, info) => {
  test.setTimeout(120000)
  await historyJourney({ page, browser, request }, info, ['P06-09', 'P06-10'], async ({ create, receipt }) => {
    const id = await create('Route original', { slides: [slide([])] })
    const other = await create('Route destination', { slides: [slide([])] })
    await page.goto(`/editor/${id}`)
    await expect(titleInput(page)).toHaveValue('Route original')
    const held = await holdNextSave(page, id)
    await titleInput(page).fill('Route pending A')
    const body = await held.entered
    expect(body.title).toBe('Route pending A')
    await titleInput(page).fill('Route queued B')
    await expect(quick(page).getByRole('button', { name: 'Saving...', exact: true })).toBeVisible()
    held.release()
    await saved(request, id, (deck) => deck.title, 'Route queued B')
    const routeSave = await holdNextSave(page, id)
    await titleInput(page).fill('Route in-flight C')
    expect((await routeSave.entered).title).toBe('Route in-flight C')
    // SPA navigation occurs while a real PUT is suspended, not after a fabricated response.
    await page.evaluate((destination) => {
      history.pushState({}, '', `/editor/${destination}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, other)
    await expect(titleInput(page)).toHaveValue('Route destination')
    routeSave.release()
    await saved(request, id, (deck) => deck.title, 'Route in-flight C')
    await expect(titleInput(page)).toHaveValue('Route destination')
    expect((await apiGetPresentation(request, other)).title).toBe('Route destination')
    await page.goto(`/editor/${id}`)
    await expect(titleInput(page)).toHaveValue('Route in-flight C')
    await expect(quick(page).getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
    await page.reload()
    await expect(titleInput(page)).toHaveValue('Route in-flight C')
    receipt.runs.push({ scenarioIds: ['P06-09', 'P06-10'], status: 'pending-identity', heldBody: body.title, successorPersisted: 'Route queued B', routePendingPersistedAndReloaded: 'Route in-flight C', destinationUnchanged: true })
  })
})

test('P06-11 actual connection failure retries the queued latest edit and reloads', async ({ page, browser, request }, info) => {
  test.setTimeout(120000)
  await historyJourney({ page, browser, request }, info, ['P06-11'], async ({ create, receipt }) => {
    const id = await create('Retry original', { slides: [slide([])] })
    await page.goto(`/editor/${id}`)
    await expect(titleInput(page)).toHaveValue('Retry original')
    let arrive, release
    const entered = new Promise((resolve) => { arrive = resolve })
    const released = new Promise((resolve) => { release = resolve })
    let taken = false
    await page.route(`**/api/presentations/${id}`, async (route) => {
      if (route.request().method() !== 'PUT' || taken) return route.continue()
      taken = true
      arrive(route.request().postDataJSON())
      await released
      await route.abort('connectionfailed')
    })
    await titleInput(page).fill('Retry A')
    expect((await entered).title).toBe('Retry A')
    await titleInput(page).fill('Retry latest B')
    release()
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await saved(request, id, (deck) => deck.title, 'Retry latest B')
    await page.reload()
    await expect(titleInput(page)).toHaveValue('Retry latest B')
    receipt.runs.push({ scenarioId: 'P06-11', status: 'pending-identity', transportFailure: 'connectionfailed, no invented API body', retryAndReload: 'Retry latest B' })
  })
})

test('P06-12 Use Remote discards a queued edit after a genuine generation conflict', async ({ page, browser, request }, info) => {
  test.setTimeout(120000)
  await historyJourney({ page, browser, request }, info, ['P06-12'], async ({ ids, receipt }) => {
    const { id } = await createHistoryPackage(request, ids, 'Conflict original')
    await page.goto(`/editor/${id}`)
    await expect(titleInput(page)).toHaveValue('Conflict original')
    const held = await holdNextSave(page, id)
    await titleInput(page).fill('Conflict local A')
    const pending = await held.entered
    await titleInput(page).fill('Conflict queued B')
    const remote = await apiGetPresentation(request, id)
    const remoteSave = await request.put(`${process.env.PLAYWRIGHT_API_BASE_URL}/presentations/${id}`, {
      data: { ...remote, title: 'Remote authoritative', aggregateGeneration: remote.aggregateGeneration, idempotencyKey: `p06-remote-${randomUUID()}` },
    })
    const remoteBody = await remoteSave.json()
    receipt.remoteSave = { status: remoteSave.status(), expectedGeneration: remote.aggregateGeneration, body: remoteBody }
    expect(remoteSave.ok(), JSON.stringify(receipt.remoteSave)).toBeTruthy()
    held.release()
    const dialog = page.getByRole('alertdialog', { name: 'Save conflict' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Use Remote', exact: true }).click()
    await expect(titleInput(page)).toHaveValue('Remote authoritative')
    // Advance beyond the save debounce: a discarded queued successor must never land.
    const start = Date.now()
    await expect.poll(async () => ({
      title: (await apiGetPresentation(request, id)).title,
      quiet: Date.now() - start >= 2000,
    }), { timeout: 6000, intervals: [250, 500] }).toEqual({ title: 'Remote authoritative', quiet: true })
    await page.reload()
    await expect(titleInput(page)).toHaveValue('Remote authoritative')
    receipt.runs.push({ scenarioId: 'P06-12', status: 'pending-identity', heldBody: pending.title, discardedQueued: 'Conflict queued B', remoteAndReload: 'Remote authoritative' })
  })
})

test('P06-13 manual acknowledgement preserves a newer draft through real unload recovery', async ({ page, browser, request }, info) => {
  test.setTimeout(120000)
  await historyJourney({ page, browser, request }, info, ['P06-13'], async ({ create, receipt }) => {
    const html = `<p>${'x'.repeat(70 * 1024)}</p>`
    const id = await create('Manual original', { slides: [slide([text('large', html)])] })
    const key = `navslides-editor-draft:presentation:${id}`
    const draft = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key)
    await page.goto(`/editor/${id}`)
    await expect(titleInput(page)).toHaveValue('Manual original')
    const held = await holdNextSave(page, id)
    await titleInput(page).fill('Manual submitted A')
    await page.keyboard.press('ControlOrMeta+s')
    const submitted = await held.entered
    expect(submitted.title).toBe('Manual submitted A')
    expect(submitted.slides[0].elements[0].content).toBe(html)
    await titleInput(page).fill('Manual newer B')
    await expect.poll(async () => (await draft())?.snapshot.title).toBe('Manual newer B')
    const newer = await draft()
    expect(newer.snapshot.slides[0].elements[0].content).toBe(html)
    let blockSuccessor = true
    let enteredB
    const successor = new Promise((resolve) => { enteredB = resolve })
    await page.route(`**/api/presentations/${id}`, async (route) => {
      if (route.request().method() !== 'PUT' || !blockSuccessor) return route.continue()
      enteredB(route.request().postDataJSON())
      await route.abort('connectionfailed')
    })
    const responseA = page.waitForResponse((response) => response.request().method() === 'PUT' && response.url().endsWith(`/presentations/${id}`) && response.request().postDataJSON().title === 'Manual submitted A')
    held.release()
    expect((await responseA).ok()).toBe(true)
    await saved(request, id, (deck) => ({ title: deck.title, html: deck.slides[0].elements[0].content }), { title: 'Manual submitted A', html })
    expect((await successor).title).toBe('Manual newer B')
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
    await expect(quick(page).getByRole('button', { name: 'Saved', exact: true })).toHaveCount(0)
    const preserved = await draft()
    expect(preserved.snapshot).toEqual(newer.snapshot)
    expect(preserved.draftId).toBe(newer.draftId)
    expect(preserved.attemptId).toBe(newer.attemptId)
    // Keep the genuine transport fault through beforeunload, including oversized sync fallback.
    await page.reload()
    const recovery = page.getByRole('alertdialog', { name: 'Recover interrupted save' })
    await expect(recovery).toBeVisible()
    await expect(titleInput(page)).toHaveValue('Manual submitted A')
    expect((await apiGetPresentation(request, id)).title).toBe('Manual submitted A')
    expect((await draft()).snapshot).toEqual(newer.snapshot)
    blockSuccessor = false
    await recovery.getByRole('button', { name: 'Recover Local Draft', exact: true }).click()
    await saved(request, id, (deck) => ({ title: deck.title, html: deck.slides[0].elements[0].content }), { title: 'Manual newer B', html })
    await expect.poll(draft).toBeNull()
    await page.reload()
    await expect(titleInput(page)).toHaveValue('Manual newer B')
    await expect(recovery).toHaveCount(0)
    receipt.runs.push({ scenarioId: 'P06-13', status: 'pending-identity', submittedTitle: submitted.title, submittedHtml: html, preservedDraft: newer, committedAWhileBFailed: true, realReloadRecovery: true, recoveredAndReloaded: 'Manual newer B', draftClearedAfterSuccess: true })
  })
})
