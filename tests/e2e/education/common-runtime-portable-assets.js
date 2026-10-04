import { expect } from '../fixtures/test-fixtures.js'
import { PluginRegistry } from '../../../client/src/plugins/plugin-registry.js'
import { createPluginElement } from '../../../client/src/plugins/plugin-loader.js'
import { gameFixture, deckWith } from './release-game-fixtures.js'
import { videoSource } from './fixtures/media-sources.js'
import { findFrame } from './release-surfaces.js'

async function upload(request, id, name, mimeType, buffer) {
  const response = await request.post(`${process.env.PLAYWRIGHT_API_BASE_URL}/upload`, {
    multipart: { presentationId: id, file: { name, mimeType, buffer } },
  })
  expect(response.ok(), `Portable fixture upload ${name}: ${await response.text()}`).toBe(true)
  const asset = await response.json()
  expect(asset.url).toMatch(/^\/uploads\//)
  return asset.url
}

export async function portableAssetDeck(request, id) {
  const image = await upload(
    request,
    id,
    'portable-lesson.svg',
    'image/svg+xml',
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#22c55e"/></svg>'
    )
  )
  const media = await upload(
    request,
    id,
    'portable-lesson.webm',
    'video/webm',
    Buffer.from(videoSource.split(',')[1], 'base64')
  )
  const font = '/vendor/tikzjax/fonts/msbm10.woff2'
  const fontResponse = await request.get(
    `${process.env.PLAYWRIGHT_API_BASE_URL.replace(/\/api\/?$/, '')}${font}`
  )
  expect(fontResponse.ok(), `Portable font fixture: ${await fontResponse.text()}`).toBe(true)
  const manifest = await request.get(
    `${process.env.PLAYWRIGHT_API_BASE_URL}/plugins/animated-counter`
  )
  expect(manifest.ok(), `Actual Counter manifest: ${await manifest.text()}`).toBe(true)
  const registry = new PluginRegistry()
  registry.registerPlugin(await manifest.json())
  const counter = createPluginElement(
    'plugin:counter',
    {
      id: 'portable-counter',
      x: 500,
      y: 20,
      width: 430,
      height: 180,
      pluginData: { value: 12, suffix: '%', label: 'Portable class score' },
    },
    registry
  )
  const quiz = {
    ...gameFixture('quiz', 'single-choice'),
    id: 'portable-quiz',
    x: 20,
    y: 60,
    width: 450,
    height: 470,
  }
  quiz.quiz.questions[0].media = { src: image, alt: 'Authored question marker' }
  const html = {
    id: 'portable-asset-frame',
    type: 'html',
    x: 500,
    y: 220,
    width: 430,
    height: 300,
    content: `<style>@font-face{font-family:PortableLesson;src:url("${font}") format("woff2")}body{margin:0;color:#16324f}
#font{font:32px PortableLesson}video{display:block;width:160px;height:100px}output{display:block}</style>
<div id="font">ABC</div><img src="${image}" alt="Authored frame marker" width="40" height="40">
<video id="clip" src="${media}" muted preload="auto"></video><button id="play">Play authored clip</button><output id="playback">Ready</output>
<script>const clip=document.querySelector('#clip'),output=document.querySelector('#playback');
clip.onended=()=>output.textContent='Clip complete';document.querySelector('#play').onclick=()=>{
output.textContent='Playing';clip.play().catch(error=>output.textContent='Playback error: '+error.name)};</script>`,
    htmlDependencies: {
      network: true,
      offlineCapable: true,
      resources: [
        { url: image, kind: 'image' },
        { url: media, kind: 'media' },
        { url: font, kind: 'font' },
      ],
      dynamicResources: [],
    },
  }
  return {
    deck: deckWith([
      {
        id: 'portable-image',
        type: 'image',
        src: image,
        alt: 'Authored slide marker',
        x: 20,
        y: 10,
        width: 40,
        height: 40,
      },
      quiz,
      counter,
      html,
    ]),
    quiz,
    assets: { image, media, font },
  }
}

export async function inspectPortableImage(image) {
  await expect(image).toBeVisible()
  await expect(image).toHaveJSProperty('complete', true)
  await expect(image).toHaveJSProperty('naturalWidth', 40)
  await expect(image).toHaveJSProperty('naturalHeight', 40)
  const measured = await image.evaluate((node) => ({
    src: node.currentSrc,
    width: node.naturalWidth,
    height: node.naturalHeight,
    rendered: {
      width: node.getBoundingClientRect().width,
      height: node.getBoundingClientRect().height,
    },
  }))
  expect(measured.src).toMatch(/^(data:|blob:)/)
  expect(measured.rendered.width).toBeGreaterThan(0)
  expect(measured.rendered.height).toBeGreaterThan(0)
  return measured
}

export async function inspectPortableFrame(page) {
  const frame = await findFrame(page, '#font')
  const image = await inspectPortableImage(
    frame.getByRole('img', { name: 'Authored frame marker', exact: true })
  )
  await frame.evaluate(() => document.fonts.ready)
  await expect
    .poll(() =>
      frame.evaluate(() =>
        [...document.fonts]
          .filter((font) => font.family === 'PortableLesson')
          .map((font) => font.status)
      )
    )
    .toEqual(['loaded'])
  const font = await frame
    .locator('#font')
    .evaluate((node) => ({
      text: node.textContent,
      family: getComputedStyle(node).fontFamily,
      loaded: document.fonts.check('32px PortableLesson', 'ABC'),
      width: node.getBoundingClientRect().width,
      height: node.getBoundingClientRect().height,
      faces: [...document.fonts].map((face) => ({ family: face.family, status: face.status })),
    }))
  expect(font).toMatchObject({ text: 'ABC', family: 'PortableLesson', loaded: true })
  expect(font.width).toBeGreaterThan(0)
  expect(font.height).toBeGreaterThan(0)
  const video = frame.locator('#clip')
  await expect.poll(() => video.evaluate((node) => node.readyState)).toBeGreaterThanOrEqual(2)
  await frame.getByRole('button', { name: 'Play authored clip', exact: true }).click()
  await expect(frame.locator('#playback')).toHaveText('Clip complete')
  const media = await video.evaluate((node) => ({
    src: node.currentSrc,
    duration: node.duration,
    currentTime: node.currentTime,
    width: node.videoWidth,
    height: node.videoHeight,
    ended: node.ended,
    error: node.error?.code || null,
  }))
  expect(media.src).toMatch(/^(data:|blob:)/)
  expect(media.duration).toBeGreaterThan(0)
  expect(media.currentTime).toBeCloseTo(media.duration, 1)
  expect(media.width).toBeGreaterThan(0)
  expect(media.height).toBeGreaterThan(0)
  expect(media).toMatchObject({ ended: true, error: null })
  return { image, font, media, playback: await frame.locator('#playback').textContent() }
}
