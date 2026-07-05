import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const EXPECTED_PATH = resolve(HERE, 'element-control-expected-controls.json')
const MATRIX_PATH = resolve(HERE, 'element-control-audit-matrix.json')
const REPORT_PATH = resolve(
  HERE,
  '../../plans/260617-0739-element-control-audit-matrix-tdd/reports/element-control-audit-matrix-current.md'
)
const ELEMENT_DEFAULTS_PATH = resolve(HERE, '../../client/src/data/element-defaults.js')

const STATUSES = new Set([
  'works',
  'partial',
  'broken',
  'export-gap',
  'implemented',
  'fallback',
  'accepted-limit',
  'not-applicable',
])
const FAILING_STATUSES = new Set(['missing', 'broken'])
const CAPABILITY_SURFACES = new Set([
  'create',
  'canvas',
  'properties',
  'formatRibbon',
  'htmlExport',
  'pptxExport',
])
const SECURITY_FIELDS = [
  'trustBoundary',
  'inputSource',
  'sink',
  'sanitizerOrEscaper',
  'urlSchemePolicy',
  'negativeSecurityTests',
]

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function rowKey(row) {
  return `${row.element}.${row.control}.${row.surface}`
}

function expectedRows(expectedControls) {
  return expectedControls.flatMap((entry) => {
    if (entry.scope !== 'included') return []
    return asArray(entry.surfaces).map((surface) => ({
      element: entry.element,
      control: entry.control,
      surface,
      contentBearing: Boolean(entry.contentBearing),
    }))
  })
}

export function validateElementControlAuditMatrix({
  canonicalElements,
  expectedControls,
  rows,
}) {
  const errors = []
  const canonicalSet = new Set(canonicalElements)
  const rowKeys = new Set()
  const allowedRowKeys = new Set(
    expectedRows(expectedControls).map(
      (expected) => `${expected.element}.${expected.control}.${expected.surface}`
    )
  )

  for (const element of canonicalElements) {
    if (!rows.some((row) => row.element === element)) {
      errors.push(`missing matrix rows for canonical element: ${element}`)
    }
    if (!expectedControls.some((entry) => entry.element === element)) {
      errors.push(`missing expected-control inventory for canonical element: ${element}`)
    }
  }

  for (const entry of expectedControls) {
    if (!canonicalSet.has(entry.element)) {
      errors.push(`expected control references unknown element: ${entry.element}`)
    }
    if (!hasText(entry.control)) errors.push(`expected control missing control name`)
    if (!['included', 'deferred', 'out-of-scope'].includes(entry.scope)) {
      errors.push(`expected control ${entry.element}.${entry.control} has invalid scope`)
    }
    const surfaces = asArray(entry.surfaces)
    if (!surfaces.length || !surfaces.every(hasText)) {
      errors.push(`expected control ${entry.element}.${entry.control} has invalid surfaces`)
    }
    if (!hasText(entry.rationale)) {
      errors.push(`expected control ${entry.element}.${entry.control} missing rationale`)
    }
  }

  for (const row of rows) {
    for (const field of ['id', 'element', 'control', 'surface', 'status', 'decision']) {
      if (!hasText(row[field])) errors.push(`row ${row.id || '(unknown)'} missing ${field}`)
    }
    if ('surfaces' in row) errors.push(`row ${row.id || rowKey(row)} mixes surfaces`)
    if (row.id && !allowedRowKeys.has(rowKey(row))) {
      errors.push(`row ${row.id} is not an expected element/control/surface`)
    }
    if (!canonicalSet.has(row.element)) errors.push(`row ${row.id} references unknown element`)
    if (!STATUSES.has(row.status)) errors.push(`row ${row.id} has invalid status ${row.status}`)
    if (FAILING_STATUSES.has(row.status)) errors.push(`row ${row.id} has failing status ${row.status}`)
    if (row.control === 'element-capability-policy' && CAPABILITY_SURFACES.has(row.surface)) {
      for (const field of ['policy', 'testCoverage', 'decision']) {
        if (field === 'testCoverage') continue
        if (!hasText(row[field])) errors.push(`row ${row.id} missing ${field}`)
      }
      if (row.status === 'accepted-limit' && !hasText(row.alternateSurface)) {
        errors.push(`row ${row.id} accepted-limit missing alternateSurface`)
      }
    }
    if (row.id && row.id !== rowKey(row)) {
      errors.push(`row ${row.id} id must match element.control.surface`)
    }
    if (!asArray(row.evidence).some(hasText)) errors.push(`row ${row.id} missing evidence`)
    if (!asArray(row.testCoverage).some(hasText)) {
      errors.push(`row ${row.id} missing target test coverage`)
    }
    if (/^(tbd|todo|placeholder)$/i.test(row.decision || '')) {
      errors.push(`row ${row.id} has placeholder decision`)
    }

    const expected = expectedControls.find(
      (entry) =>
        entry.element === row.element &&
        entry.control === row.control &&
        asArray(entry.surfaces).includes(row.surface)
    )
    if (expected?.contentBearing) {
      for (const field of SECURITY_FIELDS) {
        if (!hasText(row.security?.[field])) {
          errors.push(`row ${row.id} missing security.${field}`)
        }
      }
    }
    const key = rowKey(row)
    if (rowKeys.has(key)) errors.push(`duplicate matrix row: ${key}`)
    rowKeys.add(key)
  }

  for (const expected of expectedRows(expectedControls)) {
    const id = `${expected.element}.${expected.control}.${expected.surface}`
    if (!rowKeys.has(id)) errors.push(`missing matrix row for expected control: ${id}`)
  }

  const summary = rows.reduce(
    (acc, row) => {
      acc.total += 1
      acc[row.status] = (acc[row.status] || 0) + 1
      return acc
    },
    { total: 0 }
  )
  return { ok: errors.length === 0, errors, summary }
}

export function renderElementControlReport({ rows, result }) {
  const sorted = [...rows].sort((a, b) =>
    (a.id || rowKey(a)).localeCompare(b.id || rowKey(b))
  )
  const lines = [
    '# Element Control Audit Matrix Current',
    '',
    `Generated: ${process.env.MATRIX_DATE || 'local run'}`,
    '',
    `Status: ${result.ok ? 'PASS' : 'FAIL'}`,
    '',
    `Rows: ${result.summary.total}`,
    `works: ${result.summary.works || 0}`,
    `partial: ${result.summary.partial || 0}`,
    `broken: ${result.summary.broken || 0}`,
    `export-gap: ${result.summary['export-gap'] || 0}`,
    '',
    '| ID | Status | Evidence | Test Coverage | Decision |',
    '|---|---|---|---|---|',
  ]
  for (const row of sorted) {
    const id = row.id || rowKey(row)
    lines.push(
      `| \`${id}\` | ${row.status} | ${asArray(row.evidence).join('<br>')} | ${asArray(row.testCoverage).join('<br>')} | ${row.decision} |`
    )
  }
  return `${lines.join('\n')}\n`
}

export async function loadCanonicalElements() {
  const mod = await import(pathToFileURL(ELEMENT_DEFAULTS_PATH).href)
  return Object.keys(mod.ELEMENT_DEFAULTS)
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const canonicalElements = await loadCanonicalElements()
  const expectedControls = existsSync(EXPECTED_PATH) ? loadJson(EXPECTED_PATH).controls || [] : []
  const rows = existsSync(MATRIX_PATH) ? loadJson(MATRIX_PATH).rows || [] : []
  const result = validateElementControlAuditMatrix({ canonicalElements, expectedControls, rows })
  mkdirSync(dirname(REPORT_PATH), { recursive: true })
  writeFileSync(REPORT_PATH, renderElementControlReport({ rows, result }))
  for (const error of result.errors) console.error(`[element-control-matrix] FAIL ${error}`)
  if (result.ok) {
    console.log(`[element-control-matrix] PASS — ${result.summary.total} row(s)`)
  } else {
    console.error(`[element-control-matrix] FAILED — ${result.errors.length} error(s)`)
    process.exit(1)
  }
}
