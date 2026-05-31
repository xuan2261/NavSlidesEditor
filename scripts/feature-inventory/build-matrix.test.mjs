import { describe, it, expect } from 'vitest'
import { buildMatrix } from './build-matrix.mjs'
import { buildRunIndex } from './join-run-status.mjs'

const INVENTORY = [
  { id: 'element.chart', category: 'element', source: 'ELEMENT_DEFAULTS', risk: 'high', tiers: ['smoke', 'deep'], scope: 'editor-core' },
  { id: 'element.timeline', category: 'element', source: 'ELEMENT_DEFAULTS', risk: 'low', tiers: ['smoke'], scope: 'editor-core' },
  { id: 'canvas.rotate-snap', category: 'canvas', source: 'manifest', risk: 'high', tiers: ['smoke', 'deep'], scope: 'editor-core' },
  { id: 'flow.clipboard', category: 'flow', source: 'manifest', risk: 'high', tiers: ['smoke', 'deep'], scope: 'editor-core' },
  { id: 'control.format.bold', category: 'control', source: 'manifest', risk: 'low', tiers: ['smoke'], scope: 'editor-core' },
  { id: 'element.audio', category: 'element', source: 'ELEMENT_DEFAULTS', risk: 'low', tiers: ['smoke'], scope: 'editor-core' },
  { id: 'flow.autosave', category: 'flow', source: 'manifest', risk: 'high', tiers: ['smoke', 'deep'], scope: 'editor-core' },
]

const TAGS = {
  // chart: smoke passes AND deep passes → PASS
  'element.chart': [
    { file: 'tests/e2e/elements/chart.spec.js', title: '[cap:element.chart] renders', tier: 'smoke', layer: 'e2e', skipped: false },
    { file: 'client/src/chart.test.jsx', title: '[cap:element.chart tier:deep] maps data', tier: 'deep', layer: 'unit', skipped: false },
  ],
  // canvas.rotate-snap: smoke passes but NO deep → DEEP-GAP
  'canvas.rotate-snap': [
    { file: 'client/src/rotate.test.js', title: '[cap:canvas.rotate-snap] rotates', tier: 'smoke', layer: 'unit', skipped: false },
  ],
  // flow.clipboard: tagged test FAILED → FAIL
  'flow.clipboard': [
    { file: 'client/src/clip.test.js', title: '[cap:flow.clipboard] copies', tier: 'smoke', layer: 'unit', skipped: false },
  ],
  // control.format.bold: tagged but skipped → SKIP
  'control.format.bold': [
    { file: 'client/src/bold.test.jsx', title: '[cap:control.format.bold] toggles', tier: 'smoke', layer: 'unit', skipped: true },
  ],
  // element.audio: tagged but no run result joined → TAGGED
  'element.audio': [
    { file: 'client/src/audio.test.jsx', title: '[cap:element.audio] mounts', tier: 'smoke', layer: 'unit', skipped: false },
  ],
  // orphan: not in inventory → ORPHAN-TAG
  'element.bogus': [
    { file: 'client/src/x.test.js', title: '[cap:element.bogus] x', tier: 'smoke', layer: 'unit', skipped: false },
  ],
  // flow.autosave: NO tag at all → GAP (omitted here)
}

// Real vitest reports the FULL literal it() title, including the [cap:*] token,
// so each run row title equals the tagged occurrence title above.
const RUN_INDEX = buildRunIndex([
  { file: 'chart.spec.js', title: '[cap:element.chart] renders', status: 'passed' },
  { file: 'chart.test.jsx', title: '[cap:element.chart tier:deep] maps data', status: 'passed' },
  { file: 'rotate.test.js', title: '[cap:canvas.rotate-snap] rotates', status: 'passed' },
  { file: 'clip.test.js', title: '[cap:flow.clipboard] copies', status: 'failed' },
  { file: 'bold.test.jsx', title: '[cap:control.format.bold] toggles', status: 'skipped' },
])

function statusOf(rows, id) {
  return rows.find((r) => r.id === id)?.status
}

describe('matrix builder status semantics', () => {
  const { rows, orphans, summary } = buildMatrix({
    inventory: INVENTORY,
    tags: TAGS,
    runIndex: RUN_INDEX,
    allowlist: [],
  })

  it('PASS only when tagged test ran AND passed (smoke+deep both pass)', () => {
    expect(statusOf(rows, 'element.chart')).toBe('PASS')
  })

  it('DEEP-GAP for high-risk smoke-pass with no deep pass', () => {
    expect(statusOf(rows, 'canvas.rotate-snap')).toBe('DEEP-GAP')
  })

  it('FAIL when tagged test ran and failed', () => {
    expect(statusOf(rows, 'flow.clipboard')).toBe('FAIL')
  })

  it('SKIP when tagged test was skipped (never green)', () => {
    expect(statusOf(rows, 'control.format.bold')).toBe('SKIP')
  })

  it('TAGGED when tag exists but no run result joined', () => {
    expect(statusOf(rows, 'element.audio')).toBe('TAGGED')
  })

  it('GAP when no tag exists for an inventory capability', () => {
    expect(statusOf(rows, 'flow.autosave')).toBe('GAP')
    expect(statusOf(rows, 'element.timeline')).toBe('GAP')
  })

  it('ORPHAN-TAG surfaces tags for ids not in inventory', () => {
    expect(orphans).toContain('element.bogus')
  })

  it('knownIds can suppress cross-scope tags from the orphan list', () => {
    const result = buildMatrix({
      inventory: INVENTORY.filter((cap) => cap.scope === 'editor-core'),
      tags: {
        'share.password': [
          { file: 'share.spec.js', title: '[cap:share.password] protects', tier: 'smoke', layer: 'e2e', skipped: false },
        ],
      },
      runIndex: RUN_INDEX,
      allowlist: [],
      knownIds: [...INVENTORY.map((cap) => cap.id), 'share.password'],
    })
    expect(result.orphans).toEqual([])
  })

  it('does not emit a matrix row for an orphan tag', () => {
    expect(rows.find((r) => r.id === 'element.bogus')).toBeUndefined()
  })

  it('summary counts only PASS toward verified', () => {
    expect(summary.PASS).toBe(1)
    expect(summary.verified).toBe(1)
    expect(summary.total).toBe(INVENTORY.length)
  })

  it('rows are sorted by id deterministically', () => {
    const ids = rows.map((r) => r.id)
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)))
  })
})

describe('matrix builder allowlist handling', () => {
  it('marks an allowlisted GAP as ALLOWED', () => {
    const { rows } = buildMatrix({
      inventory: INVENTORY,
      tags: TAGS,
      runIndex: RUN_INDEX,
      allowlist: [{ id: 'flow.autosave', reason: 'deferred', added: '2026-05-30' }],
    })
    expect(statusOf(rows, 'flow.autosave')).toBe('ALLOWED')
  })

  it('marks an allowlisted SKIP as ALLOWED', () => {
    const { rows } = buildMatrix({
      inventory: INVENTORY,
      tags: TAGS,
      runIndex: RUN_INDEX,
      allowlist: [{ id: 'control.format.bold', reason: 'flaky', added: '2026-05-30' }],
    })
    expect(statusOf(rows, 'control.format.bold')).toBe('ALLOWED')
  })

  it('never marks a FAIL as ALLOWED (failing test stays red)', () => {
    const { rows } = buildMatrix({
      inventory: INVENTORY,
      tags: TAGS,
      runIndex: RUN_INDEX,
      allowlist: [{ id: 'flow.clipboard', reason: 'x', added: '2026-05-30' }],
    })
    expect(statusOf(rows, 'flow.clipboard')).toBe('FAIL')
  })

  it('never marks a PASS as ALLOWED', () => {
    const { rows } = buildMatrix({
      inventory: INVENTORY,
      tags: TAGS,
      runIndex: RUN_INDEX,
      allowlist: [{ id: 'element.chart', reason: 'x', added: '2026-05-30' }],
    })
    expect(statusOf(rows, 'element.chart')).toBe('PASS')
  })
})
