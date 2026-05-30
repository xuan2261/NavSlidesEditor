import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const MATRIX_JSON = resolve(
  HERE,
  '../../plans/260530-0854-feature-coverage-traceability-matrix-system-tdd/reports/feature-coverage-matrix.json'
)

// Curated subset that MUST be PASS after retrofit. Anchored on unit tests with
// genuine deep assertions (clipboard fidelity, snapping geometry, multiselect)
// so the guard is deterministic without a heavy/flaky Playwright run.
const MUST_PASS = ['flow.clipboard', 'canvas.smart-guides', 'flow.find-replace']

describe('tag retrofit guard — curated subset is PASS in regenerated matrix', () => {
  let byId = {}
  let doc
  beforeAll(() => {
    expect(existsSync(MATRIX_JSON), 'matrix JSON must exist (run npm run matrix:capture)').toBe(true)
    doc = JSON.parse(readFileSync(MATRIX_JSON, 'utf8'))
    byId = Object.fromEntries(doc.rows.map((r) => [r.id, r]))
  })

  for (const id of MUST_PASS) {
    it(`${id} is PASS`, () => {
      expect(byId[id], `${id} missing from matrix`).toBeTruthy()
      expect(byId[id].status).toBe('PASS')
    })
  }

  it('has no orphan tags (every [cap:*] id resolves to inventory)', () => {
    // An orphan means a tag id was mistyped or truncated (e.g. the camelCase
    // extractor bug). Zero orphans proves every tag maps to a real capability.
    expect(doc.orphans).toEqual([])
  })
})
