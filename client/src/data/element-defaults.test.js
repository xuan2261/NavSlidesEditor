import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { ELEMENT_DEFAULTS } from './element-defaults'
import { DEFAULT_SHORTCUTS } from '../utils/default-keyboard-shortcut-definitions-registry'

describe('element-defaults guards README count claim', () => {
  it('exposes exactly 19 element types (matches README "19 element types")', () => {
    expect(Object.keys(ELEMENT_DEFAULTS)).toHaveLength(19)
  })
})

// Drift guard (auto-source layer): a new ELEMENT_DEFAULTS key or DEFAULT_SHORTCUTS
// id must be tracked by the coverage matrix as PASS (verified) or ALLOWED
// (acknowledged debt). A new capability with neither → this test goes red,
// forcing a [cap:*] test or a dated allowlist entry. game is game-scope, excluded.
describe('feature-coverage drift guard', () => {
  const MATRIX_JSON = resolve(
    __dirname,
    '../../../plans/260530-0854-feature-coverage-traceability-matrix-system-tdd/reports/feature-coverage-matrix.json'
  )
  const hasMatrix = existsSync(MATRIX_JSON)
  const statusById = hasMatrix
    ? Object.fromEntries(
        JSON.parse(readFileSync(MATRIX_JSON, 'utf8')).rows.map((r) => [r.id, r.status])
      )
    : {}
  const TRACKED = new Set(['PASS', 'ALLOWED'])

  it('matrix JSON exists (run `npm run matrix` to regenerate)', () => {
    expect(hasMatrix).toBe(true)
  })

  it('every editor-core element type is PASS or ALLOWED in the matrix', () => {
    const untracked = Object.keys(ELEMENT_DEFAULTS)
      .filter((type) => type !== 'game') // game-scope, excluded from editor-core matrix
      .map((type) => `element.${type}`)
      .filter((id) => !TRACKED.has(statusById[id]))
    expect(untracked, `untracked element caps (need [cap:*] test or allowlist): ${untracked}`).toEqual([])
  })

  it('every shortcut id is PASS or ALLOWED in the matrix', () => {
    const untracked = DEFAULT_SHORTCUTS.map((s) => `shortcut.${s.id}`).filter(
      (id) => !TRACKED.has(statusById[id])
    )
    expect(untracked, `untracked shortcut caps (need [cap:*] test or allowlist): ${untracked}`).toEqual([])
  })
})
