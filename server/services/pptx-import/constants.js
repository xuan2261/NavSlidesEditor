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
const MEDIA_URL_ALLOWLIST = buildMediaUrlAllowlist()

const FAILURE_TYPES = Object.freeze({
  installFailed: 'install-failed',
  importFailed: 'import-failed',
  parseFailed: 'parse-failed',
  outputEmpty: 'output-empty',
  schemaUnusable: 'schema-unusable',
  browserOnly: 'browser-only',
})

function addHost(list, value) {
  if (!value) return
  try {
    list.add(new URL(value).hostname.toLowerCase())
  } catch {
    list.add(String(value).replace(/:\d+$/, '').toLowerCase())
  }
}

function buildMediaUrlAllowlist() {
  const list = new Set(['localhost', '127.0.0.1'])
  addHost(list, process.env.PUBLIC_HOST)
  addHost(list, process.env.HOST)
  return list
}

module.exports = {
  ALLOWED_MEDIA_EXTENSIONS,
  buildMediaUrlAllowlist,
  CANVAS_SIZE,
  FAILURE_TYPES,
  MEDIA_URL_ALLOWLIST,
  MAX_DECOMPRESSED_BYTES,
  MAX_AGGREGATE_MEDIA_BYTES,
  MAX_FILE_BYTES,
  MAX_PARSED_OUTPUT_BYTES,
  MAX_ZIP_ENTRIES,
  PARSER_KILL_GRACE_MS,
  PARSER_MAX_OLD_SPACE_MB,
  PARSER_TIMEOUT_MS,
  IMPORT_TIMEOUT_MS,
  STALE_TEMP_UPLOAD_AGE_MS,
  TEMP_UPLOAD_DIR,
}
