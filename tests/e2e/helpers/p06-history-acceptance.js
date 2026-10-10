import { expect } from '@playwright/test'
import { executionIdentityGate, finishExecutionIdentity } from './execution-identity-gate.js'
import { apiCreatePresentation, apiDeletePresentation, apiGetPresentation, apiUpdatePresentation } from '../fixtures/test-fixtures.js'

export const text = (id, content, x = 100) => ({ id, type: 'text', x, y: 100, width: 400, height: 80, content, fontSize: 24 })
export const slide = (elements) => ({ id: 'slide', elements, notes: '', background: { type: 'color', color: '#101010' } })
export const titleInput = (page) => page.getByPlaceholder('Untitled Presentation')
export const quick = (page) => page.getByRole('toolbar', { name: 'Quick actions' })
export const content = (page, id) => page.getByTestId(`slide-element-${id}`)
export const saved = async (request, id, read, expected) => expect.poll(async () => read(await apiGetPresentation(request, id)), { timeout: 12000 }).toEqual(expected)

export async function historyJourney({ page, browser, request }, info, scenarioIds, journey) {
  const receipt = { status: 'running', scenarioIds, production: 'isolated npm start, actual HTTP API; barriers never synthesize bodies', runs: [], pageErrors: [] }
  const ids = []
  page.on('pageerror', (error) => receipt.pageErrors.push(error.message))
  const create = async (title, body) => {
    const deck = await apiCreatePresentation(request, title)
    ids.push(deck.id)
    if (body) await apiUpdatePresentation(request, deck.id, body)
    return deck.id
  }
  let journeyError = null
  let identityError = null
  try {
    await executionIdentityGate(receipt, 'before', browser)
    await journey({ create, receipt, ids })
    expect(receipt.pageErrors).toEqual([])
    receipt.status = 'passed'
  } catch (error) {
    receipt.status = 'failed'; receipt.error = error.message
    journeyError = error
  } finally {
    identityError = await finishExecutionIdentity(receipt, browser)
    await info.attach('p06-native-ui', { body: await page.screenshot(), contentType: 'image/png' })
    await info.attach('p06-browser-receipt', { body: Buffer.from(JSON.stringify(receipt, null, 2)), contentType: 'application/json' })
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    for (const id of ids) await apiDeletePresentation(request, id)
  }
  if (journeyError) throw journeyError
  if (identityError) throw identityError
}

// Hold only one actual HTTP transaction. Release forwards the captured request unchanged.
export async function holdNextSave(page, id) {
  let arrive, release
  const entered = new Promise((resolve) => { arrive = resolve })
  const released = new Promise((resolve) => { release = resolve })
  let taken = false
  await page.route(`**/api/presentations/${id}`, async (route) => {
    if (route.request().method() !== 'PUT' || taken) return route.continue()
    taken = true
    arrive(route.request().postDataJSON())
    await released
    await route.continue()
  })
  return { entered, release }
}
