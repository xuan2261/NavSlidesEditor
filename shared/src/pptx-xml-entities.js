// XML attribute decoding shared by source readers and canonical validation.
function decodeXml(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
  let output = ''
  let cursor = 0
  const matcher = /&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g
  for (const match of value.matchAll(matcher)) {
    if (value.slice(cursor, match.index).includes('&')) return null
    output += value.slice(cursor, match.index)
    const token = match[0].slice(1, -1)
    if (Object.prototype.hasOwnProperty.call(entities, token)) output += entities[token]
    else {
      const point = Number.parseInt(token.slice(token.startsWith('#x') ? 2 : 1), token.startsWith('#x') ? 16 : 10)
      if (!Number.isInteger(point) || point > 0x10ffff || point < 0) return null
      output += String.fromCodePoint(point)
    }
    cursor = match.index + match[0].length
  }
  return value.slice(cursor).includes('&') ? null : output + value.slice(cursor)
}
module.exports = { decodeXml }
