const { resolveGeometryColorPaint } = require('./pptx-geometry-color')

function geometryGlowSvg(geometry, glow, { ink, bounds, occurrenceMatrix, includeSource = true }) {
  if (!(glow.rad ?? 0)) return includeSource ? ink : ''
  // This local authored-unit Gaussian transfer is derived, not native-qualified.
  // Glow needs independent native radius/affine receipts; shadow receipts do not
  // establish PowerPoint glow equivalence.
  const sigma = glow.rad / 9525 / 3
  const pad = sigma * 4 + 1
  const left = bounds[0] - pad, top = bounds[1] - pad
  const width = bounds[2] - bounds[0] + pad * 2
  const height = bounds[3] - bounds[1] + pad * 2
  const color = resolveGeometryColorPaint(glow.color)
  const key = JSON.stringify([glow, bounds, occurrenceMatrix, includeSource])
  let hash = 0x6c62272e07bb014262b821756295c58dn
  for (const character of key)
    hash = BigInt.asUintN(
      128,
      (hash ^ BigInt(character.charCodeAt(0))) * 0x1000000000000000000013bn
    )
  const id = 'pptx-glow-' + hash.toString(16).padStart(32, '0')
  // Build exterior coverage separately from opacity. Gamma lifts positive alpha
  // above the discrete threshold while keeping zero zero, including float
  // subnormal alpha. This keeps glow off translucent source ink as well as opaque
  // ink; a plain "out SourceAlpha" would alter source opacity and color there.
  // The blurred field still uses original SourceAlpha, not this coverage mask.
  const merge = includeSource ? '<feMerge><feMergeNode in="exterior"/><feMergeNode in="SourceGraphic"/></feMerge>' : ''
  return `<defs><filter id="${id}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="${left}" y="${top}" width="${width}" height="${height}" color-interpolation-filters="sRGB"><feComponentTransfer in="SourceAlpha" result="coverageLift"><feFuncA type="gamma" amplitude="1" exponent="0.000001" offset="0"/></feComponentTransfer><feComponentTransfer in="coverageLift" result="inkCoverage"><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer><feGaussianBlur in="SourceAlpha" stdDeviation="${sigma}" result="blur"/><feFlood flood-color="#${color.rgb}" flood-opacity="${color.alpha}" result="color"/><feComposite in="color" in2="blur" operator="in" result="glow"/><feComposite in="glow" in2="inkCoverage" operator="out" result="exterior"/>${merge}</filter></defs><g data-pptx-geometry-glow="${geometry.componentId}" filter="url(#${id})">${ink}</g>`
}

module.exports = { geometryGlowSvg }
