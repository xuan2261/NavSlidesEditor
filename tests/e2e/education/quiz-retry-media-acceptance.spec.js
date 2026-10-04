import {
  test,
  expect,
  apiGetPresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { QUESTION_KINDS, gameFixture, deckWith } from './release-game-fixtures.js'
import { launchPresentPopup } from './present-offline-helpers.js'
import { downloadArtifact, freshPortable } from './release-surfaces.js'
import { quizRetryJourney } from './quiz-retry-media-interactions.js'

function retryFixture(kind) {
  const fixture = gameFixture('quiz', kind)
  fixture.quiz.attemptLimit = 2
  const question = fixture.quiz.questions[0]
  if (kind === 'matching') {
    const leftId = `${question.id}/left-2`,
      rightId = `${question.id}/right-2`
    question.options.left.push({ id: leftId, text: 'Second left item' })
    question.options.right.push({ id: rightId, text: 'Second right item' })
    question.answerKey.pairs.push({ leftId, rightId })
  }
  if (kind === 'ordering') question.options.reverse()
  if (kind === 'fill-blank') question.answerKey.accepted = ['Café Việt']
  if (kind === 'image-hotspot') {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="320" viewBox="0 0 160 320"><rect width="160" height="320" fill="#e2e8f0"/><rect x="40" y="80" width="80" height="160" fill="#2563eb"/></svg>'
    question.media = {
      src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
      alt: 'Portrait image with a blue center rectangle and gray outside area',
    }
  }
  return fixture
}

for (const kind of QUESTION_KINDS) {
  for (const surface of ['present', 'file']) {
    test(`quiz ${kind} actual wrong answer, valid retry, one award, finish and reset on ${surface}`, async ({
      page,
      request,
      browser,
      testPresentation,
    }, testInfo) => {
      const fixture = retryFixture(kind)
      await apiUpdatePresentation(request, testPresentation.id, deckWith([fixture]))
      await new EditorPage(page).gotoPresentation(testPresentation.id)
      const savedJSON = await apiGetPresentation(request, testPresentation.id)
      let target, popup, portable
      try {
        if (surface === 'present') {
          ;({ popup } = await launchPresentPopup(page))
          target = popup
          await target.waitForFunction(() => window.Reveal?.isReady())
        } else {
          const file = await downloadArtifact(page, testInfo, 'Export HTML', `${kind}-retry.html`)
          portable = await freshPortable(browser, file)
          target = portable.page
          await testInfo.attach('portable-source', { path: file, contentType: 'text/html' })
        }
        const root = target.locator(`[data-ns-game][data-ns-element-id="${fixture.id}"]`)
        const observed = await quizRetryJourney(root, fixture.quiz.questions[0])
        if (portable) observed.network = await portable.inspectNetwork()
        const savedAfterPlay = await apiGetPresentation(request, testPresentation.id)
        expect(savedAfterPlay).toEqual(savedJSON)
        await testInfo.attach('measured-quiz-retry', {
          contentType: 'application/json',
          body: Buffer.from(
            JSON.stringify({ kind, surface, observed, savedJSON, savedAfterPlay }, null, 2)
          ),
        })
        await testInfo.attach('reset-surface', {
          body: await target.screenshot(),
          contentType: 'image/png',
        })
      } finally {
        try {
          await popup?.close()
        } finally {
          await portable?.context.close()
        }
      }
    })
  }
}
