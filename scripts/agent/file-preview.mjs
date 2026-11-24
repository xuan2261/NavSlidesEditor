import { z } from 'zod'
import { chromium } from 'playwright'
import { tool, id, AgentError } from './contracts.mjs'
import { assertWritable, checkCancelled, resolveLocalPath, writeLocalFile } from './files.mjs'
import { localFile } from './file-import-tools.mjs'

function deckViewport(presentation) {
  const width = Number(presentation?.resolution?.width) || 960
  const height = Number(presentation?.resolution?.height) || 540
  if (![width, height].every((n) => Number.isSafeInteger(n) && n > 0 && n <= 8192) || width * height > 32000000) {
    throw new AgentError('PREVIEW_RESOLUTION_UNSUPPORTED', 'Preview requires positive integer deck dimensions no greater than 8192 px and 32 million total pixels.', 'Use a supported deck resolution; this tool will not silently resize the requested image.')
  }
  return { width, height }
}

async function capture(browser, api, args, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, serviceWorkers: 'block', acceptDownloads: false })
  const forbidden = new Set()
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const allowed = url.origin === api.baseUrl && request.method() === 'GET' && !request.redirectedFrom()
    if (!allowed) {
      forbidden.add(url.origin === api.baseUrl ? 'mutation or redirect' : 'external network asset')
      await route.abort('blockedbyclient')
    } else await route.continue()
  })
  await context.routeWebSocket('**/*', (socket) => socket.close({ code: 1008, reason: 'Local preview does not open WebSocket connections.' }))
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  page.setDefaultNavigationTimeout(20000)
  const response = await page.goto(`${api.baseUrl}/api/presentations/${args.presentationId}/present?preview=true`, { waitUntil: 'load' })
  if (!response?.ok()) throw new AgentError('PREVIEW_PAGE_FAILED', `NavSlides preview returned HTTP ${response?.status() || 'unknown'}.`, 'Check the presentation ID and local server readiness.')
  await page.waitForFunction(() => window.Reveal?.isReady?.() === true)
  await page.evaluate(async ({ horizontal, vertical }) => {
    await document.fonts.ready
    window.Reveal.configure({ transition: 'none', backgroundTransition: 'none', autoSlide: 0, autoAnimate: false })
    window.Reveal.slide(horizontal, vertical)
  }, { horizontal: args.slide - 1, vertical: args.child ?? 0 })
  await page.waitForFunction(({ horizontal, vertical }) => {
    const indices = window.Reveal.getIndices()
    return indices.h === horizontal && indices.v === vertical
  }, { horizontal: args.slide - 1, vertical: args.child ?? 0 })
  await page.waitForFunction(() => [...window.Reveal.getCurrentSlide().querySelectorAll('img')].every((image) => image.complete))
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  if (forbidden.size) throw new AgentError('PREVIEW_NETWORK_BLOCKED', `Preview blocked ${[...forbidden].join(' and ')}.`, 'Use same-origin local assets. Preview cannot access arbitrary network targets, follow redirects or mutate the server.')
  const brokenImage = await page.evaluate(() => [...window.Reveal.getCurrentSlide().querySelectorAll('img')].some((image) => !image.naturalWidth))
  if (brokenImage) throw new AgentError('PREVIEW_ASSET_FAILED', 'An image on the selected slide could not load.', 'Correct the slide image URL or restore its uploaded asset before previewing.')
  return page.screenshot({ type: 'png', animations: 'disabled', fullPage: false, timeout: 15000 })
}

/** Produce actual browser pixels; browser lifetime is bounded and always closed. */
export async function renderSlidePreview(presentation, args, api, signal) {
  signal = signal ? AbortSignal.any([signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000)
  const viewport = deckViewport(presentation)
  const slides = presentation?.slides
  if (!Array.isArray(slides) || args.slide > slides.length) throw new AgentError('SLIDE_NOT_FOUND', 'The requested 1-based slide does not exist.', 'Read get_presentation and choose an existing top-level slide.')
  const parent = slides[args.slide - 1]
  if (args.child !== undefined && args.child > (parent.children?.length || 0)) throw new AgentError('CHILD_SLIDE_NOT_FOUND', 'The requested 1-based child slide does not exist.', 'Choose an existing child-array ordinal, or omit child to capture the parent slide.')
  checkCancelled(signal)
  let browser
  let abort
  let failure
  let png
  try {
    try { browser = await chromium.launch({ headless: true, timeout: 15000 }) } catch {
      throw new AgentError('BROWSER_UNAVAILABLE', 'Chromium could not start for the slide preview.', 'Install the matching browser with npx playwright install chromium, then check local browser execution permissions.')
    }
    const cancelled = new Promise((_, reject) => {
      abort = () => reject(new AgentError(signal?.reason?.name === 'TimeoutError' ? 'PREVIEW_TIMEOUT' : 'CANCELLED', 'Slide preview was cancelled or exceeded its 45-second deadline.', 'Check server readiness and local slide assets before trying again.'))
      signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) abort()
    })
    png = await Promise.race([capture(browser, api, args, viewport), cancelled])
  } catch (error) {
    failure = error instanceof AgentError ? error : new AgentError('PREVIEW_FAILED', 'Chromium could not finish rendering the selected slide.', 'Check that the local present URL loads and Reveal becomes ready; inspect local browser and server logs.')
  } finally {
    if (abort) signal?.removeEventListener('abort', abort)
    if (browser) {
      try { await browser.close() } catch {
        if (!failure) failure = new AgentError('BROWSER_CLOSE_FAILED', 'The preview browser could not be closed cleanly.', 'Close the owned Chromium process before starting another preview.')
        else failure.hint += ' Browser cleanup also failed; close the owned Chromium process before retrying.'
      }
    }
  }
  if (failure) throw failure
  return png
}

export const previewTools = [
  tool('preview_slide', 'Render a real PNG at exact deck resolution using local Chromium and Reveal. slide is a 1-based top-level index; child is a 1-based child-array ordinal (omit for parent). Output directory must exist; never overwrites without overwrite:true. Local assets only; bounded to 45 seconds, 8192 px per dimension and 32 million pixels.', {
    presentationId: id, slide: z.number().int().positive(),
    child: z.number().int().positive().optional().describe('1-based ordinal in the selected parent slide children array; omit for the parent.'),
    path: localFile.describe('PNG output path inside NAVSLIDES_WORKSPACE; parent directory must exist.'),
    overwrite: z.boolean().default(false),
  }, async (args, api, signal) => {
    assertWritable(api)
    const bounded = signal ? AbortSignal.any([signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000)
    checkCancelled(bounded)
    const target = await resolveLocalPath(args.path, { write: true, overwrite: args.overwrite, readOnly: api.readOnly })
    const presentation = await api.request(`/api/presentations/${args.presentationId}`, { signal: bounded })
    const bytes = await renderSlidePreview(presentation, args, api, bounded)
    const saved = await writeLocalFile(target, bytes, { overwrite: args.overwrite, readOnly: api.readOnly, signal: bounded })
    return { ...saved, mimeType: 'image/png' }
  }, { destructive: true }),
]
