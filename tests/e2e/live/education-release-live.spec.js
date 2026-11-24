import { test, expect } from '@playwright/test'
import { question, nativeAnswer } from './education-player-fixture.js'
import {
  releaseJourney,
  latest,
  redacted,
  receipt,
  reconnect,
  replay,
  qualify,
  agreePublic,
} from './education-release-helper.js'
import { engagementJourneys } from './education-release-engagement.js'

engagementJourneys()
test('HotPotato native answers award one server speed bonus, hydrate and reset', async ({
  page,
  request,
  browser,
  baseURL,
}, testInfo) => {
  const journey = await releaseJourney({ page, request, browser, baseURL }, 'hot-potato', {
    questions: [question()],
    allowLate: false,
    shuffleQuestions: false,
  })
  try {
    await journey.command('nextQuestion')
    await redacted(journey)
    for (const [index, learner] of journey.learners.entries()) {
      await nativeAnswer(learner, index === 0 ? 'Earth' : 'Mars')
      const [accepted] = await receipt(journey, index, 'game-answer')
      const result = accepted.result
      expect(result.correct).toBe(index === 0)
      expect(result.terminal).toBe(true)
      if (index === 0) {
        expect(result.points).toBeGreaterThanOrEqual(10)
        expect(result.points).toBeLessThanOrEqual(20)
      } else expect(result.points).toBe(0)
      expect(result.totalScore).toBe(result.points)
      await expect
        .poll(
          () =>
            latest(journey, index)?.leaderboard.find((row) => row.name === ['Ada', 'Lin'][index])
              ?.score
        )
        .toBe(result.points)
      await expect(learner.getByRole('button', { name: 'Submit answer' })).toBeDisabled()
    }
    await redacted(journey)
    await journey.command('reveal')
    for (const learner of journey.learners)
      await expect(learner.getByText('Answer: Earth', { exact: true })).toBeVisible()
    await reconnect(journey)
    await replay(journey, () => journey.command('nextQuestion'))
    for (const learner of journey.learners) {
      await expect(learner.getByRole('radio', { name: 'Earth', exact: true })).not.toBeChecked()
      await expect(learner.getByRole('button', { name: 'Submit answer' })).toBeEnabled()
    }
    await qualify(testInfo, journey)
  } finally {
    await journey.close()
  }
})
test('Jeopardy native host selects Daily Double, wagers and adjudicates once for two public spectators', async ({
  page,
  request,
  browser,
  baseURL,
}, testInfo) => {
  const q = { ...question('cell-100'), points: 100 }
  const journey = await releaseJourney({ page, request, browser, baseURL }, 'jeopardy', {
    categories: [{ id: 'geo', title: 'Geography', questions: [q] }],
    dailyDouble: ['cell-100'],
    timerDuration: 30,
  })
  try {
    await journey.root.getByRole('button', { name: 'geo 100 · Blue', exact: true }).click()
    await receipt(journey, 'host', 'game-jeopardy-select')
    await expect(journey.root.getByRole('spinbutton', { name: /Wager/ })).toBeVisible()
    await journey.root.getByRole('spinbutton', { name: /Wager/ }).fill('100')
    await journey.root.getByRole('button', { name: 'Submit wager', exact: true }).click()
    await receipt(journey, 'host', 'game-jeopardy-wager')
    await redacted(journey)
    for (const learner of journey.learners) {
      await expect(learner.getByRole('heading', { name: q.prompt, exact: true })).toBeVisible()
      await expect(learner.getByRole('button', { name: 'Submit answer' })).toHaveCount(0)
      await expect(learner.getByRole('button', { name: 'Correct', exact: true })).toHaveCount(0)
    }
    expect(latest(journey).jeopardy.wager).toBe(100)
    await journey.command('reveal')
    await agreePublic(journey)
    expect(latest(journey).revealed.question.answerKey).toEqual(q.answerKey)
    await journey.root.getByRole('button', { name: 'Correct', exact: true }).click()
    await receipt(journey, 'host', 'game-jeopardy-adjudicate')
    await agreePublic(journey)
    expect(latest(journey).teams.map((row) => row.score)).toEqual([100, 0])
    expect(latest(journey).jeopardy.cells[0].used).toBe(true)
    await expect(journey.root.getByRole('button', { name: 'Correct', exact: true })).toHaveCount(0)
    await reconnect(journey)
    await reconnect(journey, 1)
    await replay(journey)
    expect(latest(journey).jeopardy.cells[0].used).toBe(false)
    await expect(
      journey.root.getByRole('button', { name: 'geo 100 · Blue', exact: true })
    ).toBeEnabled()
    await qualify(testInfo, journey)
  } finally {
    await journey.close()
  }
})
test('name-picker presenter broadcast picks and resets actual spectator cards in two independent contexts', async ({
  page,
  request,
  browser,
  baseURL,
}, testInfo) => {
  const journey = await releaseJourney({ page, request, browser, baseURL }, 'name-picker')
  try {
    await redacted(journey)
    for (const learner of journey.learners) {
      await expect(learner.getByRole('heading', { name: 'Name picker', exact: true })).toBeVisible()
      await expect(learner.getByRole('button')).toHaveCount(0)
    }
    const winners = []
    for (let pick = 1; pick <= 2; pick++) {
      await journey.command('pick')
      await receipt(journey, 'host', 'game-random', pick)
      await agreePublic(journey)
      const winner = latest(journey).picker.winner
      expect(journey.config.items.map((row) => row.id)).toContain(winner.id)
      winners.push(winner.id)
      expect(new Set(winners).size).toBe(pick)
      for (const learner of journey.learners)
        await expect(learner.getByText(`Selected: ${winner.label}`, { exact: true })).toBeVisible()
    }
    await reconnect(journey)
    await reconnect(journey, 1)
    for (const wire of journey.wires)
      expect(wire.outgoing.filter((row) => row.data?.commandId)).toEqual([])
    await replay(journey)
    expect(latest(journey).picker.winner).toBeNull()
    for (const learner of journey.learners) {
      await expect(
        learner.getByText('Waiting for the host to choose.', { exact: true })
      ).toBeVisible()
      await expect(learner.getByRole('button')).toHaveCount(0)
    }
    await qualify(testInfo, journey)
  } finally {
    await journey.close()
  }
})
