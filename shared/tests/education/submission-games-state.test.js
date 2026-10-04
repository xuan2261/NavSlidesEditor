import { describe, expect, it } from 'vitest'
import { createDefaultGameConfig } from '../../src/education/game-defaults.js'
import { createPollState, reducePoll, pollAggregate } from '../../src/education/games/poll.js'
import {
  createWordCloudState,
  reduceWordCloud,
  wordCloudAggregate,
} from '../../src/education/games/word-cloud.js'
import { createMatchingState, reduceMatching } from '../../src/education/games/matching.js'

function game(type, factory, reducer, overrides = {}) {
  const config = { ...createDefaultGameConfig(type), ...overrides }
  let state = factory(config)
  return {
    config,
    get state() {
      return state
    },
    send(type, fields = {}, now = 0) {
      state = reducer(
        config,
        state,
        { type, generation: state.generation, roundId: state.roundId, ...fields },
        { now }
      )
      return state
    },
  }
}
const join = (g) => {
  g.send('join', { participantId: 'a', name: 'Same name' })
  g.send('join', { participantId: 'b', name: 'Same name' })
  g.send('start')
}
const vote = (g, optionId, fields = {}, now = 0) =>
  g.send('vote', { participantId: 'a', optionId, actionId: 'vote-1', ...fields }, now)
const phrase = (g, text, actionId, fields = {}) =>
  g.send('submit', { participantId: 'a', text, actionId, ...fields })

describe('poll classroom submissions', () => {
  it('ignores repeated active Start without extending the deadline or invalidating accepted votes', () => {
    const g = game('poll', createPollState, reducePoll)
    join(g)
    vote(g, g.config.options[0].id)
    const active = g.state
    expect(g.send('start', {}, 10000)).toBe(active)
    expect(g.send('start', {}, 20000)).toBe(active)
    g.send(
      'vote',
      {
        participantId: 'b',
        optionId: g.config.options[1].id,
        actionId: 'other',
        roundId: active.roundId,
      },
      20000
    )
    expect(pollAggregate(g.config, g.state).totalVotes).toBe(2)
    g.send('expire', {}, active.deadline)
    expect(g.state.phase).toBe('ended')
    g.send('start', {}, 40000)
    expect(g.state).toMatchObject({
      phase: 'active',
      roundId: active.roundId + 1,
      deadline: 40000 + g.config.timerDuration * 1000,
    })
    expect(pollAggregate(g.config, g.state).totalVotes).toBe(2)
  })
  it('replaces votes by stable identity and never awards correctness points', () => {
    const g = game('poll', createPollState, reducePoll)
    join(g)
    const [a, b] = g.config.options.map((row) => row.id)
    vote(g, a)
    vote(g, a, { actionId: 'vote-2' })
    expect(pollAggregate(g.config, g.state)).toMatchObject({
      totalVotes: 1,
      options: [
        { id: a, votes: 1 },
        { id: b, votes: 0 },
      ],
    })
    vote(g, b, { actionId: 'vote-3' })
    g.send('vote', { participantId: 'b', optionId: a, actionId: 'other' })
    expect(pollAggregate(g.config, g.state)).toMatchObject({
      totalVotes: 2,
      options: [
        { id: a, votes: 1 },
        { id: b, votes: 1 },
      ],
    })
    expect(g.state.score).toBeUndefined()
    expect(g.state.votes).toEqual([
      { participantId: 'a', optionId: b },
      { participantId: 'b', optionId: a },
    ])
  })
  it('honors locked vote and hidden results while reveal remains open for voting', () => {
    const g = game('poll', createPollState, reducePoll, {
      allowVoteChange: false,
      showResults: false,
    })
    join(g)
    const [a, b] = g.config.options.map((row) => row.id)
    vote(g, a)
    vote(g, b, { actionId: 'vote-2' })
    expect(g.state.lastResult.error).toBe('vote-change-disabled')
    expect(g.state.resultsVisible).toBe(false)
    g.send('reveal')
    expect(g.state.resultsVisible).toBe(true)
    g.send('vote', { participantId: 'b', optionId: b, actionId: 'other' })
    expect(pollAggregate(g.config, g.state).totalVotes).toBe(2)
    g.send('start')
    expect(pollAggregate(g.config, g.state).totalVotes).toBe(2)
  })
  it('validates active state then participant then option and rejects deadline submissions', () => {
    const g = game('poll', createPollState, reducePoll)
    vote(g, 'bad')
    expect(g.state.lastResult.error).toBe('poll-not-active')
    g.send('start')
    vote(g, 'bad')
    expect(g.state.lastResult.error).toBe('player-not-found')
    g.send('join', { participantId: 'a', name: 'A' })
    vote(g, 'bad')
    expect(g.state.lastResult.error).toBe('invalid-poll-option')
    vote(g, g.config.options[0].id, {}, 30000)
    expect(g.state.lastResult.error).toBe('poll-not-active')
    expect(pollAggregate(g.config, g.state).totalVotes).toBe(0)
  })
})

describe('word cloud deliberate actions', () => {
  it('ignores active Start without changing cloud receipts, quotas, round identity or expiry', () => {
    const g = game('word-cloud', createWordCloudState, reduceWordCloud, {
      maxSubmissionsPerPlayer: 1,
    })
    join(g)
    phrase(g, 'first', 'one')
    const active = g.state
    expect(g.send('start', {}, 10000)).toBe(active)
    expect(g.send('start', {}, 20000)).toBe(active)
    phrase(g, 'first', 'one', { roundId: active.roundId })
    expect(g.state.lastResult.ok).toBe(true)
    phrase(g, 'second', 'two', { roundId: active.roundId })
    expect(g.state.lastResult.error).toBe('word-cloud-rate-limit')
    expect(wordCloudAggregate(g.config, g.state)).toEqual({
      entries: [{ text: 'first', count: 1 }],
      totalSubmissions: 1,
    })
    g.send('expire', {}, active.deadline)
    expect(g.state.phase).toBe('ended')
    g.send('start', {}, 40000)
    expect(g.state).toMatchObject({
      phase: 'active',
      roundId: active.roundId + 1,
      deadline: 40000 + g.config.timerDuration * 1000,
      quotas: active.quotas,
      accepted: active.accepted,
    })
  })
  it('counts repeated phrases but deduplicates delivery and preserves quotas across start and rejoin', () => {
    const g = game('word-cloud', createWordCloudState, reduceWordCloud, {
      maxSubmissionsPerPlayer: 2,
    })
    join(g)
    phrase(g, '  ＣＡＴ\t  DOG ', 'one')
    phrase(g, 'cat dog', 'one')
    phrase(g, 'CAT DOG', 'two')
    expect(wordCloudAggregate(g.config, g.state)).toEqual({
      entries: [{ text: 'cat dog', count: 2 }],
      totalSubmissions: 2,
    })
    g.send('leave', { participantId: 'a' })
    g.send('join', { participantId: 'a', name: 'New name' })
    g.send('start')
    phrase(g, 'other', 'three')
    expect(g.state.lastResult.error).toBe('word-cloud-rate-limit')
    phrase(g, '   ', 'empty')
    expect(g.state.lastResult.error).toBe('empty-word-cloud-text')
    g.send('clear')
    phrase(g, 'other', 'three')
    expect(wordCloudAggregate(g.config, g.state)).toEqual({
      entries: [{ text: 'other', count: 1 }],
      totalSubmissions: 1,
    })
  })
  it('uses lowercase expansion before UTF16 slicing, deterministic sorting and display-only cap', () => {
    const g = game('word-cloud', createWordCloudState, reduceWordCloud, {
      maxPhraseLength: 1,
      displayLimit: 1,
    })
    join(g)
    phrase(g, '\u0130', 'one')
    phrase(g, 'z', 'two')
    phrase(g, 'a', 'three')
    expect(wordCloudAggregate(g.config, g.state)).toEqual({
      entries: [{ text: 'a', count: 1 }],
      totalSubmissions: 3,
    })
    expect(g.state.counts).toContainEqual({ text: 'i', count: 1 })
    const emoji = game('word-cloud', createWordCloudState, reduceWordCloud, { maxPhraseLength: 1 })
    join(emoji)
    phrase(emoji, '😀', 'one')
    expect(emoji.state.counts[0].text).toBe('\ud83d')
  })
  it('rejects reused identity with altered phrase and stale generation without consuming quota', () => {
    const g = game('word-cloud', createWordCloudState, reduceWordCloud)
    join(g)
    phrase(g, 'a', 'one')
    phrase(g, 'b', 'one')
    expect(g.state.lastResult.error).toBe('action-id-conflict')
    phrase(g, 'b', 'two', { generation: 7 })
    expect(wordCloudAggregate(g.config, g.state).totalSubmissions).toBe(1)
    const fresh = createWordCloudState(g.config)
    expect(fresh).toMatchObject({ counts: [], quotas: [], accepted: [], participants: [] })
  })
  it('clear invalidates delayed delivery without ending the active deadline', () => {
    const g = game('word-cloud', createWordCloudState, reduceWordCloud)
    join(g)
    phrase(g, 'old', 'one')
    const roundId = g.state.roundId,
      deadline = g.state.deadline
    g.send('clear')
    phrase(g, 'old', 'one', { roundId })
    expect(g.state.lastResult.error).toBe('stale-round')
    expect(g.state).toMatchObject({
      phase: 'active',
      deadline,
      counts: [],
      quotas: [],
      accepted: [],
    })
    phrase(g, 'new', 'two')
    expect(wordCloudAggregate(g.config, g.state)).toEqual({
      entries: [{ text: 'new', count: 1 }],
      totalSubmissions: 1,
    })
  })
})

describe('matching game mappings', () => {
  it('uses shared one-to-one assignment draft with cancellation and unchanged config', () => {
    const g = game('matching', createMatchingState, reduceMatching)
    const baseline = JSON.stringify(g.config)
    join(g)
    const [a, b] = g.config.pairs
    g.send('select', { sourceId: a.promptId })
    g.send('assign', { targetId: b.targetId })
    g.send('select', { sourceId: b.promptId })
    g.send('assign', { targetId: b.targetId })
    expect(g.state.assignment.assignments).toEqual([{ sourceId: a.promptId, targetId: b.targetId }])
    g.send('cancel')
    expect(g.state.assignment.selectedId).toBeNull()
    expect(JSON.stringify(g.config)).toBe(baseline)
  })
})

describe('submission lifecycle isolation', () => {
  const games = [
    ['poll', createPollState, reducePoll],
    ['word-cloud', createWordCloudState, reduceWordCloud],
    ['matching', createMatchingState, reduceMatching],
  ]
  it.each(games)(
    '%s rejects stale generation and restart timers while preserving authored config',
    (type, factory, reducer) => {
      const config = createDefaultGameConfig(type),
        baseline = JSON.stringify(config)
      const first = { ...factory(config), generation: 3 }
      const second = factory(config)
      const joined = reducer(config, first, { type: 'join', participantId: 'a', name: 'A' })
      const started = reducer(config, joined, { type: 'start' }, { now: 100 })
      const ended = reducer(config, started, { type: 'end' })
      const restarted = reducer(config, ended, { type: 'start' }, { now: 200 })
      expect(
        reducer(config, restarted, { type: 'expire', roundId: started.roundId }, { now: 999999 })
      ).toBe(restarted)
      expect(reducer(config, restarted, { type: 'reveal', generation: 2 })).toBe(restarted)
      expect(second).toMatchObject({
        participants: [],
        accepted: [],
        deadline: null,
        phase: 'idle',
      })
      expect(JSON.stringify(config)).toBe(baseline)
    }
  )
  it('matching validates active room then participant before malformed pairs', () => {
    const g = game('matching', createMatchingState, reduceMatching)
    g.send('submit', { participantId: 'bad', pairs: null, actionId: 'one' })
    expect(g.state.lastResult.error).toBe('matching-not-active')
    g.send('start')
    g.send('submit', { participantId: 'bad', pairs: null, actionId: 'one' })
    expect(g.state.lastResult.error).toBe('player-not-found')
    g.send('join', { participantId: 'a', name: 'A' })
    g.send('submit', { participantId: 'a', pairs: null, actionId: 'one' })
    expect(g.state.lastResult.error).toBe('invalid-matching-pairs')
  })
})
