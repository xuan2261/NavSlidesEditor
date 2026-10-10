import { expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'
import JSZip from 'jszip'
import { finishExecutionIdentity } from './execution-identity-gate.js'
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

// Generate valid owned bytes with Chromium's actual encoders; no external fixture download.
export async function generateBrowserAssets(page) {
  return page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 320; canvas.height = 180
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#22c55e'; ctx.fillRect(0, 0, 320, 180)
    ctx.fillStyle = '#111827'; ctx.fillRect(30, 30, 90, 90)
    const image = canvas.toDataURL('image/png').split(',')[1]
    ctx.fillStyle = '#f59e0b'; ctx.fillRect(160, 30, 90, 90)
    const poster = canvas.toDataURL('image/png').split(',')[1]
    const stream = canvas.captureStream(10)
    const mime = 'video/webm;codecs=vp8'
    if (!MediaRecorder.isTypeSupported(mime)) throw new Error('Chromium VP8 encoder unavailable')
    const recorder = new MediaRecorder(stream, { mimeType: mime })
    const chunks = []
    recorder.ondataavailable = (event) => chunks.push(event.data)
    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = resolve; recorder.onerror = reject
    })
    recorder.start()
    // Draw during real-time capture so the stream contains presented frames, not one still.
    let frame = 0
    const drawing = setInterval(() => {
      ctx.fillStyle = ++frame % 2 ? '#ef4444' : '#3b82f6'
      ctx.fillRect(160, 30, 90, 90)
    }, 100)
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200))
      recorder.stop(); await stopped
    } finally { clearInterval(drawing) }
    stream.getTracks().forEach((track) => track.stop())
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer())
    let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte)
    return [
      { name: 'image.png', mime: 'image/png', base64: image },
      { name: 'poster.png', mime: 'image/png', base64: poster },
      { name: 'video.webm', mime: 'video/webm', base64: btoa(binary) },
      { name: 'captions.vtt', mime: 'text/vtt',
        base64: btoa('WEBVTT\n\n00:00.000 --> 00:01.000\nOwned portable caption\n') },
    ]
  })
}

export async function assertArchive(filename, marker, assets, originalHash) {
  const bytes = await readFile(filename)
  expect(bytes.subarray(0, 2).toString()).toBe('PK')
  const zip = await JSZip.loadAsync(bytes)
  const projection = JSON.parse(await zip.file('presentation.json').async('string'))
  expect(JSON.stringify(projection)).toContain(marker)
  expect(zip.file('package/manifest.json')).not.toBeNull()
  const manifest = JSON.parse(await zip.file('manifest.json').async('string'))
  expect(manifest.media).toHaveLength(assets.length)
  for (const asset of assets) {
    const expected = Buffer.from(asset.base64, 'base64')
    const entry = manifest.media.find((item) => item.sha256 === sha256(expected))
    expect(entry, asset.name).toBeTruthy()
    expect(await zip.file(entry.archivePath).async('nodebuffer')).toEqual(expected)
  }
  const blobs = Object.keys(zip.files).filter((name) => name.startsWith('package/blobs/') && !zip.files[name].dir)
  expect(blobs.map((name) => name.split('/').at(-1))).toContain(originalHash)
  expect(sha256(await zip.file(`package/blobs/${originalHash}`).async('nodebuffer'))).toBe(originalHash)
  return { sha256: sha256(bytes), byteLength: bytes.length, packageBlobs: blobs.length, media: assets.length }
}

export async function observeDecodedMedia(page, withMedia, selector = '[data-testid="canvas-area"]') {
  if (!withMedia) return { media: 0 }
  const scope = page.locator(selector)
  await expect(scope.locator('img').first()).toBeVisible()
  await scope.locator('img').first().evaluate(async (img) => { await img.decode() })
  const video = scope.locator('video').first()
  await video.evaluate((node) => { node.muted = true; node.load() })
  await expect.poll(() => video.evaluate((node) => node.readyState)).toBeGreaterThanOrEqual(2)
  const observed = await video.evaluate(async (node) => {
    const presented = new Promise((resolve) => node.requestVideoFrameCallback(resolve))
    await node.play()
    await presented
    node.pause()
    const poster = new Image(); poster.src = node.poster; await poster.decode()
    const track = node.querySelector('track')
    if (!track) throw new Error('Owned caption track was not rendered')
    track.track.mode = 'showing'
    return { width: node.videoWidth, height: node.videoHeight, duration: node.duration,
      posterWidth: poster.naturalWidth, trackSrc: track.src }
  })
  expect(observed.width).toBe(320); expect(observed.height).toBe(180)
  expect(observed.duration).toBeGreaterThan(0); expect(observed.posterWidth).toBe(320)
  await expect.poll(() => video.evaluate((node) => node.querySelector('track').readyState)).toBe(2)
  expect(await video.evaluate((node) => node.querySelector('track').track.cues[0].text))
    .toBe('Owned portable caption')
  return observed
}

export async function observeOffline(page, filename, withMedia, marker, screenshot) {
  const requests = []; const errors = []
  page.on('request', (request) => { if (/^https?:/.test(request.url())) requests.push(request.url()) })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.context().setOffline(true)
  await page.goto(pathToFileURL(filename).href)
  await page.waitForFunction(() => window.Reveal?.isReady?.())
  await expect(page.locator('.reveal')).toContainText(marker)
  const media = await observeDecodedMedia(page, withMedia, '.reveal .slides section.present')
  await page.screenshot({ path: screenshot, fullPage: true })
  expect(requests).toEqual([]); expect(errors).toEqual([])
  return { ready: true, requests, errors, media }
}

export async function writeReceipt(info, receipt, browser) {
  const identityError = await finishExecutionIdentity(receipt, browser)
  receipt.recordedAt = new Date().toISOString()
  receipt.node = process.version
  const file = info.outputPath('portable-browser-receipt.json')
  await writeFile(file, JSON.stringify(receipt, null, 2))
  await info.attach('portable-browser-receipt', { path: file, contentType: 'application/json' })
  if (identityError) throw identityError
}
