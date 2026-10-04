import {
  classifyPptxMediaSource,
  classifyPptxPosterSource,
  hasPptxUploadSignature,
  parseUploadSource,
} from 'revealjs-shared'
import { sanitizeSvgContent } from './content-safety'
import { createSvgDataUri } from './export-pptx-core'
import { renderImageToPngDataUri } from './export-pptx-raster-capture'

const POSTER_MIMES = {
  gif: ['image/gif'],
  jpeg: ['image/jpeg'],
  jpg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
}

function toBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

function responseMime(response) {
  return String(response?.headers?.get?.('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase()
}

async function fetchValidatedData(source, extension, acceptedMimeTypes, fetchImpl) {
  if (typeof fetchImpl !== 'function') return null
  try {
    const response = await fetchImpl(source, {
      credentials: 'same-origin',
      redirect: 'error',
    })
    const mime = responseMime(response)
    if (!response.ok || !acceptedMimeTypes.includes(mime)) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (!bytes.byteLength || !hasPptxUploadSignature(bytes, extension)) return null
    return `data:${mime};base64,${toBase64(bytes)}`
  } catch {
    return null
  }
}

export async function resolveClientPptxMedia(element, fetchImpl = globalThis.fetch) {
  const classified = classifyPptxMediaSource(element)
  if (!classified.embeddable) return { ...classified, embedded: false }

  const data = await fetchValidatedData(
    classified.source,
    classified.extension,
    classified.acceptedMimeTypes,
    fetchImpl
  )
  if (!data) {
    return { ...classified, embedded: false, reason: 'validated-upload-unavailable' }
  }

  let cover
  if (element.type === 'video') {
    const poster = await resolveClientPptxPoster(element.poster, fetchImpl)
    if (poster) {
      cover = /^data:image\/png;/i.test(poster)
        ? poster
        : (await renderImageToPngDataUri(poster)) || undefined
    }
    if (
      !cover &&
      (/^data:image\//i.test(element.poster || '') ||
        parseUploadSource(element.poster)?.extension === 'svg')
    ) {
      throw new Error(`Failed to decode authored video poster "${element.id || ''}"`)
    }
  }

  return { ...classified, embedded: true, data, cover }
}

export async function resolveClientPptxPoster(source, fetchImpl = globalThis.fetch) {
  const data =
    /^data:(image\/(?:png|jpeg|gif|webp|svg\+xml))(?:;charset=[\w-]+)?(;base64)?,([\s\S]*)$/i.exec(
      String(source || '')
    )
  if (data) {
    try {
      const bytes = data[2]
        ? Uint8Array.from(atob(data[3]), (character) => character.charCodeAt(0))
        : new TextEncoder().encode(decodeURIComponent(data[3]))
      if (data[1].toLowerCase() === 'image/svg+xml') {
        const svg = sanitizeSvgContent(new TextDecoder().decode(bytes))
        if (!/<svg\b/i.test(svg)) return null
        return await renderImageToPngDataUri(createSvgDataUri(svg))
      }
      const extension = data[1].slice('image/'.length).toLowerCase()
      if (!hasPptxUploadSignature(bytes, extension)) return null
      return `data:${data[1].toLowerCase()};base64,${toBase64(bytes)}`
    } catch {
      return null
    }
  }
  const upload = parseUploadSource(source)
  if (upload?.extension === 'svg' && typeof fetchImpl === 'function') {
    try {
      const response = await fetchImpl(upload.source, {
        credentials: 'same-origin',
        redirect: 'error',
      })
      if (!response.ok || responseMime(response) !== 'image/svg+xml') return null
      const svg = sanitizeSvgContent(await response.text())
      if (!/<svg\b/i.test(svg)) return null
      return await renderImageToPngDataUri(createSvgDataUri(svg))
    } catch {
      return null
    }
  }
  const poster = classifyPptxPosterSource(source)
  if (!poster) return null
  return fetchValidatedData(
    poster.source,
    poster.extension,
    POSTER_MIMES[poster.extension] || [],
    fetchImpl
  )
}
