import {
  test,
  expect,
  apiUpdatePresentation,
  apiGetPresentation,
} from '../fixtures/test-fixtures.js'
import { pathToFileURL } from 'node:url'
import { EditorPage } from '../pages/editor-page.js'
import { launchPresentPopup } from './present-offline-helpers.js'
import { videoSource, audioSource } from './fixtures/media-sources.js'

async function assertReachable(node) {
  expect(
    await node.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      return hit === element || element.contains(hit)
    })
  ).toBe(true)
}

async function readGeometry(root) {
  return root.locator('video,audio').evaluateAll((players) =>
    players.map((player) => {
      const size = (node) => ({
        width: parseFloat(getComputedStyle(node).width),
        height: parseFloat(getComputedStyle(node).height),
      })
      let wrapper = player.parentElement
      while (
        wrapper &&
        !(wrapper.style.position === 'absolute' && wrapper.style.width.endsWith('px'))
      )
        wrapper = wrapper.parentElement
      if (!wrapper) throw new Error('Authored media wrapper not found')
      return {
        type: player.tagName,
        player: size(player),
        region: size(player.parentElement),
        wrapper: {
          ...size(wrapper),
          x: parseFloat(wrapper.style.left),
          y: parseFloat(wrapper.style.top),
          transform: wrapper.style.transform,
        },
      }
    })
  )
}

async function assertReadable(node) {
  const measurement = await node.evaluate((element) => {
    const parse = (value) => {
      const channels = value.match(/[\d.]+/g).map(Number)
      return [...channels.slice(0, 3), channels[3] ?? 1]
    }
    const blend = (front, back) =>
      front.slice(0, 3).map((channel, index) => channel * front[3] + back[index] * (1 - front[3]))
    const layers = []
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor)
      if (style.backgroundImage !== 'none') throw new Error('Nonuniform caption background')
      const layer = parse(style.backgroundColor)
      layers.push(layer)
      if (layer[3] === 1) break
    }
    const background = layers.reverse().reduce((back, front) => blend(front, back), [255, 255, 255])
    const foreground = blend(parse(getComputedStyle(element).color), background)
    const luminance = (channels) =>
      channels
        .map((channel) => {
          const value = channel / 255
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
        })
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
    return { foreground, background, ratio: (values[0] + 0.05) / (values[1] + 0.05) }
  })
  expect(measurement.ratio).toBeGreaterThanOrEqual(4.5)
}

async function inspectMetadata(root) {
  const before = await readGeometry(root)
  for (const kind of ['Video', 'Audio']) {
    const description = root.getByText(`${kind} description.`, { exact: true })
    const details = root
      .locator('details.ns-media-transcript')
      .filter({ hasText: `${kind} transcript.` })
    const summary = details.locator('summary')
    await assertReachable(description)
    await assertReachable(summary)
    await assertReadable(description)
    await assertReadable(summary)
    await summary.click()
    await expect(details).toHaveAttribute('open', '')
    await assertReachable(details.getByText(`${kind} transcript.`, { exact: true }))
    await assertReadable(summary)
    await assertReadable(details.getByText(`${kind} transcript.`, { exact: true }))
    expect(await readGeometry(root)).toEqual(before)
    await summary.click()
    await expect(details).not.toHaveAttribute('open', '')
    expect(await readGeometry(root)).toEqual(before)
  }
  return before
}

async function presentGeometry(page, inspect = false) {
  const { popup } = await launchPresentPopup(page)
  try {
    await popup.waitForFunction(() => window.Reveal?.isReady())
    const root = popup.locator('.reveal .slides')
    return inspect ? await inspectMetadata(root) : await readGeometry(root)
  } finally {
    await popup.close()
  }
}

async function offlineGeometry(page, testInfo, label, inspect = false) {
  await page.getByRole('button', { name: 'File menu', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Export HTML', exact: true }).click()
  const download = await downloadPromise
  const file = testInfo.outputPath(`media-captions-${label}.html`)
  await download.saveAs(file)
  expect(await download.failure()).toBeNull()
  const offline = await page.context().newPage()
  await offline.route(/^https?:\/\//, (route) => route.abort())
  try {
    await offline.goto(pathToFileURL(file).href)
    await offline.waitForFunction(() => window.Reveal?.isReady())
    const root = offline.locator('.reveal .slides')
    return inspect ? await inspectMetadata(root) : await readGeometry(root)
  } finally {
    await offline.close()
  }
}

for (const [backgroundName, backgroundColor] of [
  ['light', '#ffffff'],
  ['dark', '#141413'],
]) {
  test(`inspector-authored media metadata stays readable on ${backgroundName} slides without resizing players or blocking dragging`, async ({
    page,
    request,
    testPresentation,
  }, testInfo) => {
    await apiUpdatePresentation(request, testPresentation.id, {
      resolution: { width: 1280, height: 720 },
      slides: [
        {
          id: 'captions',
          background: { type: 'color', color: backgroundColor },
          elements: [
            {
              id: 'caption-video',
              name: 'Caption video',
              type: 'video',
              x: 45,
              y: 50,
              width: 520,
              height: 220,
              src: videoSource,
              controls: true,
            },
            {
              id: 'caption-audio',
              name: 'Caption audio',
              type: 'audio',
              x: 645,
              y: 50,
              width: 520,
              height: 220,
              src: audioSource(),
              controls: true,
            },
          ],
        },
      ],
    })
    await new EditorPage(page).gotoPresentation(testPresentation.id)
    const canvas = page.getByTestId('canvas-area')
    const before = {
      canvas: await readGeometry(canvas),
      present: await presentGeometry(page),
      offline: await offlineGeometry(page, testInfo, 'before'),
    }
    expect(before.canvas[0].player).toEqual({ width: 520, height: 220 })
    await page.getByRole('button', { name: 'Selection Pane', exact: true }).click()
    for (const kind of ['Video', 'Audio']) {
      if (kind === 'Video') {
        await page.getByRole('listitem', { name: 'Caption video, Video', exact: true }).click()
        await page.getByRole('button', { name: 'Properties', exact: true }).click()
      } else {
        await page.getByTestId('slide-element-caption-audio').click({ position: { x: 8, y: 8 } })
      }
      await page.getByLabel('Media transcript', { exact: true }).fill(`${kind} transcript.`)
      await page.getByLabel('Media audio description', { exact: true }).fill(`${kind} description.`)
    }
    await expect
      .poll(async () =>
        (await apiGetPresentation(request, testPresentation.id)).slides[0].elements.map(
          ({ transcript, audioDescription }) => ({ transcript, audioDescription })
        )
      )
      .toEqual([
        { transcript: 'Video transcript.', audioDescription: 'Video description.' },
        { transcript: 'Audio transcript.', audioDescription: 'Audio description.' },
      ])
    await page.reload()
    await expect(canvas).toBeVisible()
    expect(await inspectMetadata(canvas)).toEqual(before.canvas)
    for (const kind of ['Video', 'Audio']) {
      const details = canvas
        .locator('details.ns-media-transcript')
        .filter({ hasText: `${kind} transcript.` })
      const summary = details.locator('summary')
      await summary.focus()
      await summary.press('Enter')
      await expect(details).toHaveAttribute('open', '')
      expect(await readGeometry(canvas)).toEqual(before.canvas)
      await summary.press('Space')
      await expect(details).not.toHaveAttribute('open', '')
      expect(await readGeometry(canvas)).toEqual(before.canvas)
    }
    const after = {
      canvas: await readGeometry(canvas),
      present: await presentGeometry(page, true),
      offline: await offlineGeometry(page, testInfo, 'after', true),
    }
    expect(after).toEqual(before)
    await testInfo.attach('media-geometry.json', {
      body: Buffer.from(JSON.stringify({ before, after }, null, 2)),
      contentType: 'application/json',
    })
    for (const id of ['caption-video', 'caption-audio']) {
      await canvas.click()
      const element = page.getByTestId(`slide-element-${id}`)
      const box = await element.boundingBox()
      const scale = (await canvas.boundingBox()).width / 1280
      const start = { x: box.x + 8 * scale, y: box.y + 8 * scale }
      expect(
        await page.evaluate(
          ({ x, y }) =>
            Boolean(
              document.elementFromPoint(x, y)?.closest('audio,video,.ns-media-transcript summary')
            ),
          start
        )
      ).toBe(false)
      const original = (
        await apiGetPresentation(request, testPresentation.id)
      ).slides[0].elements.find((element) => element.id === id)
      await page.mouse.move(start.x, start.y)
      await page.mouse.down()
      await page.mouse.move(start.x + 30 * scale, start.y + 20 * scale, { steps: 6 })
      await page.mouse.up()
      await expect
        .poll(async () => {
          const moved = (
            await apiGetPresentation(request, testPresentation.id)
          ).slides[0].elements.find((element) => element.id === id)
          return { x: moved.x, y: moved.y }
        })
        .toEqual({ x: original.x + 30, y: original.y + 20 })
      const moved = (
        await apiGetPresentation(request, testPresentation.id)
      ).slides[0].elements.find((element) => element.id === id)
      expect(moved).toEqual({ ...original, x: original.x + 30, y: original.y + 20 })
      await page.reload()
      await expect(element).toBeVisible()
      expect(
        await element.evaluate((node) => ({
          x: parseFloat(node.style.left),
          y: parseFloat(node.style.top),
        }))
      ).toEqual({ x: original.x + 30, y: original.y + 20 })
    }
  })
}
