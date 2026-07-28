import { describe, expect, it } from 'vitest'
import dtoModule from './dto.js'

const {
  stripAuthority,
  toExternalPresentationDto,
  toPresentationEditorDto,
  toPublicDto,
} = dtoModule

describe('package authority DTO boundary', () => {
  it('keeps only the editor generation token and strips nested authority', () => {
    const value = {
      id: 'deck',
      aggregateGeneration: 3,
      packageRevisionId: 'r1',
      slides: [{ _pptxSource: { packagePath: 'secret' }, title: 'safe' }],
    }
    expect(stripAuthority(value, { retainGeneration: true })).toEqual({
      id: 'deck',
      aggregateGeneration: 3,
      slides: [{ title: 'safe' }],
    })
    expect(stripAuthority(value)).not.toHaveProperty('aggregateGeneration')
  })

  it('preserves editable import metadata while stripping nested package authority', () => {
    const value = {
      _pptxMeta: { originalSize: { width: 720, height: 540 } },
      _pptxImportMeta: {
        textInsets: { left: 7.2 },
        layoutPlaceholder: true,
        layoutPath: 'ppt/slideLayouts/slideLayout1.xml',
        sourceMapRevisionId: 'secret',
      },
      _pptxChartMeta: { originalType: 'scatterChart', sourceAuthority: 'secret' },
    }
    expect(stripAuthority(value)).toEqual({
      _pptxMeta: { originalSize: { width: 720, height: 540 } },
      _pptxImportMeta: { textInsets: { left: 7.2 } },
      _pptxChartMeta: { originalType: 'scatterChart' },
    })
  })

  it('strips chart provenance and relationship data from nested chart metadata', () => {
    const value = {
      _pptxChartMeta: {
        originalType: 'barChart',
        grouping: 'stacked',
        chartPath: 'ppt/charts/chart1.xml',
        matrixHash: 'a'.repeat(64),
        native: {
          relationshipClosure: [{ target: 'https://private.example/data.xlsx' }],
        },
        adapterQualified: true,
        source: 'parser',
      },
    }

    expect(stripAuthority(value)).toEqual({
      _pptxChartMeta: {
        originalType: 'barChart',
        grouping: 'stacked',
      },
    })
  })

  it('exposes a source-availability marker without package authority', () => {
    const record = {
      id: 'deck',
      pptxAggregateHead: {
        packageRevisionId: 'r0',
        originalRevisionId: 'r0',
        generation: 1,
      },
    }
    expect(toPresentationEditorDto(record, { aggregateGeneration: 1 })).toEqual({
      id: 'deck',
      aggregateGeneration: 1,
      pptxSourceAvailable: true,
    })
  })

  it('exposes only the safe capability summary publicly', () => {
    const record = {
      id: 'deck',
      byteLength: 12,
      sha256: 'secret',
      relationships: [{ target: 'https://private.example' }],
      complexObjects: [{ source: { partPath: 'ppt/vbaProject.bin' } }],
      capabilitySummary: {
        editedExport: 'unsupported-blocking',
        originalRecovery: 'exact',
        hasUnsupportedObjects: true,
        hasUnsafeImpact: true,
        kinds: ['macro'],
      },
    }
    expect(toPublicDto(record)).toEqual({
      id: 'deck',
      byteLength: 12,
      capabilitySummary: record.capabilitySummary,
    })
    expect(stripAuthority(record)).not.toHaveProperty('complexObjects')
    expect(stripAuthority(record)).not.toHaveProperty('relationships')
  })

  it('strips package source identity from external presentation JSON', () => {
    const record = {
      id: 'deck',
      title: 'Export',
      pptxOriginal: {
        id: 'original-file',
        sha256: 'a'.repeat(64),
        byteLength: 12,
      },
      pptxAggregateHead: { generation: 4, packageRevisionId: 'secret' },
    }

    expect(toExternalPresentationDto(record)).toEqual({
      id: 'deck',
      title: 'Export',
    })
  })

  it('reduces _pptxImportReport to summary-only on external DTO (no jobId/diagnostics)', () => {
    const record = {
      id: 'deck',
      title: 'Export',
      _pptxImportReport: {
        schemaVersion: 1,
        jobId: 'job-secret',
        createdAt: '2026-07-24T00:00:00.000Z',
        summary: {
          warningCount: 1,
          byType: { 'media-missing': 1 },
          unsupportedFeatureCount: 0,
          omittedCount: 0,
        },
        diagnostics: [{ type: 'media-missing', message: 'img gone' }],
      },
    }
    const external = toExternalPresentationDto(record)
    expect(external._pptxImportReport).toEqual({
      schemaVersion: 1,
      warningCount: 1,
      byType: { 'media-missing': 1 },
      unsupportedFeatureCount: 0,
      omittedCount: 0,
    })
    expect(external._pptxImportReport.jobId).toBeUndefined()
    expect(external._pptxImportReport.diagnostics).toBeUndefined()
  })

  it('preserves bounded _pptxImportReport on editor DTO (not authority-stripped)', () => {
    const report = {
      schemaVersion: 1,
      jobId: 'job-1',
      createdAt: '2026-07-24T00:00:00.000Z',
      summary: {
        warningCount: 2,
        byType: { 'media-missing': 1, 'geometry-clamped': 1 },
        unsupportedFeatureCount: 0,
        omittedCount: 0,
      },
      diagnostics: [
        { type: 'media-missing', message: 'img gone' },
        { type: 'geometry-clamped', message: 'clamped' },
      ],
      statsDigest: { slideCount: 3 },
    }
    const dto = toPresentationEditorDto({
      id: 'deck',
      title: 'Imported',
      _pptxImportReport: report,
      pptxAggregateHead: { packageRevisionId: 'r0', generation: 1 },
    }, { aggregateGeneration: 1 })

    expect(dto).toMatchObject({
      id: 'deck',
      title: 'Imported',
      aggregateGeneration: 1,
      pptxSourceAvailable: true,
      _pptxImportReport: {
        schemaVersion: 1,
        summary: {
          warningCount: 2,
          byType: { 'media-missing': 1, 'geometry-clamped': 1 },
          omittedCount: 0,
        },
      },
    })
    expect(dto._pptxImportReport).not.toHaveProperty('jobId')
    expect(dto._pptxImportReport).not.toHaveProperty('createdAt')
    expect(dto._pptxImportReport.diagnostics).toEqual([
      { type: 'media-missing' },
      { type: 'geometry-clamped' },
    ])
  })
})
