import { test, expect } from '@playwright/test'
import { question, nativeAnswer, agreeTeamScores } from './education-player-fixture.js'
import {
  releaseJourney,
  redacted,
  receipt,
  reconnect,
  replay,
  qualify,
  latest,
} from './education-release-helper.js'
test('independent native learners choose corners, reveal elimination and replay without stale draft', async ({
  page,
  request,
  browser,
  baseURL,
}, testInfo) => {
  const args = { page, request, browser, baseURL }
  const journey = await releaseJourney(args, 'four-corners', {
    questions: [question()],
    timerDuration: 30,
    eliminateMode: 'wrong',
  })
  try {
    const [ada, lin] = journey.learners
    await journey.command('start')
    await redacted(journey)
    await ada.getByRole('radio', { name: 'Earth', exact: true }).check()
    await lin.getByRole('radio', { name: 'Mars', exact: true }).check()
    await ada.getByRole('button', { name: 'Choose corner' }).click()
    await lin.getByRole('button', { name: 'Choose corner' }).click()
    await expect(ada.getByRole('button', { name: 'Choose corner' })).toBeDisabled()
    await expect(lin.getByText(/Correct corner/)).toHaveCount(0)
    for (const index of [0, 1]) await receipt(journey, index, 'game-fourcorners-choice')
    await redacted(journey)
    await journey.command('reveal')
    await expect(ada.getByText('Correct corner: Earth')).toBeVisible()
    await expect(lin.getByText(/Eliminated/)).toBeVisible()
    await expect
      .poll(() =>
        latest(journey)
          .leaderboard.filter((row) => ['Ada', 'Lin'].includes(row.name))
          .map((row) => [row.name, row.score])
          .sort()
      )
      .toEqual([
        ['Ada', 10],
        ['Lin', 0],
      ])
    await reconnect(journey)
    await expect(ada.getByText('Correct corner: Earth')).toBeVisible()
    await replay(journey, () => journey.command('start'))
    await expect(ada.getByRole('radio', { name: 'Earth', exact: true })).not.toBeChecked()
    await expect(lin.getByRole('button', { name: 'Choose corner' })).toBeEnabled()
    await qualify(testInfo, journey)
  } finally {
    await journey.close()
  }
})
test('native relay assigns independent learners and only the server baton holder can answer', async ({
  page,
  request,
  browser,
  baseURL,
}, testInfo) => {
  const args = { page, request, browser, baseURL }
  const journey = await releaseJourney(args, 'relay-race', {
    questions: [question('q1'), question('q2')],
    questionsPerRound: 1,
    shuffleTeams: false,
    timerDuration: 30,
    passOnWrong: false,
  })
  try {
    const assignments = journey.root.locator('[data-ns-command="assignTeam"]')
    await expect(assignments).toHaveCount(4)
    const playerIds = await assignments.evaluateAll((buttons) => [
      ...new Set(buttons.map((button) => button.dataset.nsPlayerId)),
    ])
    for (let index = 0; index < playerIds.length; index++)
      await journey.root
        .locator(
          `[data-ns-command="assignTeam"][data-ns-player-id="${playerIds[index]}"][data-ns-team-id="team-${index + 1}"]`
        )
        .click()
    await journey.command('start')
    await redacted(journey)
    const [ada, lin] = journey.learners
    await expect(ada.getByRole('button', { name: 'Submit answer' })).toBeVisible()
    await expect(lin.getByRole('button', { name: 'Submit answer' })).toBeVisible()
    let holder = (await ada.getByRole('button', { name: 'Submit answer' }).isEnabled()) ? ada : lin
    const waiting = holder === ada ? lin : ada
    await expect(waiting.getByRole('button', { name: 'Submit answer' })).toBeDisabled()
    await nativeAnswer(holder, 'Mars')
    const holderIndex = journey.learners.indexOf(holder)
    await expect
      .poll(() =>
        journey.received[holderIndex].some(
          (state) =>
            state.ownSubmission?.result?.correct === false &&
            state.ownSubmission.result.terminal === true
        )
      )
      .toBe(true)
    await receipt(journey, holderIndex, 'game-relay-answer')
    await expect(holder.getByRole('button', { name: 'Submit answer' })).toBeDisabled()
    await expect
      .poll(() =>
        journey.root.evaluate((root) =>
          Object.values(NavSlidesEducation.mount(root).getState().state.relay.positions)
        )
      )
      .toEqual([0, 0])
    await expect
      .poll(
        async () =>
          (await ada.getByRole('button', { name: 'Submit answer' }).isEnabled()) ||
          (await lin.getByRole('button', { name: 'Submit answer' }).isEnabled())
      )
      .toBe(true)
    holder = (await ada.getByRole('button', { name: 'Submit answer' }).isEnabled()) ? ada : lin
    await nativeAnswer(holder)
    await expect
      .poll(() =>
        journey.received[journey.learners.indexOf(holder)].some(
          (state) =>
            state.ownSubmission?.result?.correct === true &&
            state.ownSubmission.result.terminal === true
        )
      )
      .toBe(true)
    await receipt(journey, journey.learners.indexOf(holder), 'game-relay-answer')
    await expect
      .poll(() =>
        journey.root.evaluate((root) =>
          Object.values(NavSlidesEducation.mount(root).getState().state.relay.positions)
        )
      )
      .toContain(1)
    await agreeTeamScores(journey)
    expect(latest(journey).teams.map((team) => team.score)).toEqual([0, 0])
    await reconnect(journey, journey.learners.indexOf(holder))
    await expect(holder.getByText('Game finished.', { exact: true })).toBeVisible()
    await replay(journey, () => journey.command('start'))
    expect(latest(journey).relay.positions).toEqual({ 'team-1': 0, 'team-2': 0 })
    await qualify(testInfo, journey)
  } finally {
    await journey.close()
  }
})
