function createLivePlayerClock(clock = { now: () => performance.now() }) {
  let key,
    anchor = null
  return {
    hydrate(state) {
      const round = JSON.stringify([state.roomInstanceId, state.generation, state.roundId])
      const token = JSON.stringify([round, state.deadlineRevision ?? state.stateVersion])
      if (key === token) return
      const now = clock.now(),
        remaining = Number.isFinite(state.timeRemainingMs)
          ? Math.max(0, state.timeRemainingMs)
          : null
      const current =
        anchor?.round === round ? Math.max(0, anchor.remaining - (now - anchor.at)) : null
      key = token
      anchor =
        remaining === null
          ? null
          : {
              round,
              at: now,
              remaining: current === null ? remaining : Math.min(current, remaining),
            }
    },
    remaining() {
      return anchor ? Math.max(0, anchor.remaining - (clock.now() - anchor.at)) : null
    },
    seconds() {
      const remaining = this.remaining()
      return remaining === null ? null : Math.ceil(remaining / 1000)
    },
  }
}
module.exports = { createLivePlayerClock }
