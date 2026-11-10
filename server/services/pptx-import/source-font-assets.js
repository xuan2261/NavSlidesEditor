const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { cloneTextData, evaluateFontProfile } = require('../../../shared/src/pptx-text-document')
const { inspectSourceFont } = require('./source-font-assets-metadata')
const { readSourceFontCollection, extractSourceFontCollectionFace } = require('./source-font-collection')

const SOURCE_FONT_LIMITS = Object.freeze({
  roots: 16, faces: 256, entries: 8192, fonts: 2048, depth: 8,
  assetBytes: 33554432, totalBytes: 134217728,
})
const fail = (detail) => { throw new TypeError(`Invalid source font assets: ${detail}`) }
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
function configuration(input) {
  const data = cloneTextData(input), { roots, faces } = data
  if (Object.keys(data).some((k) => !['roots', 'faces'].includes(k)) ||
      !Array.isArray(roots) || !roots.length || roots.length > SOURCE_FONT_LIMITS.roots ||
      roots.some((p) => typeof p !== 'string' || !path.isAbsolute(p) || p.includes('\0')) ||
      !Array.isArray(faces) || faces.length > SOURCE_FONT_LIMITS.faces) fail('roots/faces')
  const ids = new Set(), identities = new Set()
  for (const face of faces) {
    if (!face || typeof face !== 'object' || Array.isArray(face) ||
        Object.keys(face).some((k) => !['faceId', 'typeface', 'bold', 'italic', 'source'].includes(k)) ||
        typeof face.faceId !== 'string' || !face.faceId || face.faceId.length > 256 || ids.has(face.faceId) ||
        typeof face.typeface !== 'string' || !face.typeface || face.typeface.length > 1024 ||
        typeof face.bold !== 'boolean' || typeof face.italic !== 'boolean') fail('face')
    if (face.source && (typeof face.source !== 'object' || Array.isArray(face.source) ||
        Object.keys(face.source).length !== 2 ||
        ['part', 'path'].some((k) => typeof face.source[k] !== 'string' || !face.source[k] ||
          face.source[k].length > 1024))) fail('source')
    if (Object.hasOwn(face, 'source') && !face.source) fail('source')
    const identity = JSON.stringify([face.typeface, face.bold, face.italic])
    if (identities.has(identity)) fail('duplicate requested name/style')
    ids.add(face.faceId)
    identities.add(identity)
  }
  return data
}

/**
 * Resolve explicit {faceId,typeface,bold,italic,source?} requests from trusted,
 * absolute directory roots. No environment/system font locations are consulted.
 * Resolved faces only populate fontProfile; callers must check unresolved before
 * registration. assets is a defensive-copy getter. Bindings retain local paths
 * and optional source provenance separately; do not publish them over HTTP.
 */
async function resolveSourceFontAssets(input) {
  const { roots, faces } = configuration(input)
  const files = [], seen = new Set(), issues = [], candidates = []
  let entries = 0, totalBytes = 0, deliveredBytes = 0
  async function scan(directory, depth) {
    const dir = await fs.opendir(directory)
    for await (const entry of dir) {
      if (++entries > SOURCE_FONT_LIMITS.entries) fail('entry budget')
      const file = path.join(directory, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        if (depth >= SOURCE_FONT_LIMITS.depth) fail('directory depth budget')
        await scan(file, depth + 1)
      } else if (entry.isFile() && /\.(ttf|otf|ttc|otc|woff2?)$/i.test(entry.name)) {
        if (files.length >= SOURCE_FONT_LIMITS.fonts) fail('font count budget')
        files.push(file)
      }
    }
  }
  for (const root of roots) {
    const canonical = await fs.realpath(root)
    if (seen.has(canonical)) continue
    seen.add(canonical)
    await scan(canonical, 0)
  }
  for (const file of files.sort()) {
    const handle = await fs.open(file, 'r')
    let bytes
    try {
      const stat = await handle.stat()
      if (!stat.isFile() || stat.size > SOURCE_FONT_LIMITS.assetBytes) fail('asset byte budget')
      totalBytes += stat.size
      if (totalBytes > SOURCE_FONT_LIMITS.totalBytes) fail('total byte budget')
      const buffer = new Uint8Array(stat.size)
      let offset = 0
      while (offset < buffer.length) {
        const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset)
        if (!bytesRead) fail('font changed during read')
        offset += bytesRead
      }
      bytes = buffer.buffer
    } finally { await handle.close() }
    let collection
    if (bytes.byteLength >= 4 && new DataView(bytes).getUint32(0) === 0x74746366) {
      try { collection = readSourceFontCollection(bytes) }
      catch (error) {
        issues.push({ path: file, reason: error.reason || 'font-collection-malformed' })
        continue
      }
    }
    const members = collection?.faces || [{ byteLength: bytes.byteLength }]
    for (const member of members) {
      if (member.byteLength > SOURCE_FONT_LIMITS.assetBytes) fail('extracted asset byte budget')
      deliveredBytes += member.byteLength
      if (deliveredBytes > SOURCE_FONT_LIMITS.totalBytes) fail('extracted total byte budget')
    }
    const containerHash = collection && createHash('sha256').update(new Uint8Array(bytes)).digest('hex')
    for (const member of members) {
      const asset = collection ? extractSourceFontCollectionFace(bytes, member) : bytes
      const provenance = collection ? { collection: { version: collection.version,
        faceIndex: member.faceIndex, faceOffset: member.offset, containerHash,
        ...(member.dsigRemoved ? { dsigRemoved: true } : {}) } } : {}
      let inspected
      try { inspected = inspectSourceFont(asset) }
      catch { inspected = { reason: 'font-metadata-unsupported' } }
      if (inspected.reason) issues.push({ path: file, reason: inspected.reason,
        ...(collection ? { faceIndex: member.faceIndex } : {}) })
      if (inspected.metadata) candidates.push({
        path: file, ...inspected, ...provenance, bytes: asset,
        hash: createHash('sha256').update(new Uint8Array(asset)).digest('hex'),
      })
    }
  }
  const profileFaces = [], bindings = [], unresolved = [], assets = []
  for (const request of faces) {
    const matching = candidates.filter(({ metadata: m }) =>
      m.bold === request.bold && m.italic === request.italic &&
      [...m.families, ...m.fullNames, ...m.postscriptNames].some((n) => n.toLowerCase() === request.typeface.toLowerCase()))
    const distinct = [...new Map(matching.map((c) => [c.hash, c])).values()]
    const selected = distinct.length === 1 ? distinct[0] : null
    if (!selected || selected.reason) {
      unresolved.push({ ...request, reason: distinct.length > 1 ? 'font-ambiguous' :
        selected?.reason || 'font-unavailable' })
      continue
    }
    profileFaces.push({ id: request.faceId, typeface: request.typeface, bold: request.bold,
      italic: request.italic, assetHash: selected.hash })
    bindings.push({ faceId: request.faceId, path: selected.path, metadata: selected.metadata,
      ...(selected.collection ? { collection: selected.collection } : {}),
      ...(request.source ? { source: request.source } : {}) })
    assets.push({ faceId: request.faceId, bytes: selected.bytes })
  }
  const fontProfile = { schemaVersion: 1, faces: profileFaces }
  evaluateFontProfile({ profile: fontProfile, requests: [] })
  return Object.freeze({
    fontProfile: freeze(fontProfile), bindings: freeze(bindings),
    unresolved: freeze(unresolved), issues: freeze(issues),
    get assets() { return assets.map(({ faceId, bytes }) => ({ faceId, bytes: bytes.slice(0) })) },
  })
}

module.exports = { resolveSourceFontAssets, SOURCE_FONT_LIMITS }
