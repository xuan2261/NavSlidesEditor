import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { buildMatrix } from './build-matrix.mjs'
import { renderMatrixMarkdown } from './matrix-format.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPORTS_DIR = resolve(
  HERE,
  '../../plans/260531-0511-full-feature-verification-gap-closure-tdd/reports'
)

function readJson(path, fallback) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback
}

export function buildExtendedDomainReport({ inventory, tags, runIndex }) {
  const extended = inventory.filter((cap) => cap.scope !== 'editor-core')
  const result = buildMatrix({
    inventory: extended,
    tags,
    runIndex,
    knownIds: inventory.map((cap) => cap.id),
  })
  const policy = extended.map((cap) => ({
    id: cap.id,
    scope: cap.scope,
    risk: cap.risk,
    targetLayer: cap.targetLayer,
    coverageMode: cap.coverageMode,
  }))
  return { ...result, policy }
}

export function trustedExtendedRunIndex(runIndex, stale) {
  return stale ? new Map() : runIndex
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const { extractAllTags } = await import('./extract-tags.mjs')
  const { loadRunResults } = await import('./join-run-status.mjs')
  const { statSync } = await import('node:fs')

  const inventory = readJson(resolve(HERE, 'inventory.json'), [])
  const tags = extractAllTags()
  const taggedFiles = [
    ...new Set(Object.values(tags).flat().map((occurrence) => resolve(HERE, '../..', occurrence.file))),
  ]
  const mtimesFor = (predicate) => taggedFiles.filter(predicate).map((file) => {
    try {
      return statSync(file).mtimeMs
    } catch {
      return 0
    }
  })
  const testFileMtimes = {
    vitest: mtimesFor((file) => !file.replace(/\\/g, '/').includes('/tests/e2e/')),
    playwright: mtimesFor((file) => file.replace(/\\/g, '/').includes('/tests/e2e/')),
  }
  const playwrightRunPath = resolve(HERE, 'run-results-playwright.json')
  const { index: runIndex, stale, staleSources } = loadRunResults({
    vitestPath: resolve(HERE, 'run-results-vitest.json'),
    playwrightPath: existsSync(playwrightRunPath) ? playwrightRunPath : null,
    testFileMtimes,
  })

  const trustedRunIndex = trustedExtendedRunIndex(runIndex, stale)
  const report = buildExtendedDomainReport({ inventory, tags, runIndex: trustedRunIndex })
  const meta = {
    generated: process.env.MATRIX_DATE || 'local run',
    stale,
    staleSources,
    title: 'Extended Domain Coverage Matrix',
  }
  mkdirSync(REPORTS_DIR, { recursive: true })
  writeFileSync(
    resolve(REPORTS_DIR, 'extended-domain-coverage-matrix.json'),
    JSON.stringify({ meta, ...report }, null, 2) + '\n'
  )
  writeFileSync(
    resolve(REPORTS_DIR, 'extended-domain-coverage-matrix.md'),
    renderMatrixMarkdown({ ...report, meta })
  )
  const s = report.summary
  console.log(
    `[extended-domain-report] ${s.verified}/${s.total} verified | GAP:${s.GAP || 0} TAGGED:${s.TAGGED || 0} | orphans:${report.orphans.length}`
  )
}
