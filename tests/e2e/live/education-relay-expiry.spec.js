import { test, expect } from '@playwright/test'
import { liveJourney, question, agreeTeamScores } from './education-player-fixture.js'
test('server relay expiry locks input before applying one configured pass-on-wrong baton', async ({
  page,
  request,
  browser,
  baseURL,
}) => {
  const args = { page, request, browser, baseURL }
  const questions = [question('q1'), question('q2')]
  const journey = await liveJourney(args, 'relay-race', {
    questions,
    questionsPerRound: 2,
    shuffleTeams: false,
    timerDuration: 1,
    passOnWrong: true,
  })
  try {
    const assignments = journey.root.locator('[data-ns-command="assignTeam"]')
    await expect(assignments).toHaveCount(4)
    const players = await assignments.evaluateAll((buttons) => [
      ...new Set(buttons.map((button) => button.dataset.nsPlayerId)),
    ])
    for (let index = 0; index < players.length; index++)
      await journey.root
        .locator(
          `[data-ns-command="assignTeam"][data-ns-player-id="${players[index]}"][data-ns-team-id="team-${index + 1}"]`
        )
        .click()
    await journey.command('start')
    await expect
      .poll(() =>
        journey.root.evaluate((root) => NavSlidesEducation.mount(root).getState().state.phase)
      )
      .toBe('active')
    const initial = await journey.root.evaluate(
      (root) => NavSlidesEducation.mount(root).getState().state
    )
    await expect
      .poll(() =>
        journey.root.evaluate((root) => NavSlidesEducation.mount(root).getState().state.phase)
      )
      .toBe('waiting')
    for (const learner of journey.learners)
      await expect(learner.getByRole('button', { name: 'Submit answer' })).toBeDisabled()
    const expired = await journey.root.evaluate(
      (root) => NavSlidesEducation.mount(root).getState().state
    )
    expect(expired.roundId).toBe(initial.roundId)
    expect(Object.values(expired.relay.positions)).toEqual([0, 0])
    expect(expired.teams.map((team) => team.score)).toEqual([0, 0])
    await expect
      .poll(() =>
        journey.root.evaluate((root) => NavSlidesEducation.mount(root).getState().state.roundId)
      )
      .toBe(initial.roundId + 1)
    const next = await journey.root.evaluate(
      (root) => NavSlidesEducation.mount(root).getState().state
    )
    expect(next.turn.turnPlayerId).toBe(initial.turn.turnPlayerId)
    const opponent = next.teams.find((team) => team.id !== initial.turn.activeTeamId).id
    expect(next.relay.positions).toEqual({ [initial.turn.activeTeamId]: 0, [opponent]: 1 })
    expect(next.teams.map((team) => team.score)).toEqual([0, 0])
    await agreeTeamScores(journey)
  } finally {
    await journey.close()
  }
})
