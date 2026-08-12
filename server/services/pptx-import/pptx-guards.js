const fs = require('fs-extra')
const path = require('path')
const JSZip = require('jszip')
const {
  FAILURE_TYPES,
  MAX_DECOMPRESSED_BYTES,
  MAX_FILE_BYTES,
  MAX_ZIP_ENTRIES,
} = require('./constants')
const { PptxImportError } = require('./diagnostics')
const { parseRawEntries } = require('./package-store/raw-zip')
const { createCrc32 } = require('./crc32')
const { PackageSafetyError, createXmlSafetyBudget, isXmlPart, readLimit } = require('./xml-safety')

/**
 * Declared ZIP CRC is checked against the bounded inflated payload.
 * Resource preflight runs before JSZip indexing or inflation.
 * Do not default to silent warn-only success for CRC failures.
 */
const IMPORT_CRC_POLICY = Object.freeze({
  mode: 'fail-closed',
  checkCRC32: true,
  errorCode: 'zip-crc-mismatch',
})

function assertPptxExtension(fileName) {
  if (path.extname(fileName || '').toLowerCase() !== '.pptx') {
    throw new PptxImportError('Only .pptx files are supported', { status: 400 })
  }
}

function isCrcMismatchError(error) {
  const message = String(error?.message || error || '')
  return /crc32\s*mismatch/i.test(message) || /corrupted zip\s*:\s*crc/i.test(message)
}

function streamBoundedZipEntry(
  entry,
  { perEntryCap, remainingBudget, signal, overflowError, expectedCrc32 },
  collect
) {
  return new Promise((resolve, reject) => {
    let count = 0
    let settled = false
    const chunks = []
    const crc = createCrc32()
    const stream = entry.nodeStream('nodebuffer')
    const onAbort = () => {
      if (settled) return
      stream.destroy?.()
      finish(new PptxImportError('PPTX import cancelled', { status: 400 }))
    }
    const finish = (error, value) => {
      if (settled) return
      settled = true
      signal?.removeEventListener?.('abort', onAbort)
      if (error) reject(error)
      else resolve(value)
    }
    signal?.addEventListener?.('abort', onAbort, { once: true })
    stream.on('data', (chunk) => {
      count += chunk.length
      if (count > perEntryCap) {
        stream.destroy?.()
        finish(overflowError?.() || new PptxImportError('PPTX package exceeds decompression budget', { status: 413 }))
      } else if (count > remainingBudget) {
        stream.destroy?.()
        finish(new PptxImportError('PPTX package exceeds decompression budget', { status: 413 }))
      } else {
        crc.update(chunk)
        if (collect) chunks.push(Buffer.from(chunk))
      }
    })
    stream.on('end', () => {
      if (expectedCrc32 != null && crc.digest() !== Number.parseInt(String(expectedCrc32), 16)) {
        finish(new PackageSafetyError(IMPORT_CRC_POLICY.errorCode, 'PPTX package entry CRC32 mismatch', 400))
        return
      }
      finish(null, collect ? Buffer.concat(chunks, count) : count)
    })
    stream.on('error', (error) => finish(new PptxImportError('Uploaded file is not a readable ZIP package', {
      status: 400, type: FAILURE_TYPES.parseFailed, cause: error,
    })))
  })
}

async function readBoundedZipEntry(entry, options) {
  if (entry.dir) return Buffer.alloc(0)
  options.signal?.throwIfAborted?.()
  return streamBoundedZipEntry(entry, options, true)
}

/**
 * Byte count under the same caps, without holding the entry in memory. A part
 * that is only charged against the decompression budget never needs its bytes,
 * and copying a 100MB media part just to read `.length` is pure waste.
 */
async function measureBoundedZipEntry(entry, options) {
  if (entry.dir) return 0
  options.signal?.throwIfAborted?.()
  return streamBoundedZipEntry(entry, options, false)
}

function parseSafeRawEntries(bytes) {
  try {
    return parseRawEntries(bytes)
  } catch {
    throw new PptxImportError('Uploaded file has unsafe ZIP structure', {
      status: 400, type: FAILURE_TYPES.parseFailed,
    })
  }
}

async function validatePptxPackage(filePath, originalName = filePath, limits = {}) {
  const maxFileBytes = readLimit(limits, 'maxFileBytes', MAX_FILE_BYTES)
  const maxZipEntries = readLimit(limits, 'maxZipEntries', MAX_ZIP_ENTRIES)
  const maxDecompressedBytes = readLimit(limits, 'maxDecompressedBytes', MAX_DECOMPRESSED_BYTES)
  const xmlBudget = createXmlSafetyBudget(limits)
  const signal = limits.signal
  signal?.throwIfAborted?.()
  assertPptxExtension(originalName)
  const stat = await fs.stat(filePath)
  signal?.throwIfAborted?.()
  if (stat.size > maxFileBytes) {
    throw new PptxImportError('PPTX file exceeds 100MB limit', { status: 413 })
  }
  let bytes
  let zip
  let rawEntries
  try {
    bytes = await fs.readFile(filePath)
    signal?.throwIfAborted?.()
    if (!bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
      throw new PptxImportError('Uploaded file is not a ZIP package', { status: 400 })
    }
    rawEntries = parseSafeRawEntries(bytes)
  } catch (error) {
    if (signal?.aborted) throw error
    if (error instanceof PptxImportError) throw error
    throw new PptxImportError('Uploaded file has unsafe ZIP structure', {
      status: 400, type: FAILURE_TYPES.parseFailed, cause: error,
    })
  }
  if (rawEntries.length > maxZipEntries) {
    throw new PptxImportError('PPTX package has too many ZIP entries', { status: 413 })
  }
  const declaredBytes = rawEntries.reduce((sum, entry) => sum + entry.uncompressedSize, 0)
  if (declaredBytes > maxDecompressedBytes) {
    throw new PptxImportError('PPTX package exceeds decompression budget', { status: 413 })
  }
  try {
    zip = await JSZip.loadAsync(bytes, { checkCRC32: false })
    signal?.throwIfAborted?.()
  } catch (error) {
    if (signal?.aborted) throw error
    throw new PptxImportError('Uploaded file is not a readable ZIP package', {
      status: 400, type: FAILURE_TYPES.parseFailed, cause: error,
    })
  }

  let measuredBytes = 0
  for (const raw of rawEntries) {
    const entry = zip.file(raw.name)
    if (!entry || entry.dir) continue
    signal?.throwIfAborted?.()
    const remainingBudget = maxDecompressedBytes - measuredBytes
    if (isXmlPart(raw.name)) {
      const partBytes = await readBoundedZipEntry(entry, {
        perEntryCap: Math.min(maxDecompressedBytes, xmlBudget.limits.maxXmlBytes),
        remainingBudget,
        signal,
        expectedCrc32: raw.crc32,
        overflowError: () =>
          new PackageSafetyError('xml-byte-budget-exceeded', `XML byte budget exceeded in ${raw.name}`, 413),
      })
      measuredBytes += partBytes.length
      xmlBudget.inspect(partBytes, raw.name)
    } else {
      measuredBytes += await measureBoundedZipEntry(entry, {
        perEntryCap: maxDecompressedBytes,
        remainingBudget,
        signal,
        expectedCrc32: raw.crc32,
      })
    }
  }
  if (!zip.file('[Content_Types].xml') || !zip.file('ppt/presentation.xml')) {
    throw new PptxImportError('ZIP package is missing required PPTX entries', { status: 400 })
  }
  return { zip, entryCount: rawEntries.length, decompressedBytes: measuredBytes, fileSize: stat.size }
}

async function loadPptxArchive(filePath, limits = {}) {
  return (await validatePptxPackage(filePath, filePath, limits)).zip
}

module.exports = {
  IMPORT_CRC_POLICY,
  assertPptxExtension,
  isCrcMismatchError,
  loadPptxArchive,
  readBoundedZipEntry,
  validatePptxPackage,
}
