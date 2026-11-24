function geometrySoftEdgeSvg(geometry, edge, { ink, bounds, occurrenceMatrix }) {
  if (!(edge.rad ?? 0)) return ink
  // Derived local-unit inward feather, NOT native-qualified. The erosion radius,
  // Gaussian transfer and scaling with the enclosing affine frame are explicit
  // renderer choices; outer-shadow/glow evidence does not qualify soft edges.
  const radius = edge.rad / 9525
  const sigma = radius / 3
  const pad = sigma * 4 + 1
  const key = JSON.stringify([edge, bounds, occurrenceMatrix])
  let hash = 0x6c62272e07bb014262b821756295c58dn
  for (const character of key)
    hash = BigInt.asUintN(
      128,
      (hash ^ BigInt(character.charCodeAt(0))) * 0x1000000000000000000013bn
    )
  const id = 'pptx-soft-edge-' + hash.toString(16).padStart(32, '0')
  // Feather coverage, not source opacity: translucent source ink keeps its own
  // alpha in the interior. Final "in" can only remove ink, never fill holes,
  // recolor SourceGraphic, or add exterior pixels. Combined fill/outline/end
  // coverage is processed together rather than softening individual paths.
  return `<defs><filter id="${id}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="${bounds[0] - pad}" y="${bounds[1] - pad}" width="${bounds[2] - bounds[0] + pad * 2}" height="${bounds[3] - bounds[1] + pad * 2}" color-interpolation-filters="sRGB"><feComponentTransfer in="SourceAlpha" result="coverageLift"><feFuncA type="gamma" amplitude="1" exponent="0.000001" offset="0"/></feComponentTransfer><feComponentTransfer in="coverageLift" result="coverage"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer><feMorphology in="coverage" operator="erode" radius="${radius / 2}" result="inset"/><feGaussianBlur in="inset" stdDeviation="${sigma}" result="feather"/><feComposite in="SourceGraphic" in2="feather" operator="in"/></filter></defs><g data-pptx-geometry-soft-edge="${geometry.componentId}" filter="url(#${id})">${ink}</g>`
}

module.exports = { geometrySoftEdgeSvg }
