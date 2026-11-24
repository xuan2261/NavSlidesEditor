const { cloneTextData, evaluateFontProfile } = require('./pptx-text-document')
const { collectSemanticFontRequests } = require('./pptx-source-font-request')
const { PORTABLE_LIMITS } = require('./education/portable-resource-contract')

const FONT_LIMITS = Object.freeze({ count: 256, face: 33554432, total: 134217728 })
function outputFailure(code, detail, location = {}) {
  return Object.assign(new TypeError(`Semantic output ${detail}`), { code, ...location })
}
function fields(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
      Reflect.ownKeys(value).length !== keys.length ||
      keys.some((key) => {
        const property = Object.getOwnPropertyDescriptor(value, key)
        return !property?.enumerable || !Object.hasOwn(property, 'value')
      }))
    throw outputFailure('semantic-output-transport', 'requires plain data transport')
}
// Check lengths before cloning, decoding or allocating any font buffer.
function validateSemanticOutputResources(input) {
  fields(input, ['schemaVersion', 'sourceIdentity', 'fontProfile', 'assets'])
  if (input.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(input.sourceIdentity) ||
      !Array.isArray(input.assets) || input.assets.length > FONT_LIMITS.count ||
      Object.keys(input.assets).length !== input.assets.length)
    throw outputFailure('semantic-output-transport', 'invalid schema, identity or asset count')
  const fontProfile = cloneTextData(input.fontProfile)
  evaluateFontProfile({ profile: fontProfile, requests: [] })
  if (fontProfile.faces.length > FONT_LIMITS.count ||
      fontProfile.faces.length !== input.assets.length ||
      fontProfile.faces.some((face) => !face.assetHash || face.substituteFor))
    throw outputFailure('semantic-output-fonts', 'requires exact physical faces')
  let total = 0, encoded = 0
  const seen = new Set()
  const assets = Array.from({ length: input.assets.length }, (_, index) => {
    const property = Object.getOwnPropertyDescriptor(input.assets, String(index))
    if (!property || !Object.hasOwn(property, 'value'))
      throw outputFailure('semantic-output-transport', 'requires plain data assets')
    const asset = property.value
    fields(asset, ['faceId', 'bytesBase64'])
    if (typeof asset.faceId !== 'string' || seen.has(asset.faceId) ||
        !fontProfile.faces.some((face) => face.id === asset.faceId) ||
        typeof asset.bytesBase64 !== 'string')
      throw outputFailure('semantic-output-fonts', 'missing, duplicate or extra font asset')
    seen.add(asset.faceId)
    const text = asset.bytesBase64
    const length = text.length / 4 * 3 - (text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0)
    total += length
    encoded += text.length
    if (!text.length || text.length % 4 || length > FONT_LIMITS.face ||
        length > PORTABLE_LIMITS.maxResourceBytes || total > FONT_LIMITS.total ||
        encoded > PORTABLE_LIMITS.maxTotalBytes)
      throw outputFailure('semantic-output-budget', 'font byte budget exceeded')
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text))
      throw outputFailure('semantic-output-transport', 'invalid base64 font bytes')
    return { faceId: asset.faceId, bytesBase64: text }
  })
  return { schemaVersion: 1, sourceIdentity: input.sourceIdentity, fontProfile, assets }
}
async function sha256(bytes, realm) {
  const digest = await realm.crypto.subtle.digest('SHA-256', bytes)
  return [...new realm.Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
async function decodeSemanticOutputResources(semantic, input, realm) {
  const requests = collectSemanticFontRequests(semantic)
  if (requests.issues.length)
    throw outputFailure('semantic-output-source', 'source font declarations unavailable', {
      issues: requests.issues,
    })
  if (!input) {
    if (requests.faces.length) throw outputFailure('semantic-output-fonts', 'font resources missing')
    return { fontProfile: { schemaVersion: 1, faces: [] }, assets: [] }
  }
  const resource = validateSemanticOutputResources(input)
  if (!realm.crypto?.subtle)
    throw outputFailure('semantic-output-crypto', 'requires destination Web Crypto')
  if (await sha256(new realm.TextEncoder().encode(requests.identity), realm) !== resource.sourceIdentity)
    throw outputFailure('semantic-output-identity', 'source identity mismatch')
  if (requests.faces.length !== resource.fontProfile.faces.length ||
      requests.faces.some((request) => !resource.fontProfile.faces.some((face) =>
        face.id === request.faceId && face.typeface === request.typeface &&
        Boolean(face.bold) === request.bold && Boolean(face.italic) === request.italic)))
    throw outputFailure('semantic-output-fonts', 'source font descriptors mismatch')
  const assets = []
  for (const asset of resource.assets) {
    const binary = realm.atob(asset.bytesBase64)
    const bytes = new realm.Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
    const face = resource.fontProfile.faces.find((face) => face.id === asset.faceId)
    if (await sha256(bytes.buffer, realm) !== face.assetHash.toLowerCase())
      throw outputFailure('semantic-output-hash', 'font asset hash mismatch', {
        faceId: face.id, issues: requests.locations[face.id],
      })
    assets.push({ faceId: asset.faceId, bytes: bytes.buffer })
  }
  return { fontProfile: resource.fontProfile, assets }
}
module.exports = {
  FONT_LIMITS, outputFailure, validateSemanticOutputResources, decodeSemanticOutputResources,
}
