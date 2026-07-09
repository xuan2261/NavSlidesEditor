/**
 * Structural Similarity (SSIM) for raw RGBA/RGB/gray buffers.
 * Uses a single global window (image-level) suitable for regression gates.
 * Returns value in [0, 1]; identical buffers → 1.
 */

const C1 = (0.01 * 255) ** 2
const C2 = (0.03 * 255) ** 2

function channelCount(byteLength, width, height) {
  const pixels = width * height
  if (pixels <= 0) return 0
  const c = byteLength / pixels
  if (c === 1 || c === 3 || c === 4) return c
  return 0
}

function luminanceAt(buf, i, channels) {
  if (channels === 1) return buf[i]
  const o = i * channels
  const r = buf[o]
  const g = buf[o + 1]
  const b = buf[o + 2]
  // Rec. 601 luma
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/**
 * @param {Buffer|Uint8Array} a
 * @param {Buffer|Uint8Array} b
 * @param {{ width: number, height: number }} size
 * @returns {number} SSIM in [0, 1]
 */
function computeSsim(a, b, { width, height }) {
  const w = Number(width)
  const h = Number(height)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    throw new Error('ssim requires positive width and height')
  }
  if (!a || !b || a.byteLength !== b.byteLength) {
    throw new Error('ssim requires equal-length buffers')
  }
  const channels = channelCount(a.byteLength, w, h)
  if (!channels) {
    throw new Error('ssim buffer size must match width*height*(1|3|4)')
  }

  const n = w * h
  if (n === 1) {
    const la = luminanceAt(a, 0, channels)
    const lb = luminanceAt(b, 0, channels)
    return la === lb ? 1 : Math.max(0, 1 - Math.abs(la - lb) / 255)
  }

  let sumA = 0
  let sumB = 0
  let sumA2 = 0
  let sumB2 = 0
  let sumAB = 0
  for (let i = 0; i < n; i += 1) {
    const la = luminanceAt(a, i, channels)
    const lb = luminanceAt(b, i, channels)
    sumA += la
    sumB += lb
    sumA2 += la * la
    sumB2 += lb * lb
    sumAB += la * lb
  }

  const muA = sumA / n
  const muB = sumB / n
  const sigmaA2 = sumA2 / n - muA * muA
  const sigmaB2 = sumB2 / n - muB * muB
  const sigmaAB = sumAB / n - muA * muB

  const numerator = (2 * muA * muB + C1) * (2 * sigmaAB + C2)
  const denominator = (muA * muA + muB * muB + C1) * (sigmaA2 + sigmaB2 + C2)
  if (denominator === 0) return 1
  const value = numerator / denominator
  // Clamp numerical noise
  if (value > 1) return 1
  if (value < 0) return 0
  return value
}

function roundSsim(value, digits = 4) {
  const f = 10 ** digits
  return Math.round(Number(value) * f) / f
}

module.exports = {
  computeSsim,
  roundSsim,
}
