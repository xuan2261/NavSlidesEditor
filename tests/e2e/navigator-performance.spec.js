import { writeFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { apiDeletePresentation } from './fixtures/test-fixtures.js'
import { BUDGET, REPETITIONS, SEED, VIEWPORT, contentHash, installPackage, installSynthetic, restoreCanonical, shuffled, syntheticDeck } from './helpers/navigator-performance-fixtures.js'
import { captureAttribution, installProbe } from './helpers/navigator-performance-probe.js'
import { behaviorSmoke, measureInteractions, witness } from './helpers/navigator-performance-interactions.js'
import { compareBaseline, environmentEvidence, saveEvidence, summarize } from './helpers/navigator-performance-evidence.js'
import { executionIdentityGate, finishExecutionIdentity } from './helpers/execution-identity-gate.js'

// Run alone after phases06/07 and a production build:
// npx playwright test tests/e2e/navigator-performance.spec.js --project=chromium --workers=1 --retries=0
// Candidate comparison: set NAVIGATOR_BASELINE_INPUT to the saved navigator-baseline.json.
// Evidence lives in Playwright's per-test output directory and HTML report attachments.
test.use({ viewport: VIEWPORT, deviceScaleFactor: 1, headless: true, trace: 'off', video: 'off' })
test('phase13 isolated production navigator baseline and stable-ID behavior', async ({ browser, browserName, request }, testInfo) => {
  test.setTimeout(7200000)
  const fixtures = []
  const receipt = {
    schemaVersion: 1, startedAt: new Date().toISOString(), status: 'running', budget: BUDGET,
    protocol: { cold: 'fresh browser context; HTTP cache disabled; includes navigation/API/parsing/fonts/decoded thumbnail images', warm: 'one discarded interaction warmup per fixture; five seeded randomized rounds; canonical source restored before each navigation', paint: 'trusted native event capture timestamp → stable source-ID/content/order oracle → second rAF; painted-frame upper bound, not exact compositor timestamp', nativePaintCrossCheck: 'Event Timing entries reported separately, >=16ms reporting threshold; missing entries are N/A, not0', profiling: 'Normal production only; React commit N/A; separate profiling-build data must not enter these distributions', drop: 'genuine held native drag across offscreen viewport; scrollIntoView target strategy, not an autoscroll claim', interpretation: 'DOM/heap are browser observations, not jsdom counts or memory-leak claims; layout/script/task counters and resource timings are attribution hints, not causal proof' },
    fixtures: [], runs: [], behaviors: [], cleanupErrors: [],
  }
  receipt.budgetHash = contentHash({ budget: receipt.budget, protocol: receipt.protocol })
  let warmContext, failure, identityError, evidenceError
  async function runOne(fixture, population, repetition, context) {
    const run = { fixture: fixture.name, fixtureHash: fixture.fixtureHash, population, repetition, status: 'running' }
    receipt.runs.push(run)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const session = await context.newCDPSession(page)
    try {
      await session.send('Performance.enable')
      await session.send('Network.enable')
      await session.send('Network.setCacheDisabled', { cacheDisabled: population === 'cold' })
      if (population === 'cold') await session.send('Network.clearBrowserCache')
      run.canonicalHash = await restoreCanonical(request, fixture)
      const navigation = await page.goto(`/editor/${fixture.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      expect(navigation?.ok(), 'Production editor document must load').toBe(true)
      run.ready = await page.evaluate(({ ids, first, synthetic }) => window.__navigatorProbe.ready(ids, first, synthetic), { ids: fixture.deck.slides.map((slide) => slide.id), first: witness(fixture.deck.slides[0]).id, synthetic: fixture.name !== 'package' })
      expect(run.ready.parentCount).toBe(fixture.parentCount)
      expect(run.ready.flattenedCount).toBe(fixture.flattenedCount)
      run.attributionBefore = await captureAttribution(session)
      if (population !== 'cold') run.interactions = await measureInteractions(page, fixture)
      run.attributionAfter = await captureAttribution(session)
      await page.evaluate(() => window.__navigatorProbe.idle())
      run.browser = await page.evaluate(() => window.__navigatorProbe.snapshot())
      if (population === 'warmup') receipt.behaviors.push({ fixture: fixture.name, result: await behaviorSmoke(page, fixture, request, testInfo) })
      expect(errors, 'Browser runtime errors invalidate the sample').toEqual([])
      run.status = 'pending-identity'
      run.executionIdentityBefore = receipt.executionIdentity.before.sha256
    } catch (error) {
      run.status = 'failed'; run.error = error.message
      try { run.browser = await page.evaluate(() => window.__navigatorProbe?.snapshot() ?? { available: false, value: null, reason: 'Probe not initialized' }) }
      catch (snapshotError) { run.browser = { available: false, value: null, reason: snapshotError.message } }
      try { await testInfo.attach(`${fixture.name}-${population}-${repetition}-failure`, { body: await page.screenshot(), contentType: 'image/png' }) }
      catch (screenshotError) { run.screenshotError = screenshotError.message }
      throw error
    } finally {
      run.pageErrors = errors
      await session.detach()
      await page.close()
      // Failed samples are checkpointed before the next population; never discarded/retried.
      await saveEvidence(testInfo, 'navigator-baseline-checkpoint.json', receipt)
    }
  }
  try {
    await executionIdentityGate(receipt, 'before', browser, ['PPTX/Bai_2_2.pptx'])
    expect(browserName).toBe('chromium')
    expect(testInfo.config.workers, 'Measurements must run alone with one worker').toBe(1)
    expect(testInfo.project.retries, 'Retries must not select attractive samples').toBe(0)
    expect(testInfo.project.repeatEach).toBe(1)
    expect(process.env.PLAYWRIGHT_USE_DEV_SERVERS, 'Build the production client; do not benchmark Vite').not.toBe('1')
    const baseURL = testInfo.project.use.baseURL
    expect(baseURL).toMatch(/^http:\/\/(127\.0\.0\.1|localhost):\d+\/?$/)
    const contextOptions = { baseURL, viewport: VIEWPORT, deviceScaleFactor: 1, reducedMotion: 'reduce', storageState: { cookies: [], origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: 'navSlidesTutorialSeen', value: 'true' }] }] } }
    fixtures.push(...[50, 100, 300].flatMap((parents) => [0, 1, 3].map((children) => syntheticDeck(parents, children))))
    fixtures.push({ name: 'package' })
    receipt.environment = await environmentEvidence(browser, browser.browserType(), testInfo, receipt.executionIdentity.before)
    await saveEvidence(testInfo, 'navigator-budget-frozen.json', { frozenAt: receipt.startedAt, budget: receipt.budget, budgetHash: receipt.budgetHash, protocol: receipt.protocol, environment: receipt.environment, executionIdentity: receipt.executionIdentity })
    for (const fixture of fixtures) {
      if (fixture.name === 'package') await installPackage(request, fixture)
      else await installSynthetic(request, fixture)
      receipt.fixtures.push(Object.fromEntries(['name', 'fixtureHash', 'packageHash', 'imageHash', 'parentCount', 'childCount', 'flattenedCount', 'provenance'].filter((key) => fixture[key] !== undefined).map((key) => [key, fixture[key]])))
    }
    // Every cold context is closed before any warm measurements begin.
    for (const fixture of shuffled(fixtures, SEED)) {
      const context = await browser.newContext(contextOptions)
      try { await installProbe(context); await runOne(fixture, 'cold', 0, context) }
      finally { await context.close() }
    }
    warmContext = await browser.newContext(contextOptions)
    await installProbe(warmContext)
    for (const fixture of shuffled(fixtures, SEED + 1)) await runOne(fixture, 'warmup', 0, warmContext)
    for (let repetition = 1; repetition <= REPETITIONS; repetition += 1) {
      const order = shuffled(fixtures, SEED + repetition + 1)
      receipt[`round${repetition}Order`] = order.map((fixture) => fixture.name)
      for (const fixture of order) await runOne(fixture, 'warm', repetition, warmContext)
    }
    await executionIdentityGate(receipt, 'after', browser, ['PPTX/Bai_2_2.pptx'])
    receipt.summary = summarize(receipt)
    receipt.comparison = await compareBaseline(receipt)
    expect(receipt.summary.complete, 'All ten fixtures and all cold/warm populations must be retained').toBe(true)
    receipt.status = 'measured; phase14 decision requires actual evidence and UX inspection'
  } catch (error) {
    receipt.status = 'failed'; receipt.error = error.message
    failure = error
  } finally {
    if (warmContext) {
      try { await warmContext.close() }
      catch (error) { receipt.cleanupErrors.push(`Browser context: ${error.message}`) }
    }
    for (const fixture of fixtures) {
      try { await apiDeletePresentation(request, fixture.id) }
      catch (error) { receipt.cleanupErrors.push(`${fixture.name}: ${error.message}`) }
    }
    identityError = await finishExecutionIdentity(receipt, browser, ['PPTX/Bai_2_2.pptx'])
    if (receipt.cleanupErrors.length) receipt.status = 'failed'
    receipt.finishedAt = new Date().toISOString()
    receipt.summary = summarize(receipt)
    try {
      const isCandidate = Boolean(process.env.NAVIGATOR_BASELINE_INPUT)
      if (isCandidate) {
        receipt.comparison = await compareBaseline(receipt)
      }
      const outputFilename = isCandidate ? 'navigator-candidate.json' : 'navigator-baseline.json'
      await saveEvidence(testInfo, outputFilename, receipt)
      await writeFile(`plans/261009-0901-navslides-full-reliability-deep-tdd/reports/${outputFilename}`, `${JSON.stringify(receipt, null, 2)}\n`)
    }
    catch (error) { evidenceError = error; receipt.evidenceError = error.stack || error.message }
  }
  if (failure) throw failure
  if (identityError) throw identityError
  if (evidenceError) throw evidenceError
  expect(receipt.cleanupErrors, 'Owned fixture cleanup must not silently fail').toEqual([])
})
