// Renders the matrix rows into a human-readable, git-diffable Markdown map.
// Kept separate so build-matrix.mjs stays lean (per ≤200 LOC rule).

const STATUS_ORDER = [
  'PASS',
  'FAIL',
  'DEEP-GAP',
  'SKIP',
  'TAGGED',
  'GAP',
  'ALLOWED',
]

function summaryLine(summary) {
  const pct =
    summary.total > 0 ? Math.round((summary.verified / summary.total) * 100) : 0
  const parts = STATUS_ORDER.filter((k) => summary[k]).map(
    (k) => `${k}: ${summary[k]}`
  )
  return `Verified (PASS only): ${summary.verified}/${summary.total} (${pct}%)  |  ${parts.join('  |  ')}`
}

export function renderMatrixMarkdown({ rows, orphans, summary, meta = {} }) {
  const lines = []
  lines.push(`# ${meta.title || 'Feature Coverage Matrix — editor-core'}`)
  lines.push('')
  if (meta.generated) lines.push(`_Generated: ${meta.generated}_`)
  if (meta.stale) {
    lines.push('')
    lines.push(
      `> ⚠️ **Run results stale or missing** — statuses derived without a fresh test run. PASS counts may be optimistic; regenerate with a fresh \`--reporter=json\` run.`
    )
  }
  lines.push('')
  lines.push(summaryLine(summary))
  if (summary['DEPTH-WARN']) {
    lines.push(`Depth warnings (warn-first): ${summary['DEPTH-WARN']}`)
  }
  lines.push('')

  const byCategory = {}
  for (const r of rows) (byCategory[r.category] ||= []).push(r)

  for (const category of Object.keys(byCategory).sort()) {
    lines.push(`## ${category}`)
    lines.push('')
    lines.push('| Capability | Risk | Tier | Layer | Depth | Test(s) | Status |')
    lines.push('|---|---|---|---|---|---|---|')
    for (const r of byCategory[category]) {
      const tests = r.tests.length ? r.tests.join('<br>') : '(none)'
      const depths = r.depths?.length ? r.depths.join(', ') : '-'
      const missing = r.missingDepths?.length
        ? `<br>Missing: ${r.missingDepths.join(', ')}`
        : ''
      lines.push(
        `| ${r.id} | ${r.risk} | ${r.tier} | ${r.layer || '-'} | ${depths}${missing} | ${tests} | ${r.status} |`
      )
    }
    lines.push('')
  }

  if (orphans.length) {
    lines.push('## ⚠️ Orphan tags (id not in inventory — stale, fix or remove)')
    lines.push('')
    for (const id of orphans) lines.push(`- \`${id}\``)
    lines.push('')
  }

  return lines.join('\n') + '\n'
}
