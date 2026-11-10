/**
 * Pure integer color transform for OOXML path-level blip shading.
 *
 * Applies the frozen source-before RGB candidate for OOXML path modifiers.
 * Browser-local control parity is not native alpha or texture qualification.
 *
 * Invariant: Alpha channel is strictly preserved: A_dst = A_src.
 */

const BLIP_SHADE_MODIFIERS = Object.freeze(['lighten', 'lightenLess', 'darken', 'darkenLess'])

function fail(msg) {
  throw new TypeError(`Invalid blip shade: ${msg}`)
}

/**
 * Builds a 256-entry lookup table for the given modifier.
 *
 * Formula matches the frozen candidate algorithm:
 *   mix = Math.trunc(255 * (1 - remaining))
 *   lighten: Math.round((c * (255 - mix) + 255 * mix) / 255)
 *   darken:  Math.round((c * (255 - mix)) / 255)
 */
function buildTransferTable(modifier) {
  if (modifier === 'norm') {
    return Uint8Array.from({ length: 256 }, (_, i) => i)
  }
  if (!BLIP_SHADE_MODIFIERS.includes(modifier)) {
    fail(`unsupported modifier "${modifier}"`)
  }
  const remaining = modifier.endsWith('Less') ? 0.8 : 0.6
  const mix = Math.trunc(255 * (1 - remaining))
  const table = new Uint8Array(256)
  const isLighten = modifier.startsWith('lighten')
  for (let c = 0; c < 256; c++) {
    table[c] = Math.round((c * (255 - mix) + (isLighten ? 255 * mix : 0)) / 255)
  }
  return table
}

const TABLES = Object.freeze({
  norm: buildTransferTable('norm'),
  lighten: buildTransferTable('lighten'),
  lightenLess: buildTransferTable('lightenLess'),
  darken: buildTransferTable('darken'),
  darkenLess: buildTransferTable('darkenLess'),
})

/**
 * Transforms an [R, G, B, A] tuple by the specified modifier.
 *
 * @param {[number, number, number, number]} rgba - 8-bit channel values [0..255]
 * @param {string} modifier - 'norm' | 'lighten' | 'lightenLess' | 'darken' | 'darkenLess'
 * @returns {[number, number, number, number]} transformed RGBA
 */
function blipShadeColorTransform(rgba, modifier = 'norm') {
  if (!Array.isArray(rgba) || rgba.length !== 4) {
    fail('expected 4-element RGBA array')
  }
  for (let i = 0; i < 4; i++) {
    const v = rgba[i]
    if (!Number.isInteger(v) || v < 0 || v > 255) {
      fail(`invalid channel value at index ${i}: ${v}`)
    }
  }
  const table = TABLES[modifier]
  if (!table) {
    fail(`unsupported modifier "${modifier}"`)
  }
  return [table[rgba[0]], table[rgba[1]], table[rgba[2]], rgba[3]]
}

/**
 * Applies the transfer table in-place to an RGBA pixel buffer (Uint8ClampedArray / Buffer).
 *
 * Stride must be 4 (R, G, B, A). Alpha channel (offset + 3) is untouched.
 *
 * @param {Uint8Array|Uint8ClampedArray} data - RGBA pixel bytes
 * @param {string} modifier - shade modifier
 */
function blipShadePixelsInPlace(data, modifier = 'norm') {
  if (!(data instanceof Uint8Array || data instanceof Uint8ClampedArray) || data.length % 4 !== 0)
    fail('expected RGBA byte buffer')
  if (modifier === 'norm') return
  const table = TABLES[modifier]
  if (!table) fail(`unsupported modifier "${modifier}"`)
  const len = data.length
  for (let i = 0; i < len; i += 4) {
    data[i] = table[data[i]]
    data[i + 1] = table[data[i + 1]]
    data[i + 2] = table[data[i + 2]]
    // data[i + 3] (alpha) remains untouched
  }
}

module.exports = {
  BLIP_SHADE_MODIFIERS,
  buildTransferTable,
  blipShadeColorTransform,
  blipShadePixelsInPlace,
}
