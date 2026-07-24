import { afterEach, describe, expect, it, vi } from 'vitest'
import corpusCli from './pptx-import-corpus-cli.js'
import fidelity from './pptx-import-semantic-and-roundtrip-fidelity-tester.js'

const { baselineFromResults, enforceStrictSummary, runFromCli } = corpusCli
const {
  STRICT_CORPUS_GATES,
  STRICT_AVG_MIN_ROUND_TRIP,
  STRICT_AVG_MIN_SEMANTIC,
  STRICT_MIN_CORPUS_FILES,
} = fidelity

const strictSummary = (overrides = {}) => ({
  failedFiles: 0,
  strict: true,
  totalFiles: STRICT_MIN_CORPUS_FILES,
  avgSemanticFidelity: STRICT_AVG_MIN_SEMANTIC,
  avgRoundTripStability: STRICT_AVG_MIN_ROUND_TRIP,
  ...overrides,
})

describe('pptx import corpus cli strict gates', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports the actual average round-trip gate threshold', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const exitCode = enforceStrictSummary(
      strictSummary({ avgRoundTripStability: STRICT_AVG_MIN_ROUND_TRIP - 0.01 }),
      [{ roundTripExportMethod: 'production' }]
    )

    expect(exitCode).toBe(1)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(`${(STRICT_AVG_MIN_ROUND_TRIP * 100).toFixed(0)}%`)
    )
  })

  it('writes canonical strict gate metadata into baseline output', () => {
    const baseline = baselineFromResults(
      [{
        file: 'deck.pptx',
        semanticFidelity: 1,
        roundTrip: { overall: STRICT_AVG_MIN_ROUND_TRIP },
        propertyCoverage: { overall: 1 },
        elementCount: {},
        stats: {
          sceneGraphUnmapped: 0,
          primitivePlaceholderCount: 0,
          nativeObjectCoverage: {
            chartCoverageGapCount: 0,
            smartArtCoverageGapCount: 0,
          },
        },
      }],
      strictSummary()
    )

    expect(baseline.gates).toMatchObject({
      avgSemanticFidelity: STRICT_CORPUS_GATES.avgSemanticFidelity,
      avgRoundTripStability: STRICT_CORPUS_GATES.avgRoundTripStability,
      perDeckSemantic: STRICT_CORPUS_GATES.perDeckSemantic,
      maxClassDrop: STRICT_CORPUS_GATES.maxClassDrop,
      classDropTypes: STRICT_CORPUS_GATES.classDropTypes,
    })
    expect(baseline).toMatchObject({
      evidenceVersion: 2,
      summary: {
        corpusEvidence: {
          sceneGraphUnmapped: 0,
          chartCoverageGapCount: 0,
          smartArtCoverageGapCount: 0,
          permanentPlaceholderCount: 0,
        },
        corpusEvidenceValidity: {
          sceneGraphUnmapped: true,
          chartCoverageGapCount: true,
          smartArtCoverageGapCount: true,
          permanentPlaceholderCount: true,
        },
      },
    })
  })

  it('marks missing native evidence invalid instead of converting it to zero', () => {
    const baseline = baselineFromResults([
      { file: 'missing-evidence.pptx', stats: { nativeObjectCoverage: {} } },
    ], strictSummary())

    expect(baseline.summary.corpusEvidence).toMatchObject({
      sceneGraphUnmapped: null,
      chartCoverageGapCount: null,
      smartArtCoverageGapCount: null,
      permanentPlaceholderCount: null,
    })
    expect(baseline.summary.corpusEvidenceValidity).toEqual({
      sceneGraphUnmapped: false,
      chartCoverageGapCount: false,
      smartArtCoverageGapCount: false,
      permanentPlaceholderCount: false,
    })
    expect(baseline.summary.invalidCorpusEvidence).toHaveLength(4)
  })

  it('marks empty corpus evidence unavailable instead of valid zero', () => {
    const baseline = baselineFromResults([], strictSummary({ totalFiles: 0 }))

    expect(baseline.summary.corpusEvidence).toEqual({
      sceneGraphUnmapped: null,
      chartCoverageGapCount: null,
      smartArtCoverageGapCount: null,
      permanentPlaceholderCount: null,
    })
    expect(baseline.summary.corpusEvidenceValidity).toEqual({
      sceneGraphUnmapped: false,
      chartCoverageGapCount: false,
      smartArtCoverageGapCount: false,
      permanentPlaceholderCount: false,
    })
    expect(baseline.summary.invalidCorpusEvidence).toHaveLength(4)
  })

  it('keeps metrics strictness separate from importer qualification mode', async () => {
    const runCorpusTests = vi.fn().mockResolvedValue({ results: [], summary: strictSummary() })
    const reportResults = vi.fn()
    const metricsCode = await runFromCli(['--strict-metrics'], { runCorpusTests, reportResults })

    expect(metricsCode).toBe(0)
    expect(runCorpusTests).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ strict: true })
    )
    expect(runCorpusTests.mock.calls[0][1].importOptions).toBeUndefined()

    const runImporterQualification = vi.fn().mockResolvedValue({ exitCode: 1 })
    const qualificationCode = await runFromCli(
      ['fixture-corpus', '--importer-strict', '--manifest-in=fixture-manifest.json'],
      { runImporterQualification }
    )

    expect(qualificationCode).toBe(1)
    expect(runImporterQualification).toHaveBeenCalledWith(expect.objectContaining({
      corpusDir: 'fixture-corpus',
      manifestPath: 'fixture-manifest.json',
    }))
  })

  it('keeps legacy --strict as a deprecated metrics-only alias', async () => {
    const runCorpusTests = vi.fn().mockResolvedValue({ results: [], summary: strictSummary() })
    const logger = { log: vi.fn(), warn: vi.fn() }

    await expect(runFromCli(['--strict'], {
      runCorpusTests,
      reportResults: vi.fn(),
      logger,
    })).resolves.toBe(0)

    expect(runCorpusTests).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      strict: true,
    }))
    expect(runCorpusTests.mock.calls[0][1].importOptions).toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('--strict is deprecated'))
  })

  it('rejects qualification without a manifest before invoking an importer', async () => {
    const runImporterQualification = vi.fn()

    await expect(runFromCli(['--importer-strict'], { runImporterQualification })).rejects.toThrow(
      '--importer-strict requires --manifest-in'
    )
    expect(runImporterQualification).not.toHaveBeenCalled()
  })
})
