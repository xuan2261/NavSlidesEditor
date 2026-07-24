/**
 * Lightweight stage timing for PPTX import perf matrix.
 * Does not alter production importer; harness injects timed stages.
 */

function createStageTimer({ now = () => Date.now(), rss = () => process.memoryUsage().rss } = {}) {
  const stages = Object.create(null)

  async function measure(name, fn) {
    if (typeof name !== 'string' || !name) {
      throw new TypeError('stage name must be a non-empty string')
    }
    const startMs = now()
    const startRss = rss()
    let error = false
    try {
      return await fn()
    } catch (err) {
      error = true
      throw err
    } finally {
      const endMs = now()
      const endRss = rss()
      stages[name] = {
        durationMs: Math.max(0, endMs - startMs),
        peakRssBytes: Math.max(startRss, endRss),
        ...(error ? { error: true } : {}),
      }
    }
  }

  function snapshot() {
    return Object.fromEntries(
      Object.entries(stages).map(([key, value]) => [key, { ...value }])
    )
  }

  return { measure, snapshot }
}

function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null
  if (p <= 0) return sortedAsc[0]
  if (p >= 100) return sortedAsc[sortedAsc.length - 1]
  const rank = Math.ceil((p / 100) * sortedAsc.length) - 1
  return sortedAsc[Math.max(0, Math.min(sortedAsc.length - 1, rank))]
}

function summarizeDurations(samples) {
  const sorted = samples.filter((n) => Number.isFinite(n)).slice().sort((a, b) => a - b)
  return {
    count: sorted.length,
    min: sorted.length ? sorted[0] : null,
    max: sorted.length ? sorted[sorted.length - 1] : null,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
  }
}

module.exports = {
  createStageTimer,
  percentile,
  summarizeDurations,
}
