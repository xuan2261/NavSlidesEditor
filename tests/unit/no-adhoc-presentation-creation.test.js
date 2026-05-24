import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      return walk(fullPath)
    }
    return entry.name.endsWith('.js') ? [fullPath] : []
  })
}

describe('presentation fixture usage in e2e', () => {
  it('does not create root presentations outside test fixtures', () => {
    const violations = walk('tests/e2e')
      .filter((file) => !file.includes(join('tests', 'e2e', 'fixtures')))
      .filter((file) => {
        const source = readFileSync(file, 'utf8')
        const rootPresentationRequest =
          /(request\.post|fetch)\(\s*(?:['"`][^'"`]*\/api\/presentations['"`]|`\$\{[^}]+\}\/presentations`)\s*,/.test(
            source
          )
        const fixtureDefinition = /function\s+apiCreatePresentation|const\s+apiCreatePresentation/.test(source)
        return rootPresentationRequest && !fixtureDefinition
      })

    expect(violations).toEqual([])
  })
})
