const { BLIP_SHADE_MODIFIERS } = require('./pptx-geometry-blip-shade')
const BLIP_SOURCE_ALGORITHM = 'ooxml-blip-source-rgb-v1'
function fail(detail) {
  throw new TypeError(`Invalid PPTX geometry blip: ${detail}`)
}
function uploadSource(src) {
  return typeof src === 'string' && src.startsWith('/uploads/') && !/[\\:#?]/.test(src) &&
    !/%(?:2f|5c|2e)/i.test(src) && !src.slice(1).split('/').some(part => !part || ['.', '..'].includes(part))
}
function validateBlipAsset(asset) {
  if (!asset || !Number.isSafeInteger(asset.width) || asset.width < 1 ||
      !Number.isSafeInteger(asset.height) || asset.height < 1 || !uploadSource(asset.src)) fail('source asset')
  return asset
}
function validateBlipDerivedAssets(assets, source) {
  validateBlipAsset(source)
  const keys = ['src', 'width', 'height', 'format', 'byteLength', 'sha256', 'sourceHash', 'algorithm']
  if (!assets || typeof assets !== 'object' || Array.isArray(assets) ||
      !/^[a-f0-9]{64}$/.test(source.preconditionHash)) fail('derived source identity')
  for (const [modifier, asset] of Object.entries(assets)) {
    if (!BLIP_SHADE_MODIFIERS.includes(modifier) || !asset || typeof asset !== 'object' ||
        Array.isArray(asset) || Object.keys(asset).length !== keys.length ||
        !keys.every(key => Object.hasOwn(asset, key))) fail('derived asset fields')
    validateBlipAsset(asset)
    if (asset.width !== source.width || asset.height !== source.height || asset.format !== 'png' ||
        !Number.isSafeInteger(asset.byteLength) || asset.byteLength < 1 ||
        !/^[a-f0-9]{64}$/.test(asset.sha256) || asset.sourceHash !== source.preconditionHash ||
        asset.algorithm !== BLIP_SOURCE_ALGORITHM) fail('derived asset provenance')
  }
  return assets
}
function blipSourceAsset(source, derivedAssets, modifier = 'norm') {
  validateBlipAsset(source)
  if (modifier === 'norm') return source
  if (!BLIP_SHADE_MODIFIERS.includes(modifier) || !derivedAssets?.[modifier])
    fail('blip path shade requires a source-resolution derived asset')
  validateBlipDerivedAssets(derivedAssets, source)
  return derivedAssets[modifier]
}
// Canonical source bindings, plus projected leaves, own references but never pixels.
function geometryBlipMediaReferences(presentation) {
  const references = []
  const asset = (value, path) => {
    if (typeof value?.src === 'string' && value.src) references.push({ url: value.src, path: [...path, 'src'], kind: 'image' })
  }
  const maps = (map, path) => {
    for (const [mode, value] of Object.entries(map || {})) asset(value, [...path, mode])
  }
  for (const [id, style] of Object.entries(presentation?.pptxSemantic?.styles || {})) {
    if (style.kind !== 'geometry-blip-binding') continue
    const path = ['pptxSemantic', 'styles', id, 'payload']
    asset(style.payload?.asset, [...path, 'asset'])
    maps(style.payload?.derivedAssets, [...path, 'derivedAssets'])
  }
  const visit = (node, path) => {
    asset(node?.pptxBlipAsset, [...path, 'pptxBlipAsset'])
    maps(node?.pptxBlipDerivedAssets, [...path, 'pptxBlipDerivedAssets'])
    for (const [id, value] of Object.entries(node?.pptxEffectFillAssets || {}))
      asset(value, [...path, 'pptxEffectFillAssets', id])
    for (const key of ['slides', 'layoutMasters', 'elements', 'children', 'fixedElements'])
      (node?.[key] || []).forEach((child, index) => visit(child, [...path, key, index]))
    for (const [id, patch] of Object.entries(node?.layoutOverrides?.elementPatches || {}))
      visit(patch, [...path, 'layoutOverrides', 'elementPatches', id])
  }
  visit(presentation, [])
  return references
}
function rewriteGeometryBlipMedia(presentation, replacement) {
  for (const reference of geometryBlipMediaReferences(presentation)) {
    const target = reference.path.slice(0, -1).reduce((node, key) => node[key], presentation)
    target.src = replacement(reference.url)
  }
  return presentation
}
module.exports = { BLIP_SOURCE_ALGORITHM, validateBlipAsset, validateBlipDerivedAssets, blipSourceAsset,
  geometryBlipMediaReferences, rewriteGeometryBlipMedia }
