import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'

describe('page-object filename convention', () => {
  it('all files in tests/e2e/pages are kebab-case', () => {
    const files = readdirSync('tests/e2e/pages').filter((file) => file.endsWith('.js'))
    const violations = files.filter((file) => /[A-Z]/.test(file))

    expect(violations).toEqual([])
  })
})
