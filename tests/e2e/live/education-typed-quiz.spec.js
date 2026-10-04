import { test, expect } from '@playwright/test'
import {
  releaseJourney,
  redacted,
  receipt,
  reconnect,
  replay,
  qualify,
  latest,
} from './education-release-helper.js'
const item = (id, text) => ({ id, text })
const base = (kind, id, options, answerKey, extra = {}) => ({
  id,
  kind,
  prompt: `Typed ${kind}`,
  points: 10,
  timeLimit: 30,
  ...(options ? { options } : {}),
  answerKey,
  feedback: { correct: 'Good', incorrect: 'Retry', explanation: 'Public after question' },
  ...extra,
})
const questions = [
  base('single-choice', 'single', [item('earth', 'Earth'), item('mars', 'Mars')], {
    optionId: 'earth',
  }),
  base('multi-choice', 'multi', [item('a', 'Alpha'), item('b', 'Beta'), item('c', 'Gamma')], {
    optionIds: ['a', 'b'],
  }),
  base('true-false', 'boolean', null, { value: true }),
  base('fill-blank', 'fill', null, { accepted: ['Earth'], caseSensitive: false }),
  base('ordering', 'order', [item('b', 'Beta'), item('a', 'Alpha')], { itemIds: ['a', 'b'] }),
  base(
    'matching',
    'match',
    {
      left: [item('l1', 'France'), item('l2', 'Italy')],
      right: [item('r2', 'Rome'), item('r1', 'Paris')],
    },
    {
      pairs: [
        { leftId: 'l1', rightId: 'r1' },
        { leftId: 'l2', rightId: 'r2' },
      ],
    }
  ),
  base(
    'image-hotspot',
    'hotspot',
    [item('zone', 'Neutral region')],
    { regions: [{ id: 'zone', shape: 'rect', x: 0, y: 0, width: 1, height: 1 }] },
    { media: { src: '/favicon.png', alt: 'Target map' } }
  ),
]
async function answer(learner, kind) {
  if (kind === 'single-choice')
    await learner.getByRole('radio', { name: 'Earth', exact: true }).check()
  if (kind === 'multi-choice')
    for (const name of ['Alpha', 'Beta'])
      await learner.getByRole('checkbox', { name, exact: true }).check()
  if (kind === 'true-false') await learner.getByRole('radio', { name: 'True', exact: true }).check()
  if (kind === 'fill-blank') await learner.getByRole('textbox').fill('Earth')
  if (kind === 'ordering') await learner.getByRole('button', { name: 'Move Alpha up' }).click()
  if (kind === 'matching') {
    await learner.getByRole('button', { name: 'France', exact: true }).click()
    await learner.getByRole('button', { name: 'Paris', exact: true }).click()
    await learner.getByRole('button', { name: 'Italy', exact: true }).click()
    await learner.getByRole('button', { name: 'Rome', exact: true }).click()
  }
  if (kind === 'image-hotspot')
    await learner.getByRole('combobox', { name: 'Named region' }).selectOption('zone')
  await learner.getByRole('button', { name: 'Submit answer' }).click()
}
for (const question of questions)
  test(`typed ${question.kind} redacts, scores once, hydrates and resets two native learners`, async ({
    page,
    request,
    browser,
    baseURL,
  }, testInfo) => {
    const journey = await releaseJourney({ page, request, browser, baseURL }, 'quiz', {
      questions: [question],
      attemptLimit: 2,
      feedbackMode: 'immediate',
      shuffleQuestions: false,
      showScore: true,
    })
    try {
      await journey.command('nextQuestion')
      for (const learner of journey.learners)
        await expect(learner.getByRole('heading', { name: question.prompt })).toBeVisible()
      await redacted(journey)
      if (question.kind === 'fill-blank') {
        const learner = journey.learners[0]
        await learner.getByRole('textbox').fill('Wrong')
        await learner.getByRole('button', { name: 'Submit answer' }).click()
        await receipt(journey, 0, 'game-answer')
        await expect.poll(() => latest(journey).ownSubmission?.result?.correct).toBe(false)
        expect(latest(journey).ownSubmission.result.pointsAwarded).toBe(0)
        await expect(learner.getByRole('textbox')).toHaveValue('Wrong')
        await redacted(journey)
      }
      for (const [index, learner] of journey.learners.entries()) {
        await answer(learner, question.kind)
        await receipt(
          journey,
          index,
          'game-answer',
          question.kind === 'fill-blank' && index === 0 ? 2 : 1
        )
        await expect.poll(() => latest(journey, index).ownSubmission?.result?.correct).toBe(true)
        expect(latest(journey, index).ownSubmission.result.pointsAwarded).toBe(question.points)
        expect(latest(journey, index).ownSubmission.result.totalScore).toBe(question.points)
        await expect
          .poll(
            () =>
              latest(journey, index)?.leaderboard.find((row) => row.name === ['Ada', 'Lin'][index])
                ?.score
          )
          .toBe(question.points)
        await expect(learner.getByRole('button', { name: 'Submit answer' })).toBeDisabled()
      }
      await journey.command('reveal')
      await expect
        .poll(() => journey.received.map((rows) => rows.at(-1)?.revealed?.question?.answerKey))
        .toEqual([question.answerKey, question.answerKey])
      await reconnect(journey)
      await expect(
        journey.learners[0].getByRole('button', { name: 'Submit answer' })
      ).toBeDisabled()
      await journey.command('end')
      for (const learner of journey.learners)
        await expect(learner.getByText('Game finished.', { exact: true })).toBeVisible()
      await replay(journey, () => journey.command('nextQuestion'))
      for (const learner of journey.learners)
        await expect(learner.getByRole('button', { name: 'Submit answer' })).toBeEnabled()
      await qualify(testInfo, journey, question.kind)
    } finally {
      await journey.close()
    }
  })
