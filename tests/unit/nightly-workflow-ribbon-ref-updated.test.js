import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('nightly ribbon workflow split path', () => {
  const workflow = readFileSync(
    '.github/workflows/nightly-ribbon-layout-768px-soft-warning-no-pr-gate.yml',
    'utf8'
  )

  it('targets the split ribbon directory, not the deleted monolithic spec', () => {
    expect(workflow).not.toMatch(/tests\/e2e\/ribbon-layout\.spec\.js/)
    expect(workflow).toMatch(/tests\/e2e\/ribbon\//)
  })
})
