import { expect } from '@playwright/test'
import { assertPublicPackets } from './education-release-redaction.js'
export { packet, command, journey, inspect, denied }
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
