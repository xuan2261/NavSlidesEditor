const path = require('path')
const { DATA_DIR } = require('../storage')

const MAX_FILE_BYTES = 100 * 1024 * 1024
const MAX_ZIP_ENTRIES = 5000
const MAX_DECOMPRESSED_BYTES = 500 * 1024 * 1024
const MAX_PARSED_OUTPUT_BYTES = 256 * 1024 * 1024
const MAX_AGGREGATE_MEDIA_BYTES = 500 * 1024 * 1024
const PARSER_TIMEOUT_MS = 60 * 1000
const IMPORT_TIMEOUT_MS = 2 * 60 * 1000
const STALE_TEMP_UPLOAD_AGE_MS = 15 * 60 * 1000
const PARSER_KILL_GRACE_MS = 2000
// Heap ceiling (MB) handed to the forked parser worker via --max-old-space-size
// so a parser-side OOM kills the worker process, not the host.
const PARSER_MAX_OLD_SPACE_MB = 1024
/** Accumulate-time hard caps for import warning peak RSS. */
const MAX_IMPORT_WARNINGS = 500
const MAX_IMPORT_WARNING_BYTES = 256 * 1024

const CANVAS_SIZE = Object.freeze({ width: 960, height: 540 })
const TEMP_UPLOAD_DIR = path.join(DATA_DIR, 'tmp-pptx-imports')
const ALLOWED_MEDIA_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'mp4',
  'mp3',
  'wav',
  'ogg',
  'webm',
])

const FAILURE_TYPES = Object.freeze({
  installFailed: 'install-failed',
  importFailed: 'import-failed',
  parseFailed: 'parse-failed',
  outputEmpty: 'output-empty',
  schemaUnusable: 'schema-unusable',
  browserOnly: 'browser-only',
})

function addOrigin(list, value) {
  const raw = String(value || '').trim()
  if (!raw) return
  try {
    const parsed = new URL(raw)
    if (!['http:', 'https:'].includes(parsed.protocol)) return
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return
    list.add(parsed.origin)
  } catch {
    // Invalid administrator configuration fails closed.
  }
}

/**
 * Explicit administrator opt-in for imported external media. Matching the
 * complete origin prevents a hostname allowlist from silently allowing an
 * alternate scheme or port. No local/default origins are trusted.
 *
 * Rebuilt per call rather than memoized so a configuration change takes effect
 * without a restart, and so no caller can hold a stale snapshot of the gate.
 */
function buildMediaUrlAllowlist() {
  const list = new Set()
  for (const value of String(process.env.PPTX_IMPORT_MEDIA_ORIGINS || '').split(',')) {
    addOrigin(list, value)
  }
  return list
}

module.exports = {
  ALLOWED_MEDIA_EXTENSIONS,
  buildMediaUrlAllowlist,
  CANVAS_SIZE,
  FAILURE_TYPES,
  MAX_DECOMPRESSED_BYTES,
  MAX_AGGREGATE_MEDIA_BYTES,
  MAX_FILE_BYTES,
  MAX_IMPORT_WARNING_BYTES,
  MAX_IMPORT_WARNINGS,
  MAX_PARSED_OUTPUT_BYTES,
  MAX_ZIP_ENTRIES,
  PARSER_KILL_GRACE_MS,
  PARSER_MAX_OLD_SPACE_MB,
  PARSER_TIMEOUT_MS,
  IMPORT_TIMEOUT_MS,
  STALE_TEMP_UPLOAD_AGE_MS,
  TEMP_UPLOAD_DIR,
}
