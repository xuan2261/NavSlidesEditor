const { parseRawEntries } = require('./pptx-import/package-store/raw-zip')
const { readBoundedZipEntry } = require('./pptx-import/pptx-guards')
const { assertArchivePath, importError } = require('./project-import-archive-validation')

function inspectRawEntries(bytes, limits) {
  let entries
  try { entries = parseRawEntries(bytes) } catch {
    throw importError('PROJECT_ARCHIVE_STRUCTURE_INVALID', 'Archive structure is invalid')
  }
  if (entries.length > limits.maxEntries) throw importError('PROJECT_ARCHIVE_ENTRY_LIMIT', 'Archive has too many entries', 413)
  let declared = 0
  for (const entry of entries) {
    if (entry.name.endsWith('/')) {
      if (!['media/', 'package/', 'package/blobs/'].includes(entry.name)) {
        throw importError('PROJECT_ARCHIVE_ENTRY_REJECTED', 'Archive contains an unexpected directory')
      }
      continue
    }
    // Version-specific exact inventory is checked after the bounded manifest read.
    if (entry.name !== 'presentation.html') assertArchivePath(entry.name, limits, { packageBacked: true })
    const offset = entry.centralHeaderOffset
    const method = bytes.readUInt16LE(offset + 10)
    const unixType = (bytes.readUInt32LE(offset + 38) >>> 16) & 0xf000
    if (entry.encrypted || unixType === 0xa000 || ![0, 8].includes(method)) {
      throw importError('PROJECT_ARCHIVE_ENTRY_REJECTED', 'Archive contains an unsupported entry')
    }
    if (entry.uncompressedSize > limits.maxEntryBytes ||
        entry.uncompressedSize / Math.max(entry.compressedSize, 1) > limits.maxCompressionRatio) {
      throw importError('PROJECT_ARCHIVE_RATIO_LIMIT', 'Archive entry exceeds expansion policy', 413)
    }
    declared += entry.uncompressedSize
  }
  if (declared > limits.maxDeclaredBytes) throw importError('PROJECT_ARCHIVE_EXPANSION_LIMIT', 'Archive exceeds expansion policy', 413)
  return entries
}

function assertVersionEntries(entries, limits, packageBacked) {
  for (const entry of entries) {
    if (entry.name.endsWith('/')) {
      if (packageBacked || entry.name !== 'media/') {
        throw importError('PROJECT_ARCHIVE_ENTRY_REJECTED', 'Archive contains an unexpected directory')
      }
    } else assertArchivePath(entry.name, limits, { packageBacked })
  }
}

function entryReader(zip, entries, limits) {
  const raw = new Map(entries.map((entry) => [entry.name, entry]))
  let used = 0
  return async (name, cap = limits.maxEntryBytes) => {
    const entry = zip.file(name)
    if (!entry || !raw.has(name)) throw importError('PROJECT_ARCHIVE_REQUIRED_ENTRY_MISSING', 'Archive is missing a required entry')
    try {
      const bytes = await readBoundedZipEntry(entry, {
        perEntryCap: cap, remainingBudget: limits.maxExpandedBytes - used,
        expectedCrc32: raw.get(name).crc32,
      })
      used += bytes.length
      return bytes
    } catch (error) {
      if (error.status === 413) throw importError('PROJECT_ARCHIVE_EXPANSION_LIMIT', 'Archive exceeds expansion policy', 413)
      throw importError('PROJECT_ARCHIVE_INVALID', 'Archive cannot be expanded')
    }
  }
}

module.exports = { assertVersionEntries, entryReader, inspectRawEntries }
