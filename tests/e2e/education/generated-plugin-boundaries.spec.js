import { readFile, writeFile } from 'node:fs/promises'
import JSZip from 'jszip'
import {
  test,
  expect,
  apiCreateShareLink,
} from '../fixtures/test-fixtures.js'
import { launchPresentPopup } from './present-offline-helpers.js'
import { downloadArtifact, freshPortable, findFrame } from './release-surfaces.js'
import {
  setupCounter, counterPeer, updateCounter, roundTrip, observeBindings, probeRejected,
} from './generated-plugin-counter-helpers.js'


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
