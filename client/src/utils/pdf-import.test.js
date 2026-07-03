import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'
import { pdfToSlides } from './pdf-import'

vi.mock('pdfjs-dist', () => {
  const getPage = async () => ({
    getViewport: () => ({ width: 320, height: 180 }),
    render: () => ({ promise: Promise.resolve() }),
  })
  return {
    version: '1.0.0',
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: () =>
      ({
        promise: Promise.resolve({
          numPages: 2,
          getPage,
        }),
      }),
  }
})

vi.mock('./api', () => ({
  api: {
    uploadFile: vi.fn(),
  },
}))

describe('pdfToSlides', () => {
  const originalDocument = globalThis.document

  beforeEach(() => {
    vi.clearAllMocks()
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({}),
      toBlob: (callback) => callback(new Blob(['png'], { type: 'image/png' })),
    }
    globalThis.document = {
      createElement: (tag) => {
        if (tag === 'canvas') return canvas
        throw new Error('Unsupported element: ' + tag)
      },
    }
    // Polyfill Blob.prototype.arrayBuffer for JSDOM (not available in older JSDOM)
    if (!Blob.prototype.arrayBuffer) {
      Blob.prototype.arrayBuffer = function () {
        const blob = this
        return new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.readAsArrayBuffer(blob)
        })
      }
    }
  })

  afterEach(() => {
    globalThis.document = originalDocument
  })

  it('returns slides with warnings when some pages fail to upload', async () => {
    api.uploadFile
      .mockResolvedValueOnce({ url: '/uploads/page-1.png' })
      .mockRejectedValueOnce(new Error('upload failed'))

    const file = new File(['pdf'], 'demo.pdf', { type: 'application/pdf' })
    const result = await pdfToSlides(file)

    expect(result.slides).toHaveLength(1)
    expect(result.slides[0].background).toEqual({ type: 'none' })
    expect(result.warnings).toEqual(['Failed to import page 2'])
  })

  it('throws when all pages fail', async () => {
    api.uploadFile.mockRejectedValue(new Error('upload failed'))

    const file = new File(['pdf'], 'demo.pdf', { type: 'application/pdf' })
    await expect(pdfToSlides(file)).rejects.toThrow('All PDF pages failed to import')
  })
})
