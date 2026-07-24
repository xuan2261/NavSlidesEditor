import { describe, expect, it } from 'vitest'
import sanitizer from './authority-sanitizer.js'

const { sanitizeClientEditableData } = sanitizer

describe('sanitizeClientEditableData', () => {
  it('preserves editable import metadata but removes nested authority', () => {
    expect(sanitizeClientEditableData({
      _pptxMeta: { originalSize: { width: 720, height: 540 } },
      _pptxImportMeta: { textInsets: { left: 7.2 }, sourceMapRevisionId: 'secret' },
      _pptxChartMeta: { originalType: 'scatterChart', sourceAuthority: 'secret' },
      pptxAggregateHead: { packageRevisionId: 'secret' },
    })).toEqual({
      _pptxMeta: { originalSize: { width: 720, height: 540 } },
      _pptxImportMeta: { textInsets: { left: 7.2 } },
      _pptxChartMeta: { originalType: 'scatterChart' },
    })
  })

  it('strips timestamps only at the presentation root', () => {
    expect(sanitizeClientEditableData({
      createdAt: 'root-created',
      updatedAt: 'root-updated',
      deletedAt: 'root-deleted',
      pluginData: {
        createdAt: 'plugin-created',
        updatedAt: 'plugin-updated',
        deletedAt: 'plugin-deleted',
      },
    })).toEqual({
      pluginData: {
        createdAt: 'plugin-created',
        updatedAt: 'plugin-updated',
        deletedAt: 'plugin-deleted',
      },
    })
  })

  it('strips client-injected _pptxImportReport (server-owned)', () => {
    expect(sanitizeClientEditableData({
      title: 'Edited',
      _pptxImportReport: {
        schemaVersion: 1,
        jobId: 'client-forged',
        summary: { warningCount: 999, byType: { flood: 999 }, omittedCount: 0 },
        diagnostics: Array.from({ length: 200 }, (_, i) => ({ type: `t${i}`, message: 'x' })),
      },
    })).toEqual({ title: 'Edited' })
  })
})
