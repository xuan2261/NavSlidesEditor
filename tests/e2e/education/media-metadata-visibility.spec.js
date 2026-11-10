import {
  test,
  expect,
  apiUpdatePresentation,
  apiGetPresentation,
} from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { videoSource, audioSource } from './fixtures/media-sources.js'
import { readGeometry, inspectMetadata, presentGeometry, offlineGeometry } from './media-metadata-measurements.js'


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
