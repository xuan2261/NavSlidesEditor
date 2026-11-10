import { expect } from '@playwright/test'
import { buildPublicAuthority } from './education-release-authority.js'
import { assertPublicPackets } from './education-release-redaction.js'
export { identity, question, session, fixture, inspect, rejects }
const identity = { gameId: 'game', roomInstanceId: 'room', generation: 0, roundId: 1 }
const question = {
  id: 'fill',
  kind: 'fill-blank',
  prompt: 'Planet',
  points: 10,
  timeLimit: 30,
  answerKey: { accepted: ['Earth'], caseSensitive: false },
  feedback: { correct: 'Good', incorrect: 'Retry', explanation: 'Home' },
}
const state = (stateVersion, phase = 'active') => ({
  ...identity,
  stateVersion,
  gameType: 'quiz',
  phase,
  question,
  timeRemainingMs: 20000,
  players: [],
})
const session = (playerId) => ({
  ...identity,
  gameType: 'quiz',
  playerId,
  sessionToken: `${playerId}-secret`,
  isHost: false,
  role: 'player',
})
function fixture({ reveal = true, answer = null, mode = 'immediate', type = 'quiz' } = {}) {
  const hostWire = {
    incoming: [
      { name: 'game-round-state', data: state(2) },
      { name: 'game-round-state', data: state(3) },
      {
        name: 'game-session',
        data: { ...identity, sessionToken: 'host-session-secret', isHost: true },
      },
    ],
    outgoing: [{ name: 'game-join', data: { hostCapability: 'host-capability-secret' } }],
  }
  if (reveal) {
    hostWire.outgoing.push({ name: 'game-quiz-reveal', data: { ...identity, commandId: 'reveal' } })
    hostWire.incoming.push(
      {
        name: 'game-command-result',
        data: { ...identity, stateVersion: 5, commandId: 'reveal', accepted: true },
      },
      { name: 'game-round-state', data: state(5, 'review') }
    )
  }
  const wires = ['ada', 'lin'].map((id) => ({
    incoming: [{ name: 'game-session', data: { ...session(id), gameType: type } }],
    outgoing: [],
  }))
  if (answer) {
    wires[0].outgoing.push({
      name: type === 'relay-race' ? 'game-relay-answer' : 'game-answer',
      data: { ...identity, commandId: 'submit', questionId: 'fill', attemptId: 'attempt', answer },
    })
    wires[0].incoming.push({
      name: 'game-command-result',
      data: { ...identity, stateVersion: 3, commandId: 'submit', accepted: true },
    })
  }
  const journey = {
    type,
    config: { questions: [question], attemptLimit: 2, feedbackMode: mode },
    hostWire,
    wires,
  }
  return {
    authority: buildPublicAuthority(journey),
    packet: {
      ...identity,
      stateVersion: reveal ? 5 : 3,
      gameType: type,
      ...(type === 'quiz' ? { quiz: { feedbackMode: mode, attemptLimit: 2 } } : {}),
      revealed: reveal
        ? { question: { answerKey: question.answerKey, explanation: 'Home' } }
        : null,
    },
  }
}
function inspect(authority, data, recipient = 0, name = 'game-round-state') {
  assertPublicPackets(
    {
      wires: [
        recipient === 0 ? { incoming: [{ name, data }] } : { incoming: [] },
        recipient === 1 ? { incoming: [{ name, data }] } : { incoming: [] },
      ],
    },
    authority
  )
}
function rejects(authority, packet, mutate, recipient = 0, name) {
  const changed = structuredClone(packet)
  mutate(changed)
  expect(() => inspect(authority, changed, recipient, name)).toThrow()
}
