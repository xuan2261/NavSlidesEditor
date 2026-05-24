import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('clipboard offset source contract', () => {
  const source = readFileSync('client/src/hooks/use-clipboard.js', 'utf8')

  it('paste and duplicate offsets remain +20/+20', () => {
    const xOffsets = source.match(/x:\s*\([^)]*\)\s*\+\s*20/g) || []
    const yOffsets = source.match(/y:\s*\([^)]*\)\s*\+\s*20/g) || []

    expect(xOffsets.length).toBeGreaterThanOrEqual(2)
    expect(yOffsets.length).toBeGreaterThanOrEqual(2)
  })
})
