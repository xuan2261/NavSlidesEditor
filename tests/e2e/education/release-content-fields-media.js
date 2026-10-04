import { expect } from '../fixtures/test-fixtures.js'
import { inspector, fillControl, reachable, renderedStyle } from './release-content-fields.js'
import { videoSource, audioSource } from './fixtures/media-sources.js'
import { illustration } from './release-ordinary-fixtures.js'

export const captionContent = 'WEBVTT\n\n00:00.050 --> 00:00.150\nQualified caption cue.\n'
export function sourceFor(type) {
  return type === 'video' ? videoSource : audioSource()
}
export async function authorMedia(page, type) {
  const panel = inspector(page)
  await fillControl(page, `${type === 'video' ? 'Video' : 'Audio'} source URL`, sourceFor(type))
  for (const label of ['Show controls', 'Muted', 'Loop', 'Autoplay'])
    await panel.getByRole('checkbox', { name: label, exact: true }).check()
  await fillControl(page, 'Media transcript', `${type} qualified transcript.`)
  await fillControl(page, 'Media audio description', `${type} qualified description.`)
  const patch = {
    src: sourceFor(type),
    controls: true,
    muted: true,
    loop: true,
    autoplay: true,
    transcript: `${type} qualified transcript.`,
    audioDescription: `${type} qualified description.`,
  }
  if (type === 'video') {
    await fillControl(page, 'Video poster image URL', illustration)
    await panel.getByLabel('Video object fit', { exact: true }).selectOption('cover')
    await fillControl(page, 'Video end time', 0.8)
    await fillControl(page, 'Video start time', 0.2)
    await fillControl(page, 'Video playback speed', 1.5)
    Object.assign(patch, {
      poster: illustration,
      objectFit: 'cover',
      startTime: 0.2,
      endTime: 0.8,
      playbackRate: 1.5,
    })
  }
  return patch
}
export async function inspectMedia(root, type) {
  const media = root.locator(type)
  await media.page().bringToFront()
  await expect.poll(() => media.evaluate((node) => node.readyState)).toBeGreaterThanOrEqual(2)
  await expect.poll(() => media.evaluate((node) => node.paused)).toBe(false)
  const state = await media.evaluate((node) => ({
    src: node.currentSrc,
    controls: node.controls,
    autoplay: node.autoplay,
    muted: node.muted,
    loop: node.loop,
    duration: node.duration,
    rate: node.playbackRate,
    poster: node.poster || null,
    fit: getComputedStyle(node).objectFit,
  }))
  expect(state.src).toContain(sourceFor(type))
  expect(state).toMatchObject({ controls: true, autoplay: true, muted: true })
  if (type === 'audio') expect(state.loop).toBe(true)
  expect(state.duration).toBeGreaterThan(0)
  if (type === 'video') {
    expect(state).toMatchObject({ rate: 1.5, poster: illustration, fit: 'cover' })
    await media.evaluate((node) => {
      node.pause()
      node.currentTime = 0.2
    })
    await expect.poll(() => media.evaluate((node) => node.currentTime)).toBeCloseTo(0.2, 1)
  }
  const description = root.getByText(`${type} qualified description.`, { exact: true })
  const details = root.locator('details.ns-media-transcript')
  const summary = details.locator('summary')
  await reachable(description)
  await reachable(summary)
  await summary.focus()
  await expect(summary).toBeFocused()
  await summary.page().keyboard.press('Enter')
  await expect(details).toHaveAttribute('open', '')
  await reachable(details.getByText(`${type} qualified transcript.`, { exact: true }))
  const metadataStyle = await renderedStyle(description, ['color', 'backgroundColor'])
  expect(metadataStyle).toEqual({ color: 'rgb(248, 250, 252)', backgroundColor: 'rgb(20, 20, 19)' })
  await expect(summary).toBeFocused()
  await summary.page().keyboard.press('Space')
  await expect(details).not.toHaveAttribute('open', '')
  await media.click({ position: { x: 12, y: 12 } })
  await media.evaluate((node) => {
    node.pause()
    node.currentTime = node.tagName === 'VIDEO' ? 0.2 : 0
    node.__qualificationTimes = []
    node.__qualificationTimer = setInterval(() => {
      if (!node.paused) node.__qualificationTimes.push(node.currentTime)
    }, 20)
  })
  let playing
  try {
    await media.evaluate(async (node) => {
      await node.play()
    })
    const loopCount = (times) =>
      times.reduce(
        (count, time, index) => count + Number(index > 0 && times[index - 1] - time > 0.08),
        0
      )
    await expect
      .poll(async () => loopCount(await media.evaluate((node) => node.__qualificationTimes)), {
        timeout: 10000,
      })
      .toBeGreaterThanOrEqual(2)
    playing = await media.evaluate((node) => ({
      currentTime: node.currentTime,
      paused: node.paused,
      times: node.__qualificationTimes,
    }))
    expect(playing.paused).toBe(false)
    expect(Math.max(...playing.times)).toBeGreaterThan(type === 'video' ? 0.45 : 0.08)
    if (type === 'video') {
      expect(Math.min(...playing.times)).toBeGreaterThanOrEqual(0.18)
      expect(Math.max(...playing.times)).toBeLessThanOrEqual(0.85)
    }
  } finally {
    await media.evaluate((node) => {
      clearInterval(node.__qualificationTimer)
      delete node.__qualificationTimer
      delete node.__qualificationTimes
      node.pause()
    })
  }
  return { state, metadataStyle, playing }
}
export async function uploadCaption(request, id) {
  const response = await request.post(`${process.env.PLAYWRIGHT_API_BASE_URL}/upload`, {
    multipart: {
      presentationId: id,
      file: {
        name: 'qualified-caption.vtt',
        mimeType: 'text/vtt',
        buffer: Buffer.from(captionContent),
      },
    },
  })
  expect(response.ok(), `Caption fixture upload: ${await response.text()}`).toBe(true)
  const asset = await response.json()
  expect(asset.url).toMatch(/^\/uploads\//)
  const resource = await request.get(
    `${process.env.PLAYWRIGHT_API_BASE_URL.replace(/\/api\/?$/, '')}${asset.url}`
  )
  expect(resource.status()).toBe(200)
  expect(resource.headers()['content-type']).toMatch(/^text\/vtt(?:;|$)/)
  expect(await resource.text()).toBe(captionContent)
  return asset.url
}
export async function authorTrack(page, src) {
  await inspector(page).getByRole('button', { name: 'Add track', exact: true }).click()
  await fillControl(page, 'Caption track 1 URL', src)
  await fillControl(page, 'Caption track 1 language', 'en')
  await fillControl(page, 'Caption track 1 label', 'Qualified English')
  await inspector(page)
    .getByLabel('Caption track 1 kind', { exact: true })
    .selectOption('subtitles')
  await inspector(page).getByLabel('Caption track 1 default', { exact: true }).uncheck()
  await inspector(page).getByLabel('Caption track 1 default', { exact: true }).check()
  await expect(inspector(page).getByRole('alert')).toHaveCount(0)
  return [{ src, srcLang: 'en', label: 'Qualified English', kind: 'subtitles', default: true }]
}
export async function inspectTrack(root, type) {
  const track = root.locator(`${type} track`)
  await expect(track).toHaveAttribute('kind', 'subtitles')
  await expect(track).toHaveAttribute('srclang', 'en')
  await expect(track).toHaveAttribute('label', 'Qualified English')
  await expect.poll(() => track.evaluate((node) => node.readyState)).toBe(2)
  const observed = await root.locator(type).evaluate((node) => {
    const track = node.textTracks[0]
    return {
      default: node.querySelector('track').default,
      mode: track.mode,
      kind: track.kind,
      language: track.language,
      label: track.label,
      cues: [...track.cues].map((cue) => ({
        text: cue.text,
        start: cue.startTime,
        end: cue.endTime,
      })),
    }
  })
  expect(observed).toEqual({
    default: true,
    mode: 'showing',
    kind: 'subtitles',
    language: 'en',
    label: 'Qualified English',
    cues: [{ text: 'Qualified caption cue.', start: 0.05, end: 0.15 }],
  })
  const media = root.locator(type)
  await media.click({ position: { x: 12, y: 12 } })
  try {
    await media.evaluate(async (node) => {
      await node.play()
      node.pause()
      node.currentTime = 0.1
    })
    await expect
      .poll(() =>
        media.evaluate((node) => [...node.textTracks[0].activeCues].map((cue) => cue.text))
      )
      .toEqual(['Qualified caption cue.'])
    const activeCues = await media.evaluate((node) =>
      [...node.textTracks[0].activeCues].map((cue) => cue.text)
    )
    await media.evaluate((node) => {
      node.pause()
      node.currentTime = 0.18
    })
    await expect
      .poll(() =>
        media.evaluate((node) => [...node.textTracks[0].activeCues].map((cue) => cue.text))
      )
      .toEqual([])
    const expiredCues = await media.evaluate((node) =>
      [...node.textTracks[0].activeCues].map((cue) => cue.text)
    )
    return { ...observed, activeCues, expiredCues }
  } finally {
    await media.evaluate((node) => node.pause())
  }
}
