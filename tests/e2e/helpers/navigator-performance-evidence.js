import os from 'node:os'
import { readFile, writeFile } from 'node:fs/promises'
import { BUDGET, REPETITIONS, SAMPLES, SEED, VIEWPORT, contentHash } from './navigator-performance-fixtures.js'

export async function environmentEvidence(browser, browserType, testInfo, identity) {
  const files = identity.files.filter((file) => file.path.startsWith('client/dist/'))
    .map(({ path: filename, sha256 }) => ({ path: filename.slice('client/dist/'.length), sha256 }))
  const sourceHashes = identity.files.filter((file) => file.path.startsWith('tests/e2e/'))
    .map(({ path: filename, sha256 }) => ({ path: filename, sha256 }))
  const commit = identity.gitHead
  const session = await browser.newBrowserCDPSession()
  let browserVersion
  try { browserVersion = await session.send('Browser.getVersion') }
  finally { await session.detach() }
  const machine = { platform: os.platform(), release: os.release(), architecture: os.arch(), cpu: os.cpus().map(({ model, speed }) => ({ model, speed })), totalMemoryBytes: os.totalmem(), browser: browser.version(), browserRevision: browserVersion.revision, viewport: VIEWPORT, deviceScaleFactor: 1, headless: true, reducedMotion: 'reduce', node: process.version }
  return {
    machine, comparisonEnvironmentHash: contentHash({ ...machine, cpu: machine.cpu.map(({ model }) => model) }), commit,
    browserVersion, browserTypeDefaultExecutableHash: identity.runtime.browserExecutableSha256,
    lockfileHash: identity.files.find((file) => file.path === 'package-lock.json').sha256,
    build: { manifestHash: contentHash(files), files }, sourceHashes,
    policy: { workers: testInfo.config.workers, retries: testInfo.project.retries, concurrentSuites: 'none; exclusive invocation asserted by operator', production: true, tracing: false, video: false, seed: SEED, warmRepetitions: REPETITIONS, samplesPerInteractionPerRepetition: SAMPLES },
  }
}
export function distribution(values) {
  if (!values.length) return { available: false, value: null, reason: 'No observed samples' }
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
  return { available: true, n: sorted.length, median, min: sorted[0], max: sorted.at(-1), p95: sorted.length >= 20 ? sorted[Math.ceil(sorted.length * 0.95) - 1] : null, p95Reason: sorted.length >= 20 ? null : 'N/A: fewer than20 timed samples' }
}
export function summarize(receipt) {
  const summary = []
  for (const fixture of receipt.fixtures) {
    const warm = receipt.runs.filter((run) => run.fixture === fixture.name && run.population === 'warm' && run.status === 'passed')
    const metrics = {}
    for (const kind of ['open', 'selection', 'input', 'scroll', 'drop']) {
      const perRepetition = warm.map((run) => kind === 'open' ? run.ready.openToReadyMs : distribution(run.interactions.rows.filter((row) => row.kind === kind).map((row) => row.paintUpperBoundMs))[BUDGET[kind].statistic])
      const spread = distribution(perRepetition)
      const pooled = distribution(kind === 'open' ? perRepetition : warm.flatMap((run) => run.interactions.rows.filter((row) => row.kind === kind).map((row) => row.paintUpperBoundMs)))
      const noise = spread.available && spread.median > 0 ? (spread.max - spread.min) / (2 * spread.median) : null
      metrics[kind] = { perRepetition, repetitions: spread, pooled, relativeHalfRangeNoise: noise, noiseValid: warm.length === REPETITIONS && noise !== null && noise < BUDGET.maximumNoise, sloMs: BUDGET[kind].ms, sloStatistic: BUDGET[kind].statistic, sloPassed: warm.length === REPETITIONS && pooled.available && pooled[BUDGET[kind].statistic] <= BUDGET[kind].ms }
    }
    summary.push({ fixture: fixture.name, metrics })
  }
  const complete = receipt.executionIdentity?.status === 'matched' && receipt.fixtures.length === 10 && receipt.runs.every((run) => run.status === 'passed') && receipt.fixtures.every((fixture) => ['cold', 'warmup', 'warm'].every((population) => receipt.runs.filter((run) => run.fixture === fixture.name && run.population === population && run.status === 'passed').length === (population === 'warm' ? REPETITIONS : 1)))
  const stable = complete && summary.every((entry) => Object.values(entry.metrics).every((metric) => metric.noiseValid))
  const withinBudget = complete && summary.every((entry) => Object.values(entry.metrics).every((metric) => metric.sloPassed))
  return { complete, stable, withinBudget, decision: !complete ? 'blocked: incomplete/failed measurement' : !stable ? 'rerun controlled environment: noise>=5%; phase14 blocked' : withinBudget ? 'phase14 no-change eligible, pending recorded UX inspection' : 'phase14 measured-bottleneck investigation required; no automatic virtualization', fixtures: summary }
}
export async function compareBaseline(receipt) {
  const filename = process.env.NAVIGATOR_BASELINE_INPUT
  if (!filename) return { available: false, value: null, reason: 'Baseline collection, not a candidate comparison' }
  const baseline = JSON.parse(await readFile(filename, 'utf8'))
  if (baseline.budgetHash !== receipt.budgetHash || baseline.environment.comparisonEnvironmentHash !== receipt.environment.comparisonEnvironmentHash) throw new Error('Cannot pair different frozen budgets or hardware/browser environments')
  for (const fixture of receipt.fixtures) {
    const prior = baseline.fixtures.find((entry) => entry.name === fixture.name)
    const matches = fixture.name === 'package' ? prior?.packageHash === fixture.packageHash : prior?.fixtureHash === fixture.fixtureHash
    if (!matches) throw new Error(`Cannot pair changed fixture ${fixture.name}`)
  }
  const pairs = []
  for (const current of receipt.summary.fixtures) {
    const prior = baseline.summary.fixtures.find((entry) => entry.fixture === current.fixture)
    if (!prior) continue
    for (const [kind, metric] of Object.entries(current.metrics)) {
      const old = prior.metrics[kind]
      if (!old) continue
      for (const statistic of ['median', 'p95']) {
        if (old.pooled[statistic] === null || metric.pooled[statistic] === null) continue
        const ratio = metric.pooled[statistic] / old.pooled[statistic]
        pairs.push({ fixture: current.fixture, kind, statistic, ratio, withinCap: ratio <= 1 + BUDGET.maximumPairedRegression })
      }
    }
  }
  const isStable = Boolean(baseline.summary.stable && receipt.summary.stable)
  return { available: true, baselineBuildHash: baseline.environment.build.manifestHash, stable: isStable, pairs, passed: pairs.every((pair) => pair.withinCap), reason: isStable ? null : 'Noise invalidates paired optimization decisions; rerun, never relax cap' }
}
export async function saveEvidence(testInfo, filename, value) {
  const file = testInfo.outputPath(filename)
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`)
  await testInfo.attach(filename, { path: file, contentType: 'application/json' })
  return file
}
