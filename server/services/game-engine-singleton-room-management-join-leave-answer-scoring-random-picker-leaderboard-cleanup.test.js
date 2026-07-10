/**
 * Unit tests for Game Engine (Phase 2).
 * Tests: GameEngine singleton — room management, player join/leave, answer scoring,
 * random picker, leaderboard, cleanup.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import GameEngine from './game-room-manager-singleton-service.js'

describe('GameEngine', () => {
  beforeEach(() => {
    GameEngine._reset()
  })

  afterEach(() => {
    GameEngine._reset()
  })

  describe('createRoom', () => {
    it('creates a room with waiting status', () => {
      const room = GameEngine.createRoom('slide1-el1', 'name-picker', { items: ['A', 'B'] })
      expect(room.status).toBe('waiting')
    })

    it('creates a room with correct gameType', () => {
      const room = GameEngine.createRoom('slide1-el1', 'hot-potato', { questions: [] })
      expect(room.gameType).toBe('hot-potato')
    })

    it('creates a room with empty players map', () => {
      const room = GameEngine.createRoom('slide1-el1', 'jeopardy', {})
      expect(room.players).toBeInstanceOf(Map)
      expect(room.players.size).toBe(0)
    })

    it('returns null when gameId already exists', () => {
      GameEngine.createRoom('slide1-el1', 'name-picker', {})
      const duplicate = GameEngine.createRoom('slide1-el1', 'hot-potato', {})
      expect(duplicate).toBeNull()
    })

    it('normalizes untrusted question timing and scoring bounds', () => {
      const room = GameEngine.createRoom('bounded', 'hot-potato', {
        questions: [
          { id: 'high', timeLimit: 9999, points: 100000 },
          { id: 'low', timeLimit: -1, points: -50 },
          { id: 'missing' },
          null,
        ],
      })

      expect(room.questions).toEqual([
        expect.objectContaining({ timeLimit: 300, points: 1000 }),
        expect.objectContaining({ timeLimit: 5, points: 1 }),
        expect.objectContaining({ points: 10 }),
      ])
    })
  })

  describe('joinRoom', () => {
    it('adds player to room', () => {
      GameEngine.createRoom('slide1-el1', 'hot-potato', {})
      const result = GameEngine.joinRoom('slide1-el1', 'socket-1', 'Alice')
      expect(result.ok).toBe(true)
      expect(result.players.size).toBe(1)
    })

    it('assigns score 0 to new player', () => {
      GameEngine.createRoom('slide1-el1', 'hot-potato', {})
      const result = GameEngine.joinRoom('slide1-el1', 'socket-1', 'Alice')
      expect(result.players.get('socket-1').score).toBe(0)
    })

    it('returns error for non-existent room', () => {
      const result = GameEngine.joinRoom('nonexistent', 'socket-1', 'Alice')
      expect(result.ok).toBe(false)
      expect(result.error).toBe('room-not-found')
    })

    it('tracks player name and answers', () => {
      GameEngine.createRoom('slide1-el1', 'hot-potato', {})
      const result = GameEngine.joinRoom('slide1-el1', 'socket-1', 'Bob')
      const player = result.players.get('socket-1')
      expect(player.name).toBe('Bob')
      expect(player.answers).toEqual([])
    })

    it('leaderboard includes the joining player with score 0', () => {
      GameEngine.createRoom('slide1-el1', 'hot-potato', {})
      const result = GameEngine.joinRoom('slide1-el1', 'socket-1', 'Alice')
      expect(result.leaderboard).toHaveLength(1)
      expect(result.leaderboard[0].name).toBe('Alice')
      expect(result.leaderboard[0].score).toBe(0)
    })
  })

  describe('submitAnswer (hot-potato quiz)', () => {
    it('awards points for correct answer', () => {
      const room = GameEngine.createRoom('slide1-el1', 'hot-potato', {
        questions: [{ id: 'q1', correctIndex: 0, points: 10 }],
      })
      room.currentQuestion = 0
      GameEngine.joinRoom('slide1-el1', 'socket-1', 'Alice')
      const result = GameEngine.submitAnswer('slide1-el1', 'socket-1', 0, 5000)
      expect(result.correct).toBe(true)
      expect(result.points).toBe(10)
      expect(result.totalScore).toBe(10)
    })

    it('returns correct=false for wrong answer', () => {
      const room = GameEngine.createRoom('slide1-el1', 'hot-potato', {
        questions: [{ id: 'q1', correctIndex: 0, points: 10 }],
      })
      room.currentQuestion = 0
      GameEngine.joinRoom('slide1-el1', 'socket-1', 'Alice')
      const result = GameEngine.submitAnswer('slide1-el1', 'socket-1', 1, 5000)
      expect(result.correct).toBe(false)
      expect(result.points).toBe(0)
    })

    it('awards speed bonus for fast answers', () => {
      const room = GameEngine.createRoom('slide1-el1', 'hot-potato', {
        questions: [{ id: 'q1', correctIndex: 0, points: 10, timeLimit: 30 }],
      })
      room.currentQuestion = 0
      GameEngine.joinRoom('slide1-el1', 'socket-1', 'Alice')
      const result = GameEngine.submitAnswer('slide1-el1', 'socket-1', 0, 1000)
      expect(result.correct).toBe(true)
      // Speed bonus: 10 * (remaining_time / timeLimit) rounded
      expect(result.points).toBeGreaterThan(10)
    })

    it('records answer in player history', () => {
      const room = GameEngine.createRoom('slide1-el1', 'hot-potato', {
        questions: [{ id: 'q1', correctIndex: 0, points: 10 }],
      })
      room.currentQuestion = 0
      GameEngine.joinRoom('slide1-el1', 'socket-1', 'Alice')
      GameEngine.submitAnswer('slide1-el1', 'socket-1', 0, 5000)
      const room2 = GameEngine.getRoom('slide1-el1')
      const player = room2.players.get('socket-1')
      expect(player.answers).toHaveLength(1)
      expect(player.answers[0]).toMatchObject({ questionId: 'q1', correct: true })
    })

    it('returns error for non-existent room', () => {
      const result = GameEngine.submitAnswer('nonexistent', 'socket-1', 0, 5000)
      expect(result).toBeNull()
    })
  })

  describe('triggerRandom (name-picker)', () => {
    it('returns valid index within items range', () => {
      GameEngine.createRoom('slide1-el1', 'name-picker', {
        items: ['A', 'B', 'C'],
        excludeAfterPick: false,
      })
      const winner = GameEngine.triggerRandom('slide1-el1')
      expect([0, 1, 2]).toContain(winner)
    })

    it('excludes picked items when excludeAfterPick=true', () => {
      GameEngine.createRoom('slide1-el1', 'name-picker', {
        items: ['A', 'B', 'C'],
        excludeAfterPick: true,
      })
      // After picking 2, only 1 item remains (can't pick the same index twice)
      GameEngine.triggerRandom('slide1-el1')
      GameEngine.triggerRandom('slide1-el1')
      const room = GameEngine.getRoom('slide1-el1')
      expect(room.items).toHaveLength(1)
    })

    it('returns -1 when no items remain', () => {
      GameEngine.createRoom('slide1-el1', 'name-picker', {
        items: ['A'],
        excludeAfterPick: true,
      })
      GameEngine.triggerRandom('slide1-el1')
      const result = GameEngine.triggerRandom('slide1-el1')
      expect(result).toBe(-1)
    })

    it('returns null for non-existent room', () => {
      const result = GameEngine.triggerRandom('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('nextQuestion', () => {
    it('advances currentQuestion index', () => {
      GameEngine.createRoom('slide1-el1', 'hot-potato', {
        questions: [
          { id: 'q1', correctIndex: 0, points: 10 },
          { id: 'q2', correctIndex: 1, points: 20 },
        ],
      })
      const r1 = GameEngine.nextQuestion('slide1-el1')
      expect(r1.currentQuestion).toBe(1)
      const r2 = GameEngine.nextQuestion('slide1-el1')
      expect(r2.currentQuestion).toBe(2)
    })

    it('returns null for non-existent room', () => {
      const result = GameEngine.nextQuestion('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('endGame', () => {
    it('sets room status to finished', () => {
      GameEngine.createRoom('slide1-el1', 'hot-potato', {})
      const result = GameEngine.endGame('slide1-el1')
      expect(result.status).toBe('finished')
    })

    it('returns null for non-existent room', () => {
      const result = GameEngine.endGame('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('getLeaderboard', () => {
    it('returns players sorted by score descending', () => {
      GameEngine.createRoom('slide1-el1', 'hot-potato', {
        questions: [{ id: 'q1', correctIndex: 0, points: 10 }],
      })
      GameEngine.joinRoom('slide1-el1', 'socket-1', 'Alice')
      GameEngine.joinRoom('slide1-el1', 'socket-2', 'Bob')
      GameEngine.joinRoom('slide1-el1', 'socket-3', 'Carol')

      GameEngine.submitAnswer('slide1-el1', 'socket-1', 0, 15000) // Alice: 10 base pts, small speed bonus
      GameEngine.submitAnswer('slide1-el1', 'socket-2', 0, 500)  // Bob: 10 base pts, high speed bonus → more points
      GameEngine.submitAnswer('slide1-el1', 'socket-3', 1, 1000) // Carol: 0pts

      const lb = GameEngine.getLeaderboard('slide1-el1')
      expect(lb).toHaveLength(3)
      expect(lb[0].score).toBeGreaterThanOrEqual(lb[1].score)
      expect(lb[1].score).toBeGreaterThanOrEqual(lb[2].score)
    })

    it('returns null for non-existent room', () => {
      const result = GameEngine.getLeaderboard('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('leaveRoom', () => {
    it('removes player from room', () => {
      GameEngine.createRoom('slide1-el1', 'hot-potato', {})
      GameEngine.joinRoom('slide1-el1', 'socket-1', 'Alice')
      GameEngine.joinRoom('slide1-el1', 'socket-2', 'Bob')

      const result = GameEngine.leaveRoom('slide1-el1', 'socket-1')
      expect(result.ok).toBe(true)
      expect(result.players.size).toBe(1)
      expect(result.players.has('socket-1')).toBe(false)
    })

    it('returns error for non-existent room', () => {
      const result = GameEngine.leaveRoom('nonexistent', 'socket-1')
      expect(result.ok).toBe(false)
      expect(result.error).toBe('room-not-found')
    })
  })

  describe('poll subtype', () => {
    it('stores poll votes outside player answer history and broadcasts aggregate only', () => {
      GameEngine.createRoom('poll-1', 'poll', {
        prompt: 'Choose one',
        options: [
          { id: 'a', text: 'Alpha' },
          { id: 'b', text: 'Beta' },
        ],
      })
      GameEngine.getRoom('poll-1').status = 'active'
      GameEngine.joinRoom('poll-1', 'player-1', 'Alice', { socketId: 'socket-1' })

      const result = GameEngine.submitPollVote('poll-1', 'player-1', 'a', { socketId: 'socket-1' })

      expect(result.ok).toBe(true)
      expect(result.aggregate).toEqual({
        prompt: 'Choose one',
        options: [
          { id: 'a', text: 'Alpha', votes: 1 },
          { id: 'b', text: 'Beta', votes: 0 },
        ],
        totalVotes: 1,
      })
      expect(GameEngine.getRoom('poll-1').players.get('player-1').answers).toEqual([])
    })

    it('uses last-write-wins when a poll player changes votes', () => {
      GameEngine.createRoom('poll-1', 'poll', {
        options: [
          { id: 'a', text: 'Alpha' },
          { id: 'b', text: 'Beta' },
        ],
      })
      GameEngine.getRoom('poll-1').status = 'active'
      GameEngine.joinRoom('poll-1', 'player-1', 'Alice', { socketId: 'socket-1' })

      GameEngine.submitPollVote('poll-1', 'player-1', 'a', { socketId: 'socket-1' })
      const result = GameEngine.submitPollVote('poll-1', 'player-1', 'b', { socketId: 'socket-1' })

      expect(result.aggregate.options).toEqual([
        { id: 'a', text: 'Alpha', votes: 0 },
        { id: 'b', text: 'Beta', votes: 1 },
      ])
      expect(result.aggregate.totalVotes).toBe(1)
    })

    it('rejects stale poll submissions from an old socket session', () => {
      GameEngine.createRoom('poll-1', 'poll', {
        options: [{ id: 'a', text: 'Alpha' }],
      })
      GameEngine.getRoom('poll-1').status = 'active'
      GameEngine.joinRoom('poll-1', 'player-1', 'Alice', { socketId: 'socket-2' })

      const result = GameEngine.submitPollVote('poll-1', 'player-1', 'a', { socketId: 'socket-1' })

      expect(result).toEqual({ ok: false, error: 'stale-player-session' })
      expect(GameEngine.getPollAggregate('poll-1').totalVotes).toBe(0)
    })

    it('preserves poll identity through disconnect and reconnect without duplicate votes', () => {
      GameEngine.createRoom('poll-1', 'poll', {
        options: [
          { id: 'a', text: 'Alpha' },
          { id: 'b', text: 'Beta' },
        ],
      })
      GameEngine.getRoom('poll-1').status = 'active'
      GameEngine.joinRoom('poll-1', 'player-1', 'Alice', { socketId: 'socket-1' })
      GameEngine.submitPollVote('poll-1', 'player-1', 'a', { socketId: 'socket-1' })
      GameEngine.disconnectRoom('poll-1', 'player-1', 'socket-1')
      GameEngine.joinRoom('poll-1', 'player-1', 'Alice', { socketId: 'socket-2' })
      const result = GameEngine.submitPollVote('poll-1', 'player-1', 'b', { socketId: 'socket-2' })

      expect(result.aggregate.options).toEqual([
        { id: 'a', text: 'Alpha', votes: 0 },
        { id: 'b', text: 'Beta', votes: 1 },
      ])
      expect(result.aggregate.totalVotes).toBe(1)
    })

    it('rejects poll votes before the host starts the poll', () => {
      GameEngine.createRoom('poll-1', 'poll', {
        options: [{ id: 'a', text: 'Alpha' }],
      })
      GameEngine.joinRoom('poll-1', 'player-1', 'Alice', { socketId: 'socket-1' })

      const result = GameEngine.submitPollVote('poll-1', 'player-1', 'a', { socketId: 'socket-1' })

      expect(result).toEqual({ ok: false, error: 'poll-not-active' })
      expect(GameEngine.getPollAggregate('poll-1').totalVotes).toBe(0)
    })
  })

  describe('word-cloud subtype', () => {
    it('normalizes text, aggregates counts, and keeps player answer history empty', () => {
      GameEngine.createRoom('cloud-1', 'word-cloud', {
        prompt: 'Describe it',
      })
      GameEngine.getRoom('cloud-1').status = 'active'
      GameEngine.joinRoom('cloud-1', 'player-1', 'Alice', { socketId: 'socket-1' })
      GameEngine.joinRoom('cloud-1', 'player-2', 'Bob', { socketId: 'socket-2' })

      GameEngine.submitWordCloudText('cloud-1', 'player-1', '  Quantum   Field  ', { socketId: 'socket-1' })
      const result = GameEngine.submitWordCloudText('cloud-1', 'player-2', 'quantum field', { socketId: 'socket-2' })

      expect(result.ok).toBe(true)
      expect(result.aggregate).toEqual({
        prompt: 'Describe it',
        entries: [{ text: 'quantum field', count: 2 }],
        totalSubmissions: 2,
      })
      expect(GameEngine.getRoom('cloud-1').players.get('player-1').answers).toEqual([])
    })

    it('bounds word cloud text to 40 characters', () => {
      GameEngine.createRoom('cloud-1', 'word-cloud', {})
      GameEngine.getRoom('cloud-1').status = 'active'
      GameEngine.joinRoom('cloud-1', 'player-1', 'Alice', { socketId: 'socket-1' })

      const result = GameEngine.submitWordCloudText(
        'cloud-1',
        'player-1',
        'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz',
        { socketId: 'socket-1' }
      )

      expect(result.text).toHaveLength(40)
      expect(result.aggregate.entries[0].text).toHaveLength(40)
    })

    it('rejects more than 5 word cloud submissions per player', () => {
      GameEngine.createRoom('cloud-1', 'word-cloud', {})
      GameEngine.getRoom('cloud-1').status = 'active'
      GameEngine.joinRoom('cloud-1', 'player-1', 'Alice', { socketId: 'socket-1' })

      for (let i = 0; i < 5; i++) {
        expect(GameEngine.submitWordCloudText('cloud-1', 'player-1', `word ${i}`, { socketId: 'socket-1' }).ok).toBe(true)
      }
      const result = GameEngine.submitWordCloudText('cloud-1', 'player-1', 'word 6', { socketId: 'socket-1' })

      expect(result).toEqual({ ok: false, error: 'word-cloud-rate-limit' })
      expect(GameEngine.getWordCloudAggregate('cloud-1').totalSubmissions).toBe(5)
    })

    it('keeps word cloud submission limit across leave and rejoin for the same player', () => {
      GameEngine.createRoom('cloud-1', 'word-cloud', {})
      GameEngine.getRoom('cloud-1').status = 'active'
      GameEngine.joinRoom('cloud-1', 'player-1', 'Alice', { socketId: 'socket-1' })

      for (let i = 0; i < 5; i++) {
        GameEngine.submitWordCloudText('cloud-1', 'player-1', `word ${i}`, { socketId: 'socket-1' })
      }
      GameEngine.leaveRoom('cloud-1', 'player-1')
      GameEngine.joinRoom('cloud-1', 'player-1', 'Alice', { socketId: 'socket-2' })

      expect(GameEngine.submitWordCloudText('cloud-1', 'player-1', 'extra', { socketId: 'socket-2' })).toEqual({
        ok: false,
        error: 'word-cloud-rate-limit',
      })
    })

    it('normalizes word cloud text with runtime-locale-independent lowercasing', () => {
      GameEngine.createRoom('cloud-1', 'word-cloud', {})
      GameEngine.getRoom('cloud-1').status = 'active'
      GameEngine.joinRoom('cloud-1', 'player-1', 'Alice', { socketId: 'socket-1' })

      const result = GameEngine.submitWordCloudText('cloud-1', 'player-1', 'MIXED Case', {
        socketId: 'socket-1',
      })

      expect(result.text).toBe('mixed case')
      expect(result.aggregate.entries[0]).toEqual({ text: 'mixed case', count: 1 })
    })

    it('applies the 40-character word cloud bound after lowercase expansion', () => {
      GameEngine.createRoom('cloud-1', 'word-cloud', {})
      GameEngine.getRoom('cloud-1').status = 'active'
      GameEngine.joinRoom('cloud-1', 'player-1', 'Alice', { socketId: 'socket-1' })

      const result = GameEngine.submitWordCloudText('cloud-1', 'player-1', 'İ'.repeat(40), {
        socketId: 'socket-1',
      })

      expect(result.text.length).toBeLessThanOrEqual(40)
      expect(result.aggregate.entries[0].text.length).toBeLessThanOrEqual(40)
    })

    it('sorts equal-count word cloud entries deterministically by text', () => {
      GameEngine.createRoom('cloud-1', 'word-cloud', {})
      GameEngine.getRoom('cloud-1').status = 'active'
      GameEngine.joinRoom('cloud-1', 'player-1', 'Alice', { socketId: 'socket-1' })

      GameEngine.submitWordCloudText('cloud-1', 'player-1', 'banana', { socketId: 'socket-1' })
      const result = GameEngine.submitWordCloudText('cloud-1', 'player-1', 'apple', { socketId: 'socket-1' })

      expect(result.aggregate.entries.map((entry) => entry.text)).toEqual(['apple', 'banana'])
    })

    it('rejects stale word cloud submissions and submissions before start', () => {
      GameEngine.createRoom('cloud-1', 'word-cloud', {})
      GameEngine.joinRoom('cloud-1', 'player-1', 'Alice', { socketId: 'socket-2' })

      expect(GameEngine.submitWordCloudText('cloud-1', 'player-1', 'early', { socketId: 'socket-2' })).toEqual({
        ok: false,
        error: 'word-cloud-not-active',
      })

      GameEngine.getRoom('cloud-1').status = 'active'
      expect(GameEngine.submitWordCloudText('cloud-1', 'player-1', 'late', { socketId: 'socket-1' })).toEqual({
        ok: false,
        error: 'stale-player-session',
      })
    })

    it('clears word cloud aggregate and per-player rate limits', () => {
      GameEngine.createRoom('cloud-1', 'word-cloud', {})
      GameEngine.getRoom('cloud-1').status = 'active'
      GameEngine.joinRoom('cloud-1', 'player-1', 'Alice', { socketId: 'socket-1' })
      GameEngine.submitWordCloudText('cloud-1', 'player-1', 'alpha', { socketId: 'socket-1' })

      const aggregate = GameEngine.clearWordCloud('cloud-1')

      expect(aggregate).toMatchObject({ entries: [], totalSubmissions: 0 })
      expect(GameEngine.submitWordCloudText('cloud-1', 'player-1', 'beta', { socketId: 'socket-1' }).ok).toBe(true)
    })
  })

  describe('matching subtype', () => {
    const matchingOptions = {
      prompt: 'Match terms',
      pairs: [
        { promptId: 'p-http', prompt: 'HTTP', targetId: 't-protocol', target: 'Protocol' },
        { promptId: 'p-tls', prompt: 'TLS', targetId: 't-security', target: 'Security' },
        { promptId: 'p-dns', prompt: 'DNS', targetId: 't-name', target: 'Name service' },
      ],
    }

    it('scores correct, partial, and incorrect matching submissions deterministically', () => {
      GameEngine.createRoom('match-1', 'matching', matchingOptions)
      GameEngine.getRoom('match-1').status = 'active'
      GameEngine.joinRoom('match-1', 'player-1', 'Alice', { socketId: 'socket-1' })
      GameEngine.joinRoom('match-1', 'player-2', 'Bob', { socketId: 'socket-2' })
      GameEngine.joinRoom('match-1', 'player-3', 'Cara', { socketId: 'socket-3' })

      const correct = GameEngine.submitMatchingPairs('match-1', 'player-1', [
        { promptId: 'p-http', targetId: 't-protocol' },
        { promptId: 'p-tls', targetId: 't-security' },
        { promptId: 'p-dns', targetId: 't-name' },
      ], { socketId: 'socket-1' })
      const partial = GameEngine.submitMatchingPairs('match-1', 'player-2', [
        { promptId: 'p-http', targetId: 't-protocol' },
        { promptId: 'p-tls', targetId: 't-name' },
        { promptId: 'p-dns', targetId: 't-security' },
      ], { socketId: 'socket-2' })
      const incorrect = GameEngine.submitMatchingPairs('match-1', 'player-3', [
        { promptId: 'p-http', targetId: 't-name' },
        { promptId: 'p-tls', targetId: 't-protocol' },
        { promptId: 'p-dns', targetId: 't-security' },
      ], { socketId: 'socket-3' })

      expect(correct).toEqual(expect.objectContaining({ ok: true, score: 3, total: 3, correct: true }))
      expect(partial).toEqual(expect.objectContaining({ ok: true, score: 1, total: 3, correct: false }))
      expect(incorrect).toEqual(expect.objectContaining({ ok: true, score: 0, total: 3, correct: false }))
      expect(GameEngine.getRoom('match-1').players.get('player-1').answers).toEqual([])
      expect(GameEngine.getMatchingState('match-1')).toEqual(expect.objectContaining({ submissions: 3 }))
    })

    it('rejects stale sessions, unknown ids, duplicate prompts, and inactive matching games', () => {
      GameEngine.createRoom('match-1', 'matching', matchingOptions)
      GameEngine.joinRoom('match-1', 'player-1', 'Alice', { socketId: 'socket-2' })

      expect(GameEngine.submitMatchingPairs('match-1', 'player-1', [
        { promptId: 'p-http', targetId: 't-protocol' },
      ], { socketId: 'socket-2' })).toEqual({ ok: false, error: 'matching-not-active' })

      GameEngine.getRoom('match-1').status = 'active'
      expect(GameEngine.submitMatchingPairs('match-1', 'player-1', [
        { promptId: 'p-http', targetId: 't-protocol' },
      ], { socketId: 'socket-1' })).toEqual({ ok: false, error: 'stale-player-session' })

      expect(GameEngine.submitMatchingPairs('match-1', 'player-1', [
        { promptId: 'p-http', targetId: 'unknown-target' },
      ], { socketId: 'socket-2' })).toEqual({ ok: false, error: 'invalid-matching-pairs' })

      expect(GameEngine.submitMatchingPairs('match-1', 'player-1', [
        { promptId: 'p-http', targetId: 't-protocol' },
        { promptId: 'p-http', targetId: 't-security' },
      ], { socketId: 'socket-2' })).toEqual({ ok: false, error: 'invalid-matching-pairs' })

      expect(GameEngine.submitMatchingPairs('match-1', 'player-1', [
        { promptId: 'p-http', targetId: 't-protocol' },
        { promptId: 'p-tls', targetId: 't-protocol' },
      ], { socketId: 'socket-2' })).toEqual({ ok: false, error: 'invalid-matching-pairs' })
    })

    it('reveals answer ids only when requested', () => {
      GameEngine.createRoom('match-1', 'matching', matchingOptions)

      expect(GameEngine.getMatchingState('match-1').answerKey).toBeUndefined()
      expect(GameEngine.getMatchingState('match-1').targets.map((target) => target.id)).toEqual([
        't-security',
        't-name',
        't-protocol',
      ])
      expect(GameEngine.getMatchingState('match-1', { revealed: true }).answerKey).toEqual([
        { promptId: 'p-http', targetId: 't-protocol' },
        { promptId: 'p-tls', targetId: 't-security' },
        { promptId: 'p-dns', targetId: 't-name' },
      ])
    })
  })

  describe('cleanup', () => {
    it('removes room from storage', () => {
      GameEngine.createRoom('slide1-el1', 'hot-potato', {})
      GameEngine.cleanup('slide1-el1')
      expect(GameEngine.getRoom('slide1-el1')).toBeUndefined()
    })
  })

  describe('multiple simultaneous games', () => {
    it('does not conflict between game IDs', () => {
      GameEngine.createRoom('slide1-el1', 'name-picker', { items: ['A', 'B'] })
      GameEngine.createRoom('slide2-el3', 'hot-potato', { questions: [] })

      GameEngine.joinRoom('slide1-el1', 'socket-1', 'Alice')
      GameEngine.joinRoom('slide2-el3', 'socket-2', 'Bob')

      const room1 = GameEngine.getRoom('slide1-el1')
      const room2 = GameEngine.getRoom('slide2-el3')

      expect(room1.players.size).toBe(1)
      expect(room2.players.size).toBe(1)
      expect(room1.gameType).toBe('name-picker')
      expect(room2.gameType).toBe('hot-potato')
    })
  })
})
