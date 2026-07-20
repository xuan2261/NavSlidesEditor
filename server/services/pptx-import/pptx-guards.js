const fs = require('fs-extra')
const nodeFs = require('fs').promises
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
const { PackageSafetyError, createXmlSafetyBudget, isXmlPart, readLimit } = require('./xml-safety')

function assertPptxExtension(fileName) {
  if (path.extname(fileName || '').toLowerCase() !== '.pptx') {
    throw new PptxImportError('Only .pptx files are supported', { status: 400 })
  }
}

async function readBoundedZipEntry(entry, { perEntryCap, remainingBudget, signal, overflowError }) {
  if (entry.dir) return Buffer.alloc(0)
  signal?.throwIfAborted?.()
  return new Promise((resolve, reject) => {
    let count = 0
    let settled = false
    const chunks = []
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
        chunks.push(Buffer.from(chunk))
      }
    })
    stream.on('end', () => finish(null, Buffer.concat(chunks, count)))
    stream.on('error', (error) => finish(new PptxImportError('Uploaded file is not a readable ZIP package', {
      status: 400, type: FAILURE_TYPES.parseFailed, cause: error,
    })))
  })
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
  const signature = Buffer.alloc(4)
  const fd = await nodeFs.open(filePath, 'r')
  try {
    await fd.read(signature, 0, 4, 0)
  } finally {
    await fd.close()
  }
  signal?.throwIfAborted?.()
  if (!signature.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    throw new PptxImportError('Uploaded file is not a ZIP package', { status: 400 })
  }

  let bytes
  let zip
  try {
    bytes = await fs.readFile(filePath)
    signal?.throwIfAborted?.()
    zip = await JSZip.loadAsync(bytes, { checkCRC32: false })
    signal?.throwIfAborted?.()
  } catch (error) {
    if (signal?.aborted) throw error
    throw new PptxImportError('Uploaded file is not a readable ZIP package', {
      status: 400, type: FAILURE_TYPES.parseFailed,
    })
  }
  const rawEntries = parseSafeRawEntries(bytes)
  if (rawEntries.length > maxZipEntries) {
    throw new PptxImportError('PPTX package has too many ZIP entries', { status: 413 })
  }
  const declaredBytes = rawEntries.reduce((sum, entry) => sum + entry.uncompressedSize, 0)
  if (declaredBytes > maxDecompressedBytes) {
    throw new PptxImportError('PPTX package exceeds decompression budget', { status: 413 })
  }

  let measuredBytes = 0
  for (const raw of rawEntries) {
    const entry = zip.file(raw.name)
    if (!entry || entry.dir) continue
    signal?.throwIfAborted?.()
    const xmlPart = isXmlPart(raw.name)
    const partBytes = await readBoundedZipEntry(entry, {
      perEntryCap: xmlPart ? Math.min(maxDecompressedBytes, xmlBudget.limits.maxXmlBytes) : maxDecompressedBytes,
      remainingBudget: maxDecompressedBytes - measuredBytes,
      signal,
      overflowError: xmlPart
        ? () => new PackageSafetyError('xml-byte-budget-exceeded', `XML byte budget exceeded in ${raw.name}`, 413)
        : undefined,
    })
    measuredBytes += partBytes.length
    if (xmlPart) xmlBudget.inspect(partBytes, raw.name)
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
  assertPptxExtension,
  loadPptxArchive,
  readBoundedZipEntry,
  validatePptxPackage,
}
