import { test, expect } from '@playwright/test'
import { buildPublicAuthority } from './education-release-authority.js'
import { assertPublicPackets } from './education-release-redaction.js'

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
test('authored reveal is confined to its accepted version, identity and exact shape', () => {
  const { authority, packet } = fixture()
  inspect(authority, packet)
  for (const mutate of [
    (data) => {
      data.stateVersion = 4
    },
    (data) => {
      data.generation++
    },
    (data) => {
      data.roundId++
    },
    (data) => {
      data.roomInstanceId = 'elsewhere'
    },
    (data) => {
      data.gameType = 'hot-potato'
    },
    (data) => {
      data.revealed.question.answerKey.accepted = ['Mars']
    },
    (data) => {
      data.revealed.question.answerKey.rubric = 'private'
    },
    (data) => {
      data.revealed.solution = 'Earth'
    },
    (data) => {
      data.extra = { correctAnswer: 'Earth' }
    },
    (data) => {
      data.clue = { answer: 'Earth' }
    },
    (data) => {
      data.extra = { accepted: true }
    },
    (data) => {
      data.quiz.feedbackMode = 'deferred'
    },
    (data) => {
      data.extra = { Answer_Key_V2: question.answerKey }
    },
  ])
    rejects(authority, packet, mutate)
  rejects(authority, packet, (data) => {
    data.answerKey = data.revealed.question.answerKey
    data.revealed = null
  })
})
test('pre-reveal keys and secret tokens never gain authority from another public packet', () => {
  const { authority, packet } = fixture({ reveal: false })
  inspect(authority, packet)
  rejects(authority, packet, (data) => {
    data.revealed = { question: { answerKey: question.answerKey, explanation: 'Home' } }
  })
  rejects(authority, packet, (data) => {
    data.extra = { 'Correct-Index': 0 }
  })
  const revealed = fixture()
  for (const mutate of [
    (data) => {
      data.revealed.question.sessionToken = 'ada-secret'
    },
    (data) => {
      data.revealed.question.extra = 'lin-secret'
    },
    (data) => {
      data.notes = 'ada-secret'
    },
    (data) => {
      data.notes = 'host-session-secret'
    },
    (data) => {
      data.notes = 'host-capability-secret'
    },
    (data) => {
      data['host-session-secret'] = true
    },
    (data) => {
      data.extra = { hostKey: 'unknown-secret' }
    },
    (data) => {
      data.extra = { Presenter_Token: 'unknown-secret' }
    },
  ])
    rejects(revealed.authority, revealed.packet, mutate)
  inspect(authority, session('ada'), 0, 'game-session')
  rejects(
    authority,
    session('ada'),
    (data) => {
      data.playerId = 'lin'
    },
    0,
    'game-session'
  )
})
test('own terminal key requires this recipient accepted attempt, not packet terminal claims', () => {
  const { authority, packet } = fixture({ reveal: false, answer: { text: 'Earth' } })
  packet.ownSubmission = {
    commandId: 'submit',
    questionId: 'fill',
    attemptId: 'attempt',
    answer: { text: 'Earth' },
    result: { accepted: true, correct: true, terminal: true, message: 'Good' },
    reveal: { answerKey: question.answerKey, explanation: 'Home' },
  }
  inspect(authority, packet)
  rejects(authority, packet, () => {}, 1)
  rejects(authority, packet, (data) => {
    data.ownSubmission.attemptId = 'other'
  })
  rejects(authority, packet, (data) => {
    data.ownSubmission.answer.text = 'Mars'
  })
  rejects(authority, packet, (data) => {
    data.ownSubmission.reveal.answerKey.accepted = ['Mars']
  })
  const wrong = fixture({ reveal: false, answer: { text: 'Wrong' }, mode: 'deferred' })
  rejects(wrong.authority, { ...wrong.packet, ownSubmission: packet.ownSubmission }, () => {})
  const immediate = fixture({ reveal: false, answer: { text: 'Wrong' } })
  const retry = {
    ...immediate.packet,
    ownSubmission: {
      commandId: 'submit',
      questionId: 'fill',
      attemptId: 'attempt',
      answer: { text: 'Wrong' },
      result: { accepted: true, correct: false, terminal: false, message: 'Retry' },
    },
  }
  inspect(immediate.authority, retry)
  rejects(immediate.authority, retry, (data) => {
    data.ownSubmission.reveal = packet.ownSubmission.reveal
  })
  rejects(immediate.authority, retry, (data) => {
    data.ownSubmission.result.terminal = true
  })
})
test('terminal relay results do not authorize a private own reveal', () => {
  const { authority, packet } = fixture({
    reveal: false,
    answer: { text: 'Earth' },
    type: 'relay-race',
  })
  packet.ownSubmission = {
    commandId: 'submit',
    questionId: 'fill',
    attemptId: 'attempt',
    answer: { text: 'Earth' },
    result: { accepted: true, correct: true, terminal: true },
  }
  inspect(authority, packet)
  rejects(authority, packet, (data) => {
    data.ownSubmission.reveal = { answerKey: question.answerKey, explanation: 'Home' }
  })
})
test('public accepted receipt is boolean at a matched receipt path, not an answer list', () => {
  const { authority } = fixture({ reveal: false, answer: { text: 'Earth' } })
  const receipt = { ...identity, stateVersion: 3, commandId: 'submit', accepted: true }
  inspect(authority, receipt, 0, 'game-command-result')
  rejects(
    authority,
    receipt,
    (data) => {
      data.accepted = ['Earth']
    },
    0,
    'game-command-result'
  )
  rejects(
    authority,
    receipt,
    (data) => {
      data.result = { accepted: true, correct: false }
    },
    0,
    'game-command-result'
  )
  rejects(
    authority,
    receipt,
    (data) => {
      data.extra = { accepted: true }
    },
    0,
    'game-command-result'
  )
})
