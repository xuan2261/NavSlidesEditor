const id = (value) => typeof value === 'string' && value.length > 0 && value.length <= 128
const text = (value) => typeof value === 'string'
const rows = (value, cap, valid) =>
  Array.isArray(value) && value.length <= cap && value.every(valid)
const option = (row) => row && id(row.id) && text(row.text)
const nonnegative = (value) => Number.isFinite(value) && value >= 0
function validLiveSnapshot(data) {
  if (
    (data.ownEligible !== undefined && typeof data.ownEligible !== 'boolean') ||
    (data.rosterWindow !== undefined && typeof data.rosterWindow !== 'boolean')
  )
    return false
  if (
    data.poll != null &&
    (!text(data.poll.prompt) ||
      !rows(data.poll.options, 6, option) ||
      !rows(
        data.poll.votes || [],
        6,
        (row) => id(row.optionId) && nonnegative(row.count) && nonnegative(row.percentage)
      ))
  )
    return false
  if (
    data.wordCloud != null &&
    (!text(data.wordCloud.prompt) ||
      !rows(data.wordCloud.words, 50, (row) => text(row.text) && nonnegative(row.count)))
  )
    return false
  if (
    data.matching != null &&
    (!text(data.matching.prompt) ||
      !rows(data.matching.prompts, 8, option) ||
      !rows(data.matching.targets, 8, option))
  )
    return false
  if (
    data.scatter != null &&
    (!(
      text(data.scatter.letter) ||
      (data.scatter.letter === null && ['waiting', 'setup', 'no-play'].includes(data.phase))
    ) ||
      !rows(data.scatter.categories, 200, (row) => id(row.id) && text(row.label)))
  )
    return false
  if (
    data.leaderboard != null &&
    !rows(data.leaderboard, 216, (row) => row && Number.isFinite(row.score))
  )
    return false
  if (
    data.teams != null &&
    !rows(
      data.teams,
      16,
      (row) =>
        row &&
        id(row.id) &&
        text(row.name) &&
        (row.score === undefined || Number.isFinite(row.score))
    )
  )
    return false
  if (
    data.players != null &&
    !rows(
      data.players,
      201,
      (row) =>
        row &&
        id(row.playerId) &&
        text(row.name) &&
        (row.eligible === undefined || typeof row.eligible === 'boolean') &&
        (row.pending === undefined || typeof row.pending === 'boolean')
    )
  )
    return false
  if (data.turn != null && (typeof data.turn !== 'object' || Array.isArray(data.turn))) return false
  if (data.buzz != null && (typeof data.buzz !== 'object' || Array.isArray(data.buzz))) return false
  if (
    data.relay?.positions != null &&
    (typeof data.relay.positions !== 'object' ||
      Object.values(data.relay.positions).some((value) => !nonnegative(value)))
  )
    return false
  return true
}
module.exports = { validLiveSnapshot }
