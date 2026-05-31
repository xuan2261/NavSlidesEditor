import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { checkGate } from './check-coverage-gate.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const MATRIX_JSON = resolve(
  HERE,
  '../../plans/260530-0854-feature-coverage-traceability-matrix-system-tdd/reports/feature-coverage-matrix.json'
)
const ALLOWLIST_PATH = resolve(HERE, 'coverage-gate-allowlist.json')
const REPORTS_DIR = resolve(
  HERE,
  '../../plans/260531-0511-full-feature-verification-gap-closure-tdd/reports'
)

const GAP_STATUSES = new Set(['ALLOWED', 'DEEP-GAP', 'GAP', 'SKIP', 'TAGGED'])

function priorityFromRisk(risk) {
  if (risk === 'high') return 'P1'
  if (risk === 'critical') return 'P0'
  return 'P2'
}

function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback
}

export function buildBaselineGapReport({ matrix, allowlist, generatedAt }) {
  if (matrix.meta?.stale) {
    throw new Error('Cannot write baseline gap report from stale or missing run results')
  }
  const gate = checkGate({
    rows: matrix.rows || [],
    orphans: matrix.orphans || [],
    allowlist: allowlist.entries || [],
  })
  if (!gate.ok) {
    const details = [...gate.errors, ...gate.failures].join('; ')
    throw new Error(`Cannot write baseline gap report because coverage gate failed: ${details}`)
  }

  const allowById = new Map((allowlist.entries || []).map((entry) => [entry.id, entry]))
  const rows = matrix.rows || []
  const gaps = []

  for (const row of rows) {
    if (!GAP_STATUSES.has(row.status)) continue
    const debt = allowById.get(row.id) || {}
    gaps.push({
      capId: row.id,
      currentStatus: row.status,
      risk: priorityFromRisk(row.risk),
      sourceRisk: row.risk,
      ownerLayer: row.layer || 'none',
      targetLayer: debt.targetLayer || 'unspecified',
      blockingReason: debt.reason || 'unallowlisted gap',
      resolutionPhase: debt.resolutionPhase || null,
      owner: debt.owner || null,
      debtAdded: debt.added || null,
      debtAllowedUntil: debt.debtAllowedUntil || null,
      tests: row.tests || [],
    })
  }

  for (const id of matrix.orphans || []) {
    gaps.push({
      capId: id,
      currentStatus: 'ORPHAN-TAG',
      risk: 'P1',
      sourceRisk: 'unknown',
      ownerLayer: 'test-tag',
      targetLayer: 'tag-cleanup',
      blockingReason: 'tag references an id not in editor-core inventory',
      resolutionPhase: 1,
      owner: 'qa',
      debtAdded: null,
      debtAllowedUntil: null,
      tests: [],
    })
  }

  gaps.sort((a, b) => a.capId.localeCompare(b.capId))
  return {
    generatedAt,
    sourceMatrix: 'plans/260530-0854-feature-coverage-traceability-matrix-system-tdd/reports/feature-coverage-matrix.json',
    editorCoreBaselineTotal: matrix.summary?.total ?? rows.length,
    summary: matrix.summary || {},
    staleRunResults: Boolean(matrix.meta?.stale),
    gaps,
  }
}

export function renderBaselineGapMarkdown(report) {
  const lines = [
    '# Baseline Gap Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Editor-core baseline total: ${report.editorCoreBaselineTotal}`,
    `Verified PASS: ${report.summary.verified || 0}/${report.editorCoreBaselineTotal}`,
    `Gap count: ${report.gaps.length}`,
    '',
    '| Capability | Status | Risk | Target | Reason | Debt until |',
    '|---|---|---|---|---|---|',
  ]
  for (const gap of report.gaps) {
    lines.push(
      `| ${gap.capId} | ${gap.currentStatus} | ${gap.risk} | ${gap.targetLayer} | ${gap.blockingReason} | ${gap.debtAllowedUntil || '-'} |`
    )
  }
  lines.push('')
  return lines.join('\n')
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const matrix = readJson(MATRIX_JSON, { rows: [], orphans: [], summary: {} })
  const allowlist = readJson(ALLOWLIST_PATH, { entries: [] })
  const report = buildBaselineGapReport({
    matrix,
    allowlist,
    generatedAt: process.env.BASELINE_DATE || matrix.meta?.generated || 'unknown',
  })
  mkdirSync(REPORTS_DIR, { recursive: true })
  writeFileSync(resolve(REPORTS_DIR, 'baseline-gap-report.json'), JSON.stringify(report, null, 2) + '\n')
  writeFileSync(resolve(REPORTS_DIR, 'baseline-gap-report.md'), renderBaselineGapMarkdown(report))
  console.log(
    `[baseline-gap-report] wrote ${report.gaps.length} gap(s), denominator ${report.editorCoreBaselineTotal}`
  )
}
