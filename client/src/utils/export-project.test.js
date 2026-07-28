import JSZip from 'jszip'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exportProject } from './export-project'

vi.mock('revealjs-shared', () => ({
  generateRevealHTML: vi.fn(() => '<html><body>deck</body></html>'),
}))

vi.mock('./offlineExport', () => ({
  generateOfflineHTML: vi.fn(async (html) => `offline:${html}`),
}))

describe('exportProject', () => {
  let downloadedBlob
  let originalCreateObjectURL
  let originalRevokeObjectURL

  beforeEach(() => {
    downloadedBlob = null
    originalCreateObjectURL = URL.createObjectURL
    originalRevokeObjectURL = URL.revokeObjectURL

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((blob) => {
        downloadedBlob = blob
        return 'blob:navslides-export'
      }),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })

    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } })
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        click: vi.fn(),
        set href(value) {
          this._href = value
        },
        set download(value) {
          this._download = value
        },
      })),
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (String(url).endsWith('/uploads/good.png')) {
          return {
            ok: true,
            blob: async () => new Uint8Array([103, 111, 111, 100]),
          }
        }

        return {
          ok: false,
          blob: async () => new Blob(['missing'], { type: 'text/plain' }),
        }
      })
    )
        // Polyfill Blob.prototype.arrayBuffer for JSDOM
    if (!Blob.prototype.arrayBuffer) {
      Blob.prototype.arrayBuffer = async function () {
        // Blob is not iterable in JSDOM; use FileReader as a polyfill
        const reader = new FileReader()
        return new Promise((resolve) => {
          reader.onload = () => {
            // reader.result is an ArrayBuffer from readAsArrayBuffer
            const result = reader.result
            resolve(result)
          }
          reader.readAsArrayBuffer(this)
        })
      }
    }
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    if (originalCreateObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: originalCreateObjectURL,
      })
    } else {
      delete URL.createObjectURL
    }

    if (originalRevokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: originalRevokeObjectURL,
      })
    } else {
      delete URL.revokeObjectURL
    }

    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('exports a JSON projection without editor diagnostics when there is no local media', async () => {
    await exportProject({
      id: 'deck-json',
      title: 'JSON Export',
      _pptxImportReport: {
        jobId: 'job-json-secret',
        createdAt: '2026-07-26T00:00:00.000Z',
        diagnostics: [{ type: 'source-name', message: 'raw detail' }],
      },
      pptxOriginal: { id: 'original-secret', sha256: 'a'.repeat(64) },
      slides: [{
        id: 'slide-json',
        elements: [{ id: 'element-json', type: 'text', content: '<p>Safe</p>' }],
      }],
    })

    const data = JSON.parse(
      new TextDecoder().decode(await downloadedBlob.arrayBuffer())
    )
    expect(data.presentation).toMatchObject({
      id: 'deck-json',
      slides: [{ id: 'slide-json', elements: [{ id: 'element-json' }] }],
    })
    expect(data.presentation).not.toHaveProperty('_pptxImportReport')
    expect(data.presentation).not.toHaveProperty('pptxOriginal')
    expect(JSON.stringify(data)).not.toContain('job-json-secret')
    expect(JSON.stringify(data)).not.toContain('original-secret')
  })

  it('exports a ZIP when one local media file is missing', async () => {
    await exportProject({
      id: 'deck-1',
      title: 'Mixed Media',
      pptxSourceAvailable: true,
      aggregateGeneration: 3,
      pptxAggregateHead: { packageRevisionId: 'secret-head', generation: 3 },
      _pptxImportReport: {
        jobId: 'job-secret',
        diagnostics: [{ type: 'media-missing', message: 'private diagnostic' }],
      },
      slides: [
        {
          id: 'slide-1',
          background: { type: 'image', image: '/uploads/good.png' },
          elements: [{
            id: 'missing-image',
            type: 'image',
            src: '/uploads/missing.png',
            _pptxSource: { packagePath: 'ppt/media/image1.png' },
          }],
        },
      ],
    })

    expect(downloadedBlob).toBeInstanceOf(Blob)
    const zip = await JSZip.loadAsync(await downloadedBlob.arrayBuffer())
    const manifest = JSON.parse(await zip.file('manifest.json').async('text'))

    expect(manifest.media).toHaveLength(1)
    expect(manifest.media[0].originalUrl).toBe('/uploads/good.png')
    expect(manifest.skippedMedia).toHaveLength(1)
    expect(manifest.skippedMedia[0].originalUrl).toBe('/uploads/missing.png')
    expect(zip.file(manifest.media[0].archivePath)).toBeTruthy()
    expect(zip.file('presentation.json')).toBeTruthy()
    const exportedPresentation = JSON.parse(await zip.file('presentation.json').async('text'))
    expect(exportedPresentation).toMatchObject({
      id: 'deck-1',
      slides: [{
        id: 'slide-1',
        elements: [{ id: 'missing-image', type: 'image' }],
      }],
    })
    expect(exportedPresentation).not.toHaveProperty('_pptxImportReport')
    expect(exportedPresentation).not.toHaveProperty('pptxAggregateHead')
    expect(exportedPresentation.slides[0].elements[0]).not.toHaveProperty('_pptxSource')
    expect(JSON.stringify(exportedPresentation)).not.toContain('job-secret')
    expect(JSON.stringify(exportedPresentation)).not.toContain('secret-head')
    expect(console.warn).toHaveBeenCalledWith(
      'Project export skipped media files:',
      expect.arrayContaining([expect.objectContaining({ originalUrl: '/uploads/missing.png' })])
    )
  })
})
