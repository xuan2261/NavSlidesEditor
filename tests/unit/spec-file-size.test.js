import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      return walk(fullPath)
    }
    return entry.name.endsWith('.spec.js') ? [fullPath] : []
  })
}

describe('e2e spec file size', () => {
  it('keeps every e2e spec at 200 LOC or below', () => {
    const oversized = walk('tests/e2e').filter((file) => {
      const lines = readFileSync(file, 'utf8').split('\n').length
      return lines > 200
    })

    expect(oversized).toEqual([])
  })
})
