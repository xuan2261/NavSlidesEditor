import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'
import { pdfToSlides } from './pdf-import'
const { getDocumentMock } = vi.hoisted(() => ({ getDocumentMock: vi.fn() }))

vi.mock('pdfjs-dist', () => {
  const getPage = async () => ({
    getViewport: () => ({ width: 320, height: 180 }),
    render: () => ({ promise: Promise.resolve() }),
  })
  return {
    version: '1.0.0',
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: getDocumentMock.mockImplementation(() => ({
      promise: Promise.resolve({
        numPages: 2,
        getPage,
      }),
    })),
  }
})

vi.mock('./api', () => ({
  api: {
    uploadFile: vi.fn(),
  },
}))

function createPdfFile() {
  const file = new File(['pdf'], 'demo.pdf', { type: 'application/pdf' })
  if (!file.arrayBuffer) {
    // Older JSDOM Files lack arrayBuffer; read this real File without mutating Blob.prototype.
    Object.defineProperty(file, 'arrayBuffer', {
      value: () =>
        new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = () => reject(reader.error)
          reader.readAsArrayBuffer(file)
        }),
    })
  }
  return file
}

describe('pdfToSlides', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({})
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['png'], { type: 'image/png' }))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns slides with warnings when some pages fail to upload', async () => {
    api.uploadFile
      .mockResolvedValueOnce({ url: '/uploads/page-1.png' })
      .mockRejectedValueOnce(new Error('upload failed'))

    const file = createPdfFile()
    const result = await pdfToSlides(file)
    expect(getDocumentMock).toHaveBeenCalledWith({
      data: expect.any(ArrayBuffer),
      enableScripting: false,
    })

    expect(result.slides).toHaveLength(1)
    expect(result.slides[0].background).toEqual({ type: 'none' })
    expect(result.warnings).toEqual(['Failed to import page 2'])
  })

  it('throws when all pages fail', async () => {
    api.uploadFile.mockRejectedValue(new Error('upload failed'))

    const file = createPdfFile()
    await expect(pdfToSlides(file)).rejects.toThrow('All PDF pages failed to import')
  })
})
