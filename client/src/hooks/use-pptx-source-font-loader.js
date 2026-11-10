import { createTableFontRuntime } from 'revealjs-shared/src/pptx-table-runtime-fonts.js'

const ASSET_BYTES = 33554432, TOTAL_BYTES = 134217728
const error = (code, issues = [{ code }]) => Object.assign(new Error(code), { code, issues })
const aborted = (signal) => {
  if (signal?.aborted) throw new DOMException('Source font load cancelled', 'AbortError')
}
async function digest(document, bytes) {
  const hash = await document.defaultView.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
async function readAsset(response, signal, remaining) {
  const reader = response.body.getReader(), chunks = []
  let size = 0
  try {
    for (;;) {
      aborted(signal)
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > ASSET_BYTES) throw error('source-font-asset-budget')
      if (size > remaining) throw error('source-font-total-budget')
      chunks.push(value)
    }
  } catch (cause) { await reader.cancel(); throw cause }
  finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes.buffer
}
async function loadVerifiedAssets({
  presentationId, requestIdentity, document, signal, fetch: fetcher = globalThis.fetch,
}) {
  if (!/^[a-zA-Z0-9_-]+$/.test(presentationId)) throw error('source-font-presentation-invalid')
  const sourceIdentity = await digest(document, new TextEncoder().encode(requestIdentity))
  aborted(signal)
  const base = `/api/presentations/${encodeURIComponent(presentationId)}/semantic-fonts`
  const query = `?sourceIdentity=${sourceIdentity}`
  const options = { signal, credentials: 'same-origin', redirect: 'error', cache: 'no-store' }
  const response = await fetcher(base + query, options)
  const profile = await response.json()
  aborted(signal)
  if (!response.ok) throw error(profile.code ?? 'source-font-profile-unavailable')
  if (profile.sourceIdentity !== sourceIdentity) throw error('source-font-source-stale')
  if (profile.status !== 'ready') throw error('source-font-unavailable', profile.issues)
  if (!Array.isArray(profile.fontProfile?.faces) || profile.fontProfile.faces.length > 256)
    throw error('source-font-profile-invalid')
  const ids = new Set()
  for (const face of profile.fontProfile.faces) {
    if (!face || typeof face.id !== 'string' || !face.id || ids.has(face.id) ||
      !/^[a-f0-9]{64}$/.test(face.assetHash)) throw error('source-font-profile-invalid')
    ids.add(face.id)
  }
  const assets = []
  let total = 0
  for (const face of profile.fontProfile.faces) {
    if (!/^[a-f0-9]{64}$/.test(face.assetHash)) throw error('source-font-profile-invalid')
    const result = await fetcher(`${base}/${face.assetHash}${query}`, options)
    if (!result.ok) throw error(result.status === 409
      ? 'source-font-source-stale' : 'source-font-asset-unavailable')
    aborted(signal)
    const bytes = await readAsset(result, signal, TOTAL_BYTES - total)
    total += bytes.byteLength
    if (total > TOTAL_BYTES) throw error('source-font-total-budget')
    if (await digest(document, bytes) !== face.assetHash)
      throw error('source-font-delivery-hash-mismatch')
    assets.push({ faceId: face.id, bytes })
  }
  aborted(signal)
  return { sourceIdentity, fontProfile: profile.fontProfile, assets }
}

export async function loadPptxSourceFontResources(options) {
  const { sourceIdentity, fontProfile, assets } = await loadVerifiedAssets(options)
  const transferable = assets.map(({ faceId, bytes }) => {
    const data = new Uint8Array(bytes)
    let binary = ''
    for (let offset = 0; offset < data.length; offset += 8192)
      binary += String.fromCharCode(...data.subarray(offset, offset + 8192))
    return { faceId, bytesBase64: globalThis.btoa(binary) }
  })
  aborted(options.signal)
  return { schemaVersion: 1, sourceIdentity, fontProfile, assets: transferable }
}

export async function loadPptxSourceFontRuntime(options) {
  const { sourceIdentity, fontProfile, assets } = await loadVerifiedAssets(options)
  const { document, signal } = options
  const localAssets = assets.map(({ faceId, bytes }) => ({
    faceId, bytes: new document.defaultView.Uint8Array(new Uint8Array(bytes)).buffer,
  }))
  const fontRuntime = await createTableFontRuntime({ document, fontProfile, assets: localAssets })
  if (signal?.aborted) {
    fontRuntime.dispose()
    aborted(signal)
  }
  return { fontRuntime, sourceIdentity }
}
