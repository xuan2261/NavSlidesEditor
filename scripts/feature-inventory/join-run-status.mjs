import { readFileSync, existsSync } from 'node:fs'
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
      rows.push({ file, title: a.title, status: normVitestStatus(a.status) })
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
    if (!occurrence.title.includes(row.title)) continue
    if (!best || STATUS_PRIORITY[row.status] > STATUS_PRIORITY[best]) {
      best = row.status
    }
  }
  return best
}

export function loadRunResults({ vitestPath, playwrightPath } = {}) {
  const rows = []
  let stale = false
  if (vitestPath && existsSync(vitestPath)) {
    rows.push(...parseVitestJson(JSON.parse(readFileSync(vitestPath, 'utf8'))))
  } else if (vitestPath) {
    stale = true
  }
  if (playwrightPath && existsSync(playwrightPath)) {
    rows.push(
      ...parsePlaywrightJson(JSON.parse(readFileSync(playwrightPath, 'utf8')))
    )
  }
  return { index: buildRunIndex(rows), rowCount: rows.length, stale }
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
