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
