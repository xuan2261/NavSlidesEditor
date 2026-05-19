#!/usr/bin/env node
/**
 * Summarize Vitest v8 coverage output (`coverage/coverage-summary.json`)
 * into a markdown report with totals + lowest-covered files.
 *
 * Usage:
 *   node scripts/summarize-vitest-coverage.js [output.md]
 *
 * Output: prints to stdout AND writes to `reports/coverage-baseline-{date}.md`
 * (or path passed as argv[2]).
 */
const fs = require('fs')
const path = require('path')

const SUMMARY_PATH = path.join(__dirname, '..', 'coverage', 'coverage-summary.json')

if (!fs.existsSync(SUMMARY_PATH)) {
  console.error(`Coverage summary not found at ${SUMMARY_PATH}. Run \`npm run test:coverage\` first.`)
  process.exit(1)
}

const summary = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'))
const { total, ...files } = summary

const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const defaultOut = path.join(
  __dirname,
  '..',
  'plans',
  '260519-1200-comprehensive-test-coverage-expansion',
  'reports',
  `coverage-baseline-${dateStr}.md`
)
const outPath = process.argv[2] || defaultOut

const lowestByMetric = (metric, n = 20) =>
  Object.entries(files)
    .map(([file, m]) => ({
      file: path.relative(path.join(__dirname, '..'), file),
      pct: m[metric].pct,
      covered: m[metric].covered,
      total: m[metric].total,
    }))
    .filter((f) => f.total > 0)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, n)

const fmt = (m) => `${m.pct.toFixed(1)}% (${m.covered}/${m.total})`

const lines = []
lines.push(`# Vitest Coverage Baseline — ${new Date().toISOString().slice(0, 10)}`)
lines.push('')
lines.push('## Total')
lines.push('')
lines.push('| Metric | Coverage |')
lines.push('|---|---|')
lines.push(`| Statements | ${fmt(total.statements)} |`)
lines.push(`| Branches | ${fmt(total.branches)} |`)
lines.push(`| Functions | ${fmt(total.functions)} |`)
lines.push(`| Lines | ${fmt(total.lines)} |`)
lines.push('')
lines.push('## 20 Lowest-Covered Files (by statement %)')
lines.push('')
lines.push('| File | Statements | Branches | Functions |')
lines.push('|---|---|---|---|')
const lowest = lowestByMetric('statements', 20)
for (const f of lowest) {
  const fileSummary = summary[path.join(__dirname, '..', f.file)]
  const branches = fileSummary?.branches
  const functions = fileSummary?.functions
  lines.push(
    `| \`${f.file.replace(/\\/g, '/')}\` | ${f.pct.toFixed(1)}% | ${branches?.pct?.toFixed(1) ?? '-'}% | ${functions?.pct?.toFixed(1) ?? '-'}% |`
  )
}

const md = lines.join('\n') + '\n'
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, md, 'utf8')

console.log(md)
console.log(`\nWrote ${outPath}`)
