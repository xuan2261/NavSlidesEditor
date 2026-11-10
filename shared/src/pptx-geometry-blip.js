// Editable parameters reference immutable source media. URLs and pixel dimensions
// are supplied only to the renderer; DPI never seeds authored placement fields.
const { IDENTITY, invert, multiply, transformPoint } = require('./pptx-affine')
const { escapePlainText } = require('./content-safety')
const { blipSourceAsset } = require('./pptx-geometry-blip-assets')
function fail(detail) {
  throw new TypeError('Invalid PPTX geometry blip: ' + detail)
}
function fields(value, allowed, required = []) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.hasOwn(value, key))
  )
    fail('record fields')
}
function integer(value, min = -2147483648, max = 2147483647) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('native integer')
}
function rectangle(value) {
  fields(value, ['l', 't', 'r', 'b'])
  for (const item of Object.values(value)) integer(item)
  if ((value.l ?? 0) + (value.r ?? 0) >= 100000 || (value.t ?? 0) + (value.b ?? 0) >= 100000)
    fail('collapsed rectangle')
}
function blipParameters(blip) {
  fields(blip, ['bindingId', 'dpi', 'rotWithShape', 'srcRect', 'tile', 'stretch'], ['bindingId'])
  if (typeof blip.bindingId !== 'string' || !blip.bindingId || blip.bindingId.length > 1024)
    fail('binding reference')
  if (Object.hasOwn(blip, 'dpi')) integer(blip.dpi, 0, 4294967295)
  if (Object.hasOwn(blip, 'rotWithShape') && typeof blip.rotWithShape !== 'boolean')
    fail('rotation flag')
  if (blip.srcRect) rectangle(blip.srcRect)
  if (Object.hasOwn(blip, 'tile')) {
    fields(blip.tile, ['tx', 'ty', 'sx', 'sy', 'flip', 'algn'])
    for (const key of ['tx', 'ty', 'sx', 'sy'])
      if (Object.hasOwn(blip.tile, key))
        integer(blip.tile[key], ['sx', 'sy'].includes(key) ? 1 : -2147483648)
    if (Object.hasOwn(blip.tile, 'flip') && !['none', 'x', 'y', 'xy'].includes(blip.tile.flip))
      fail('tile flip')
    if (
      Object.hasOwn(blip.tile, 'algn') &&
      !['tl', 't', 'tr', 'l', 'ctr', 'r', 'bl', 'b', 'br'].includes(blip.tile.algn)
    )
      fail('tile alignment')
  }
  if (Object.hasOwn(blip, 'stretch')) {
    fields(blip.stretch, ['fillRect'])
    if (Object.hasOwn(blip.stretch, 'fillRect')) rectangle(blip.stretch.fillRect)
  }
  if (blip.tile && blip.stretch) fail('exclusive placement')
  return blip
}
function blipPatch(patch) {
  fields(patch, ['dpi', 'rotWithShape', 'srcRect', 'tile', 'stretch'])
  blipParameters({
    bindingId: 'patch-validation',
    ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== null)),
  })
  return patch
}
function blipPaintId(geometry, options = {}) {
  blipParameters(geometry.style.fill.blip)
  const modifier = options.modifier ?? 'norm'
  // Durable canonical JSON sorts record keys. Paint identity must survive that
  // round-trip so regenerated projection journals retain the same references.
  const key = JSON.stringify([
    geometry.width,
    geometry.height,
    geometry.style.fill.blip,
    options.width,
    options.height,
    options.nativeStroke,
    options.occurrenceMatrix,
    options.asset,
    options.fillFrame,
  ], (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value)
  let hash = 0x6c62272e07bb014262b821756295c58dn
  for (const character of key)
    hash = BigInt.asUintN(
      128,
      (hash ^ BigInt(character.charCodeAt(0))) * 0x1000000000000000000013bn
    )
  return (
    'pptx-blip-' +
    hash.toString(16).padStart(32, '0') +
    (modifier === 'norm' ? '' : '-' + modifier)
  )
}
function blipSvgDefinition(geometry, options) {
  const blip = blipParameters(geometry.style.fill.blip)
  const { width, height, nativeStroke, occurrenceMatrix = IDENTITY, fillFrame } = options
  const asset = blipSourceAsset(options.asset, options.derivedAssets, options.modifier)
  if (
    ![geometry.width, geometry.height, width, height].every(
      (value) => typeof value === 'number' && Number.isFinite(value) && value > 0
    )
  )
    fail('render extent')
  const id = blipPaintId(geometry, options)
  const rect = (value, w, h) => {
    const x = w * ((value?.l ?? 0) / 100000),
      y = h * ((value?.t ?? 0) / 100000)
    const rw = w * (1 - ((value?.l ?? 0) + (value?.r ?? 0)) / 100000)
    const rh = h * (1 - ((value?.t ?? 0) + (value?.b ?? 0)) / 100000)
    if (![x, y, rw, rh].every(Number.isFinite) || rw <= 0 || rh <= 0) fail('collapsed rectangle')
    return { x, y, width: rw, height: rh }
  }
  const source = rect(blip.srcRect, asset.width, asset.height)
  const image = (destination) => {
    const sx = destination.width / source.width,
      sy = destination.height / source.height
    return `<image x="${destination.x - source.x * sx}" y="${destination.y - source.y * sy}" width="${asset.width * sx}" height="${asset.height * sy}" href="${escapePlainText(asset.src)}" preserveAspectRatio="none"/>`
  }
  let transform = fillFrame?.paintToLeaf ?? IDENTITY
  let paintWidth = fillFrame?.width ?? geometry.width,
    paintHeight = fillFrame?.height ?? geometry.height
  const paintWorld = fillFrame?.paintToWorld ?? occurrenceMatrix
  if (blip.rotWithShape === false) {
    // Native90-degree rectangular cases anchor upright paint at transformed
    // bounds, not at an authored-center counterrotation with repeated fragments.
    const corners = [
      [0, 0],
      [paintWidth, 0],
      [0, paintHeight],
      [paintWidth, paintHeight],
    ].map(([x, y]) => transformPoint(paintWorld, { x, y }))
    const left = Math.min(...corners.map((point) => point.x)),
      top = Math.min(...corners.map((point) => point.y))
    paintWidth = Math.max(...corners.map((point) => point.x)) - left
    paintHeight = Math.max(...corners.map((point) => point.y)) - top
    transform = multiply(invert(occurrenceMatrix), [1, 0, 0, 1, left, top])
  } else if (!blip.stretch) {
    // Native2x/.5x group observation: tile physical size stays in slide units,
    // while shape coverage scales. Preserve orientation/reflection of the axes.
    const [a, b, c, d, e, f] = paintWorld
    const sx = Math.hypot(a, b),
      sy = Math.hypot(c, d)
    if (!sx || !sy) fail('collapsed occurrence')
    paintWidth *= sx
    paintHeight *= sy
    transform = multiply(invert(occurrenceMatrix), [a / sx, b / sx, c / sy, d / sy, e, f])
  }
  if (nativeStroke)
    transform = multiply([width / geometry.width, 0, 0, height / geometry.height, 0, 0], transform)
  let x = 0,
    y = 0,
    w,
    h,
    ink,
    clip
  if (blip.stretch) {
    w = paintWidth
    h = paintHeight
    const destination = rect(blip.stretch.fillRect, w, h)
    clip = destination
    ink = `<g clip-path="url(#${id}-crop)">${image(destination)}</g>`
  } else {
    const tile = blip.tile || {}
    const tw = asset.width * 9525 * ((tile.sx ?? 100000) / 100000)
    const th = asset.height * 9525 * ((tile.sy ?? 100000) / 100000)
    if (![tw, th].every((value) => Number.isFinite(value) && value > 0)) fail('collapsed tile')
    const alignment = tile.algn ?? 'tl'
    x =
      (['t', 'ctr', 'b'].includes(alignment)
        ? (paintWidth - tw) / 2
        : ['tr', 'r', 'br'].includes(alignment)
          ? paintWidth - tw
          : 0) + (tile.tx ?? 0)
    y =
      (['l', 'ctr', 'r'].includes(alignment)
        ? (paintHeight - th) / 2
        : ['bl', 'b', 'br'].includes(alignment)
          ? paintHeight - th
          : 0) + (tile.ty ?? 0)
    const fx = ['x', 'xy'].includes(tile.flip),
      fy = ['y', 'xy'].includes(tile.flip)
    w = tw * (fx ? 2 : 1)
    h = th * (fy ? 2 : 1)
    clip = { x: 0, y: 0, width: tw, height: th }
    const tileImage = `<g clip-path="url(#${id}-crop)">${image(clip)}</g>`
    ink =
      tileImage +
      (fx ? `<g transform="matrix(-1 0 0 1 ${w} 0)">${tileImage}</g>` : '') +
      (fy ? `<g transform="matrix(1 0 0 -1 0 ${h})">${tileImage}</g>` : '') +
      (fx && fy ? `<g transform="matrix(-1 0 0 -1 ${w} ${h})">${tileImage}</g>` : '')
  }
  return `<defs><clipPath id="${id}-crop" clipPathUnits="userSpaceOnUse"><rect x="${clip.x}" y="${clip.y}" width="${clip.width}" height="${clip.height}"/></clipPath><pattern id="${id}" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}" patternTransform="matrix(${transform.join(' ')})">${ink}</pattern></defs>`
}
module.exports = { blipParameters, blipPatch, blipPaintId, blipSvgDefinition }
