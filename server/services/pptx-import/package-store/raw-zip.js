const path = require('node:path').posix

function findEocd(bytes) {
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) return offset
  }
  throw new Error('ZIP end-of-central-directory record is missing')
}

function validateName(name) {
  const hasControl = [...name].some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127
  })
  if (!name || hasControl || name.includes('\\') ||
      name.startsWith('/') || /^[a-z]:/i.test(name) || name.includes('//')) {
    throw new Error(`Unsafe ZIP entry path: ${name}`)
  }
  const segments = name.split('/')
  if (segments.some((segment) => segment === '.' || segment === '..' ||
      /[. ]$/.test(segment) || /%2e|%2f|%5c/i.test(segment))) {
    throw new Error(`Unsafe ZIP dot segment: ${name}`)
  }
}

function parseRawEntries(bytes) {
  const eocd = findEocd(bytes)
  const count = bytes.readUInt16LE(eocd + 10)
  let offset = bytes.readUInt32LE(eocd + 16)
  const entries = []
  const exact = new Set()
  const folded = new Set()
  for (let index = 0; index < count; index += 1) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP central header')
    const flags = bytes.readUInt16LE(offset + 8)
    const crc32 = bytes.readUInt32LE(offset + 16)
    const compressedSize = bytes.readUInt32LE(offset + 20)
    const uncompressedSize = bytes.readUInt32LE(offset + 24)
    const nameLength = bytes.readUInt16LE(offset + 28)
    const extraLength = bytes.readUInt16LE(offset + 30)
    const commentLength = bytes.readUInt16LE(offset + 32)
    const localOffset = bytes.readUInt32LE(offset + 42)
    const rawName = bytes.subarray(offset + 46, offset + 46 + nameLength)
    const name = rawName.toString(flags & 0x800 ? 'utf8' : 'latin1').normalize('NFC')
    validateName(name)
    if (exact.has(name)) throw new Error(`Duplicate ZIP entry path: ${name}`)
    if (folded.has(name.toLocaleLowerCase('en-US'))) throw new Error(`ZIP case collision: ${name}`)
    exact.add(name)
    folded.add(name.toLocaleLowerCase('en-US'))
    if (bytes.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Invalid ZIP local header')
    const localNameLength = bytes.readUInt16LE(localOffset + 26)
    const localName = bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength)
    if (!localName.equals(rawName)) throw new Error(`ZIP header name mismatch: ${name}`)
    entries.push({
      name,
      rawNameHex: rawName.toString('hex'),
      encrypted: Boolean(flags & 0x1),
      compressedSize,
      uncompressedSize,
      crc32: crc32.toString(16).padStart(8, '0'),
      localHeaderOffset: localOffset,
      centralHeaderOffset: offset,
    })
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

function relationshipSource(relsPath) {
  if (relsPath === '_rels/.rels') return '/'
  const marker = '/_rels/'
  const at = relsPath.indexOf(marker)
  if (at < 0 || !relsPath.endsWith('.rels')) return null
  return `${relsPath.slice(0, at)}/${relsPath.slice(at + marker.length, -5)}`
}

function resolveTarget(source, target) {
  const value = String(target || '').split(/[?#]/, 1)[0]
  const invalid = !value || value.startsWith('//') || value.includes('\\') ||
    value.includes('//') || /^[a-z][a-z\d+.-]*:/i.test(value) || /%2e|%2f|%5c/i.test(value)
  const rootSegments = value.startsWith('/') ? value.slice(1).split('/') : []
  const rootSourceTraversal = source === '/' && value.split('/').some((segment) => segment === '..')
  if (invalid || rootSourceTraversal || rootSegments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('Unsafe OPC relationship target')
  }
  const resolved = value.startsWith('/')
    ? path.normalize(value.slice(1))
    : path.normalize(path.join(path.dirname(source || '/'), value))
  const normalized = resolved.replace(/^\/+/, '')
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../') ||
      path.isAbsolute(normalized)) {
    throw new Error('Unsafe OPC relationship target')
  }
  return normalized
}

module.exports = { parseRawEntries, relationshipSource, resolveTarget }
