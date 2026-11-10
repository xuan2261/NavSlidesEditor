const { createHash } = require('node:crypto')
const { collectSemanticFontRequests } = require('./semantic-font-request')
const { resolveSemanticFontDelivery } = require('./semantic-font-delivery')
const { SOURCE_FONT_LIMITS } = require('./source-font-assets')
const { PORTABLE_LIMITS } = require('../../../shared/src/education/portable-resource-contract')

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const failure = (code, issues = [{ code }], status = 422) =>
  Object.assign(new Error(code), { code, issues, status })
function cancelled(signal) {
  if (signal?.aborted) throw new DOMException('Semantic output cancelled', 'AbortError')
}
function located(requests, code) {
  return requests.faces.flatMap((face) =>
    (requests.locations[face.faceId] || []).map((location) => ({ ...location, code })))
}

async function prepareSemanticOutputResources(presentation, { signal } = {}) {
  cancelled(signal)
  if (!presentation.pptxSemantic) return null
  let requests
  try { requests = collectSemanticFontRequests(presentation.pptxSemantic) }
  catch { throw failure('source-font-declarations-invalid') }
  const sourceIdentity = hash(requests.identity)
  if (requests.issues.length) throw failure('semantic-output-font-unavailable', requests.issues)
  if (!requests.faces.length) return {
    schemaVersion: 1, sourceIdentity, fontProfile: { schemaVersion: 1, faces: [] }, assets: [],
  }
  let delivery
  try { delivery = await resolveSemanticFontDelivery(presentation, sourceIdentity) }
  catch (error) {
    cancelled(signal)
    throw failure(error.code || 'source-font-inventory-unavailable',
      located(requests, error.code || 'source-font-inventory-unavailable'), error.status || 503)
  }
  cancelled(signal)
  if (delivery.sourceIdentity !== sourceIdentity ||
      hash(collectSemanticFontRequests(presentation.pptxSemantic).identity) !== sourceIdentity)
    throw failure('source-font-source-stale', located(requests, 'source-font-source-stale'), 409)
  if (delivery.status !== 'ready' || delivery.issues.length)
    throw failure('semantic-output-font-unavailable', [
      ...delivery.issues, ...located(requests, 'source-font-required-face-unavailable'),
    ])
  const faces = delivery.fontProfile?.faces
  if (delivery.fontProfile?.schemaVersion !== 1 || !Array.isArray(faces) || faces.length !== requests.faces.length ||
      faces.length > SOURCE_FONT_LIMITS.faces || !Array.isArray(delivery.assets) ||
      delivery.assets.length !== faces.length)
    throw failure('source-font-profile-invalid', located(requests, 'source-font-profile-invalid'))
  const seen = new Set(), assetIds = new Set(), assets = [], profileFaces = []
  let total = 0, transported = 0
  for (const face of faces) {
    const request = requests.faces.find((item) => item.faceId === face.id)
    if (!request || seen.has(face.id) || face.typeface !== request.typeface ||
        face.bold !== request.bold || face.italic !== request.italic ||
        !/^[a-f0-9]{64}$/.test(face.assetHash))
      throw failure('source-font-profile-invalid', located(requests, 'source-font-profile-invalid'))
    seen.add(face.id)
    profileFaces.push({ id: face.id, typeface: face.typeface, bold: face.bold,
      italic: face.italic, assetHash: face.assetHash })
  }
  for (const asset of delivery.assets) {
    const face = profileFaces.find((item) => item.id === asset.faceId)
    if (!face || assetIds.has(asset.faceId) || !(asset.bytes instanceof ArrayBuffer))
      throw failure('source-font-asset-invalid', located(requests, 'source-font-asset-invalid'))
    assetIds.add(asset.faceId)
    const length = asset.bytes.byteLength
    total += length
    const encodedLength = 4 * Math.ceil(length / 3)
    transported += encodedLength
    if (!length || length > SOURCE_FONT_LIMITS.assetBytes ||
        encodedLength > PORTABLE_LIMITS.maxResourceBytes ||
        total > SOURCE_FONT_LIMITS.totalBytes || transported > PORTABLE_LIMITS.maxTotalBytes)
      throw failure('source-font-asset-budget', located(requests, 'source-font-asset-budget'))
    const bytes = Buffer.from(asset.bytes)
    if (hash(bytes) !== face.assetHash)
      throw failure('source-font-delivery-hash-mismatch',
        requests.locations[face.id].map((source) => ({ ...source, code: 'source-font-delivery-hash-mismatch' })))
    assets.push({ faceId: face.id, bytesBase64: bytes.toString('base64') })
  }
  const resources = { schemaVersion: 1, sourceIdentity,
    fontProfile: { schemaVersion: 1, faces: profileFaces }, assets }
  if (Buffer.byteLength(JSON.stringify(resources)) > PORTABLE_LIMITS.maxTotalBytes)
    throw failure('semantic-output-artifact-budget')
  return resources
}

function assertSemanticOutputArtifact(html, resources) {
  if (resources && Buffer.byteLength(html) > PORTABLE_LIMITS.maxTotalBytes)
    throw failure('semantic-output-artifact-budget')
  return html
}

module.exports = { prepareSemanticOutputResources, assertSemanticOutputArtifact }
