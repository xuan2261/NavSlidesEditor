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
  it('keeps metrics, importer qualification, and browser scripts distinct', () => {
    const pkg = readJson('package.json')
    const readme = readText('README.md')
    const codeStandards = readText('docs', 'code-standards.md')
    const fidelityReport = readText('docs', 'pptx-import-fidelity-report.md')
    const corpusReadme = readText('server', 'data', 'test-corpus', 'README.md')

    expect(pkg.scripts['test:pptx:corpus-metrics']).toContain('--strict-metrics')
    expect(pkg.scripts['test:corpus']).toBe('npm run test:pptx:corpus-metrics')
    expect(pkg.scripts['test:pptx:best-effort']).toContain('npm run test:pptx:browser-audit')
    expect(pkg.scripts['test:pptx:importer-qualification']).toContain('--importer-strict')
    expect(pkg.scripts['test:pptx:strict']).toBe('npm run test:pptx:importer-qualification')
    expect(pkg.scripts['test:pptx:browser-audit']).toContain('--scope=smoke')
    expect(pkg.scripts['test:pptx:browser-audit:full']).toContain('--scope=full')

    expect(readme).toContain('Parser-relative PPTX corpus metrics')
    expect(readme).toContain('Manifest-bound PPTX importer qualification')
    expect(readme).toContain('deprecated alias for importer qualification')
    expect(codeStandards).toContain('PPTX evidence lanes are distinct')

    expect(codeStandards).toContain(`semantic >= ${STRICT_CORPUS_GATES.avgSemanticFidelity.label}`)
    expect(codeStandards).toContain(`round-trip >= ${STRICT_CORPUS_GATES.avgRoundTripStability.label}`)
    for (const doc of [fidelityReport, corpusReadme]) {
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

  it('keeps public PPTX workflow and round-trip limits accurate in English and Vietnamese', () => {
    const english = readText('website', 'features', 'pptx-import-export.md')
    const vietnamese = readText('website', 'vi', 'features', 'pptx-import-export.md')

    expect(english).toContain('Home dashboard')
    expect(english).toContain('verified immutable source package')
    expect(english).toContain('new file from the editor model')
    expect(english).toContain('editable shapes')
    expect(english).not.toContain('SmartArt is rasterized')

    expect(vietnamese).toContain('trang chủ')
    expect(vietnamese).toContain('gói nguồn bất biến đã được xác minh')
    expect(vietnamese).toContain('tạo tệp mới từ mô hình của trình biên tập')
    expect(vietnamese).toContain('hình khối có thể chỉnh sửa')
    expect(vietnamese).not.toContain('SmartArt được kết xuất thành hình ảnh')
  })
})
