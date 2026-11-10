const { createHash } = require('node:crypto')
const { resolveSourceFontAssets } = require('./source-font-assets')
const { collectSemanticFontRequests } = require('./semantic-font-request')
const failure = (status, code) => Object.assign(new Error(code), { status, code })

function configuredRoots() {
  const raw = process.env.NAVSLIDES_PPTX_FONT_ROOTS
  if (!raw) return []
  try {
    const roots = JSON.parse(raw)
    if (!Array.isArray(roots)) throw new TypeError()
    return roots
  } catch { throw failure(503, 'source-font-roots-invalid') }
}
async function resolveSemanticFontDelivery(presentation, requestedIdentity, roots) {
  const semantic = presentation.pptxSemantic
  if (!semantic) throw failure(422, 'source-font-semantic-source-unavailable')
  let requests, sourceIdentity
  try {
    requests = collectSemanticFontRequests(semantic)
    sourceIdentity = createHash('sha256').update(requests.identity).digest('hex')
  }
  catch { throw failure(422, 'source-font-declarations-invalid') }
  if (sourceIdentity !== requestedIdentity) throw failure(409, 'source-font-source-stale')
  const empty = { schemaVersion: 1, faces: [] }
  roots ??= configuredRoots()
  if (!roots.length) return {
    sourceIdentity, status: 'unavailable', fontProfile: empty, assets: [],
    issues: [{ code: 'source-font-roots-unconfigured' }, ...requests.issues],
  }
  let result
  try { result = await resolveSourceFontAssets({ roots, faces: requests.faces }) }
  catch { throw failure(503, 'source-font-inventory-unavailable') }
  const issues = [...requests.issues, ...result.unresolved.flatMap((face) =>
    requests.locations[face.faceId].map((source) => ({
      ...source, code: face.reason, typeface: face.typeface, bold: face.bold, italic: face.italic,
    })))]
  const assets = result.assets
  for (const asset of assets) {
    const face = result.fontProfile.faces.find((face) => face.id === asset.faceId)
    if (createHash('sha256').update(Buffer.from(asset.bytes)).digest('hex') !== face.assetHash)
      throw failure(503, 'source-font-delivery-hash-mismatch')
  }
  return { sourceIdentity, status: issues.length ? 'unavailable' : 'ready',
    fontProfile: result.fontProfile, assets, issues }
}
module.exports = { resolveSemanticFontDelivery }
