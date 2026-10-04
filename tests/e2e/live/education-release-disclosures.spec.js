import { test, expect } from '@playwright/test'
import { buildPublicAuthority } from './education-release-authority.js'
import { assertPublicPackets } from './education-release-redaction.js'
import { sharedProjection, assertRecipientMetadata } from './education-release-agreement.js'
const room = { gameId: 'game', roomInstanceId: 'room', generation: 0, roundId: 1 }
const packet = (stateVersion, extra = {}) => ({ ...room, stateVersion, ...extra })
function command(wire, event, commandId, stateVersion, fields = {}, result = {}) {
  wire.outgoing.push({ name: event, data: packet(stateVersion - 1, { commandId, ...fields }) })
  wire.incoming.push({
    name: 'game-command-result',
    data: packet(stateVersion, { commandId, accepted: true, result }),
  })
}
function journey(type, config) {
  const hostWire = {
    incoming: [
      {
        name: 'game-session',
        data: {
          ...room,
          gameType: type,
          playerId: 'host',
          sessionToken: 'host-token',
          isHost: true,
          role: 'host',
        },
      },
    ],
    outgoing: [],
  }
  const wires = ['ada', 'lin'].map((playerId) => ({
    outgoing: [],
    incoming: [
      {
        name: 'game-session',
        data: {
          ...room,
          playerId,
          sessionToken: `${playerId}-token`,
          isHost: false,
          role: 'player',
          gameType: type,
        },
      },
    ],
  }))
  return { type, config, hostWire, wires }
}
function inspect(authority, data, recipient = 0, name = 'game-round-state') {
  assertPublicPackets(
    {
      wires: authority.recipients.map((_, index) => ({
        incoming: index === recipient ? [{ name, data }] : [],
      })),
    },
    authority
  )
}
function denied(authority, data, mutate, recipient = 0, name) {
  const copy = structuredClone(data)
  mutate(copy)
  expect(() => inspect(authority, copy, recipient, name)).toThrow()
}
test('matching key uses authored stable pairs, not another learner projection', () => {
  const pairs = [{ promptId: 'http', prompt: 'HTTP', targetId: 'protocol', target: 'Protocol' }]
  const run = journey('matching', { pairs })
  run.hostWire.incoming.push({ name: 'game-round-state', data: packet(2, { phase: 'active' }) })
  command(run.wires[0], 'game-matching-submit', 'submit', 3, {
    pairs: [{ promptId: 'http', targetId: 'protocol' }],
  })
  command(run.hostWire, 'game-matching-reveal', 'reveal', 5)
  run.hostWire.incoming.push({ name: 'game-round-state', data: packet(5, { phase: 'active' }) })
  const authority = buildPublicAuthority(run),
    key = [{ promptId: 'http', targetId: 'protocol' }]
  const before = packet(3, {
    gameType: 'matching',
    ownSubmission: { commandId: 'submit', pairs: key, correct: true },
    revealed: null,
  })
  inspect(authority, before)
  denied(authority, before, (data) => {
    data.revealed = { answerKey: key }
  })
  denied(authority, before, () => {}, 1)
  const revealed = packet(5, { revealed: { answerKey: key }, matching: { answerKey: key } })
  inspect(authority, revealed)
  denied(authority, revealed, (data) => {
    data.matching.answerKey[0].targetId = 'wrong'
  })
  denied(authority, revealed, (data) => {
    data.revealed.answerKey[0].correctAnswer = 'HTTP'
  })
  const hydration = packet(5, { answerKey: key })
  inspect(authority, hydration, 1, 'game-matching-started')
  denied(
    authority,
    hydration,
    (data) => {
      data.stateVersion = 3
    },
    1,
    'game-matching-started'
  )
  denied(
    authority,
    hydration,
    (data) => {
      data.stateVersion = 500
    },
    1,
    'game-matching-started'
  )
})
function scatterFixture() {
  const config = {
    teams: [{ id: 'blue' }, { id: 'red' }],
    categories: [{ id: 'animal', label: 'Animal' }],
    scoring: 'unique',
  }
  const run = journey('scattergories', config)
  command(run.hostWire, 'game-team-assign', 'ada-team', 1, { playerId: 'ada', teamId: 'blue' })
  command(run.hostWire, 'game-team-assign', 'lin-team', 2, { playerId: 'lin', teamId: 'red' })
  const host = (version) =>
    packet(version, {
      gameType: 'scattergories',
      phase: version < 5 ? 'playing' : 'review',
      scatter: { letter: 'B', categories: config.categories, submitterPlayerId: null },
      players: [
        { playerId: 'ada', teamId: 'blue', eligible: true, isHost: false },
        { playerId: 'lin', teamId: 'red', eligible: true, isHost: false },
      ],
    })
  run.hostWire.incoming.push({ name: 'game-round-state', data: host(2) })
  command(
    run.wires[0],
    'game-scatter-submit',
    'ada-submit',
    3,
    { entries: [{ categoryId: 'animal', text: ' Bear ' }] },
    { submissionId: 'first' }
  )
  command(
    run.wires[1],
    'game-scatter-submit',
    'lin-submit',
    4,
    { entries: [{ categoryId: 'animal', text: 'Bear' }] },
    { submissionId: 'second' }
  )
  command(run.hostWire, 'game-scatter-reveal', 'reveal', 5)
  run.hostWire.incoming.push({ name: 'game-round-state', data: host(5) })
  command(run.hostWire, 'game-scatter-adjudicate', 'invalidate', 6, {
    submissionId: 'first',
    categoryId: 'animal',
    valid: false,
  })
  run.hostWire.incoming.push({ name: 'game-round-state', data: host(6) })
  const submissions = [
    { submissionId: 'first', teamId: 'blue', entries: [{ categoryId: 'animal', text: 'Bear' }] },
    { submissionId: 'second', teamId: 'red', entries: [{ categoryId: 'animal', text: 'Bear' }] },
  ]
  const reveal = (valid) => ({
    answers: { animal: { blue: 'Bear', red: 'Bear' } },
    results: { animal: { blue: 0, red: 0 } },
    submissions,
    validity: valid ? {} : { animal: { blue: false } },
    rows: submissions.map((row, index) => ({
      submissionId: row.submissionId,
      teamId: row.teamId,
      categoryId: 'animal',
      text: 'Bear',
      valid: index === 0 ? valid : true,
      unique: false,
      points: 0,
    })),
  })
  return {
    authority: buildPublicAuthority(run),
    host: host(6),
    first: packet(5, { revealed: reveal(true) }),
    final: packet(6, { revealed: reveal(false) }),
  }
}
test('scatter review respects accepted entries and version-bounded adjudication', () => {
  const { authority, first, final } = scatterFixture()
  inspect(authority, first)
  inspect(authority, final)
  denied(authority, first, (data) => {
    data.stateVersion = 4
  })
  denied(authority, first, (data) => {
    data.revealed.validity = { animal: { blue: false } }
  })
  denied(authority, final, (data) => {
    data.revealed.rows[0].valid = true
  })
  denied(authority, final, (data) => {
    data.revealed.rows[1].points = 10
  })
  denied(authority, final, (data) => {
    data.revealed.rows[0].rubric = 'private'
  })
  denied(authority, final, (data) => {
    data.revealed.answers.animal.blue = 'Bison'
  })
})
test('agreement preserves common scatter state while checking each recipient submitter', () => {
  const { authority, host } = scatterFixture()
  const learners = ['ada', 'lin'].map((playerId) => ({
    ...host,
    scatter: { ...host.scatter, submitterPlayerId: playerId },
  }))
  expect(learners.map(sharedProjection)).toEqual([sharedProjection(host), sharedProjection(host)])
  assertRecipientMetadata(authority, host, learners)
  const wrong = structuredClone(learners)
  wrong[1].scatter.submitterPlayerId = 'ada'
  expect(() => assertRecipientMetadata(authority, host, wrong)).toThrow()
  const changed = structuredClone(learners[0])
  changed.scatter.letter = 'C'
  expect(sharedProjection(changed)).not.toEqual(sharedProjection(host))
})
