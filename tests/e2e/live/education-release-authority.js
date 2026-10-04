import { expect } from '@playwright/test'
import { validateCanonicalQuestion } from '../../../shared/src/education/question-schema.js'

export const sameRoom = (a, b) => ['gameId', 'roomInstanceId'].every((key) => a[key] === b[key])
export const sameRound = (a, b) =>
  sameRoom(a, b) && ['generation', 'roundId'].every((key) => a[key] === b[key])
const identity = (data) =>
  Object.fromEntries(
    ['gameId', 'roomInstanceId', 'generation', 'roundId', 'stateVersion'].map((key) => [
      key,
      data[key],
    ])
  )
function metadata(data) {
  return {
    ...identity(data),
    phase: data.phase,
    status: data.status,
    questionId: data.question?.id || null,
    questionKind: data.question?.kind || null,
    timeRemainingMs: data.timeRemainingMs,
    serverTimeMs: data.serverTimeMs,
    players: (data.players || []).map(({ playerId, teamId, isHost, eligible }) => ({
      playerId,
      teamId,
      isHost,
      eligible,
    })),
    activeCellId: data.jeopardy?.activeCellId,
    letter: data.scatter?.letter,
  }
}
function commands(wire, recipient) {
  return wire.outgoing
    .filter((row) => row.data?.commandId)
    .map((sent) => {
      const matches = wire.incoming.filter(
        (row) =>
          row.name === 'game-command-result' &&
          row.data.commandId === sent.data.commandId &&
          sameRoom(row.data, sent.data)
      )
      expect(matches, `Receipt authority for ${sent.name}/${sent.data.commandId}`).toHaveLength(1)
      const receipt = matches[0].data
      expect(typeof receipt.accepted).toBe('boolean')
      expect(Number.isSafeInteger(receipt.stateVersion)).toBe(true)
      expect(receipt.generation).toBe(
        sent.data.generation + Number(sent.name === 'game-reset' && receipt.accepted)
      )
      return structuredClone({ event: sent.name, command: sent.data, receipt, recipient })
    })
}
export function buildPublicAuthority(journey) {
  const config = structuredClone(journey.config)
  const questions = [
    ...(config.questions || []),
    ...(config.categories || []).flatMap((category) => category.questions || []),
  ]
  for (const question of questions)
    expect(validateCanonicalQuestion(question).isValid, `Authored question ${question.id}`).toBe(
      true
    )
  expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length)
  const recipients = journey.wires.map((wire, index) => {
    const sessions = wire.incoming
      .filter((row) => row.name === 'game-session')
      .map((row) => structuredClone(row.data))
    expect(sessions.length, `Recipient ${index} has authenticated identity`).toBeGreaterThan(0)
    for (const session of sessions) {
      expect(session.isHost).toBe(false)
      expect(session.gameType).toBe(journey.type)
      expect(session.gameId).toBe(sessions[0].gameId)
      expect(session.playerId).toBe(sessions[0].playerId)
      expect(session.roomInstanceId).toBe(sessions[0].roomInstanceId)
    }
    return { playerId: sessions[0].playerId, sessions, commands: commands(wire, index) }
  })
  const hostCommands = commands(journey.hostWire, 'host')
  const hostSessions = journey.hostWire.incoming
    .filter((row) => row.name === 'game-session')
    .map((row) => row.data)
  expect(hostSessions.length, 'Host authority has an authenticated session').toBeGreaterThan(0)
  for (const session of hostSessions) expect(session.isHost).toBe(true)
  const states = journey.hostWire.incoming
    .filter((row) => row.name === 'game-round-state')
    .map((row) => {
      expect(
        hostSessions.some((session) => sameRoom(session, row.data)),
        'Host state belongs to its authenticated room'
      ).toBe(true)
      expect(Number.isSafeInteger(row.data.stateVersion)).toBe(true)
      return metadata(row.data)
    })
  expect(states.length, 'Authenticated host transition history is required').toBeGreaterThan(0)
  const hostSecrets = [
    ...journey.hostWire.outgoing
      .filter((row) => row.name === 'game-join')
      .map((row) => row.data.hostCapability),
    ...journey.hostWire.incoming
      .filter((row) => row.name === 'game-session')
      .map((row) => row.data.sessionToken),
  ].filter(Boolean)
  return { type: journey.type, config, questions, recipients, hostCommands, states, hostSecrets }
}
export function stateAt(authority, envelope) {
  return authority.states
    .filter((state) => sameRound(state, envelope) && state.stateVersion <= envelope.stateVersion)
    .sort((a, b) => b.stateVersion - a.stateVersion)[0]
}
export function acceptedAt(authority, envelope) {
  return [
    ...authority.hostCommands,
    ...authority.recipients.flatMap((recipient) => recipient.commands),
  ]
    .filter(
      (row) =>
        row.receipt.accepted &&
        sameRound(row.receipt, envelope) &&
        row.receipt.stateVersion <= envelope.stateVersion
    )
    .sort((a, b) => a.receipt.stateVersion - b.receipt.stateVersion)
}
export function selectedSubmitter(authority, envelope, recipient) {
  const state = stateAt(authority, envelope)
  const player = state?.players.find(
    (row) => row.playerId === recipient.playerId && row.eligible && !row.isHost
  )
  if (!player) return null
  const assignments = authority.hostCommands.filter(
    (row) =>
      row.event === 'game-team-assign' &&
      row.receipt.accepted &&
      sameRoom(row.receipt, envelope) &&
      row.receipt.generation <= envelope.generation &&
      row.receipt.stateVersion <= envelope.stateVersion
  )
  const team = assignments.find((row) => row.command.playerId === player.playerId)?.command.teamId
  expect(team, 'Scatter submitter has accepted team assignment').toBe(player.teamId)
  const roster = []
  for (const snapshot of authority.states
    .filter(
      (row) =>
        sameRoom(row, envelope) &&
        row.generation === envelope.generation &&
        row.stateVersion <= envelope.stateVersion
    )
    .sort((a, b) => a.stateVersion - b.stateVersion)) {
    for (const member of snapshot.players)
      if (member.eligible && !member.isHost && !roster.includes(member.playerId))
        roster.push(member.playerId)
  }
  return (
    roster.find(
      (playerId) =>
        state.players.some((row) => row.playerId === playerId && row.eligible) &&
        assignments.some(
          (assignment) =>
            assignment.command.playerId === playerId && assignment.command.teamId === team
        )
    ) || null
  )
}
