import { readFile, writeFile } from 'node:fs/promises'
import JSZip from 'jszip'
import {
  test,
  expect,
  apiUpdatePresentation,
  apiCreateShareLink,
} from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { PluginRegistry } from '../../../client/src/plugins/plugin-registry.js'
import { createPluginElement } from '../../../client/src/plugins/plugin-loader.js'
import { launchPresentPopup } from './present-offline-helpers.js'
import { downloadArtifact, freshPortable, findFrame } from './release-surfaces.js'

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

test('actual generated Present and Share retain Counter document authority across A B A and reject sibling/stale traffic', async ({
  page,
  request,
  testPresentation,
}) => {
  test.setTimeout(120000)
  await observeBindings(page.context())
  await setupCounter(page, request, testPresentation.id)
  const { popup } = await launchPresentPopup(page)
  const share = await apiCreateShareLink(request, testPresentation.id)
  const shared = await page.context().newPage()
  try {
    await shared.goto(`/share/${share.token}`)
    for (const surface of [popup, shared]) {
      await surface.waitForFunction(() => window.Reveal?.isReady())
      const peer = await roundTrip(surface)
      const victimOuter = await (
        await surface.locator('[data-ns-element-id="counter"] iframe').first().elementHandle()
      ).contentFrame()
      const siblingOuter = await (
        await surface
          .locator('[data-ns-element-id="sibling-counter"] iframe')
          .first()
          .elementHandle()
      ).contentFrame()
      const oldBinding = await victimOuter.evaluate(() => window.__counterBinding)
      expect(oldBinding.type).toMatch(/init|data-changed/)
      await probeRejected(surface, siblingOuter, oldBinding, 700, peer)
      await surface
        .locator('[data-ns-element-id="counter"] iframe')
        .first()
        .evaluate((frame) => {
          frame.srcdoc = frame.srcdoc
        })
      const freshPeer = await counterPeer(surface, 'Class score', peer)
      await updateCounter(freshPeer, 23)
      const freshOuter = await (
        await surface.locator('[data-ns-element-id="counter"] iframe').first().elementHandle()
      ).contentFrame()
      await probeRejected(surface, freshOuter, oldBinding, 800, freshPeer)
      await updateCounter(freshPeer, 31)
    }
  } finally {
    await popup.close()
    await shared.close()
  }
})

test('normal HTML Download and editable ZIP include a working offline actual Counter with opaque frames', async ({
  page,
  request,
  browser,
  testPresentation,
}, testInfo) => {
  test.setTimeout(180000)
  await setupCounter(page, request, testPresentation.id)
  const html = await downloadArtifact(page, testInfo, 'Export HTML', 'actual-counter.html')
  const archive = await downloadArtifact(
    page,
    testInfo,
    'Export Project',
    'actual-counter.navslides'
  )
  const zip = await JSZip.loadAsync(await readFile(archive))
  const zipHtml = zip.file('presentation.html')
  expect(zipHtml).not.toBeNull()
  const attachment = testInfo.outputPath('actual-counter-zip.html')
  await writeFile(attachment, await zipHtml.async('string'))
  for (const file of [html, attachment]) {
    const offline = await freshPortable(browser, file)
    try {
      const peer = await roundTrip(offline.page)
      await updateCounter(peer, 41)
      const frame = await findFrame(offline.page, '#ns-sandbox-child')
      await expect(frame.locator('#ns-sandbox-child')).toHaveAttribute('sandbox', 'allow-scripts')
      await offline.inspectNetwork()
    } finally {
      await offline.context.close()
    }
  }
})
