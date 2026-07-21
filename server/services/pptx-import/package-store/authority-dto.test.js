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
})
