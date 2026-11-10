/**
 * Client-side session derivation cache for blip path shading.
 *
 * Derives pre-interpolation shaded raster variants at source resolution
 * using OffscreenCanvas (or standard HTMLCanvasElement) in a browser context.
 *
 * Avoids any server-side raster decoding or persistent storage.
 * Caches derived blob URLs by `(sourceSrc, modifier)`.
 */

import { blipShadePixelsInPlace, BLIP_SHADE_MODIFIERS } from 'revealjs-shared/src/pptx-geometry-blip-shade.js'

const cache = new Map()

/**
 * Derives a shaded variant of an image at source resolution.
 *
 * @param {string} src - source image URL (typically /uploads/...)
 * @param {string} modifier - 'lighten' | 'lightenLess' | 'darken' | 'darkenLess'
 * @returns {Promise<string>} derived object URL (or source URL if norm/unsupported)
 */
export async function getDerivedBlipVariant(src, modifier = 'norm') {
  if (!src || modifier === 'norm' || !BLIP_SHADE_MODIFIERS.includes(modifier)) {
    return src
  }

  const key = `${src}:${modifier}`
  if (cache.has(key)) {
    return cache.get(key)
  }

  // Load the source image to extract natural dimensions and raw pixel bytes
  const image = await loadImage(src)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height

  if (!width || !height) {
    return src
  }

  let canvas, ctx
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(width, height)
    ctx = canvas.getContext('2d', { willReadFrequently: true })
  } else if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    ctx = canvas.getContext('2d', { willReadFrequently: true })
  } else {
    // Non-browser / test environment without Canvas support
    return src
  }

  if (!ctx) {
    return src
  }

  ctx.drawImage(image, 0, 0)
  const imageData = ctx.getImageData(0, 0, width, height)

  // Apply discrete integer transfer in-place at source resolution (alpha preserved)
  blipShadePixelsInPlace(imageData.data, modifier)
  ctx.putImageData(imageData, 0, 0)

  let derivedUrl = src
  if (typeof canvas.convertToBlob === 'function') {
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    derivedUrl = URL.createObjectURL(blob)
  } else if (typeof canvas.toDataURL === 'function') {
    derivedUrl = canvas.toDataURL('image/png')
  }

  cache.set(key, derivedUrl)
  return derivedUrl
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Image is not defined in this environment'))
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(new Error(`Failed to load image from ${src}: ${e?.message || 'unknown error'}`))
    img.src = src
  })
}

/**
 * Clears the session derivation cache and revokes any created blob URLs.
 */
export function clearBlipVariantCache() {
  for (const url of cache.values()) {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function' && url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  }
  cache.clear()
}
