import { expect } from '../fixtures/test-fixtures.js'
import { pathToFileURL } from 'node:url'
import { launchPresentPopup } from './present-offline-helpers.js'
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
export { readGeometry, inspectMetadata, presentGeometry, offlineGeometry }
