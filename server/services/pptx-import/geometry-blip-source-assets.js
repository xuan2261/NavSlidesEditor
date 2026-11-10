'use strict'
const { createHash } = require('node:crypto')
const { PNG } = require('pngjs')
const { persistImageBuffer } = require('./media')
const { decodeGeometryBlipSource } = require('./geometry-blip-source-decoder')
const { blipShadePixelsInPlace, BLIP_SHADE_MODIFIERS } = require('../../../shared/src/pptx-geometry-blip-shade')
const { materializeGeometry } = require('../../../shared/src/pptx-geometry-style-resolution')
const { geometryProvider } = require('../../../shared/src/pptx-geometry-style-records')
const { BLIP_SOURCE_ALGORITHM } = require('../../../shared/src/pptx-geometry-blip-assets')
const { normalizePptxSemanticDocument } = require('../../../shared/src/pptx-semantic-document')
const { semanticInstances, semanticStyle, replaceSemanticRecords } = require('../../../shared/src/pptx-semantic-records')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
function fail(detail) {
  throw Object.assign(new TypeError(`Geometry blip source assets: ${detail}`), {
    code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
  })
}
function createGeometryBlipSourceAssetProducer({ uploadsDir, mediaOptions = {} }) {
  // Import-local metadata only. The staging caller unions requests by immutable
  // source identity before decoding; no process-global or retained pixel cache.
  const cache = new Map()
  return async (bytes, asset, modifiers) => {
    if (!Array.isArray(modifiers) || modifiers.some(mode => !BLIP_SHADE_MODIFIERS.includes(mode)))
      fail('unsupported modifier')
    if (!modifiers.length) return {}
    if (!uploadsDir || !mediaOptions.mediaTransaction) fail('missing import media ownership context')
    mediaOptions.signal?.throwIfAborted?.()
    if (!asset || !Buffer.isBuffer(bytes) || sha(bytes) !== asset.preconditionHash || bytes.length !== asset.byteLength)
      fail('source identity mismatch')
    if (!['png', 'bmp'].includes(asset.format)) fail(`unsupported source format ${asset.format}`)
    const isPng = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    if ((isPng ? 'png' : 'bmp') !== asset.format) fail('source identity format')
    const requested = [...new Set(modifiers)]
    const key = asset.preconditionHash
    const cached = cache.get(key)
    if (cached) {
      const first = Object.values(cached)[0]
      if (first.width !== asset.width || first.height !== asset.height) fail('source identity dimensions')
      if (requested.some(mode => !cached[mode])) fail('source modifier requests must be unioned before decoding')
      return Object.fromEntries(requested.map(mode => [mode, structuredClone(cached[mode])]))
    }
    const remaining = mediaOptions.mediaBudget?.remainingBytes
    if (!Number.isSafeInteger(remaining) || remaining < 0) fail('unknown media budget capacity')
    const source = decodeGeometryBlipSource(bytes, remaining)
    if (source.width !== asset.width || source.height !== asset.height) fail('source identity dimensions')
    for (let offset = 3; offset < source.data.length; offset += 4)
      if (source.data[offset] !== 255) fail('source alpha shading is not qualified')
    const result = {}
    for (const modifier of requested) {
      mediaOptions.signal?.throwIfAborted?.()
      const data = Buffer.from(source.data)
      blipShadePixelsInPlace(data, modifier)
      const encoded = PNG.sync.write({ width: source.width, height: source.height, data },
        { colorType: 6, inputColorType: 6, bitDepth: 8 })
      const placed = await persistImageBuffer(encoded, 'image/png', uploadsDir, mediaOptions)
      if (!placed.url) fail(`derived media ${placed.warning?.code || 'placement failed'}`)
      result[modifier] = { src: placed.url, width: source.width, height: source.height,
        format: 'png', byteLength: encoded.length, sha256: sha(encoded),
        sourceHash: key, algorithm: BLIP_SOURCE_ALGORITHM }
    }
    cache.set(key, result)
    return structuredClone(result)
  }
}
async function stageGeometryBlipSourceAssets(document, zip, options) {
  const sources = new Map()
  for (const [instanceId, instance] of semanticInstances(document)) {
    if (!instance?.sourceBinding) continue
    const providerGeom = geometryProvider(document, instance).geometry
    if (!providerGeom) continue
    const geometry = materializeGeometry(document, instance.id || instanceId)
    const blip = geometry?.style?.fill?.blip ?? providerGeom?.style?.fill?.blip
    const modifiers = [...new Set((geometry?.paths || providerGeom?.paths || []).map(path => path.fill)
      .filter(mode => BLIP_SHADE_MODIFIERS.includes(mode)))]
    if (!blip || !modifiers.length) continue
    const binding = semanticStyle(document, blip.bindingId)
    if (binding?.kind !== 'geometry-blip-binding') fail('missing source binding')
    const asset = binding.payload.asset, key = asset.preconditionHash
    if (!sources.has(key)) sources.set(key, { asset, bindings: new Map(), modifiers: new Set() })
    const request = sources.get(key)
    request.bindings.set(blip.bindingId, binding)
    for (const modifier of modifiers) request.modifiers.add(modifier)
  }
  if (!sources.size) return document
  const patchStyles = {}
  const derive = createGeometryBlipSourceAssetProducer(options)
  for (const request of sources.values()) {
    options.mediaOptions?.signal?.throwIfAborted?.()
    const file = zip.file(request.asset.partUri)
    if (!file) fail('missing immutable source bytes')
    const bytes = await file.async('nodebuffer')
    const assets = await derive(bytes, request.asset, [...request.modifiers])
    for (const [bindingId, binding] of request.bindings) {
      const source = binding.payload.asset
      if (source.width !== request.asset.width || source.height !== request.asset.height ||
          source.format !== request.asset.format || source.byteLength !== bytes.length)
        fail('source identity metadata mismatch')
      patchStyles[bindingId] = {
        ...binding,
        payload: { ...binding.payload, derivedAssets: assets },
      }
    }
  }
  return normalizePptxSemanticDocument(replaceSemanticRecords(document, { styles: patchStyles }))
}
module.exports = { createGeometryBlipSourceAssetProducer, stageGeometryBlipSourceAssets }
