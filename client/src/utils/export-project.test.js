import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import { exportProject } from './export-project'

vi.mock('revealjs-shared', async (importOriginal) => ({
  ...(await importOriginal()),
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
            arrayBuffer: async () => new Uint8Array([103, 111, 111, 100]).buffer,
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
      slides: [
        {
          id: 'slide-json',
          elements: [{ id: 'element-json', type: 'text', content: '<p>Safe</p>' }],
        },
      ],
    })

    const data = JSON.parse(new TextDecoder().decode(await downloadedBlob.arrayBuffer()))
    expect(data.presentation).toMatchObject({
      id: 'deck-json',
      slides: [{ id: 'slide-json', elements: [{ id: 'element-json' }] }],
    })
    expect(data.presentation).not.toHaveProperty('_pptxImportReport')
    expect(data.presentation).not.toHaveProperty('pptxOriginal')
    expect(JSON.stringify(data)).not.toContain('job-json-secret')
    expect(JSON.stringify(data)).not.toContain('original-secret')
  })

  it('rejects missing media without downloading a partial archive', async () => {
    await expect(exportProject({
      title: 'Missing Media',
      slides: [{ id: 'slide-1', elements: [{ type: 'image', src: '/uploads/missing.png' }] }],
    })).rejects.toMatchObject({
      code: 'PROJECT_MEDIA_ATTACHMENT_FAILED',
      failures: [expect.objectContaining({ originalUrl: '/uploads/missing.png' })],
    })
    expect(downloadedBlob).toBeNull()
  })

  it('rejects a mixed-media legacy projection without downloading a partial archive', async () => {
    await expect(exportProject({
      id: 'deck-1', title: 'Mixed Media', aggregateGeneration: 3,
      pptxAggregateHead: { packageRevisionId: 'secret-head', generation: 3 },
      _pptxImportReport: { jobId: 'job-secret', diagnostics: [{ type: 'media-missing', message: 'private diagnostic' }] },
      slides: [{ id: 'slide-1', background: { type: 'image', image: '/uploads/good.png' },
        elements: [{ id: 'missing-image', type: 'image', src: '/uploads/missing.png',
          _pptxSource: { packagePath: 'ppt/media/image1.png' } }] }],
    })).rejects.toMatchObject({
      code: 'PROJECT_MEDIA_ATTACHMENT_FAILED',
      failures: [expect.objectContaining({ originalUrl: '/uploads/missing.png' })],
    })
    expect(downloadedBlob).toBeNull()
  })

  it('exports complete legacy media while removing editor and package authority', async () => {
    await exportProject({
      id: 'deck-1', title: 'Mixed Media', aggregateGeneration: 3,
      pptxAggregateHead: { packageRevisionId: 'secret-head', generation: 3 },
      _pptxImportReport: { jobId: 'job-secret', diagnostics: [{ type: 'media-missing', message: 'private diagnostic' }] },
      slides: [{ id: 'slide-1', background: { type: 'image', image: '/uploads/good.png' },
        elements: [{ id: 'good-image', type: 'image', src: '/uploads/good.png',
          _pptxSource: { packagePath: 'ppt/media/image1.png' } }] }],
    })
    const zip = await JSZip.loadAsync(await downloadedBlob.arrayBuffer())
    const presentation = JSON.parse(await zip.file('presentation.json').async('text'))
    const manifest = JSON.parse(await zip.file('manifest.json').async('text'))
    expect(presentation).not.toHaveProperty('aggregateGeneration')
    expect(presentation).not.toHaveProperty('pptxAggregateHead')
    expect(presentation).not.toHaveProperty('_pptxImportReport')
    expect(presentation.slides[0].elements[0]).not.toHaveProperty('_pptxSource')
    expect(JSON.stringify(presentation)).not.toMatch(/secret-head|job-secret|private diagnostic/)
    expect(manifest).toMatchObject({ version: '1.1', hasLocalMedia: true, mediaCount: 1 })
    expect(manifest.media[0].originalUrl).toBe('/uploads/good.png')
    expect(await zip.file(manifest.media[0].archivePath).async('text')).toBe('good')
    expect(zip.file('presentation.html')).not.toBeNull()
    expect(zip.file('package/manifest.json')).toBeNull()
  })

  it('P10 preserves the server package archive even when the deck has no local media', async () => {
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify({ version: '2.0', media: [] }))
    zip.file('presentation.json', JSON.stringify({ title: 'Server snapshot', slides: [] }))
    zip.file('package/manifest.json', JSON.stringify({ original: { sha256: 'a'.repeat(64) } }))
    zip.file(`package/blobs/${'a'.repeat(64)}`, 'original-bytes')
    const payload = new Blob([await zip.generateAsync({ type: 'uint8array' })], { type: 'application/zip' })
    fetch.mockResolvedValueOnce({ ok: true, blob: async () => payload })

    await exportProject({ id: 'deck-full', title: 'Portable', slides: [], pptxSourceAvailable: true, aggregateGeneration: 4 })

    expect(fetch).toHaveBeenCalledWith('/api/presentations/deck-full/project-archive', {
      headers: { 'If-Pptx-Generation': '4' },
    })

    expect(downloadedBlob.type).toBe('application/zip')
    const exported = await JSZip.loadAsync(await downloadedBlob.arrayBuffer())
    expect(JSON.parse(await exported.file('manifest.json').async('text')).version).toBe('2.0')
    expect(JSON.parse(await exported.file('package/manifest.json').async('text')).original.sha256).toBe('a'.repeat(64))
    expect(await exported.file(`package/blobs/${'a'.repeat(64)}`).async('text')).toBe('original-bytes')
    expect(JSON.parse(await exported.file('presentation.json').async('text')).title).toBe('Server snapshot')
  })
})
