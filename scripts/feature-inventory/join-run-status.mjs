import { readFileSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, basename } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))

// vitest: pending/todo tests never executed → treat as skipped (not verified).
function normVitestStatus(s) {
  if (s === 'passed') return 'passed'
  if (s === 'failed') return 'failed'
  return 'skipped' // skipped, pending, todo
}

export function parseVitestJson(json) {
  const rows = []
  for (const tr of json.testResults || []) {
    const file = basename((tr.name || '').replace(/\\/g, '/'))
    for (const a of tr.assertionResults || []) {
      const ancestors = (a.ancestorTitles || []).join(' ')
      const fullTitle = ancestors ? `${ancestors} ${a.title}` : a.title
      rows.push({ file, title: a.title, fullTitle, status: normVitestStatus(a.status) })
    }
  }
  return rows
}

function playwrightSpecStatus(spec) {
  // A spec passes only if every test result passed; any failure → failed;
  // otherwise (skipped/timedOut with no pass) → skipped.
  const statuses = (spec.tests || []).flatMap((t) =>
    (t.results || []).map((r) => r.status)
  )
  if (statuses.includes('failed') || statuses.includes('timedOut')) return 'failed'
  if (statuses.length && statuses.every((s) => s === 'passed')) return 'passed'
  return 'skipped'
}

function walkPlaywrightSuites(suite, fallbackFile, rows) {
  const file = suite.file ? basename(suite.file.replace(/\\/g, '/')) : fallbackFile
  for (const spec of suite.specs || []) {
    rows.push({ file, title: spec.title, status: playwrightSpecStatus(spec) })
  }
  for (const child of suite.suites || []) {
    walkPlaywrightSuites(child, file, rows)
  }
  return rows
}

export function parsePlaywrightJson(json) {
  const rows = []
  for (const suite of json.suites || []) walkPlaywrightSuites(suite, null, rows)
  return rows
}

const STATUS_PRIORITY = { failed: 3, passed: 2, skipped: 1 }

// Keyed by file basename → list of run rows. Tag occurrence titles embed the
// raw test title (plus the [cap:*] token), so we match by substring within file.
export function buildRunIndex(rows) {
  const index = new Map()
  for (const r of rows) {
    const key = r.file
    if (!index.has(key)) index.set(key, [])
    index.get(key).push(r)
  }
  return index
}

export function resolveStatus(occurrence, index) {
  const key = basename(occurrence.file.replace(/\\/g, '/'))
  const candidates = index.get(key)
  if (!candidates) return null
  let best = null
  for (const row of candidates) {
    // The occurrence title always carries the distinctive [cap:*] token (it is
    // literally in the source it()/describe() title). A run row matches only
    // when its full title (ancestors + leaf) CONTAINS that tagged title:
    //   - it() tag  → row.title === occurrence.title (exact)
    //   - describe() tag → row.fullTitle starts with the describe title
    // Matching this single direction makes an untagged sibling — which never
    // contains the [cap:*] token — structurally unable to false-match, so a
    // runtime-skipped tagged test can never bind to a passing sibling.
    const full = row.fullTitle || row.title
    if (!full.includes(occurrence.title)) continue
    if (!best || STATUS_PRIORITY[row.status] > STATUS_PRIORITY[best]) {
      best = row.status
    }
  }
  return best
}

// Pure staleness check: run-results are stale if their capture time predates
// the newest test file's mtime (a test was edited after the last run), or if
// the run-result mtime is missing entirely. No test files → cannot be stale.
export function isRunResultStale(runResultMtime, testFileMtimes) {
  if (!testFileMtimes || testFileMtimes.length === 0) return false
  if (runResultMtime == null) return true
  return runResultMtime < Math.max(...testFileMtimes)
}

function mtimesForRunner(testFileMtimes, runner) {
  if (!testFileMtimes) return null
  if (Array.isArray(testFileMtimes)) return testFileMtimes
  return testFileMtimes[runner] || []
}

export function loadRunResults({ vitestPath, playwrightPath, testFileMtimes } = {}) {
  const rows = []
  const staleSources = { vitest: false, playwright: false }
  if (vitestPath && existsSync(vitestPath)) {
    rows.push(...parseVitestJson(JSON.parse(readFileSync(vitestPath, 'utf8'))))
    // Present-but-old run-results are the silent false-green trap: warn when a
    // test file changed after this capture so a stale green is never trusted.
    const vitestMtimes = mtimesForRunner(testFileMtimes, 'vitest')
    if (vitestMtimes) {
      const mtime = statSync(vitestPath).mtimeMs
      staleSources.vitest = isRunResultStale(mtime, vitestMtimes)
    }
  } else if (vitestPath) {
    staleSources.vitest = true
  }
  if (playwrightPath && existsSync(playwrightPath)) {
    rows.push(
      ...parsePlaywrightJson(JSON.parse(readFileSync(playwrightPath, 'utf8')))
    )
    const playwrightMtimes = mtimesForRunner(testFileMtimes, 'playwright')
    if (playwrightMtimes) {
      const mtime = statSync(playwrightPath).mtimeMs
      staleSources.playwright = isRunResultStale(mtime, playwrightMtimes)
    }
  } else if (playwrightPath) {
    staleSources.playwright = true
  }
  const stale = staleSources.vitest || staleSources.playwright
  return { index: buildRunIndex(rows), rowCount: rows.length, stale, staleSources }
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const { writeFileSync } = await import('node:fs')
  const vitestPath = resolve(HERE, 'run-results-vitest.json')
  const playwrightPath = resolve(HERE, 'run-results-playwright.json')
  const { index, rowCount, stale } = loadRunResults({ vitestPath, playwrightPath })
  const flat = [...index.entries()].flatMap(([file, rows]) =>
    rows.map((r) => ({ file, title: r.title, status: r.status }))
  )
  writeFileSync(
    resolve(HERE, 'run-results.json'),
    JSON.stringify({ stale, rows: flat }, null, 2) + '\n'
  )
  console.log(`[run-status] joined ${rowCount} test results (stale=${stale})`)
}
