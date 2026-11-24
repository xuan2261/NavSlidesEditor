import {
  test,
  expect,
  apiGetPresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { launchPresentPopup } from './present-offline-helpers.js'
import { downloadArtifact, freshPortable } from './release-surfaces.js'
import { cardDeck } from './card-image-lifecycle-interactions.js'
import { playCards } from './card-image-lifecycle-journey.js'


for (const surface of ['present', 'file']) {
  test(`card image lifecycle: ${surface} conceals, decodes, locks mismatches, cancels stale work and isolates inherited progress`, async ({
    page,
    request,
    browser,
    testPresentation,
  }, testInfo) => {
    await apiUpdatePresentation(request, testPresentation.id, cardDeck())
    await new EditorPage(page).gotoPresentation(testPresentation.id)
    const savedJSON = await apiGetPresentation(request, testPresentation.id)
    let active, offline, file
    if (surface === 'present') ({ popup: active } = await launchPresentPopup(page))
    else {
      file = await downloadArtifact(page, testInfo, 'Export HTML', 'card-image-lifecycle.html')
      offline = await freshPortable(browser, file)
      active = offline.page
    }
    const errors = []
    active.on('pageerror', (error) => errors.push(error.message))
    try {
      const observations = await playCards(active)
      expect(await apiGetPresentation(request, testPresentation.id)).toEqual(savedJSON)
      const network = offline ? await offline.inspectNetwork() : null
      if (offline)
        expect(network).toEqual({
          protocol: 'file:',
          httpAttempts: [],
          socketAttempts: [],
          errors: [],
        })
      expect(errors).toEqual([])
      await testInfo.attach(`card-image-lifecycle-${surface}-measurements`, {
        body: Buffer.from(JSON.stringify({ surface, observations, network, errors }, null, 2)),
        contentType: 'application/json',
      })
      await testInfo.attach(`card-image-lifecycle-${surface}-after-assertions`, {
        body: await active.screenshot({ fullPage: true }),
        contentType: 'image/png',
      })
      if (file)
        await testInfo.attach('card-image-lifecycle-portable-artifact', {
          path: file,
          contentType: 'text/html',
        })
    } finally {
      if (offline) await offline.context.close()
      else await active.close()
    }
  })
}
