const { resolveGeometryColorPaint } = require('./pptx-geometry-color')

function geometryInnerShadowSvg(geometry, shadow, { ink, bounds, occurrenceMatrix, includeSource = true }) {
  const angle = ((shadow.dir ?? 0) * Math.PI) / 10800000
  const cosine = Math.cos(angle),
    sine = Math.sin(angle)
  // Inner shadows have no rotWithShape switch: direction follows geometry.
  // Match the existing shadow contract's slide-unit distance under group scale.
  const scale = Math.hypot(
    occurrenceMatrix[0] * cosine + occurrenceMatrix[2] * sine,
    occurrenceMatrix[1] * cosine + occurrenceMatrix[3] * sine
  )
  const distance = (shadow.dist ?? 0) / 9525 / scale
  const dx = distance * cosine,
    dy = distance * sine
  // Reuse the outer-shadow blur transfer; native inner-shadow pixel equivalence
  // requires its own receipt and is not established by this derived SVG.
  const sigma = (shadow.blurRad ?? 0) / 9525 / 3
  const pad = sigma * 4 + 1
  const left = bounds[0] + Math.min(0, dx) - pad
  const top = bounds[1] + Math.min(0, dy) - pad
  const right = bounds[2] + Math.max(0, dx) + pad
  const bottom = bounds[3] + Math.max(0, dy) + pad
  const color = resolveGeometryColorPaint(shadow.color)
  const key = JSON.stringify([shadow, bounds, occurrenceMatrix, includeSource])
  let hash = 0x6c62272e07bb014262b821756295c58dn
  for (const character of key)
    hash = BigInt.asUintN(
      128,
      (hash ^ BigInt(character.charCodeAt(0))) * 0x1000000000000000000013bn
    )
  const id = 'pptx-inner-shadow-' + hash.toString(16).padStart(32, '0')
  // Color the complement of the shifted alpha, then composite atop the original.
  // Unlike an over/merge overlay, atop preserves SourceGraphic alpha exactly,
  // including translucent fills, stroked outlines, and transparent interior holes.
  return `<defs><filter id="${id}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="${sigma}" result="blur"/><feOffset in="blur" dx="${dx}" dy="${dy}" result="offset"/><feFlood flood-color="#${color.rgb}" flood-opacity="${color.alpha}" result="color"/><feComposite in="color" in2="offset" operator="out" result="shadow"/><feComposite in="shadow" in2="SourceGraphic" operator="${includeSource ? 'atop' : 'in'}"/></filter></defs><g data-pptx-geometry-inner-shadow="${geometry.componentId}" filter="url(#${id})">${ink}</g>`
}

module.exports = { geometryInnerShadowSvg }
