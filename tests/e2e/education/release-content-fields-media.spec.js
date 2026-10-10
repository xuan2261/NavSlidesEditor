import { test } from '../fixtures/test-fixtures.js'
import {
  contentFixture,
  setupContent,
  reloadContent,
  fieldEvidence,
  withPresent,
  withPortable,
} from './release-content-fields.js'
import {
  sourceFor,
  authorMedia,
  inspectMedia,
  captionContent,
  uploadCaption,
  authorTrack,
  inspectTrack,
} from './release-content-fields-media.js'

for (const type of ['video', 'audio']) {
  test(`${type} controls source playback attributes and reachable metadata qualify after reload [cap:element.${type}.editor]`, async ({
    page,
    request,
    testPresentation,
  }, testInfo) => {
    const element = contentFixture(type, { controls: false, width: 620, height: 220 })
    await setupContent(page, request, testPresentation.id, element)
    const patch = await authorMedia(page, type)
    const { target, persisted } = await reloadContent(
      page,
      request,
      testPresentation.id,
      element.id,
      patch
    )
    const canvas = await inspectMedia(target, type)
    await withPresent(page, async (present) => {
      const generated = await inspectMedia(present.locator('.reveal .slides section.present'), type)
      const viewport = present.viewportSize()
      await present.setViewportSize({ width: 390, height: 844 })
      await present.waitForFunction(() => window.Reveal.isScrollView())
      await present.setViewportSize(viewport)
      await present.waitForFunction(() => !window.Reveal.isScrollView())
      const responsive = await inspectMedia(
        present.locator('.reveal .slides section.present'),
        type
      )
      const screenshot = testInfo.outputPath(`${type}-fields-present.png`)
      await present.screenshot({ path: screenshot })
      const fields = [
        'src',
        'controls',
        'autoplay',
        'loop',
        'muted',
        'transcript',
        'audioDescription',
      ]
      if (type === 'video')
        fields.push(
          'poster',
          'objectFit',
          'startTime',
          'endTime',
          'playbackRate',
          'fit',
          'start',
          'end',
          'rate'
        )
      await fieldEvidence(
        testInfo,
        page,
        type,
        fields,
        patch,
        { persisted, canvas, generated, responsive },
        [screenshot]
      )
    })
  })

  for (const captionSource of ['uploaded', 'inline']) {
    test(`${type}${captionSource === 'inline' ? ' inline' : ''} authored caption track loads real timed subtitle cues in browser and portable file [cap:element.${type}.editor]`, async ({
      page,
      request,
      browser,
      testPresentation,
    }, testInfo) => {
      const src =
        captionSource === 'uploaded'
          ? await uploadCaption(request, testPresentation.id)
          : `data:text/vtt;base64,${Buffer.from(captionContent).toString('base64')}`
      const element = contentFixture(type, { src: sourceFor(type), width: 620, height: 220 })
      await setupContent(page, request, testPresentation.id, element)
      const tracks = await authorTrack(page, src)
      const { target, persisted } = await reloadContent(
        page,
        request,
        testPresentation.id,
        element.id,
        { tracks }
      )
      const canvas = await inspectTrack(target, type)
      const portable = await withPortable(
        page,
        browser,
        testInfo,
        `${type}-captions.html`,
        async (offline) => {
          const observed = await inspectTrack(
            offline.locator('.reveal .slides section.present'),
            type
          )
          const screenshot = testInfo.outputPath(`${type}-timed-captions.png`)
          await offline.screenshot({ path: screenshot })
          return { observed, screenshot }
        }
      )
      await fieldEvidence(
        testInfo,
        page,
        type,
        type === 'audio' ? ['tracks', 'captions'] : ['tracks'],
        {
          cues: [{ text: 'Qualified caption cue.', start: 0.05, end: 0.15 }],
          activeCues: ['Qualified caption cue.'],
          expiredCues: [],
        },
        { persisted, canvas, portable: portable.observed.observed, network: portable.network },
        [portable.file, portable.observed.screenshot]
      )
      await testInfo.attach(`${type}-caption-network`, {
        body: Buffer.from(JSON.stringify(portable.network)),
        contentType: 'application/json',
      })
    })
  }
}
