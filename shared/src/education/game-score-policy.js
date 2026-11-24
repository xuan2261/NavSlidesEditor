/**
 * Shared score policy and award identity helpers for Phase 05 games.
 * Deduplicates awards by unique award key: generation + gameType + contextId + awardKind.
 * < 200 LOC per CLAUDE.md conventions.
 */

function makeAwardKey({ generation, gameType, contextId, awardKind }) {
  return `${generation}:${gameType}:${contextId}:${awardKind}`
}

function createScoreLedger() {
  const awardedKeys = new Set()
  return {
    has: (key) => awardedKeys.has(key),
    record: (key) => {
      if (awardedKeys.has(key)) return false
      awardedKeys.add(key)
      return true
    },
    clear: () => awardedKeys.clear(),
    keys: () => [...awardedKeys],
  }
}

function clampScore(score, min = 0, max = Infinity) {
  if (!Number.isFinite(score)) return min
  return Math.min(max, Math.max(min, score))
}

module.exports = {
  makeAwardKey,
  createScoreLedger,
  clampScore,
}
