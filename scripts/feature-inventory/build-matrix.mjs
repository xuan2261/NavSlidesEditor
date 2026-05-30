import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { resolveStatus } from './join-run-status.mjs'
import { renderMatrixMarkdown } from './matrix-format.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const PLAN_DIR = resolve(HERE, '../../plans/260530-0854-feature-coverage-traceability-matrix-system-tdd')
const REPORTS_DIR = resolve(PLAN_DIR, 'reports')
const DOCS_MD = resolve(HERE, '../../docs/feature-coverage-matrix.md')

const ALLOWED_BASES = new Set(['GAP', 'DEEP-GAP', 'SKIP', 'TAGGED'])

// A tagged test only counts as verified (PASS) if it ACTUALLY RAN GREEN. Source
// skip or skipped run → never green. No joined run result → TAGGED (unverified).
function effectiveOccurrenceStatus(occ, runIndex) {
  if (occ.skipped) return 'skipped'
  return resolveStatus(occ, runIndex) ?? 'tagged'
}

function computeBaseStatus(occurrences, runIndex) {
  if (!occurrences || occurrences.length === 0) return 'GAP'
  const effs = occurrences.map((o) => effectiveOccurrenceStatus(o, runIndex))
  if (effs.includes('failed')) return 'FAIL'
  if (effs.includes('passed')) return 'PASS'
  if (effs.includes('skipped')) return 'SKIP'
  return 'TAGGED'
}

function needsDeep(cap) {
  return cap.risk === 'high' && (cap.tiers || []).includes('deep')
}

function hasDeepPass(occurrences, runIndex) {
  return (occurrences || []).some(
    (o) => o.tier === 'deep' && !o.skipped && resolveStatus(o, runIndex) === 'passed'
  )
}

export function buildMatrix({ inventory, tags, runIndex, allowlist = [] }) {
  const allowSet = new Set(allowlist.map((a) => a.id))
  const inventoryIds = new Set(inventory.map((c) => c.id))
  const rows = []

  for (const cap of inventory) {
    const occ = tags[cap.id] || []
    let status = computeBaseStatus(occ, runIndex)
    if (status === 'PASS' && needsDeep(cap) && !hasDeepPass(occ, runIndex)) {
      status = 'DEEP-GAP'
    }
    if (ALLOWED_BASES.has(status) && allowSet.has(cap.id)) status = 'ALLOWED'

    const tier = occ.some((o) => o.tier === 'deep')
      ? 'deep'
      : (cap.tiers || ['smoke']).includes('deep')
        ? 'smoke→deep'
        : 'smoke'
    const layer = occ.length ? [...new Set(occ.map((o) => o.layer))].join(',') : null
    const tests = [...new Set(occ.map((o) => o.file))]

    rows.push({ id: cap.id, category: cap.category, risk: cap.risk, tier, layer, tests, status })
  }

  rows.sort((a, b) => a.id.localeCompare(b.id))

  const orphans = Object.keys(tags)
    .filter((id) => !inventoryIds.has(id))
    .sort((a, b) => a.localeCompare(b))

  const summary = { total: rows.length, verified: 0 }
  for (const r of rows) summary[r.status] = (summary[r.status] || 0) + 1
  summary.verified = summary.PASS || 0

  return { rows, orphans, summary }
}

function loadJsonIfExists(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const { extractAllTags } = await import('./extract-tags.mjs')
  const { loadRunResults } = await import('./join-run-status.mjs')

  const fullInventory = loadJsonIfExists(resolve(HERE, 'inventory.json'), [])
  // Matrix scope is editor-core; live/game/pptx/ai namespaces are reserved but
  // excluded from the visibility map (their gap rows would be misleading noise).
  const inventory = fullInventory.filter((c) => c.scope === 'editor-core')
  const tags = extractAllTags()
  const { index: runIndex, stale } = loadRunResults({
    vitestPath: resolve(HERE, 'run-results-vitest.json'),
    playwrightPath: resolve(HERE, 'run-results-playwright.json'),
  })
  const allowlistDoc = loadJsonIfExists(resolve(HERE, 'coverage-gate-allowlist.json'), { entries: [] })
  const allowlist = allowlistDoc.entries || []

  const result = buildMatrix({ inventory, tags, runIndex, allowlist })
  mkdirSync(REPORTS_DIR, { recursive: true })
  const meta = { generated: process.env.MATRIX_DATE || 'local run', stale }
  writeFileSync(
    resolve(REPORTS_DIR, 'feature-coverage-matrix.json'),
    JSON.stringify({ meta, ...result }, null, 2) + '\n'
  )
  const markdown = renderMatrixMarkdown({ ...result, meta })
  writeFileSync(resolve(REPORTS_DIR, 'feature-coverage-matrix.md'), markdown)
  // Promote the human-readable map to docs/ (committed, long-term home). CI's
  // freshness check fails if the committed copy drifts from a fresh regen.
  mkdirSync(dirname(DOCS_MD), { recursive: true })
  writeFileSync(DOCS_MD, markdown)
  const s = result.summary
  console.log(
    `[matrix] ${s.verified}/${s.total} verified | GAP:${s.GAP || 0} DEEP-GAP:${s['DEEP-GAP'] || 0} FAIL:${s.FAIL || 0} SKIP:${s.SKIP || 0} TAGGED:${s.TAGGED || 0} | orphans:${result.orphans.length}`
  )
}
