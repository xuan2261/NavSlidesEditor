const fs = require('fs')
const path = require('path')
const JSZip = require('jszip')

const PLAN_RESEARCH_ROOT = path.resolve(
  'plans/20260424-1508-pptx-parser-benchmark-hard/research'
)

const DEFAULT_PPTX_LIMITS = {
  maxFileBytes: 100 * 1024 * 1024,
  maxEntries: 5000,
  maxUncompressedBytes: 500 * 1024 * 1024,
}

function assertInsidePlanResearch(outPath) {
  const resolved = path.resolve(outPath)
  const relative = path.relative(PLAN_RESEARCH_ROOT, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Output path must stay under ${PLAN_RESEARCH_ROOT}`)
  }
  return resolved
}

function getZipSize(file) {
  return file && file._data
    ? file._data.uncompressedSize || file._data.compressedSize || 0
    : 0
}

async function loadPptxWithBudget(filePath, limits = DEFAULT_PPTX_LIMITS) {
  const stat = fs.statSync(filePath)
  if (stat.size > limits.maxFileBytes) {
    throw new Error(`PPTX exceeds max file size: ${stat.size} bytes`)
  }

  const buffer = fs.readFileSync(filePath)
  const zip = await JSZip.loadAsync(buffer)
  const files = Object.values(zip.files).filter((file) => !file.dir)
  if (files.length > limits.maxEntries) {
    throw new Error(`PPTX exceeds max ZIP entry count: ${files.length}`)
  }

  const uncompressedBytes = files.reduce((sum, file) => sum + getZipSize(file), 0)
  if (uncompressedBytes > limits.maxUncompressedBytes) {
    throw new Error(`PPTX exceeds max decompressed size: ${uncompressedBytes} bytes`)
  }

  return { buffer, entryCount: files.length, uncompressedBytes, zip }
}

module.exports = {
  DEFAULT_PPTX_LIMITS,
  PLAN_RESEARCH_ROOT,
  assertInsidePlanResearch,
  loadPptxWithBudget,
}
