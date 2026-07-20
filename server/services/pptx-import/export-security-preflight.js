const JSZip = require('jszip')
const zlib = require('node:zlib')
const {
  MAX_DECOMPRESSED_BYTES,
  MAX_FILE_BYTES,
  MAX_ZIP_ENTRIES,
} = require('./constants')
const { parseRawEntries } = require('./package-store/raw-zip')

const FORBIDDEN_PATHS = [
  /(^|\/)_xmlsignatures\//i,
  /(^|\/)vbaProject\.bin$/i,
  /(^|\/)activeX\//i,
  /(^|\/)embeddings\//i,
  /EncryptedPackage$/i,
]
const FORBIDDEN_TYPES = [
  /macroEnabled/i, /vbaProject/i, /activeX/i, /oleObject/i,
  /digital-signature/i, /encrypted/i, /rights-management/i,
]

function rawEntryBytes(bytes, entry, maxOutputLength) {
  const offset = entry.localHeaderOffset
  const method = bytes.readUInt16LE(offset + 8)
  const nameLength = bytes.readUInt16LE(offset + 26)
  const extraLength = bytes.readUInt16LE(offset + 28)
  const start = offset + 30 + nameLength + extraLength
  const compressed = bytes.subarray(start, start + entry.compressedSize)
  if (compressed.length !== entry.compressedSize) throw new Error('Truncated ZIP entry')
  if (method === 0) return compressed
  if (method === 8) return zlib.inflateRawSync(compressed, { maxOutputLength })
  throw new Error(`Unsupported ZIP compression method: ${method}`)
}

function inspectRawArchive(bytes, limits = {}) {
  const maxCompressedBytes = limits.maxCompressedBytes ?? MAX_FILE_BYTES
  const maxZipEntries = limits.maxZipEntries ?? MAX_ZIP_ENTRIES
  const maxDecompressedBytes = limits.maxDecompressedBytes ?? MAX_DECOMPRESSED_BYTES
  const maxEntryCompressedBytes = limits.maxEntryCompressedBytes ?? maxCompressedBytes
  const maxEntryUncompressedBytes = limits.maxEntryUncompressedBytes ?? maxDecompressedBytes
  const maxCompressionRatio = limits.maxCompressionRatio ?? 1000
  if (!Buffer.isBuffer(bytes) || bytes.length > maxCompressedBytes) {
    throw new Error('ZIP package exceeds compressed-byte budget')
  }
  const entries = parseRawEntries(bytes)
  if (entries.length > maxZipEntries) throw new Error('Too many ZIP entries')
  let compressedTotal = 0
  let uncompressedTotal = 0
  for (const entry of entries) {
    compressedTotal += entry.compressedSize
    uncompressedTotal += entry.uncompressedSize
    if (entry.compressedSize > maxEntryCompressedBytes ||
        entry.uncompressedSize > maxEntryUncompressedBytes ||
        compressedTotal > maxCompressedBytes ||
        uncompressedTotal > maxDecompressedBytes) {
      throw new Error('ZIP entry exceeds size budget')
    }
    if (entry.uncompressedSize > Math.max(1, entry.compressedSize) * maxCompressionRatio) {
      throw new Error('ZIP entry exceeds compression-ratio budget')
    }
    if (/\.xml$|\.rels$/i.test(entry.name)) {
      const xml = rawEntryBytes(bytes, entry, maxEntryUncompressedBytes + 1)
      if (xml.length !== entry.uncompressedSize) throw new Error('ZIP entry size mismatch')
      if (/<!DOCTYPE|<!ENTITY|<\s*(?:\w+:)?include\b/i.test(xml.toString('utf8'))) {
        throw new Error(`Unsafe XML construct in ${entry.name}`)
      }
    }
  }
  return entries
}

async function securityPreflight(bytes, options = {}) {
  try {
    inspectRawArchive(bytes, options.limits)
  } catch (error) {
    return Object.freeze({
      ok: false,
      blockReason: 'unsafe-or-oversized-package',
      evidence: error.message,
    })
  }
  let zip
  try {
    const loadZip = options.loadZip || ((source, config) => JSZip.loadAsync(source, config))
    zip = await loadZip(bytes, { checkCRC32: true })
  } catch {
    return Object.freeze({ ok: false, blockReason: 'encrypted-or-invalid-package' })
  }
  const paths = Object.keys(zip.files)
  const forbiddenPath = paths.find((path) => FORBIDDEN_PATHS.some((rule) => rule.test(path)))
  const types = zip.file('[Content_Types].xml')
    ? await zip.file('[Content_Types].xml').async('string')
    : ''
  const forbiddenType = FORBIDDEN_TYPES.find((rule) => rule.test(types))
  if (forbiddenPath || forbiddenType) {
    return Object.freeze({
      ok: false,
      blockReason: 'protected-or-active-content',
      evidence: forbiddenPath || forbiddenType.source,
    })
  }
  return Object.freeze({ ok: true })
}

module.exports = { inspectRawArchive, securityPreflight }
