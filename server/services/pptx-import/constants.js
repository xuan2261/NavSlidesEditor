const path = require('path')
const { DATA_DIR } = require('../storage')

const MAX_FILE_BYTES = 100 * 1024 * 1024
const MAX_ZIP_ENTRIES = 5000
const MAX_DECOMPRESSED_BYTES = 500 * 1024 * 1024
const PARSER_TIMEOUT_MS = 60 * 1000
const PARSER_KILL_GRACE_MS = 2000

const CANVAS_SIZE = Object.freeze({ width: 960, height: 540 })
const TEMP_UPLOAD_DIR = path.join(DATA_DIR, 'tmp-pptx-imports')

const FAILURE_TYPES = Object.freeze({
  installFailed: 'install-failed',
  importFailed: 'import-failed',
  parseFailed: 'parse-failed',
  outputEmpty: 'output-empty',
  schemaUnusable: 'schema-unusable',
  browserOnly: 'browser-only',
})

module.exports = {
  CANVAS_SIZE,
  FAILURE_TYPES,
  MAX_DECOMPRESSED_BYTES,
  MAX_FILE_BYTES,
  MAX_ZIP_ENTRIES,
  PARSER_KILL_GRACE_MS,
  PARSER_TIMEOUT_MS,
  TEMP_UPLOAD_DIR,
}
