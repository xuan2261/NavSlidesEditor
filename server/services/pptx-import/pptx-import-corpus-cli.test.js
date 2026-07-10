import { afterEach, describe, expect, it, vi } from 'vitest'
import corpusCli from './pptx-import-corpus-cli.js'
import fidelity from './pptx-import-semantic-and-roundtrip-fidelity-tester.js'

const { baselineFromResults, enforceStrictSummary } = corpusCli
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
      },
    })
  })
})
