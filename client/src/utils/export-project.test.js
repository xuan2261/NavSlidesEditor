import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    await expect(
      exportProject({
        title: 'Missing Media',
        slides: [{ id: 'slide-1', elements: [{ type: 'image', src: '/uploads/missing.png' }] }],
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_MEDIA_ATTACHMENT_FAILED',
      failures: [expect.objectContaining({ originalUrl: '/uploads/missing.png' })],
    })
    expect(downloadedBlob).toBeNull()
  })
})
