import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ELEMENT_DEFAULTS } from './element-defaults'
import { DEFAULT_SHORTCUTS } from '../utils/default-keyboard-shortcut-definitions-registry'
import { DEFAULT_TOKENS, AUTO_FIELD_MAP, resolveColorField } from 'revealjs-shared'

const THIS_DIR = dirname(fileURLToPath(import.meta.url))

describe('element-defaults guards README count claim', () => {
  it('exposes exactly 19 element types (matches README "19 element types")', () => {
    expect(Object.keys(ELEMENT_DEFAULTS)).toHaveLength(19)
  })

  it('callout default width/height are >= canvas MIN_SIZE (40)', () => {
    expect(ELEMENT_DEFAULTS.callout.width).toBeGreaterThanOrEqual(40)
    expect(ELEMENT_DEFAULTS.callout.height).toBeGreaterThanOrEqual(40)
  })
})

describe('shared presentation JSDoc mirrors canonical element defaults', () => {
  const presentationTypesPath = resolve(THIS_DIR, '../../../shared/src/types/presentation.js')
  const presentationTypesSource = readFileSync(presentationTypesPath, 'utf8')
  const elementTypeMatch = presentationTypesSource.match(/@typedef \{([^}]+)\} ElementType/)
  const elementTypes = elementTypeMatch?.[1]
    .split('|')
    .map((type) => type.trim().replace(/^'|'$/g, ''))
    .filter(Boolean)

  it('declares exactly the canonical ElementType union', () => {
    expect(elementTypeMatch, 'ElementType typedef is present').toBeTruthy()
    expect(elementTypes.sort()).toEqual(Object.keys(ELEMENT_DEFAULTS).sort())
  })

  it('does not retain stale qr/divider aliases and includes current concrete types', () => {
    expect(elementTypes).not.toEqual(expect.arrayContaining(['qr', 'divider']))
    expect(elementTypes).toEqual(expect.arrayContaining(['qrcode', 'timeline', 'game']))
  })

  it('uses current high-risk element property names in concrete typedefs', () => {
    expect(presentationTypesSource).not.toMatch(/\bshapeType:/)
    expect(presentationTypesSource).not.toMatch(/\bcode:/)
    expect(presentationTypesSource).not.toMatch(/\blatex:/)
    expect(presentationTypesSource).not.toMatch(/\bhtmlContent:/)
    expect(presentationTypesSource).not.toMatch(/\bmarkdown:/)
    expect(presentationTypesSource).not.toMatch(/\bcolor: string,\n \*   strokeWidth/)
    expect(presentationTypesSource).toMatch(/\bshape:/)
    expect(presentationTypesSource).toMatch(/\bcontent: string/)
    expect(presentationTypesSource).toMatch(/\biconColor:/)
  })
})

// The token flip (hex -> 'auto') must produce ZERO out-of-box visual change:
// every default color field flipped to 'auto' must resolve, under DEFAULT_TOKENS,
// to the exact hex it held before the flip.
describe("default 'auto' colors resolve to the historical hex (no out-of-box change)", () => {
  // Map of (type, field) -> the hex the default held BEFORE the flip.
  const PRIOR_HEX = {
    shape: { fill: '#6366f1', textColor: '#ffffff' },
    text: { textColor: '#ffffff' },
    icon: { iconColor: '#ffffff' },
    callout: { calloutTextColor: '#ffffff' },
    table: { textColor: '#ffffff' },
    drawing: { strokeColor: '#ffffff' },
    line: { stroke: '#ffffff' },
    timeline: { lineColor: '#6366f1', dotColor: '#6366f1', textColor: '#ffffff' },
  }

  for (const [type, fields] of Object.entries(PRIOR_HEX)) {
    for (const [field, priorHex] of Object.entries(fields)) {
      it(`${type}.${field} default 'auto' -> ${priorHex} under DEFAULT_TOKENS`, () => {
        // The current default is the 'auto' sentinel.
        expect(ELEMENT_DEFAULTS[type][field]).toBe('auto')
        // 'auto' resolves to a token var whose DEFAULT_TOKENS value == prior hex.
        const tokenVar = resolveColorField('auto', type, field) // var(--ns-X)
        const tokenName = tokenVar.match(/^var\(--ns-(.+)\)$/)[1]
        expect(DEFAULT_TOKENS.colors[tokenName]).toBe(priorHex)
        // sanity: AUTO_FIELD_MAP agrees
        expect(`var(--ns-${AUTO_FIELD_MAP[type][field]})`).toBe(tokenVar)
      })
    }
  }
})


// Drift guard (auto-source layer): a new ELEMENT_DEFAULTS key or DEFAULT_SHORTCUTS
// id must be tracked by the coverage matrix as PASS (verified) or ALLOWED
// (acknowledged debt). A new capability with neither → this test goes red,
// forcing a [cap:*] test or a dated allowlist entry. game is game-scope, excluded.
describe('feature-coverage drift guard', () => {
  const MATRIX_JSON = resolve(
    THIS_DIR,
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
