import { expect } from '@playwright/test'
import { selectedSubmitter } from './education-release-authority.js'

export function sharedProjection(state) {
  const projected = Object.fromEntries(
    [
      'gameId',
      'gameType',
      'roomInstanceId',
      'generation',
      'roundId',
      'stateVersion',
      'phase',
      'question',
      'teams',
      'turn',
      'buzz',
      'relay',
      'leaderboard',
      'poll',
      'wordCloud',
      'matching',
      'scatter',
      'jeopardy',
      'picker',
      'revealed',
    ].map((key) => [key, state[key]])
  )
  if (projected.scatter) {
    const { submitterPlayerId, ...sharedScatter } = projected.scatter
    projected.scatter = sharedScatter
  }
  return projected
}
export function assertRecipientMetadata(authority, host, learners) {
  if (authority.type !== 'scattergories') return
  expect(host.scatter.submitterPlayerId, 'Host never becomes a team submitter').toBeNull()
  for (const [index, learner] of learners.entries()) {
    expect(
      learner.scatter.submitterPlayerId,
      `Recipient ${index} retains its independently assigned team submitter`
    ).toBe(selectedSubmitter(authority, learner, authority.recipients[index]))
  }
}
