/* global window */
const fs = require('fs-extra')
const path = require('node:path')
const { createDeadline } = require('./http-boundary')
const VIEWPORT = Object.freeze({ width: 960, height: 540 })
function expectedRevealSlideCount(presentation) {
  return (presentation?.slides || []).reduce((count, slide) => count + 1 + (slide.children?.length || 0), 0)
}

function captureTimeout() {
  return Object.assign(new Error('capture-timeout'), { code: 'capture-timeout' })
}

function abortable(signal, operation) {
  if (!signal) return operation()
  if (signal.aborted) throw captureTimeout()
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(captureTimeout())
    signal.addEventListener('abort', onAbort, { once: true })
    Promise.resolve().then(() => {
      if (signal.aborted) throw captureTimeout()
      return operation()
    }).then(
      (value) => { signal.removeEventListener('abort', onAbort); resolve(value) },
      (error) => { signal.removeEventListener('abort', onAbort); reject(error) }
    )
  })
}

async function closeResource(resource, name, timeoutMs) {
  if (!resource?.close) return null
  const deadline = createDeadline(timeoutMs)
  try {
    await abortable(deadline.signal, () => resource.close())
    return null
  } catch (error) {
    return error?.code === 'capture-timeout' ? `capture-${name}-close-timeout` : `capture-${name}-close-failed`
  } finally {
    deadline.clear()
  }
}

async function closeCaptureResources(page, browser, ownBrowser, timeoutMs) {
  const errors = []
  const pageError = await closeResource(page, 'page', timeoutMs)
  if (pageError) errors.push(pageError)
  const browserError = ownBrowser ? await closeResource(browser, 'browser', timeoutMs) : null
  if (browserError) errors.push(browserError)
  return errors
}

async function disposeHandle(handle, timeoutMs) {
  if (!handle?.dispose) return null
  const deadline = createDeadline(timeoutMs)
  try {
    await abortable(deadline.signal, () => handle.dispose())
    return null
  } catch (error) {
    return error?.code === 'capture-timeout'
      ? 'capture-current-slide-dispose-timeout'
      : 'capture-current-slide-dispose-failed'
  } finally {
    deadline.clear()
  }
}

async function launchBrowser(chromium, signal, teardownTimeoutMs) {
  const pending = chromium.launch({ headless: true })
  try {
    return await abortable(signal, () => pending)
  } catch (error) {
    if (error?.code === 'capture-timeout') {
      Promise.resolve(pending).then((browser) => closeResource(browser, 'browser', teardownTimeoutMs), () => {})
      error.cleanupPending = 'capture-browser-launch-cleanup-pending'
    }
    throw error
  }
}

async function generatePresentHtml(presentation) {
  let generateRevealHTML
  try {
    ;({ generateRevealHTML } = require('revealjs-shared'))
  } catch {
    ;({ generateRevealHTML } = require('../../../../shared/src/htmlGenerator.js'))
  }
  return generateRevealHTML(presentation)
}

async function writePresentHtml(presentation, outFile) {
  await fs.writeFile(outFile, await generatePresentHtml(presentation), 'utf8')
  return outFile
}

function normalizeRevealPlan(plan) {
  if (!Array.isArray(plan)) throw new Error('invalid-reveal-slide-plan')
  return plan.map((target, ordinal) => {
    if (!Number.isSafeInteger(target?.ordinal) || target.ordinal !== ordinal ||
      !Number.isSafeInteger(target.h) || target.h < 0 || !Number.isSafeInteger(target.v) || target.v < 0) {
      throw new Error('invalid-reveal-slide-plan')
    }
    return { ordinal, h: target.h, v: target.v }
  })
}

async function readRevealPlan(page) {
  return normalizeRevealPlan(await page.evaluate(() => {
    const reveal = window.Reveal
    if (!reveal || typeof reveal.getSlides !== 'function' || typeof reveal.getIndices !== 'function') {
      throw new Error('reveal-api-unavailable')
    }
    return reveal.getSlides().map((slide, ordinal) => {
      const indices = reveal.getIndices(slide) || {}
      return { ordinal, h: indices.h ?? 0, v: indices.v ?? 0 }
    })
  }))
}

async function captureRevealSlides(page, {
  deckDir, expectedSlideCount, signal = null, teardownTimeoutMs = 10_000,
}) {
  const plan = await abortable(signal, () => readRevealPlan(page))
  if (plan.length !== expectedSlideCount) throw new Error('reveal-slide-count-mismatch')
  await fs.ensureDir(deckDir)
  const files = []
  for (const target of plan) {
    await abortable(signal, () => page.evaluate(({ h, v }) => window.Reveal.slide(h, v, -1), target))
    await abortable(signal, () => page.waitForFunction((expected) => {
      const reveal = window.Reveal
      if (!reveal || typeof reveal.getCurrentSlide !== 'function') return false
      const indices = reveal.getIndices() || {}
      const current = reveal.getCurrentSlide()
      const animations = typeof current?.getAnimations === 'function'
        ? current.getAnimations({ subtree: true })
        : []
      return indices.h === expected.h && (indices.v ?? 0) === expected.v &&
        current === reveal.getSlides()[expected.ordinal] &&
        animations.every((animation) => ['finished', 'idle'].includes(animation.playState))
    }, target))
    const currentHandle = await abortable(signal, () => page.evaluateHandle(() => window.Reveal.getCurrentSlide()))
    const currentSlide = currentHandle.asElement()
    if (!currentSlide) {
      const disposeError = await disposeHandle(currentHandle, teardownTimeoutMs)
      const error = new Error('reveal-current-slide-unavailable')
      if (disposeError) error.cleanupErrors = [disposeError]
      throw error
    }
    const targetPath = path.join(deckDir, `slide-${target.ordinal}.png`)
    let captureError = null
    try {
      await abortable(signal, () => currentSlide.screenshot({ path: targetPath }))
      files.push(targetPath)
    } catch (error) {
      captureError = error
    } finally {
      const disposeError = await disposeHandle(currentHandle, teardownTimeoutMs)
      if (disposeError) {
        captureError = captureError || new Error('reveal-slide-capture-failed')
        captureError.cleanupErrors = [...(captureError.cleanupErrors || []), disposeError]
      }
    }
    if (captureError) throw captureError
  }
  return { files, plan }
}

function withAssetBase(html, assetBaseUrl) {
  const base = new URL(assetBaseUrl)
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('invalid-present-assets-base-url')
  const origin = base.origin.replace(/\/$/, '')
  return html.replaceAll('"/vendor/', `"${origin}/vendor/`)
}

async function capturePresentSlides(presentation, options = {}) {
  const outDir = options.outDir
  const deckStem = options.deckStem || 'deck'
  const teardownTimeoutMs = options.teardownTimeoutMs ?? 10_000
  if (!outDir) return { ok: false, files: [], error: 'outDir-required' }
  if (!options.assetBaseUrl) return { ok: false, files: [], error: 'asset-base-url-required' }
  if (!Number.isSafeInteger(teardownTimeoutMs) || teardownTimeoutMs < 1) return { ok: false, files: [], error: 'invalid-teardown-timeout' }
  if (options.signal?.aborted) return { ok: false, files: [], error: 'capture-timeout' }
  const expectedSlideCount = expectedRevealSlideCount(presentation)
  if (!expectedSlideCount) return { ok: false, files: [], error: 'presentation-has-no-slides' }

  let chromium
  try {
    ;({ chromium } = require('playwright'))
  } catch (error) {
    return { ok: false, files: [], error: `playwright-missing: ${error.message}` }
  }
  const ownBrowser = !options.browser
  let browser = options.browser || null
  let page = null
  let result
  try {
    if (!browser) browser = await launchBrowser(chromium, options.signal, teardownTimeoutMs)
    page = await abortable(options.signal, () => browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 }))
    const html = await abortable(options.signal, () => generatePresentHtml(presentation))
    const assetBaseUrl = new URL(options.assetBaseUrl).origin
    await abortable(options.signal, () => page.goto(`${assetBaseUrl}/`, { waitUntil: 'load' }))
    await abortable(options.signal, () => page.setContent(withAssetBase(html, assetBaseUrl), { waitUntil: 'load' }))
    await abortable(options.signal, () => page.waitForFunction(() => window.Reveal?.isReady?.() === true))
    await abortable(options.signal, () => page.evaluate(({ revealConfig, viewport }) => {
      window.Reveal.configure(revealConfig)
      const root = globalThis.document.documentElement
      root.style.setProperty('--slide-scale', '1')
      root.style.setProperty('--font-zoom', '1')
      root.style.setProperty('--slide-aspect', String(viewport.width / viewport.height))
      globalThis.document.body.style.margin = '0'
    }, {
      revealConfig: {
        controls: false,
        progress: false,
        transition: 'none',
        backgroundTransition: 'none',
        history: false,
        hash: false,
      },
      viewport: VIEWPORT,
    }))
    const capture = await captureRevealSlides(page, {
      deckDir: path.join(outDir, deckStem), expectedSlideCount, signal: options.signal, teardownTimeoutMs,
    })
    result = { ok: true, files: capture.files, viewport: VIEWPORT, slidePlan: capture.plan }
  } catch (error) {
    result = {
      ok: false,
      files: [],
      error: error?.code || error.message,
      ...((error?.cleanupPending || Array.isArray(error?.cleanupErrors))
        ? { cleanupErrors: [
          ...(error?.cleanupPending ? [error.cleanupPending] : []),
          ...(Array.isArray(error?.cleanupErrors) ? error.cleanupErrors : []),
        ] }
        : {}),
    }
  }
  const cleanupErrors = [
    ...(result.cleanupErrors || []),
    ...(await closeCaptureResources(page, browser, ownBrowser, teardownTimeoutMs)),
  ]
  if (cleanupErrors.length) {
    result = result.ok
      ? { ok: false, files: [], error: 'capture-teardown-failed', cleanupErrors }
      : { ...result, cleanupErrors }
  }
  return result
}

module.exports = {
  VIEWPORT,
  capturePresentSlides,
  captureRevealSlides,
  expectedRevealSlideCount,
  writePresentHtml,
}
