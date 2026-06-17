import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const root = resolve(__dirname, '..', '..')
const readText = (...parts) => readFileSync(resolve(root, ...parts), 'utf8').replace(/\r\n/g, '\n')
const readJson = (...parts) => JSON.parse(readText(...parts))
const { STRICT_CORPUS_GATES } = require('../../server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js')

describe('pptx import docs contract', () => {
  it('keeps strict script docs aligned with package commands and gate constants', () => {
    const pkg = readJson('package.json')
    const readme = readText('README.md')
    const codeStandards = readText('docs', 'code-standards.md')
    const fidelityReport = readText('docs', 'pptx-import-fidelity-report.md')
    const corpusReadme = readText('server', 'data', 'test-corpus', 'README.md')

    expect(pkg.scripts['test:pptx:strict']).toBe('npm run test:corpus && npm run test:pptx:browser-audit')
    expect(pkg.scripts['test:pptx:browser-audit']).toContain('--scope=smoke')
    expect(pkg.scripts['test:pptx:browser-audit:full']).toContain('--scope=full')

    expect(readme).toContain('corpus + strict smoke browser audit')
    expect(readme).not.toContain('test:pptx:strict               # corpus + full browser audit')

    for (const doc of [readme, codeStandards, fidelityReport, corpusReadme]) {
      expect(doc).toContain(`semantic >= ${STRICT_CORPUS_GATES.avgSemanticFidelity.label}`)
      expect(doc).toContain(`round-trip floor >= ${STRICT_CORPUS_GATES.avgRoundTripStability.label}`)
    }
  })

  it('documents OOXML native object coverage as additive evidence, not full parser support', () => {
    const fidelityReport = readText('docs', 'pptx-import-fidelity-report.md')
    const architecture = readText('docs', 'system-architecture.md')
    const roadmap = readText('docs', 'project-roadmap.md')
    const docs = `${fidelityReport}\n${architecture}\n${roadmap}`

    expect(docs).toContain('OOXML slide relationship')
    expect(docs).toContain('nativeObjectCoverage')
    expect(docs).toContain('evidence entries')
    expect(docs).toContain('full native SmartArt/chart reconstruction remains parser work')
  })
})
