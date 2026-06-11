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

function assertPptxExtension(fileName) {
  if (path.extname(fileName || '').toLowerCase() !== '.pptx') {
    throw new PptxImportError('Only .pptx files are supported', { status: 400 })
  }
}

function getUncompressedSize(entry) {
  return entry?._data?.uncompressedSize || entry?.uncompressedSize || 0
}

// Stream-decompress one entry through a byte counter, aborting as soon as the
// per-entry or cumulative cap is breached. Never trusts the archive-declared
// uncompressed size — that field is attacker-controlled.
async function measureEntryInflatedBytes(entry, { perEntryCap, remainingBudget, signal }) {
  if (entry.dir) return 0
  signal?.throwIfAborted?.()
  return new Promise((resolve, reject) => {
    let count = 0
    let settled = false
    const stream = entry.nodeStream('nodebuffer')
    const onAbort = () => {
      if (settled) return
      settled = true
      stream.destroy?.()
      reject(new PptxImportError('PPTX import cancelled', { status: 400 }))
    }
    signal?.addEventListener?.('abort', onAbort, { once: true })
    const finish = (err, value) => {
      if (settled) return
      settled = true
      signal?.removeEventListener?.('abort', onAbort)
      if (err) reject(err)
      else resolve(value)
    }
    stream.on('data', (chunk) => {
      count += chunk.length
      if (count > perEntryCap || count > remainingBudget) {
        stream.destroy?.()
        finish(new PptxImportError('PPTX package exceeds decompression budget', { status: 413 }))
      }
    })
    stream.on('end', () => finish(null, count))
    stream.on('error', (err) =>
      finish(new PptxImportError('Uploaded file is not a readable ZIP package', {
        status: 400,
        type: FAILURE_TYPES.parseFailed,
        cause: err,
      }))
    )
  })
}

async function validatePptxPackage(filePath, originalName = filePath, limits = {}) {
  const maxFileBytes = limits.maxFileBytes || MAX_FILE_BYTES
  const maxZipEntries = limits.maxZipEntries || MAX_ZIP_ENTRIES
  const maxDecompressedBytes = limits.maxDecompressedBytes || MAX_DECOMPRESSED_BYTES
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

  let zip
  try {
    const bytes = await fs.readFile(filePath)
    signal?.throwIfAborted?.()
    zip = await JSZip.loadAsync(bytes, { checkCRC32: false })
    signal?.throwIfAborted?.()
  } catch (err) {
    if (signal?.aborted) throw err
    throw new PptxImportError('Uploaded file is not a readable ZIP package', {
      status: 400,
      type: FAILURE_TYPES.parseFailed,
    })
  }

  const entries = Object.values(zip.files)
  if (entries.length > maxZipEntries) {
    throw new PptxImportError('PPTX package has too many ZIP entries', { status: 413 })
  }

  // Cheap fast-reject on the archive-declared sizes (attacker can lie, so this
  // is only an optimization — the authoritative check is the measured one below).
  const declaredBytes = entries.reduce((sum, entry) => sum + getUncompressedSize(entry), 0)
  if (declaredBytes > maxDecompressedBytes) {
    throw new PptxImportError('PPTX package exceeds decompression budget', { status: 413 })
  }

  // Authoritative check: actually inflate each entry through a byte counter and
  // abort the moment the per-entry or cumulative cap is breached.
  let measuredBytes = 0
  for (const entry of entries) {
    if (entry.dir) continue
    signal?.throwIfAborted?.()
    measuredBytes += await measureEntryInflatedBytes(entry, {
      perEntryCap: maxDecompressedBytes,
      remainingBudget: maxDecompressedBytes - measuredBytes,
      signal,
    })
    if (measuredBytes > maxDecompressedBytes) {
      throw new PptxImportError('PPTX package exceeds decompression budget', { status: 413 })
    }
  }

  if (!zip.file('[Content_Types].xml') || !zip.file('ppt/presentation.xml')) {
    throw new PptxImportError('ZIP package is missing required PPTX entries', { status: 400 })
  }

  return { zip, entryCount: entries.length, decompressedBytes: measuredBytes, fileSize: stat.size }
}

module.exports = {
  assertPptxExtension,
  validatePptxPackage,
}
