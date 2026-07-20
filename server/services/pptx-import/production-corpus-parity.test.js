import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

describe('production and corpus importer parity', () => {
  it('routes corpus imports through the production importer with route-equivalent defaults', async () => {
    const importPptxFile = vi.fn().mockResolvedValue({
      presentation: { slides: [] },
      stats: {},
      warnings: [],
    })
    const tester = await import('./pptx-import-semantic-and-roundtrip-fidelity-tester.js')

    await tester.importPresentation('fixture.pptx', undefined, {
      importer: importPptxFile,
    })

    expect(importPptxFile).toHaveBeenCalledWith('fixture.pptx', {
      originalName: 'fixture.pptx',
    })
  })

  it('has no private mapper or archive implementation in the corpus harness', async () => {
    const source = await fs.readFile(path.join(
      process.cwd(),
      'server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js'
    ), 'utf8')
    expect(source).not.toMatch(/mapPptxOutput/)
    expect(source).not.toMatch(/JSZip\.loadAsync/)
    expect(source).toMatch(/importPptxFile/)
  })

  it('does not turn strict corpus scoring into importer feature flags', async () => {
    const tester = await import('./pptx-import-semantic-and-roundtrip-fidelity-tester.js')
    expect(tester.productionImportOptions()).toEqual({})
    expect(tester.corpusFileOptions({
      strict: true,
    }, false)).toMatchObject({
      strict: true,
      skipRoundTrip: false,
      importOptions: {},
    })
  })

  it('forwards explicit importer strict flags without changing them', async () => {
    const tester = await import('./pptx-import-semantic-and-roundtrip-fidelity-tester.js')
    const explicitFlags = {
      strict: true,
      strictCountGate: true,
      strictPrimitives: true,
      originalName: 'explicit-name.pptx',
      uploadsDir: 'explicit-uploads',
    }
    const fileOptions = tester.corpusFileOptions({
      strict: true,
      importOptions: explicitFlags,
    }, false)

    expect(fileOptions.importOptions).toEqual(explicitFlags)

    const importer = vi.fn().mockResolvedValue({
      presentation: { slides: [] },
      stats: {},
      warnings: [],
    })
    await tester.importPresentation('fixture.pptx', 'uploads', {
      importer,
      ...fileOptions.importOptions,
    })
    expect(importer).toHaveBeenCalledWith('fixture.pptx', {
      ...explicitFlags,
    })
  })
})
