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

async function validatePptxPackage(filePath, originalName = filePath, limits = {}) {
  const maxFileBytes = limits.maxFileBytes || MAX_FILE_BYTES
  const maxZipEntries = limits.maxZipEntries || MAX_ZIP_ENTRIES
  const maxDecompressedBytes = limits.maxDecompressedBytes || MAX_DECOMPRESSED_BYTES
  assertPptxExtension(originalName)
  const stat = await fs.stat(filePath)
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
  if (!signature.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    throw new PptxImportError('Uploaded file is not a ZIP package', { status: 400 })
  }

  let zip
  try {
    zip = await JSZip.loadAsync(await fs.readFile(filePath), { checkCRC32: false })
  } catch {
    throw new PptxImportError('Uploaded file is not a readable ZIP package', {
      status: 400,
      type: FAILURE_TYPES.parseFailed,
    })
  }

  const entries = Object.values(zip.files)
  if (entries.length > maxZipEntries) {
    throw new PptxImportError('PPTX package has too many ZIP entries', { status: 413 })
  }

  const decompressedBytes = entries.reduce((sum, entry) => sum + getUncompressedSize(entry), 0)
  if (decompressedBytes > maxDecompressedBytes) {
    throw new PptxImportError('PPTX package exceeds decompression budget', { status: 413 })
  }

  if (!zip.file('[Content_Types].xml') || !zip.file('ppt/presentation.xml')) {
    throw new PptxImportError('ZIP package is missing required PPTX entries', { status: 400 })
  }

  return { zip, entryCount: entries.length, decompressedBytes, fileSize: stat.size }
}

module.exports = {
  assertPptxExtension,
  validatePptxPackage,
}
