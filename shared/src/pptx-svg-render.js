const { normalizeSvgDocument } = require('./pptx-svg-document')
const { geometrySvgPathsString } = require('./pptx-geometry-svg')

function semanticSvgMarkup(input) {
  const document = normalizeSvgDocument(input)
  const { x, y, width, height } = document.viewBox
  const paths = document.paths.map(({ geometry, transform }) => {
    const stroke = geometry.style?.stroke
    const adaptedGeometry = stroke && stroke.width !== undefined && stroke.color?.kind !== 'none'
      ? { ...geometry, style: { ...geometry.style, stroke: { ...stroke, width: stroke.width * 9525 } } }
      : geometry
    const markup = geometrySvgPathsString(adaptedGeometry, {
      width, height, fill: 'none', stroke: 'none', strokeWidth: 0,
    })
    return transform ? `<g transform="matrix(${transform.join(' ')})">${markup}</g>` : markup
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" preserveAspectRatio="${document.preserveAspectRatio ?? 'xMidYMid meet'}">${paths}</svg>`
}

module.exports = { semanticSvgMarkup }
