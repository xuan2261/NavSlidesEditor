const rosterTypes = new Set(['four-corners', 'relay-race', 'trivia-champ', 'scattergories'])
const usesRoster = (room) => rosterTypes.has(room.gameType)
function assignmentOpen(room) {
  if (room.status === 'finished') return false
  if (room.status === 'waiting') return true
  return room.gameType === 'four-corners'
    ? room.domain.phase === 'revealed'
    : room.gameType === 'relay-race'
      ? room.domain.phase === 'waiting'
      : ['trivia-champ', 'scattergories'].includes(room.gameType) && room.domain.phase === 'review'
}
const eligible = (room, player) =>
  Boolean(player && player.role !== 'host' && (!usesRoster(room) || player.admitted === true))
function promote(room) {
  for (const player of room.players.values()) {
    if (
      player.role === 'host' ||
      player.admitted ||
      (room.teams.length && !room.teams.some((team) => team.id === player.teamId))
    )
      continue
    player.admitted = true
    if (!room.roster.includes(player.playerId)) room.roster.push(player.playerId)
  }
}
function assignTeam(room, payload) {
  if (!assignmentOpen(room)) return { error: 'roster-locked' }
  const player = room.players.get(payload.playerId)
  if (!player || player.role === 'host' || !room.teams.some((team) => team.id === payload.teamId))
    return { error: 'invalid-team-assignment' }
  if (player.teamId || player.admitted) return { error: 'team-already-assigned' }
  player.teamId = payload.teamId
  return { result: { playerId: player.playerId, teamId: player.teamId } }
}
module.exports = { usesRoster, assignmentOpen, eligible, promote, assignTeam }
