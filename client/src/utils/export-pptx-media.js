import {
  classifyPptxMediaSource,
  classifyPptxPosterSource,
  hasPptxUploadSignature,
} from 'revealjs-shared'

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
    const poster = classifyPptxPosterSource(element.poster, { embeddedCover: true })
    if (poster) {
      cover =
        (await fetchValidatedData(poster.source, 'png', ['image/png'], fetchImpl)) || undefined
    }
  }

  return { ...classified, embedded: true, data, cover }
}

export async function resolveClientPptxPoster(source, fetchImpl = globalThis.fetch) {
  const poster = classifyPptxPosterSource(source)
  if (!poster) return null
  return fetchValidatedData(
    poster.source,
    poster.extension,
    POSTER_MIMES[poster.extension] || [],
    fetchImpl
  )
}
