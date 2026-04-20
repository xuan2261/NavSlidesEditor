/**
 * Convert PDF file to slide objects using pdfjs-dist.
 * Each page → 1 slide with full-screen image element.
 */
import { api } from './api'

let pdfjsLib = null

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib
  pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
  return pdfjsLib
}

/**
 * @param {File} file - PDF file from input
 * @param {function} onProgress - called with (current, total) page numbers
 * @returns {Promise<Array>} slides array
 */
export async function pdfToSlides(file, onProgress) {
  const pdfjs = await loadPdfJs()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  const slides = []

  for (let i = 1; i <= pdf.numPages; i++) {
    if (onProgress) onProgress(i, pdf.numPages)

    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')

    await page.render({ canvasContext: ctx, viewport }).promise

    // Convert canvas to blob and upload
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    const formData = new FormData()
    formData.append('file', blob, `pdf-page-${i}.png`)

    try {
      const result = await api.uploadFile(blob)
      if (result.url) {
        slides.push({
          id: crypto.randomUUID(),
          elements: [
            {
              id: crypto.randomUUID(),
              type: 'image',
              x: 0,
              y: 0,
              width: 960,
              height: 540,
              zIndex: 1,
              src: result.url,
              objectFit: 'contain',
            },
          ],
          background: { type: 'color', color: '#ffffff' },
        })
      }
    } catch (err) {
      console.error(`Failed to upload PDF page ${i}:`, err)
    }
  }

  return slides
}
