import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '..', '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

describe('pptx import strict npm scripts contract', () => {
  it('keeps importer qualification separate from metrics and browser audit', () => {
    expect(pkg.scripts['test:pptx:corpus-metrics']).toContain('--strict-metrics')
    expect(pkg.scripts['test:corpus']).toBe('npm run test:pptx:corpus-metrics')
    expect(pkg.scripts['test:pptx:importer-qualification']).toContain('--importer-strict')
    expect(pkg.scripts['test:pptx:strict']).toBe('npm run test:pptx:importer-qualification')
    expect(pkg.scripts['test:pptx:browser-audit']).toContain('--scope=smoke')
    expect(pkg.scripts['test:pptx:browser-audit:full']).toContain('--scope=full')
  })
})

