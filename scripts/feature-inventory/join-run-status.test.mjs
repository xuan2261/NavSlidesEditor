import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  parseVitestJson,
  parsePlaywrightJson,
  buildRunIndex,
  resolveStatus,
  isRunResultStale,
  loadRunResults,
} from './join-run-status.mjs'

const VITEST_JSON = {
  testResults: [
    {
      name: 'C:/repo/client/src/foo.test.js',
      assertionResults: [
        { title: 'renders bar chart', status: 'passed', ancestorTitles: ['chart'] },
        { title: 'fails on bad data', status: 'failed', ancestorTitles: ['chart'] },
        { title: 'is skipped', status: 'skipped', ancestorTitles: ['chart'] },
        { title: 'pending one', status: 'pending', ancestorTitles: ['chart'] },
      ],
    },
  ],
}

const PLAYWRIGHT_JSON = {
  suites: [
    {
      title: 'elements/chart.spec.js',
      file: 'tests/e2e/elements/chart.spec.js',
      specs: [
        {
          title: 'chart renders in e2e',
          tests: [{ results: [{ status: 'passed' }] }],
        },
      ],
      suites: [
        {
          title: 'nested',
          file: 'tests/e2e/elements/chart.spec.js',
          specs: [
            {
              title: 'nested e2e fails',
              tests: [{ results: [{ status: 'failed' }] }],
            },
          ],
        },
      ],
    },
  ],
}

describe('run-status joiner', () => {
  it('parses vitest passed/failed/skipped (pending → skipped)', () => {
    const rows = parseVitestJson(VITEST_JSON)
    const byTitle = Object.fromEntries(rows.map((r) => [r.title, r.status]))
    expect(byTitle['renders bar chart']).toBe('passed')
    expect(byTitle['fails on bad data']).toBe('failed')
    expect(byTitle['is skipped']).toBe('skipped')
    expect(byTitle['pending one']).toBe('skipped')
  })

  it('vitest rows carry file basename', () => {
    const rows = parseVitestJson(VITEST_JSON)
    expect(rows[0].file).toBe('foo.test.js')
  })

  it('parses playwright nested suites recursively', () => {
    const rows = parsePlaywrightJson(PLAYWRIGHT_JSON)
    const byTitle = Object.fromEntries(rows.map((r) => [r.title, r.status]))
    expect(byTitle['chart renders in e2e']).toBe('passed')
    expect(byTitle['nested e2e fails']).toBe('failed')
  })

  it('resolveStatus matches a tag occurrence by basename + leaf title', () => {
    // Real vitest reports the FULL literal it() title, including the [cap:*]
    // token, so the run row title equals the occurrence title.
    const index = buildRunIndex([
      { file: 'foo.test.js', title: '[cap:element.chart] renders bar chart', status: 'passed' },
    ])
    const occ = {
      file: 'client/src/foo.test.js',
      title: '[cap:element.chart] renders bar chart',
    }
    expect(resolveStatus(occ, index)).toBe('passed')
  })

  it('does NOT bind a tagged test to a passing untagged sibling (no substring false-PASS)', () => {
    // The tagged test is skipped at RUNTIME (describe.skip / skipIf) so occ.skipped
    // is false, but a sibling whose title is a substring of the tagged title
    // passed. The join must report the tagged test's own status (skipped), never
    // the sibling's pass — that would manufacture false confidence.
    const index = buildRunIndex([
      { file: 'align.test.js', title: 'aligns elements', status: 'passed' },
      { file: 'align.test.js', title: '[cap:canvas.align] aligns elements to grid', status: 'skipped' },
    ])
    const occ = {
      file: 'client/src/align.test.js',
      title: '[cap:canvas.align] aligns elements to grid',
    }
    expect(resolveStatus(occ, index)).toBe('skipped')
  })

  it('resolveStatus matches a tag placed on a describe (ancestor) title', () => {
    // vitest reports describe titles as ancestorTitles, not the leaf title. A
    // tag on a describe must still resolve to its tests' run status.
    const json = {
      testResults: [
        {
          name: 'C:/repo/client/src/rotate.test.js',
          assertionResults: [
            {
              title: 'snaps 22 to 15',
              status: 'passed',
              ancestorTitles: ['[cap:canvas.rotate-snap tier:deep] rotation snapping'],
            },
          ],
        },
      ],
    }
    const index = buildRunIndex(parseVitestJson(json))
    const occ = {
      file: 'client/src/rotate.test.js',
      title: '[cap:canvas.rotate-snap tier:deep] rotation snapping',
    }
    expect(resolveStatus(occ, index)).toBe('passed')
  })

  it('resolveStatus returns null when no run result joined', () => {
    const index = buildRunIndex(parseVitestJson(VITEST_JSON))
    const occ = { file: 'client/src/other.test.js', title: '[cap:x] never ran' }
    expect(resolveStatus(occ, index)).toBeNull()
  })

  it('isRunResultStale flags run-results older than the newest test file', () => {
    // run-results captured at t=100; a test file was edited at t=200 → stale.
    expect(isRunResultStale(100, [50, 200, 80])).toBe(true)
  })

  it('isRunResultStale is false when run-results are newer than every test file', () => {
    expect(isRunResultStale(300, [50, 200, 80])).toBe(false)
  })

  it('isRunResultStale is false when there are no test files to compare', () => {
    expect(isRunResultStale(100, [])).toBe(false)
  })

  it('isRunResultStale treats a missing run-result mtime (null) as stale', () => {
    expect(isRunResultStale(null, [50])).toBe(true)
  })

  it('resolveStatus prefers failed over passed across a describe-tagged group', () => {
    // A [cap:*] tag on a describe spans multiple leaf tests; if any leaf failed,
    // the cap must resolve to failed (failed > passed > skipped).
    const index = buildRunIndex([
      { file: 'a.test.js', title: 'case one', fullTitle: '[cap:y] suite case one', status: 'passed' },
      { file: 'a.test.js', title: 'case two', fullTitle: '[cap:y] suite case two', status: 'failed' },
    ])
    const occ = { file: 'x/a.test.js', title: '[cap:y] suite' }
    expect(resolveStatus(occ, index)).toBe('failed')
  })

  it('tracks stale evidence separately for vitest and playwright result files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'navslides-run-status-'))
    const vitestPath = join(dir, 'run-results-vitest.json')
    const playwrightPath = join(dir, 'run-results-playwright.json')
    writeFileSync(vitestPath, JSON.stringify(VITEST_JSON))
    writeFileSync(playwrightPath, JSON.stringify(PLAYWRIGHT_JSON))

    const now = Date.now()
    const result = loadRunResults({
      vitestPath,
      playwrightPath,
      testFileMtimes: {
        vitest: [now - 1000],
        playwright: [now + 1000],
      },
    })

    expect(result.stale).toBe(true)
    expect(result.staleSources).toEqual({ vitest: false, playwright: true })
  })
})
