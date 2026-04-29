import path from 'node:path'
import { describe, expect, it } from 'vitest'
import harnessModule from './pptx-import-semantic-and-roundtrip-fidelity-tester.js'

const harness = harnessModule.default || harnessModule

describe('harness integration (real export path)', () => {
  const corpusFile = path.resolve(process.cwd(), 'PPTX', 'Bai_2_1.pptx')

  it('uses production export by default for round-trip runs', async () => {
    const result = await harness.testCorpusFile(corpusFile, {
      skipRoundTrip: false,
      allowFallback: false,
      strict: false,
    })

    expect(result.errors).toEqual([])
    expect(result.roundTripExportMethod).toBe('production')
    expect(result.roundTrip?.available).toBe(true)
  }, 120000)

  it('strict mode keeps production export and produces stability metrics', async () => {
    const result = await harness.testCorpusFile(corpusFile, {
      skipRoundTrip: false,
      allowFallback: false,
      strict: true,
    })

    expect(result.errors).toEqual([])
    expect(result.roundTripExportMethod).toBe('production')
    expect(result.roundTrip?.available).toBe(true)
    expect(result.roundTrip?.overall).not.toBeNull()
  }, 120000)

  it('strict mode enforces round-trip even when skipRoundTrip is requested', async () => {
    const result = await harness.testCorpusFile(corpusFile, {
      skipRoundTrip: true,
      allowFallback: false,
      strict: true,
    })

    expect(result.errors).toEqual([])
    expect(result.roundTripExportMethod).toBe('production')
    expect(result.roundTrip?.available).toBe(true)
  }, 120000)
})
