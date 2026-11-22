import fs from 'node:fs/promises'
import { appendFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { chromium, request, expect } from '@playwright/test'
import { clock, check, collectHttp, contentOf, exposedTarget, withinDeadline, writeExclusive, writeExclusiveBytes, ownedServer, selectNavigatorSlide } from './native-save-latency/helpers.mjs'

const runId = `20261116-${randomUUID()}`
const reports = path.resolve('plans/261009-0901-navslides-full-reliability-deep-tdd/reports')
const output = path.join(reports, `native-save-${runId}`)
await fs.mkdir(reports, { recursive: true })
await fs.mkdir(output) // Exclusive directory; never overwrite any earlier run.
const receipt = { runId, started: clock(), deadlineMs: 30000, deadlineFailed: false,
  artifactEncoding: { authoritySnapshots: 'original validated HTTP JSON bytes', metadata: 'pretty JSON (indentation 2)' },
  status: 'running', marker: ` NAV13:${runId}`, events: [], markerSaves: [], failures: [], cleanupErrors: [] }
const eventFile = path.join(output, 'http.jsonl')
writeFileSync(eventFile, '', { flag: 'wx' })
const append = (event) => appendFileSync(eventFile, `${JSON.stringify(event)}\n`)
const phase = (name) => {
  receipt.lastPhase = { name, clock: clock() }
  append({ type: 'phase', ...receipt.lastPhase })
}
let root, server, browser, context, setupRequest, page
await writeExclusive(path.join(output, 'started.json'), receipt)
console.log(`Evidence: ${output}`)
try {
  root = await fs.mkdtemp(path.join(os.tmpdir(), `nav-native-save-${runId}-`))
  receipt.retainedDataRoot = root
  const data = path.join(root, 'data'), uploads = path.join(root, 'uploads')
  await fs.mkdir(data); await fs.mkdir(uploads)
  // No server modules or writer live in the Playwright observer process.
  server = ownedServer({ data, uploads, output, receipt })
  const baseURL = await server.ready
  receipt.baseURL = baseURL
  Object.assign(process.env, { PLAYWRIGHT_TEST_BASE_URL: baseURL, PLAYWRIGHT_API_BASE_URL: `${baseURL}/api` })
  await writeExclusive(path.join(output, 'isolation.json'), { root, data, uploads, baseURL })
  const { installPackage, VIEWPORT } = await import('../tests/e2e/helpers/navigator-performance-fixtures.js')
  setupRequest = await request.newContext({ baseURL, timeout: 120000 })
  const fixture = { name: 'package' }
  await installPackage(setupRequest, fixture)
  receipt.presentationId = fixture.id
  receipt.presentationUrl = `${baseURL}/api/presentations/${fixture.id}`
  receipt.initialGeneration = fixture.deck.aggregateGeneration
  receipt.packageHash = fixture.packageHash
  check(fixture.deck.slides.length === 39, 'Imported package must contain 39 slides')
  browser = await chromium.launch({ headless: true })
  context = await browser.newContext({ baseURL, viewport: VIEWPORT, deviceScaleFactor: 1,
    storageState: { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: 'navSlidesTutorialSeen', value: 'true' }] }] } })
  collectHttp(context, receipt, append)
  page = await context.newPage()
  page.on('pageerror', (error) => { receipt.failures.push({ type: 'pageerror', ...clock(), error: error.stack }); append(receipt.failures.at(-1)) })
  const navigation = await page.goto(`/editor/${fixture.id}`, { waitUntil: 'domcontentloaded' })
  check(navigation?.ok(), 'Editor document failed to load')
  await page.waitForSelector('.ProseMirror-preview, [data-element-content]', { timeout: 60000 })
  receipt.target = await exposedTarget(page, fixture.deck)
  const target = receipt.target
  const clipboardInput = process.env.NATIVE_SAVE_INPUT === 'clipboard'
  receipt.inputMode = clipboardInput ? 'native clipboard paste' : 'native per-character keyboard'
  if (clipboardInput) {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.evaluate((marker) => navigator.clipboard.writeText(marker), receipt.marker)
  }
  await page.mouse.dblclick(target.hitpoint.x, target.hitpoint.y)
  const editor = page.getByTestId(`slide-element-${target.id}`).locator('.ProseMirror')
  await editor.waitFor({ timeout: 30000 })
  await expect(editor).toBeFocused({ timeout: 30000 })
  await page.keyboard.press('ControlOrMeta+End')
  await server.profileStart()
  receipt.typingStart = clock()
  append({ type: 'typing-start', ...receipt.typingStart, marker: receipt.marker })
  await withinDeadline(receipt, async (guard) => {
    if (clipboardInput) await page.keyboard.press('ControlOrMeta+V')
    else await page.keyboard.type(receipt.marker)
    receipt.typingEnd = clock(); guard()
    await page.keyboard.press('Escape'); guard()
    // Match a complete marker-bearing save, not the first PUT or a partial keystroke save.
    while (!receipt.markerSaves.some((s) => s.finished.mono - receipt.typingStart.mono <= receipt.deadlineMs)) {
      guard()
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    guard()
    receipt.matchedSave = receipt.markerSaves.at(-1)
    const get = async (label) => {
      guard()
      const started = clock()
      phase(`${label}:get`)
      const response = await context.request.get(receipt.presentationUrl, { timeout: Math.max(1, Math.floor(receipt.deadlineMs - (clock().mono - receipt.typingStart.mono))) })
      const received = clock()
      append({ type: 'authoritative-get', label, started, received, status: response.status() })
      guard()
      check(response.status() === 200, 'Authoritative GET failed')
      phase(`${label}:json`)
      const body = await response.body(); guard()
      const deck = JSON.parse(body.toString('utf8')); guard()
      check(deck.slides.length === 39, 'Authoritative slide count changed')
      check(Number.isInteger(deck.aggregateGeneration) && deck.aggregateGeneration > receipt.initialGeneration, 'Generation did not advance')
      check(contentOf(deck, target).includes(receipt.marker), 'Exact marker absent from authoritative target content')
      phase(`${label}:file-write`)
      await writeExclusiveBytes(path.join(output, `${label}.json`), body); guard()
      phase(`${label}:file-write-returned`)
      return deck
    }
    receipt.generationBeforeReload = (await get('authority-before-reload')).aggregateGeneration
    phase('reload:start')
    const reload = await page.reload({ waitUntil: 'domcontentloaded' }); guard()
    phase('reload:returned')
    check(reload?.ok(), 'Reload document failed')
    phase('navigator:start')
    const button = await selectNavigatorSlide(page, target.index, phase, guard); guard()
    const canvas = page.getByTestId(`slide-element-${target.id}`)
    phase('canvas:wait')
    await canvas.waitFor(); guard()
    phase('canvas:wait-returned')
    // Read exact strings rather than Playwright's whitespace-normalized text oracle.
    const exactText = async (locator, label) => {
      for (;;) {
        guard()
        phase(`${label}:exact-marker-read`)
        const text = await locator.textContent({ timeout: Math.max(1, Math.floor(receipt.deadlineMs - (clock().mono - receipt.typingStart.mono))) })
        guard()
        if (text?.includes(receipt.marker)) {
          phase(`${label}:exact-marker-matched`)
          return text
        }
        phase(`${label}:exact-marker-retry-wait`)
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
    }
    phase('canvas:exact-marker-loop-start')
    const canvasText = await exactText(canvas, 'canvas')
    phase('thumbnail:exact-marker-loop-start')
    const thumbnailText = await exactText(button.locator('[inert]'), 'thumbnail')
    receipt.reload = { canvasText, thumbnailText, canvas: true, thumbnail: true }
    receipt.finalGeneration = (await get('authority-after-reload')).aggregateGeneration
    check(receipt.finalGeneration >= receipt.generationBeforeReload, 'Generation regressed across reload')
    check(!receipt.failures.length, 'Browser runtime error invalidates proof')
    check(!receipt.events.some((e) => e.type === 'requestfailed' || e.type === 'response' && e.status >= 400), 'HTTP failure invalidates proof')
    guard()
  })
  receipt.deadlinePassed = !receipt.deadlineFailed
  receipt.status = 'passed'
} catch (error) {
  receipt.status = 'failed'
  receipt.deadlinePassed = false
  receipt.failures.push({ type: 'harness', ...clock(), error: error.stack || String(error) })
  append(receipt.failures.at(-1))
  process.exitCode = 1
} finally {
  // Checkpoint before potentially failing screenshot/teardown. All isolated data is retained.
  try { await writeExclusive(path.join(output, 'result-before-cleanup.json'), receipt) }
  catch (error) { receipt.cleanupErrors.push(`Checkpoint: ${error.message}`) }
  if (page && !page.isClosed()) {
    try { await page.screenshot({ path: path.join(output, 'reload-or-failure.png'), timeout: 10000 }) }
    catch (error) { receipt.cleanupErrors.push(`Screenshot: ${error.message}`) }
  }
  for (const [label, close] of [
    ['browser', () => browser?.close()], ['setupRequest', () => setupRequest?.dispose()],
    ['server', () => server?.stop()],
  ]) {
    try { await close() } catch (error) { receipt.cleanupErrors.push(`${label}: ${error.message}`) }
  }
  if (receipt.cleanupErrors.length) { receipt.status = 'failed'; process.exitCode = 1 }
  receipt.finished = clock()
  await writeExclusive(path.join(output, 'result.json'), receipt)
  console.log(`${receipt.status.toUpperCase()} — ${output}; retained data: ${root ?? 'not created'}`)
}
