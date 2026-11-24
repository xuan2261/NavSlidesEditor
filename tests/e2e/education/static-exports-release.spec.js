import { test, expect, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { gameCases, gameFixture, deckWith } from './release-game-fixtures.js'
import { CANONICAL_ELEMENTS, ordinaryFixture } from './release-ordinary-fixtures.js'
import { observe } from './release-observations.js'
import { setTeacherReveal, exportStatic } from './release-static-downloads.js'
import { assertStaticGame, ordinaryStaticText } from './release-static-expectations.js'
import { decodeQrRaster } from './release-static-artifacts.js'

for (const { type, kind } of gameCases()) {
  for (const format of ['pdf', 'pptx']) {
    test(`${format} ${type}${kind ? ` ${kind}` : ''} real artifact hides default solution and explicitly reveals teacher answer`, async ({
      page,
      request,
      testPresentation,
    }, testInfo) => {
      test.setTimeout(240000)
      const fixture = gameFixture(type, kind)
      if (type === 'word-search') {
        fixture['word-search'].title =
          'Authored classroom word search with a deliberately wrapped heading that preserves every final word'
        fixture.backgroundColor = '#ffffff'
        fixture.textColor = '#2563eb'
        fixture.accentColor = '#2563eb'
      }
      await apiUpdatePresentation(request, testPresentation.id, deckWith([fixture]))
      const editor = new EditorPage(page)
      await editor.gotoPresentation(testPresentation.id)
      await setTeacherReveal(page, false)
      const defaultArtifact = await exportStatic(page, format, testInfo, 'default')
      const defaultObserved = assertStaticGame(defaultArtifact, type, kind, false)
      if (type === 'word-search') {
        expect(defaultArtifact.text.replace(/\s+/g, ' ')).toContain(fixture['word-search'].title)
        expect(defaultArtifact.authoredBluePixels).toBeGreaterThan(50)
      }
      const identity = { element: 'game', gameType: type, questionKind: kind, surface: format }
      await observe(
        testInfo,
        page,
        identity,
        'redacted-default',
        { authoredPromptOrBoard: true, solutionUnrevealed: true, interactiveLossDisclosed: true },
        defaultObserved,
        defaultArtifact.artifacts
      )
      if (format === 'pdf' && type === 'quiz' && kind === 'single-choice') {
        await observe(
          testInfo,
          page,
          { element: 'game', surface: 'pdf' },
          'default-answer-redaction',
          { staticDefaultHasNoSolutionMarking: true },
          defaultObserved,
          defaultArtifact.artifacts
        )
      }
      await page.reload()
      await page.getByTestId('canvas-area').waitFor()
      await setTeacherReveal(page, true)
      const teacherArtifact = await exportStatic(page, format, testInfo, 'teacher')
      const teacherObserved = assertStaticGame(teacherArtifact, type, kind, true, defaultArtifact)
      if (type === 'word-search') {
        expect(teacherArtifact.text.replace(/\s+/g, ' ')).toContain(fixture['word-search'].title)
        expect(teacherArtifact.authoredBluePixels).toBeGreaterThan(50)
      }
      await observe(
        testInfo,
        page,
        identity,
        'teacher-reveal',
        {
          explicitTeacherChoice: true,
          authoredSolutionVisibleWhenApplicable: true,
          noInteractiveClaim: true,
        },
        teacherObserved,
        teacherArtifact.artifacts
      )
    })
  }
}
for (const type of CANONICAL_ELEMENTS) {
  for (const format of ['pdf', 'pptx']) {
    test(`${format} canonical ${type} actual static artifact preserves its supported authored mapping`, async ({
      page,
      request,
      testPresentation,
    }, testInfo) => {
      test.setTimeout(180000)
      const fixture = ordinaryFixture(type)
      await apiUpdatePresentation(request, testPresentation.id, deckWith([fixture]))
      await new EditorPage(page).gotoPresentation(testPresentation.id)
      const artifact = await exportStatic(
        page,
        format,
        testInfo,
        `ordinary-${type}`,
        type === 'game'
      )
      let decodedPayload = null
      const graphic =
        ['image', 'icon', 'drawing', 'line', 'svg'].includes(type) ||
        (type === 'video' && format === 'pptx')
      if (type === 'qrcode') {
        for (const path of artifact.artifacts.filter((path) => /\.(png|jpe?g)$/i.test(path))) {
          decodedPayload = await decodeQrRaster(path)
          if (decodedPayload) break
        }
        expect(decodedPayload).toBe(fixture.qrData)
      } else if (graphic) {
        expect(
          artifact.authoredBluePixels > 50 || artifact.nativePalette?.includes('2563eb'),
          'Actual raster or native exported paint must contain the authored blue graphic'
        ).toBe(true)
      } else {
        expect(artifact.text.replace(/\s+/g, ' ')).toContain(ordinaryStaticText[type])
      }
      await observe(
        testInfo,
        page,
        { element: type, surface: format },
        'static-mapping',
        { type, supportedAuthoredMapping: true, interactive: false },
        {
          text: artifact.text,
          decodedPayload,
          authoredBluePixels: artifact.authoredBluePixels,
          nativePalette: artifact.nativePalette,
          pageCount: artifact.pageCount,
          slideCount: artifact.slideCount,
          limitation: ['video', 'audio'].includes(type)
            ? 'Media is non-playable in static exports.'
            : null,
        },
        artifact.artifacts
      )
    })
  }
}

