// Exact UTF-8 size of a JSON string, without allocating serialized strings or
// per-leaf Uint8Arrays. JSON escapes lone surrogates, but not / or U+2028/U+2029.
function jsonStringByteLength(value) {
  let bytes = 2 // surrounding quotes
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code === 0x22 || code === 0x5c) bytes += 2
    else if (code < 0x20)
      bytes += code === 8 || code === 9 || code === 10 || code === 12 || code === 13 ? 2 : 6
    else if (code < 0x80) bytes++
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdfff) {
      const next = value.charCodeAt(i + 1)
      if (code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4
        i++
      } else bytes += 6
    } else bytes += 3
  }
  return bytes
}
// Pure leaf metrics shared by checked allocation and fallback measurement.
const stringify = JSON.stringify
function primitiveCloneMetrics(value) {
  return { nodeCount: 1, maxRelativeDepth: 0, maxArrayLength: 0,
    jsonBytes: typeof value === 'string' ? jsonStringByteLength(value)
      : typeof value === 'number' ? stringify(value).length
      : value === true ? 4 : value === false ? 5 : 4 }
}
module.exports = { jsonStringByteLength, primitiveCloneMetrics }
