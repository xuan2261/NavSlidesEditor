import { describe, it, expect } from 'vitest'
import {
  parseVitestJson,
  parsePlaywrightJson,
  buildRunIndex,
  resolveStatus,
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
    const index = buildRunIndex([
      ...parseVitestJson(VITEST_JSON),
      ...parsePlaywrightJson(PLAYWRIGHT_JSON),
    ])
    const occ = {
      file: 'client/src/foo.test.js',
      title: '[cap:element.chart] renders bar chart',
    }
    // tag title contains the leaf test title as a substring
    expect(resolveStatus(occ, index)).toBe('passed')
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

  it('resolveStatus prefers failed over passed on title collision', () => {
    const index = buildRunIndex([
      { file: 'a.test.js', title: 'same title', status: 'passed' },
      { file: 'a.test.js', title: 'same title', status: 'failed' },
    ])
    const occ = { file: 'x/a.test.js', title: '[cap:y] same title' }
    expect(resolveStatus(occ, index)).toBe('failed')
  })
})
