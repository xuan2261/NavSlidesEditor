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
})
