import { describe, expect, it } from 'vitest'
import importer from './importer.js'

const { buildImportStats } = importer

describe('pptx importer stats boundary', () => {
  it('preserves additive OOXML native object coverage stats', () => {
    const nativeObjectCoverage = {
      chartEvidenceCount: 2,
      smartArtEvidenceCount: 1,
      mappedNativeChartCount: 1,
      mappedNativeDiagramCount: 0,
      chartCoverageGapCount: 1,
      smartArtCoverageGapCount: 1,
    }
    const ooxml = {
      nativeChartCount: 2,
      nativeSmartArtCount: 1,
      slideEvidence: [{ slideIndex: 0, chartEntries: ['ppt/charts/chart1.xml'] }],
    }

    expect(buildImportStats({
      mappedStats: {
        slideCount: 1,
        chartCount: 1,
        nativeChartCount: 2,
        nativeSmartArtCount: 1,
        nativeChartImportedCount: 1,
        nativeSmartArtImportedCount: 0,
        nativeObjectCoverage,
        ooxml,
      },
      parsed: { packageVersion: '2.0.2' },
      startedAt: 10,
      now: 25,
    })).toMatchObject({
      parser: 'pptxtojson',
      packageVersion: '2.0.2',
      chartCount: 1,
      nativeChartCount: 2,
      nativeSmartArtCount: 1,
      nativeChartImportedCount: 1,
      nativeSmartArtImportedCount: 0,
      nativeObjectCoverage,
      ooxml,
      durationMs: 15,
    })
  })
})

