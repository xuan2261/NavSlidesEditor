// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { engine, fixture } from './game-authority-test-fixture'
afterEach(() => engine._reset())
describe('preserved engagement authority', () => {
  it('updates a poll vote without increasing total and retains identity on reconnect', () => {
    const f = fixture('poll', {
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
    })
    f.join()
    expect(f.command('game-poll-submit', { optionId: 'a' }, 'learner').error).toBe(
      'poll-not-active'
    )
    f.command('game-poll-start')
    f.command('game-poll-submit', { optionId: 'a' }, 'learner')
    f.join('learner', 'Learner', { socketId: 'new' })
    f.command('game-poll-submit', { optionId: 'b' }, 'learner')
    expect(engine.getPollAggregate('room')).toMatchObject({
      totalVotes: 1,
      options: [
        { id: 'a', votes: 0 },
        { id: 'b', votes: 1 },
      ],
    })
    expect(f.room.players.get('learner').answers).toEqual([])
    engine.leaveRoom('room', 'learner', { ...f.playerActors.get('learner'), requireSession: true })
    expect(engine.getPollAggregate('room').totalVotes).toBe(0)
  })
  it('keeps domain action receipts actor-scoped even when valid IDs contain separators', () => {
    const f = fixture('poll', {
      options: [
        { id: 'one', text: 'One' },
        { id: 'two', text: 'Two' },
      ],
    })
    f.join('a:b')
    f.join('a')
    f.command('game-poll-start')
    const first = f.command(
      'game-poll-submit',
      { commandId: 'c', optionId: f.room.config.options[0].id },
      'a:b'
    )
    const second = f.command(
      'game-poll-submit',
      { commandId: 'b:c', optionId: f.room.config.options[1].id },
      'a'
    )
    expect(first.accepted).toBe(true)
    expect(second.accepted).toBe(true)
    expect(engine.getPollAggregate('room').totalVotes).toBe(2)
    expect(engine.getPollAggregate('room').options.map((option) => option.votes)).toEqual([1, 1])
  })
  it('enforces authored disabled vote changes and safe reveal', () => {
    const f = fixture('poll', { allowVoteChange: false })
    f.join()
    f.command('game-poll-start')
    f.command('game-poll-submit', { optionId: f.room.config.options[0].id }, 'learner')
    expect(
      f.command('game-poll-submit', { optionId: f.room.config.options[1].id }, 'learner').error
    ).toBe('vote-change-disabled')
    expect(f.command('game-poll-reveal', {}, 'learner').error).toBe('host-only')
    expect(engine.getPublicState('room').poll.allowChangeVote).toBe(false)
  })
  it('normalizes cloud phrases, tie orders, quotas and lowercase expansion boundaries', () => {
    const f = fixture('word-cloud')
    f.join()
    f.join('other')
    f.command('game-word-cloud-start')
    f.command('game-word-cloud-submit', { text: '  Quantum   Field ' }, 'learner')
    f.command('game-word-cloud-submit', { text: 'QUANTUM FIELD' }, 'other')
    expect(engine.getWordCloudAggregate('room').entries).toEqual([
      { text: 'quantum field', count: 2 },
    ])
    f.command('game-word-cloud-submit', { text: 'banana' }, 'learner')
    f.command('game-word-cloud-submit', { text: 'apple' }, 'learner')
    const result = f.command('game-word-cloud-submit', { text: 'İ'.repeat(40) }, 'learner')
    expect(result.result.text.length).toBeLessThanOrEqual(40)
    expect(
      engine
        .getWordCloudAggregate('room')
        .entries.filter((row) => row.count === 1)
        .map((row) => row.text)
    ).toEqual(['apple', 'banana', result.result.text].sort())
    f.command('game-word-cloud-submit', { text: 'fifth' }, 'learner')
    expect(f.command('game-word-cloud-submit', { text: 'sixth' }, 'learner').error).toBe(
      'word-cloud-rate-limit'
    )
    engine.leaveRoom('room', 'learner')
    f.join('learner')
    expect(f.command('game-word-cloud-submit', { text: 'extra' }, 'learner').error).toBe(
      'word-cloud-rate-limit'
    )
    f.command('game-word-cloud-clear')
    expect(engine.getWordCloudAggregate('room')).toMatchObject({ entries: [], totalSubmissions: 0 })
    expect(engine.getPublicState('room', 'learner').ownSubmission).toBeNull()
    expect(f.command('game-word-cloud-submit', { text: 'fresh' }, 'learner').accepted).toBe(true)
  })
  it('does not reactivate an ended engagement room through a delayed learner submit or host clear', () => {
    const f = fixture('word-cloud')
    f.join()
    f.command('game-word-cloud-start')
    f.command('game-end')
    expect(f.command('game-word-cloud-submit', { text: 'late' }, 'learner').error).toBe(
      'game-ended'
    )
    expect(f.command('game-word-cloud-clear').error).toBe('game-ended')
    expect(f.room.status).toBe('finished')
    expect(engine.getWordCloudAggregate('room').totalSubmissions).toBe(0)
  })
  it('rejects oversized cloud input and preserves inactive/stale membership errors', () => {
    const f = fixture('word-cloud')
    f.join()
    expect(f.command('game-word-cloud-submit', { text: 'early' }, 'learner').error).toBe(
      'word-cloud-not-active'
    )
    f.command('game-word-cloud-start')
    expect(f.command('game-word-cloud-submit', { text: 'x'.repeat(41) }, 'learner').error).toBe(
      'invalid-word-cloud-text'
    )
    const old = f.playerActors.get('learner')
    f.join('learner', 'Learner', { socketId: 'new' })
    expect(engine.command('game-word-cloud-submit', f.envelope({ text: 'stale' }), old).error).toBe(
      'stale-player-session'
    )
  })
  it('preserves stable matching pair scoring, bijection validation and controlled reveal', () => {
    const pairs = [
      { promptId: 'p1', prompt: 'A', targetId: 't1', target: 'a' },
      { promptId: 'p2', prompt: 'B', targetId: 't2', target: 'b' },
      { promptId: 'p3', prompt: 'C', targetId: 't3', target: 'c' },
    ]
    const f = fixture('matching', { pairs })
    f.join()
    f.join('partial')
    f.join('wrong')
    expect(f.command('game-matching-submit', { pairs: [] }, 'learner').error).toBe(
      'matching-not-active'
    )
    f.command('game-matching-start')
    const submit = (ids, playerId) =>
      f.command(
        'game-matching-submit',
        { pairs: ids.map((targetId, i) => ({ promptId: `p${i + 1}`, targetId })) },
        playerId
      )
    expect(submit(['t1', 't2', 't3'], 'learner').result).toMatchObject({
      score: 3,
      total: 3,
      correct: true,
    })
    expect(submit(['t1', 't3', 't2'], 'partial').result.score).toBe(1)
    expect(submit(['t3', 't1', 't2'], 'wrong').result.score).toBe(0)
    expect(submit(['unknown'], 'wrong').error).toBe('invalid-matching-pairs')
    expect(submit(['t1', 't1'], 'wrong').error).toBe('invalid-matching-pairs')
    expect(
      f.command(
        'game-matching-submit',
        {
          pairs: [
            { promptId: 'p1', targetId: 't1' },
            { promptId: 'p1', targetId: 't2' },
          ],
        },
        'wrong'
      ).error
    ).toBe('invalid-matching-pairs')
    expect(engine.getMatchingState('room')).not.toHaveProperty('answerKey')
    expect(f.room.players.get('learner').answers).toEqual([])
    f.command('game-matching-reveal')
    expect(engine.getMatchingState('room').answerKey).toEqual(
      pairs.map(({ promptId, targetId }) => ({ promptId, targetId }))
    )
    f.command('game-reset')
    f.command('game-matching-start')
    expect(engine.getMatchingState('room')).toMatchObject({ submissions: 0 })
    expect(engine.getMatchingState('room')).not.toHaveProperty('answerKey')
  })
})
