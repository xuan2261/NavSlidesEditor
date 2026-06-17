import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '..', '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

describe('pptx import strict npm scripts contract', () => {
  it('keeps strict verification on corpus plus smoke browser audit', () => {
    expect(pkg.scripts['test:pptx:browser-audit']).toContain('--scope=smoke')
    expect(pkg.scripts['test:pptx:browser-audit:full']).toContain('--scope=full')
    expect(pkg.scripts['test:pptx:strict']).toBe('npm run test:corpus && npm run test:pptx:browser-audit')
  })
})

