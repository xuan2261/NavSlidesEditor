import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { resolveStatus } from './join-run-status.mjs'
import { renderMatrixMarkdown } from './matrix-format.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
// Stable machine-readable home (not under archived plans/). Markdown is also
// promoted to docs/feature-coverage-matrix.md for the committed human map.
const REPORTS_DIR = resolve(HERE, 'reports')
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

function passedOccurrences(occurrences, runIndex) {
  return (occurrences || []).filter(
    (o) => !o.skipped && resolveStatus(o, runIndex) === 'passed'
  )
}

function verifiedDepths(occurrences, runIndex) {
  const depths = passedOccurrences(occurrences, runIndex).flatMap((o) => o.depths || [])
  return passedOccurrences(occurrences, runIndex).length
    ? ['trace', ...[...new Set(depths)].sort((a, b) => a.localeCompare(b))]
    : []
}

function depthRequirementById(depthPolicy) {
  return new Map((depthPolicy?.requirements || []).map((r) => [r.id, r]))
}

export function buildMatrix({
  inventory,
  tags,
  runIndex,
  allowlist = [],
  knownIds = null,
  depthPolicy = {},
}) {
  const allowSet = new Set(allowlist.map((a) => a.id))
  const inventoryIds = new Set(inventory.map((c) => c.id))
  const knownIdSet = knownIds ? new Set(knownIds) : inventoryIds
  const depthRequirements = depthRequirementById(depthPolicy)
  const rows = []

  for (const cap of inventory) {
    const occ = tags[cap.id] || []
    let status = computeBaseStatus(occ, runIndex)
    if (
      cap.coverageMode === 'inventory-only' &&
      (status === 'GAP' || status === 'TAGGED' || status === 'SKIP')
    ) {
      status = 'INVENTORY'
    }
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
    const depths = verifiedDepths(occ, runIndex)
    const depthRequirement = depthRequirements.get(cap.id)
    const requiredDepths = depthRequirement?.requiredDepths || []
    const missingDepths =
      status === 'PASS' ? requiredDepths.filter((d) => !depths.includes(d)) : []
    const depthStatus = missingDepths.length ? 'DEPTH-WARN' : 'OK'

    rows.push({
      id: cap.id,
      category: cap.category,
      risk: cap.risk,
      tier,
      layer,
      tests,
      status,
      depths,
      requiredDepths,
      missingDepths,
      depthStatus,
      depthOwner: depthRequirement?.owner || null,
      depthResolutionPhase: depthRequirement?.resolutionPhase || null,
    })
  }

  rows.sort((a, b) => a.id.localeCompare(b.id))

  const orphans = Object.keys(tags)
    .filter((id) => !knownIdSet.has(id))
    .sort((a, b) => a.localeCompare(b))

  const summary = { total: rows.length, verified: 0 }
  for (const r of rows) summary[r.status] = (summary[r.status] || 0) + 1
  summary.verified = summary.PASS || 0
  summary['DEPTH-WARN'] = rows.filter((r) => r.depthStatus === 'DEPTH-WARN').length

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
  const { statSync } = await import('node:fs')

  const fullInventory = loadJsonIfExists(resolve(HERE, 'inventory.json'), [])
  // Matrix scope is editor-core; live/game/pptx/ai namespaces are reserved but
  // excluded from the visibility map (their gap rows would be misleading noise).
  const inventory = fullInventory.filter((c) => c.scope === 'editor-core')
  const tags = extractAllTags()
  // Collect tagged test-file mtimes per runner so a present-but-old result is
  // flagged only against files that contribute matrix evidence.
  const taggedFiles = [
    ...new Set(Object.values(tags).flat().map((occurrence) => resolve(HERE, '../..', occurrence.file))),
  ]
  const mtimesFor = (predicate) => taggedFiles.filter(predicate).map((f) => {
    try {
      return statSync(f).mtimeMs
    } catch {
      return 0
    }
  })
  const testFileMtimes = {
    vitest: mtimesFor((f) => !f.replace(/\\/g, '/').includes('/tests/e2e/')),
    playwright: mtimesFor((f) => f.replace(/\\/g, '/').includes('/tests/e2e/')),
  }
  const playwrightRunPath = resolve(HERE, 'run-results-playwright.json')
  const { index: runIndex, stale, staleSources } = loadRunResults({
    vitestPath: resolve(HERE, 'run-results-vitest.json'),
    playwrightPath: existsSync(playwrightRunPath) ? playwrightRunPath : null,
    testFileMtimes,
  })
  const allowlistDoc = loadJsonIfExists(resolve(HERE, 'coverage-gate-allowlist.json'), { entries: [] })
  const allowlist = allowlistDoc.entries || []
  const depthPolicy = loadJsonIfExists(resolve(HERE, 'coverage-depth-policy.json'), {})

  const result = buildMatrix({
    inventory,
    tags,
    runIndex,
    allowlist,
    knownIds: fullInventory.map((c) => c.id),
    depthPolicy,
  })
  mkdirSync(REPORTS_DIR, { recursive: true })
  const meta = { generated: process.env.MATRIX_DATE || 'local run', stale, staleSources }
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
