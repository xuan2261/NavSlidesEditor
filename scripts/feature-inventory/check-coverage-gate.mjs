import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const MATRIX_JSON = resolve(
  HERE,
  '../../plans/260530-0854-feature-coverage-traceability-matrix-system-tdd/reports/feature-coverage-matrix.json'
)
const ALLOWLIST_PATH = resolve(HERE, 'coverage-gate-allowlist.json')

const STALE_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

// Statuses that an allowlist entry may legitimately suppress to a WARN.
// PASS needs nothing; FAIL must NEVER be allowlisted (a red test stays red).
const ALLOWABLE = new Set(['GAP', 'DEEP-GAP', 'SKIP', 'TAGGED', 'ALLOWED'])

function validateAllowlist(allowlist) {
  const errors = []
  for (const e of allowlist) {
    if (!e.id) errors.push(`allowlist entry missing id: ${JSON.stringify(e)}`)
    if (!e.reason) errors.push(`allowlist entry for ${e.id || '?'} missing reason`)
    if (!e.added) errors.push(`allowlist entry for ${e.id || '?'} missing added date`)
    if (!e.owner) errors.push(`allowlist entry for ${e.id || '?'} missing owner`)
    if (!e.targetLayer) errors.push(`allowlist entry for ${e.id || '?'} missing targetLayer`)
    if (!e.resolutionPhase) errors.push(`allowlist entry for ${e.id || '?'} missing resolutionPhase`)
    if (!e.debtAllowedUntil) errors.push(`allowlist entry for ${e.id || '?'} missing debtAllowedUntil`)
  }
  return errors
}

export function checkGate({ rows, orphans = [], allowlist = [], now = Date.now(), stale = false }) {
  const errors = validateAllowlist(allowlist)
  const allowById = new Map(allowlist.map((e) => [e.id, e]))
  const failures = []
  const warnings = []

  if (stale) {
    warnings.push('STALE matrix evidence: run results are stale or missing; refresh test reporter JSON before treating PASS counts as release evidence')
  }

  for (const row of rows) {
    const entry = allowById.get(row.id)
    if (row.depthStatus === 'DEPTH-WARN') {
      const missing = (row.missingDepths || []).join(', ')
      const owner = row.depthOwner ? ` owner:${row.depthOwner}` : ''
      warnings.push(`DEPTH-WARN: ${row.id} missing ${missing || '(unknown)'}${owner}`)
    }
    if (row.status === 'PASS') continue
    if (row.status === 'FAIL') {
      // A failing test is a hard fail regardless of allowlist — never mask red.
      failures.push(`FAIL: ${row.id} — a tagged test is failing (fix the test)`)
      continue
    }
    if (ALLOWABLE.has(row.status)) {
      if (entry) {
        warnings.push(`${row.status} (allowlisted): ${row.id} — ${entry.reason}`)
      } else {
        failures.push(
          `${row.status}: ${row.id} — add a [cap:${row.id}] test or an allowlist entry`
        )
      }
      continue
    }
    failures.push(`UNKNOWN status ${row.status}: ${row.id}`)
  }

  for (const id of orphans) {
    failures.push(`ORPHAN-TAG: ${id} — tag references an id not in inventory (remove or fix)`)
  }

  // Staleness nudge: warn on allowlist entries older than the threshold so the
  // list shrinks instead of becoming a permanent dumping ground.
  for (const e of allowlist) {
    const added = Date.parse(e.added)
    if (!Number.isNaN(added) && now - added > STALE_DAYS * DAY_MS) {
      const days = Math.floor((now - added) / DAY_MS)
      warnings.push(`STALE allowlist entry: ${e.id} added ${e.added} (${days}d old, >${STALE_DAYS}d)`)
    }
  }

  return { ok: failures.length === 0 && errors.length === 0, failures, warnings, errors }
}

function loadJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const matrix = loadJson(MATRIX_JSON, { rows: [], orphans: [] })
  const allowlistDoc = loadJson(ALLOWLIST_PATH, { entries: [] })
  const result = checkGate({
    rows: matrix.rows,
    orphans: matrix.orphans || [],
    allowlist: allowlistDoc.entries || [],
    stale: Boolean(matrix.meta?.stale),
  })
  for (const w of result.warnings) console.warn(`[gate] WARN ${w}`)
  for (const e of result.errors) console.error(`[gate] ERROR ${e}`)
  for (const f of result.failures) console.error(`[gate] FAIL ${f}`)
  if (result.ok) {
    console.log(`[gate] PASS — ${result.warnings.length} warning(s), 0 failures`)
    process.exit(0)
  } else {
    console.error(`[gate] FAILED — ${result.failures.length} failure(s), ${result.errors.length} error(s)`)
    process.exit(1)
  }
}
