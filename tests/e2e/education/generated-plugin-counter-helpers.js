import { expect, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { PluginRegistry } from '../../../client/src/plugins/plugin-registry.js'
import { createPluginElement } from '../../../client/src/plugins/plugin-loader.js'
async function setupCounter(page, request, id) {
  const response = await request.get(
    `${process.env.PLAYWRIGHT_API_BASE_URL}/plugins/animated-counter`
  )
  expect(response.ok()).toBe(true)
  const registry = new PluginRegistry()
  registry.registerPlugin(await response.json())
  const counter = createPluginElement(
    'plugin:counter',
    { id: 'counter', x: 60, y: 60, pluginData: { value: 12, suffix: '%', label: 'Class score' } },
    registry
  )
  const sibling = {
    ...structuredClone(counter),
    id: 'sibling-counter',
    y: 280,
    pluginData: { value: 99, suffix: '%', label: 'Sibling score' },
  }
  // A genuine uploaded image selects the ZIP path rather than the no-media JSON backup.
  const upload = await request.post(`${process.env.PLAYWRIGHT_API_BASE_URL}/upload`, {
    multipart: {
      presentationId: id,
      file: {
        name: 'counter-lesson.svg',
        mimeType: 'image/svg+xml',
        buffer: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#22c55e"/></svg>'
        ),
      },
    },
  })
  expect(upload.ok(), `Counter ZIP fixture upload: ${await upload.text()}`).toBe(true)
  const asset = await upload.json()
  expect(asset.url).toMatch(/^\/uploads\//)
  const image = {
    id: 'counter-lesson-image',
    type: 'image',
    src: asset.url,
    alt: 'Lesson marker',
    x: 20,
    y: 20,
    width: 40,
    height: 40,
  }
  await apiUpdatePresentation(request, id, {
    title: 'Generated Counter boundary',
    resolution: { width: 960, height: 540 },
    slides: [
      { id: 'counter-slide', elements: [counter, sibling] },
      { id: 'away-slide', elements: [image] },
    ],
  })
  await new EditorPage(page).gotoPresentation(id)
}
async function counterPeer(page, label = 'Class score', excludeFrame = null) {
  let selected
  await expect
    .poll(async () => {
      for (const frame of page.frames()) {
        if (frame === excludeFrame || frame.isDetached()) continue
        try {
          if (
            (await frame.locator('#label').count()) &&
            (await frame.locator('#label').textContent()) === label
          ) {
            selected = frame
            return true
          }
        } catch (error) {
          if (!frame.isDetached() && !error.message.includes('Frame was detached')) throw error
        }
      }
      return false
    })
    .toBe(true)
  return selected
}
async function updateCounter(peer, value) {
  await peer.evaluate((value) => window.navslides.updateData({ value }), value)
  await expect(peer.locator('#value')).toHaveText(`${value}%`)
}
async function roundTrip(page) {
  const peer = await counterPeer(page)
  await expect(peer.locator('#value')).toHaveText('12%')
  await updateCounter(peer, 17)
  await page.evaluate(() => window.Reveal.slide(1))
  await expect(page.locator('section.present')).toHaveAttribute(
    'data-ns-effective-slide-id',
    'away-slide'
  )
  await page.evaluate(() => window.Reveal.slide(0))
  await expect(page.locator('section.present')).toHaveAttribute(
    'data-ns-effective-slide-id',
    'counter-slide'
  )
  await updateCounter(peer, 23)
  const isolation = await peer.evaluate(() => {
    let parentDenied = false,
      storageDenied = false
    try {
      void parent.document.body
    } catch {
      parentDenied = true
    }
    try {
      void localStorage.length
    } catch {
      storageDenied = true
    }
    return { parentDenied, storageDenied }
  })
  expect(isolation).toEqual({ parentDenied: true, storageDenied: true })
  return peer
}
async function observeBindings(context) {
  await context.addInitScript(() => {
    window.__counterBinding = undefined
    window.addEventListener('message', (event) => {
      if (event.source === parent && event.data?.source === 'navslides-host')
        window.__counterBinding = event.data
    })
  })
}
async function probeRejected(page, sender, binding, value, peer) {
  await page.evaluate((value) => {
    window.__counterProbe = new Promise((resolve) => {
      const listener = (event) => {
        if (event.data?.patch?.value !== value) return
        window.removeEventListener('message', listener)
        setTimeout(resolve, 0)
      }
      window.addEventListener('message', listener)
    })
  }, value)
  await sender.evaluate(
    ({ binding, value }) =>
      parent.postMessage(
        {
          source: 'navslides-plugin',
          type: 'update-data',
          instanceToken: binding.instanceToken,
          documentToken: binding.documentToken,
          patch: { value },
        },
        '*'
      ),
    { binding, value }
  )
  await page.evaluate(() => window.__counterProbe)
  await expect(peer.locator('#value')).toHaveText('23%')
}
export { setupCounter, counterPeer, updateCounter, roundTrip, observeBindings, probeRejected }
