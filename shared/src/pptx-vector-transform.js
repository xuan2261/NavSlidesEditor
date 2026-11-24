const { multiply, IDENTITY } = require('./pptx-affine')
const NUMBER = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?'
function svgNumbers(text) {
  if (typeof text !== 'string' || text.length > 1048576) throw new TypeError('Invalid SVG numbers')
  const tokens = text.trim().match(new RegExp(NUMBER, 'g')) || []
  if (!tokens.length || !new RegExp(`^\\s*${NUMBER}(?:(?:\\s*,\\s*|\\s+|(?=[+-]))${NUMBER})*\\s*$`).test(text))
    throw new TypeError('Invalid SVG numbers')
  const values = tokens.map(Number)
  if (values.some((value) => !Number.isFinite(value) || Math.abs(value) > 1e12)) throw new TypeError('Invalid SVG number range')
  return values
}
function svgTransform(text) {
  if (typeof text !== 'string' || text.length > 8192) throw new TypeError('Invalid SVG transform')
  let matrix = [...IDENTITY], cursor = 0, count = 0
  const expression = /([A-Za-z]+)\s*\(([^()]*)\)/g
  for (const match of text.matchAll(expression)) {
    if (text.slice(cursor, match.index).trim().replace(/^,/, '').trim() || ++count > 64)
      throw new TypeError('Invalid SVG transform list')
    const values = svgNumbers(match[2]), [a, b, c] = values
    let next
    if (match[1] === 'matrix' && values.length === 6) next = values
    else if (match[1] === 'translate' && [1, 2].includes(values.length)) next = [1, 0, 0, 1, a, b ?? 0]
    else if (match[1] === 'scale' && [1, 2].includes(values.length)) next = [a, 0, 0, b ?? a, 0, 0]
    else if (match[1] === 'rotate' && [1, 3].includes(values.length)) {
      const angle = a * Math.PI / 180, cosine = Math.cos(angle), sine = Math.sin(angle)
      next = [cosine, sine, -sine, cosine, 0, 0]
      if (values.length === 3) next = multiply(multiply([1, 0, 0, 1, b, c], next), [1, 0, 0, 1, -b, -c])
    } else if (['skewX', 'skewY'].includes(match[1]) && values.length === 1) {
      const tangent = Math.tan(a * Math.PI / 180)
      next = match[1] === 'skewX' ? [1, 0, tangent, 1, 0, 0] : [1, tangent, 0, 1, 0, 0]
    } else throw new TypeError('Unsupported SVG transform')
    matrix = multiply(matrix, next)
    if (matrix.some((value) => !Number.isFinite(value) || Math.abs(value) > 1e12)) throw new TypeError('Invalid SVG transform range')
    cursor = match.index + match[0].length
  }
  if (!count || text.slice(cursor).trim()) throw new TypeError('Invalid SVG transform tail')
  return matrix
}
module.exports = { svgNumbers, svgTransform }
