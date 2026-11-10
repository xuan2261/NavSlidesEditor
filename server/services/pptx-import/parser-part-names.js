function compareParserParts(a, b) {
  const left = /(\d+)\.xml$/i.exec(a)
  const right = /(\d+)\.xml$/i.exec(b)
  if (left && right) {
    const x = BigInt(left[1])
    const y = BigInt(right[1])
    return x < y ? -1 : x > y ? 1 : 0
  }
  if (left) return -1
  if (right) return 1
  return a < b ? -1 : a > b ? 1 : 0
}

function relationshipPart(part) {
  const slash = part.lastIndexOf('/')
  return `${part.slice(0, slash)}/_rels/${part.slice(slash + 1)}.rels`
}

module.exports = { compareParserParts, relationshipPart }
