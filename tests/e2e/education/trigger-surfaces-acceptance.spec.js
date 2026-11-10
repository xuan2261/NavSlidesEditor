import {
  test,
  expect,
  apiCreateShareLink,
} from '../fixtures/test-fixtures.js'
import { downloadArtifact, freshPortable } from './release-surfaces.js'
import { prepare, openShare, inspectOffline, verifyActions, activate, snapshot } from './trigger-surface-interactions.js'

for (const surface of ['share', 'file']) {
  test(`trigger parity ${surface}: six actions, lower/upper bounds, child scope and reset authority`, async ({
    page,
    request,
    browser,
    testPresentation,
  }, testInfo) => {
    await prepare(page, request, testPresentation.id)
    const source =
      surface === 'share'
        ? `/share/${(await apiCreateShareLink(request, testPresentation.id)).token}`
        : await downloadArtifact(page, testInfo, 'Export HTML', 'trigger-actions-portable.html')
    const document =
      surface === 'share'
        ? await openShare(browser, page, source)
        : await freshPortable(browser, source)
    try {
      await verifyActions(document.page, testInfo, surface)
      if (surface === 'file') await inspectOffline(document)
    } finally {
      await document.context.close()
    }
  })
  test(`trigger ${surface}: two fresh documents retain independently divergent runtime state`, async ({
    page,
    request,
    browser,
    testPresentation,
  }, testInfo) => {
    await prepare(page, request, testPresentation.id)
    const source =
      surface === 'share'
        ? `/share/${(await apiCreateShareLink(request, testPresentation.id)).token}`
        : await downloadArtifact(page, testInfo, 'Export HTML', 'trigger-isolation-portable.html')
    const open = () =>
      surface === 'share' ? openShare(browser, page, source) : freshPortable(browser, source)
    const first = await open()
    try {
      await activate(first.page, 'Award three Blue points')
      await activate(first.page, 'Reveal this slide answer')
      const divergent = { blue: '5', red: '7', parentHidden: false, childHidden: true }
      expect(await snapshot(first.page)).toEqual(divergent)
      const second = await open()
      try {
        expect(await snapshot(second.page)).toEqual({
          blue: '2',
          red: '7',
          parentHidden: true,
          childHidden: true,
        })
        await activate(second.page, 'Remove two Blue points')
        await activate(second.page, 'Increase Red score by 1')
        expect(await snapshot(second.page)).toEqual({
          blue: '0',
          red: '8',
          parentHidden: true,
          childHidden: true,
        })
        expect(await snapshot(first.page)).toEqual(divergent)
        await first.page.screenshot({
          path: testInfo.outputPath(`trigger-isolation-A-${surface}.png`),
          fullPage: true,
        })
        await second.page.screenshot({
          path: testInfo.outputPath(`trigger-isolation-B-${surface}.png`),
          fullPage: true,
        })
        if (surface === 'file') {
          await inspectOffline(first)
          await inspectOffline(second)
        }
      } finally {
        await second.context.close()
      }
    } finally {
      await first.context.close()
    }
  })
}
