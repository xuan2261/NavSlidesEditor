const align = (n) => Math.ceil(n / 4) * 4
const HEAD = 0x68656164
const DSIG = 0x44534947

// Sum padded big-endian words; a head table's checkSumAdjustment is excluded.
function checksum(bytes, offset, length, head = false) {
  const v = new DataView(bytes)
  let sum = 0
  for (let i = 0; i < length; i += 4) {
    let word = 0
    for (let j = 0; j < 4; j++)
      word = word * 256 + (i + j < length && !(head && i === 8) ? v.getUint8(offset + i + j) : 0)
    sum = (sum + word) >>> 0
  }
  return sum
}

// Validate the entire container before admitting any face. TTC offsets are
// absolute; exact table sharing is legal, partial overlap or directory aliasing
// is not. DSIG structure is validated, not authenticated. Signatures cannot
// survive rebasing and are omitted with explicit private provenance.
function readSourceFontCollection(bytes) {
  const v = new DataView(bytes)
  const fail = (reason = 'font-collection-malformed') => {
    const error = new TypeError(reason)
    error.reason = reason
    throw error
  }
  const range = (offset, length) => {
    if (offset < 0 || offset + length > v.byteLength) fail()
  }
  const u16 = (at) => { range(at, 2); return v.getUint16(at) }
  const u32 = (at) => { range(at, 4); return v.getUint32(at) }
  function validateDsig(offset, length) {
    range(offset, length)
    if (length < 8 || u32(offset) !== 1 || (u16(offset + 6) & ~1)) fail()
    const count = u16(offset + 4), header = 8 + count * 12, blocks = []
    if (header > length) fail()
    for (let i = 0; i < count; i++) {
      const at = offset + 8 + i * 12, size = u32(at + 4), start = u32(at + 8)
      if (u32(at) !== 1 || size < 8 || start < header || start + size > length ||
          u16(offset + start) || u16(offset + start + 2) || u32(offset + start + 4) !== size - 8) fail()
      blocks.push({ start, size })
    }
    blocks.sort((a, b) => a.start - b.start)
    for (let i = 1; i < blocks.length; i++)
      if (blocks[i].start < blocks[i - 1].start + blocks[i - 1].size) fail()
  }
  if (u32(0) !== 0x74746366) fail()
  const version = u32(4), count = u32(8)
  if (![0x00010000, 0x00020000].includes(version)) fail('font-collection-version-unsupported')
  if (!count || count > 256) fail()
  const headerLength = 12 + count * 4 + (version === 0x00020000 ? 12 : 0)
  range(0, headerLength)
  const directories = [{ offset: 0, length: headerLength }], faces = [], regions = []
  let collectionDsig = false
  if (version === 0x00020000) {
    const at = 12 + count * 4, tag = u32(at), length = u32(at + 4), offset = u32(at + 8)
    if (tag || length || offset) {
      if (tag !== DSIG || !length || offset < headerLength || offset % 4) fail()
      validateDsig(offset, length)
      directories.push({ offset, length })
      collectionDsig = true
    }
  }
  for (let faceIndex = 0; faceIndex < count; faceIndex++) {
    const offset = u32(12 + faceIndex * 4)
    if (offset < headerLength || offset % 4) fail()
    const signature = u32(offset), tableCount = u16(offset + 4)
    // Only TrueType outlines have real-byte coverage in this extraction lane.
    if (signature !== 0x00010000) fail('font-collection-outline-unsupported')
    if (!tableCount || tableCount > 256) fail()
    const length = 12 + tableCount * 16
    range(offset, length)
    directories.push({ offset, length })
    const tables = []
    let previous = -1, byteLength = 12, dsigRemoved = collectionDsig
    for (let i = 0; i < tableCount; i++) {
      const at = offset + 12 + i * 16, tag = u32(at), sum = u32(at + 4)
      const start = u32(at + 8), size = u32(at + 12)
      if (tag <= previous || start % 4 || start < headerLength || !size) fail()
      range(start, size)
      previous = tag
      const table = { tag, sum, offset: start, length: size }
      regions.push(table)
      if (tag === DSIG) {
        validateDsig(start, size)
        dsigRemoved = true
      } else {
        tables.push(table)
        byteLength += 16 + align(size)
      }
    }
    const head = tables.find((t) => t.tag === HEAD)
    if (!head || head.length < 54 ||
        ![0x676c7966, 0x6c6f6361].every((tag) => tables.some((t) => t.tag === tag))) fail()
    faces.push({ faceIndex, offset, signature, tables, byteLength, dsigRemoved })
  }
  directories.sort((a, b) => a.offset - b.offset)
  for (let i = 1; i < directories.length; i++)
    if (directories[i].offset < directories[i - 1].offset + directories[i - 1].length) fail()
  regions.sort((a, b) => a.offset - b.offset || a.length - b.length)
  let previous
  for (const table of regions) {
    if (directories.some((d) => table.offset < d.offset + d.length && d.offset < table.offset + table.length))
      fail()
    if (previous && table.offset < previous.offset + previous.length) {
      if (table.offset !== previous.offset || table.length !== previous.length ||
          table.tag !== previous.tag || table.sum !== previous.sum) fail()
      continue
    }
    if (checksum(bytes, table.offset, table.length, table.tag === HEAD) !== table.sum) fail()
    previous = table
  }
  return { version, faces }
}

function extractSourceFontCollectionFace(bytes, face) {
  const result = new ArrayBuffer(face.byteLength), v = new DataView(result)
  const count = face.tables.length, selector = Math.floor(Math.log2(count))
  v.setUint32(0, face.signature)
  v.setUint16(4, count)
  v.setUint16(6, 16 * 2 ** selector)
  v.setUint16(8, selector)
  v.setUint16(10, count * 16 - 16 * 2 ** selector)
  let offset = 12 + count * 16, head
  face.tables.forEach((table, index) => {
    const at = 12 + index * 16
    v.setUint32(at, table.tag)
    v.setUint32(at + 4, table.sum)
    v.setUint32(at + 8, offset)
    v.setUint32(at + 12, table.length)
    new Uint8Array(result, offset, table.length).set(new Uint8Array(bytes, table.offset, table.length))
    if (table.tag === HEAD) { head = offset; v.setUint32(head + 8, 0) }
    offset += align(table.length)
  })
  v.setUint32(head + 8, (0xb1b0afba - checksum(result, 0, result.byteLength)) >>> 0)
  return result
}

module.exports = { readSourceFontCollection, extractSourceFontCollectionFace }
