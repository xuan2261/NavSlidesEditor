import { expect } from '@playwright/test'
import { liveJourney } from './education-player-fixture.js'
import { assertPublicPackets } from './education-release-redaction.js'
import { observe } from '../education/release-observations.js'
import { writeFile } from 'node:fs/promises'
import { capturePackets, settlePackets } from './education-release-packets.js'
import { buildPublicAuthority } from './education-release-authority.js'
import { sharedProjection, assertRecipientMetadata } from './education-release-agreement.js'

export async function releaseJourney(args, type, fields = {}, prepare = async () => {}) {
  const hostWire = { incoming: [], outgoing: [] },
    wires = []
  const watchHost = (page) => capturePackets(page, hostWire)
  args.page.context().on('page', watchHost)
  try {
    const journey = await liveJourney(args, type, fields, async (context, name) => {
      wires.push(capturePackets(context.pages()[0]))
      await prepare(context, name)
    })
    return {
      ...journey,
      hostWire,
      wires,
      type,
      evidence: { redactions: [], receipts: [], reconnects: [], resets: [] },
      get received() {
        return wires.map((wire) =>
          wire.incoming.filter((row) => row.name === 'game-round-state').map((row) => row.data)
        )
      },
    }
  } finally {
    args.page.context().off('page', watchHost)
  }
}
export const hostState = (journey) =>
  journey.root.evaluate((root) => NavSlidesEducation.mount(root).getState().state)
export const latest = (journey, index = 0) => journey.received[index].at(-1)
export async function agreePublic(journey) {
  const command = journey.hostWire.outgoing.filter((row) => row.data?.commandId).at(-1)
  if (command) {
    await expect
      .poll(
        () =>
          journey.hostWire.incoming.find(
            (row) =>
              row.name === 'game-command-result' && row.data.commandId === command.data.commandId
          )?.data.accepted
      )
      .toBe(true)
  }
  await expect
    .poll(async () => {
      await settlePackets(journey)
      const host = await hostState(journey),
        learners = journey.received.map((rows) => rows.at(-1))
      if (
        !learners.every(
          (state) =>
            state &&
            JSON.stringify(sharedProjection(state)) === JSON.stringify(sharedProjection(host))
        )
      )
        return false
      assertRecipientMetadata(buildPublicAuthority(journey), host, learners)
      return true
    })
    .toBe(true)
}
export async function redacted(journey) {
  await agreePublic(journey)
  await settlePackets(journey)
  assertPublicPackets(journey, buildPublicAuthority(journey))
  for (const state of journey.received.map((rows) => rows.at(-1))) expect(state.revealed).toBeNull()
  journey.evidence.redactions.push(
    journey.received.map((rows) => {
      const { roomInstanceId, generation, roundId, stateVersion } = rows.at(-1)
      return { roomInstanceId, generation, roundId, stateVersion }
    })
  )
}
export async function receipt(journey, index, event, count = 1) {
  const wire = index === 'host' ? journey.hostWire : journey.wires[index]
  await expect.poll(() => wire.outgoing.filter((row) => row.name === event).length).toBe(count)
  const commands = wire.outgoing.filter((row) => row.name === event)
  expect(new Set(commands.map((row) => row.data.commandId)).size).toBe(count)
  for (const command of commands) {
    await expect
      .poll(
        () =>
          wire.incoming.filter(
            (row) =>
              row.name === 'game-command-result' && row.data.commandId === command.data.commandId
          ).length
      )
      .toBe(1)
    const result = wire.incoming.find(
      (row) => row.name === 'game-command-result' && row.data.commandId === command.data.commandId
    ).data
    expect(result.accepted).toBe(true)
    expect(result.duplicate).toBe(false)
    expect(result.roomInstanceId).toBe(command.data.roomInstanceId)
    expect(result.generation).toBe(command.data.generation)
    journey.evidence.receipts.push({
      event,
      index,
      commandId: result.commandId,
      generation: result.generation,
      roundId: result.roundId,
    })
  }
  return wire.incoming
    .filter(
      (row) =>
        row.name === 'game-command-result' &&
        commands.some((command) => command.data.commandId === row.data.commandId)
    )
    .map((row) => row.data)
}
export async function reconnect(journey, index = 0) {
  await agreePublic(journey)
  const before = structuredClone(latest(journey, index)),
    wire = journey.wires[index]
  const sent = wire.outgoing.filter((row) => row.data?.commandId).length
  const offset = journey.received[index].length
  const sessions = wire.incoming.filter((row) => row.name === 'game-session').length
  await journey.learners[index].reload()
  await expect.poll(() => journey.received[index].length).toBeGreaterThan(offset)
  await expect
    .poll(() => wire.incoming.filter((row) => row.name === 'game-session').length)
    .toBe(sessions + 1)
  await settlePackets(journey)
  await agreePublic(journey)
  const after = latest(journey, index)
  for (const key of [
    'roomInstanceId',
    'generation',
    'roundId',
    'ownSubmission',
    'leaderboard',
    'teams',
  ])
    expect(after[key]).toEqual(before[key])
  expect(after.stateVersion).toBeGreaterThan(before.stateVersion)
  expect(wire.outgoing.filter((row) => row.data?.commandId)).toHaveLength(sent)
  assertPublicPackets(journey, buildPublicAuthority(journey))
  journey.evidence.reconnects.push({
    index,
    before: before.stateVersion,
    after: after.stateVersion,
    roomInstanceId: after.roomInstanceId,
    generation: after.generation,
    roundId: after.roundId,
    ownSubmission: after.ownSubmission,
  })
}
export async function replay(journey, start) {
  const before = await hostState(journey)
  await journey.command('reset')
  await expect.poll(() => latest(journey)?.generation).toBe(before.generation + 1)
  await agreePublic(journey)
  for (const state of journey.received.map((rows) => rows.at(-1))) {
    expect(state.roomInstanceId).toBe(before.roomInstanceId)
    expect(state.ownSubmission).toBeNull()
    expect((state.teams || []).map((row) => row.score)).toEqual((state.teams || []).map(() => 0))
    expect((state.leaderboard || []).every((row) => row.score === 0)).toBe(true)
  }
  journey.evidence.resets.push({
    roomInstanceId: before.roomInstanceId,
    before: before.generation,
    after: latest(journey).generation,
  })
  if (start) await start()
  await redacted(journey)
}
export async function qualify(testInfo, journey, questionKind = null, details = {}) {
  await agreePublic(journey)
  await settlePackets(journey)
  assertPublicPackets(journey, buildPublicAuthority(journey))
  expect(journey.contexts).toHaveLength(2)
  expect(journey.contexts[0]).not.toBe(journey.contexts[1])
  for (const contract of ['redactions', 'receipts', 'reconnects', 'resets'])
    expect(
      journey.evidence[contract].length,
      `Actual ${contract} contract was not exercised`
    ).toBeGreaterThan(0)
  for (const wire of [journey.hostWire, ...journey.wires]) {
    const commands = wire.outgoing.filter((row) => row.data?.commandId)
    expect(new Set(commands.map((row) => row.data.commandId)).size).toBe(commands.length)
    for (const command of commands)
      expect(
        wire.incoming.filter(
          (row) =>
            row.name === 'game-command-result' && row.data.commandId === command.data.commandId
        )
      ).toHaveLength(1)
  }
  const artifact = testInfo.outputPath(`${journey.type}-${questionKind || 'native'}-wire.json`)
  const publicHost = {
    incoming: journey.hostWire.incoming.filter((row) => row.name !== 'game-session'),
    outgoing: journey.hostWire.outgoing.filter((row) => row.name !== 'game-join'),
  }
  const publicLearners = journey.wires.map((wire) => ({
    incoming: wire.incoming.filter((row) => row.name !== 'game-session'),
    outgoing: wire.outgoing.filter((row) => row.name !== 'game-join'),
  }))
  await writeFile(
    artifact,
    JSON.stringify(
      { host: publicHost, learners: publicLearners, evidence: journey.evidence, ...details },
      null,
      2
    )
  )
  await observe(
    testInfo,
    journey.host,
    {
      element: 'game',
      gameType: journey.type,
      questionKind,
      surface: 'live',
      mode: 'live',
      lane: 'production-browser',
    },
    journey.type === 'name-picker' ? 'broadcast-pick-reset' : 'authority-redaction-replay',
    'Native generated host and two independent audience contexts: public redaction, once-only authoritative receipts, agreeing projections, reconnect hydration and generation reset.',
    'All contract assertions completed against actual Socket.IO packets and native browser controls.',
    [artifact]
  )
}
export async function assignTeams(journey) {
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
}
