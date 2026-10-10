import { test, expect, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { downloadArtifact, freshPortable, findFrame } from './release-surfaces.js'
import { completeGame } from './release-game-interactions.js'
import {
  portableAssetDeck,
  inspectPortableImage,
  inspectPortableFrame,
} from './common-runtime-portable-assets.js'
import { recordCommon } from './common-runtime-evidence.js'

test('common portable-assets: real HTML Download renders uploaded image question-media video font and actual plugin in fresh file Chromium and completes/resets offline', async ({
  page,
  request,
  browser,
  testPresentation,
}, testInfo) => {
  const fixture = await portableAssetDeck(request, testPresentation.id)
  await apiUpdatePresentation(request, testPresentation.id, fixture.deck)
  await new EditorPage(page).gotoPresentation(testPresentation.id)
  const file = await downloadArtifact(page, testInfo, 'Export HTML', 'common-portable-assets.html')
  const offline = await freshPortable(browser, file)
  try {
    expect(new URL(offline.page.url()).protocol).toBe('file:')
    const image = await inspectPortableImage(
      offline.page.getByRole('img', { name: 'Authored slide marker', exact: true })
    )
    const root = offline.page.locator('[data-ns-game][data-ns-element-id="portable-quiz"]')
    const questionMedia = await inspectPortableImage(
      root.getByRole('img', { name: 'Authored question marker', exact: true })
    )
    const limitation = root.getByText(
      'Local classroom — answers are included in this offline document.',
      { exact: true }
    )
    await expect(limitation).toBeVisible()
    // Offline closure is not answer secrecy or a multiplayer transport guarantee.
    const inspectable = await root
      .locator('[data-ns-game-config]')
      .evaluate((node) => JSON.parse(node.textContent).questions[0].answerKey)
    expect(inspectable).toEqual(fixture.quiz.quiz.questions[0].answerKey)
    const counter = await findFrame(offline.page, '#label')
    await expect(counter.locator('#label')).toHaveText('Portable class score')
    await expect(counter.locator('#value')).toHaveText('12%')
    const plugin = {
      label: await counter.locator('#label').textContent(),
      value: await counter.locator('#value').textContent(),
    }
    expect(
      await counter.evaluate(() => {
        try {
          void parent.document.body
          return 'escaped'
        } catch (error) {
          return error.name
        }
      })
    ).toBe('SecurityError')
    const authoredAssets = await inspectPortableFrame(offline.page)
    const rendered = testInfo.outputPath('portable-assets-before-native-completion.png')
    await offline.page.screenshot({ path: rendered, fullPage: true })
    const activity = await completeGame(root, 'quiz', fixture.quiz.quiz)
    expect(activity.completed).toContain('Quiz complete.')
    expect(activity.completed).toContain('Score: 10')
    expect(activity.reset).toContain('Score: 0')
    await expect(root.getByRole('button', { name: 'Submit answer', exact: true })).toBeEnabled()
    await expect(
      root.getByRole('heading', { name: fixture.quiz.quiz.questions[0].prompt, exact: true })
    ).toBeVisible()
    const restoredQuestionMedia = await inspectPortableImage(
      root.getByRole('img', { name: 'Authored question marker', exact: true })
    )
    const current = await offline.page.evaluate(() => ({
      indices: window.Reveal.getIndices(),
      slide: window.Reveal.getCurrentSlide().dataset.nsEffectiveSlideId,
    }))
    expect(current).toMatchObject({ indices: { h: 0, v: 0 }, slide: 'release-slide' })
    const network = await offline.inspectNetwork()
    expect(network).toEqual({ protocol: 'file:', httpAttempts: [], socketAttempts: [], errors: [] })
    await recordCommon(
      testInfo,
      offline.page,
      'portable-assets',
      'file',
      {
        imageDimensions: { width: 40, height: 40 },
        questionImageDimensions: { width: 40, height: 40 },
        plugin: { label: 'Portable class score', value: '12%' },
        font: { family: 'PortableLesson', status: 'loaded', text: 'ABC' },
        mediaPlayback: 'Clip complete',
        completedScore: 10,
        resetScore: 0,
        limitation: 'Local classroom — answers are included in this offline document.',
        inspectableAnswerKey: inspectable,
        network: { protocol: 'file:', httpAttempts: [], socketAttempts: [], errors: [] },
      },
      {
        image,
        questionMedia,
        restoredQuestionMedia,
        plugin,
        authoredAssets,
        activity,
        current,
        network,
        limitation: await limitation.textContent(),
        inspectableAnswerKey: inspectable,
        uploadedAssets: fixture.assets,
      },
      [file, rendered]
    )
  } finally {
    await offline.context.close()
  }
})
