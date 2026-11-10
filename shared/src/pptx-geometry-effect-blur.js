function geometryBlurSvg(geometry, blur, { ink, bounds, occurrenceMatrix }) {
  if (!(blur.rad ?? 0)) return ink
  // Derived rendering choices, NOT native-qualified: radius is converted to
  // local CSS units, sigma = radius / 3, and the enclosing affine scales it.
  // Absent/true grow expands support; false clips at the combined ink bounds.
  // Native kernel, units, grow behavior and affine equivalence require a probe.
  const sigma = blur.rad / 9525 / 3
  const pad = blur.grow === false ? 0 : sigma * 4 + 1
  const key = JSON.stringify([blur, bounds, occurrenceMatrix])
  let hash = 0x6c62272e07bb014262b821756295c58dn
  for (const character of key)
    hash = BigInt.asUintN(
      128,
      (hash ^ BigInt(character.charCodeAt(0))) * 0x1000000000000000000013bn
    )
  const id = 'pptx-blur-' + hash.toString(16).padStart(32, '0')
  // Blur SourceGraphic once, including fill/outline/ends together. Blurring
  // SourceAlpha and repainting would lose source colors and translucent ink.
  return `<defs><filter id="${id}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="${bounds[0] - pad}" y="${bounds[1] - pad}" width="${bounds[2] - bounds[0] + pad * 2}" height="${bounds[3] - bounds[1] + pad * 2}" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="${sigma}"/></filter></defs><g data-pptx-geometry-blur="${geometry.componentId}" filter="url(#${id})">${ink}</g>`
}

module.exports = { geometryBlurSvg }
