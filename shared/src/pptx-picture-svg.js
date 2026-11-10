const { pictureParameters } = require('./pptx-picture-document')
const { geometrySvgPathsString } = require('./pptx-geometry-svg')
const { escapePlainText } = require('./content-safety')
const { pictureShapeEffects } = require('./pptx-picture-effects')

function pictureSvg(element, resolveSource = (src) => src) {
  const picture = pictureParameters(element.pptxPicture)
  const geometry = element.pptxPictureGeometry
  const {
    schemaVersion: _v,
    componentId: _c,
    mediaBinding: _m,
    cstate: _s,
    useLocalDpi: _localCompression,
    alpha,
    filters: colorFilters = [],
    ...placement
  } = picture
  let hash = 0x6c62272e07bb014262b821756295c58dn
  for (const character of JSON.stringify([picture, geometry, element.pptxOccurrenceMatrix]))
    hash = BigInt.asUintN(
      128,
      (hash ^ BigInt(character.charCodeAt(0))) * 0x1000000000000000000013bn
    )
  const id = `pptx-picture-${hash.toString(16)}`
  const options = {
    width: geometry.width / 9525,
    height: geometry.height / 9525,
    fill: 'none',
    stroke: 'none',
    strokeWidth: 0,
    occurrenceMatrix: element.pptxOccurrenceMatrix,
    blipAsset: element.pptxPictureAsset,
    effectFillAssets: element.pptxEffectFillAssets,
  }
  // Each SVG transfer clamps independently. In particular 2x then .35x is not
  // equivalent to .7 opacity on pixels whose first stage saturates.
  // Note: DrawingML <a:lum> luminance adjustments use non-linear contrast curves in
  // native PowerPoint (e.g. positive contrast). Linear SVG feComponentTransfer
  // is a deterministic browser projection approximation, not certified native equivalence.
  const stages = [
    ...alpha.map((stage) => `<feComponentTransfer><feFuncA type="linear" slope="${(stage.amt ?? 100000) / 100000}" intercept="0"/></feComponentTransfer>`),
    ...colorFilters.map((stage) => {
      if (stage.kind === 'inv') {
        return '<feComponentTransfer><feFuncR type="linear" slope="-1" intercept="1"/><feFuncG type="linear" slope="-1" intercept="1"/><feFuncB type="linear" slope="-1" intercept="1"/></feComponentTransfer>'
      }
      if (stage.kind === 'lum') {
        const bright = (stage.bright ?? 0) / 100000
        const contrast = (stage.contrast ?? 0) / 100000
        const slope = 1 + contrast
        const intercept = bright - 0.5 * contrast
        return `<feComponentTransfer><feFuncR type="linear" slope="${slope}" intercept="${intercept}"/><feFuncG type="linear" slope="${slope}" intercept="${intercept}"/><feFuncB type="linear" slope="${slope}" intercept="${intercept}"/></feComponentTransfer>`
      }
      return ''
    }),
  ]
  const filters = stages.length
    ? `<defs><filter id="${id}-alpha" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${stages.join('')}</filter></defs>`
    : ''
  const ink = geometrySvgPathsString(
    {
      ...geometry,
      style: {
        fill: { blip: { bindingId: id, ...placement } },
        stroke: { color: { kind: 'none' }, width: 0 },
      },
    },
    options
  )
    .replaceAll('<image ', stages.length ? `<image filter="url(#${id}-alpha)" ` : '<image ')
    .replaceAll(
      `href="${escapePlainText(element.pptxPictureAsset.src)}"`,
      `href="${escapePlainText(resolveSource(element.pptxPictureAsset.src))}"`
    )
  const outline = geometrySvgPathsString(
    {
      ...geometry,
      style: {
        fill: { color: { kind: 'none' } },
        ...(geometry.style?.stroke ? { stroke: geometry.style.stroke } : {}),
      },
    },
    options
  )
  const alt = element.decorative ? '' : element.alt || ''
  const accessibility = element.decorative
    ? 'aria-hidden="true"'
    : `role="img" aria-label="${escapePlainText(alt)}"`
  let painted = pictureShapeEffects(geometry, options, ink,
    `<g data-pptx-picture-outline="true">${outline}</g>`)
  // Keep canonical upload URLs through blip validation; resolve emitted hrefs afterward.
  for (const asset of Object.values(element.pptxEffectFillAssets ?? {}))
    painted = painted.replaceAll(
      `href="${escapePlainText(asset.src)}"`,
      `href="${escapePlainText(resolveSource(asset.src))}"`
    )
  return `<svg xmlns="http://www.w3.org/2000/svg" data-pptx-picture="${escapePlainText(picture.componentId)}" width="100%" height="100%" viewBox="0 0 ${options.width} ${options.height}" preserveAspectRatio="none" style="display:block;overflow:visible" ${accessibility}>${element.longDescription ? `<desc>${escapePlainText(element.longDescription)}</desc>` : ''}${filters}${painted}</svg>`
}
module.exports = { pictureSvg }
