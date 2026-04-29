const crypto = require('crypto')
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')

const PARSERS = ['pptxtojson', 'pptx2json', 'ppt-parser', 'pptx-compose']
const FAILURE_TYPES = [
  'install-failed',
  'import-failed',
  'parse-failed',
  'output-empty',
  'schema-unusable',
  'browser-only',
]
const MAX_DIAGNOSTIC_CHARS = 8192

function getSandboxRoot(researchRoot) {
  return path.join(researchRoot, 'parser-sandbox')
}

function createSandboxRequire(sandboxRoot) {
  return createRequire(path.join(sandboxRoot, 'package.json'))
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

function getPackageMetadata(sandboxRoot, packageName) {
  const packageJsonPath = path.join(sandboxRoot, 'node_modules', packageName, 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    return { packageVersion: null, packageModifiedDate: null, installOk: false }
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  let packageModifiedDate = null
  try {
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npm'
    const args = process.platform === 'win32'
      ? ['/c', 'npm', 'view', packageName, 'time.modified', '--json']
      : ['view', packageName, 'time.modified', '--json']
    const view = execFileSync(command, args, {
      encoding: 'utf8',
      timeout: 15000,
    })
    packageModifiedDate = JSON.parse(view)
  } catch {
    packageModifiedDate = null
  }

  return {
    packageVersion: packageJson.version || null,
    packageModifiedDate,
    installOk: true,
  }
}

function classifyError(error, fallbackType = 'parse-failed') {
  const message = error && error.message ? error.message : String(error)
  if (/cannot find module|module not found|package path/i.test(message)) return 'install-failed'
  if (/window|document|FileReader|navigator|self is not defined|DOMParser/i.test(message)) {
    return 'browser-only'
  }
  if (/require\(\) of ES Module|ERR_REQUIRE_ESM|import/i.test(message)) return 'import-failed'
  return fallbackType
}

function safeMessageForType(type) {
  if (type === 'install-failed') return 'Parser package could not be loaded from the sandbox.'
  if (type === 'import-failed') return 'Parser package import failed in the Node benchmark runtime.'
  if (type === 'browser-only') return 'Parser requires browser APIs in the Node benchmark runtime.'
  if (type === 'output-empty') return 'Parser output was empty.'
  if (type === 'schema-unusable') return 'Parser output did not expose usable slide data.'
  return 'Parser execution failed.'
}

function diagnosticDigest(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16)
}

function sanitizeDiagnostic(value, fallbackMessage = 'Parser execution failed.') {
  const raw = value == null ? '' : String(value)
  if (!raw.trim()) return fallbackMessage
  const capped = raw.slice(0, MAX_DIAGNOSTIC_CHARS)
  const capNote = raw.length > capped.length ? `, capped:${capped.length}` : ''
  return `${fallbackMessage} Diagnostic redacted (${raw.length} chars${capNote}, sha256:${diagnosticDigest(capped)}).`
}

function sanitizeError(error) {
  if (!error) return null
  const type = error.type || classifyError(error)
  const diagnostic = error.stack || error.message || String(error)
  return {
    type,
    message: sanitizeDiagnostic(diagnostic, safeMessageForType(type)),
  }
}

function createDiagnosticBuffer(maxChars = MAX_DIAGNOSTIC_CHARS) {
  let text = ''
  let truncated = false
  return {
    append(chunk) {
      const next = chunk == null ? '' : chunk.toString()
      const remaining = maxChars - text.length
      if (remaining <= 0) {
        truncated = true
        return
      }
      text += next.slice(0, remaining)
      if (next.length > remaining) truncated = true
    },
    toString() {
      return truncated ? `${text}\n[diagnostic truncated]` : text
    },
  }
}

async function withSilencedConsole(callback) {
  const original = {
    debug: console.debug,
    error: console.error,
    info: console.info,
    log: console.log,
    warn: console.warn,
  }
  console.debug = () => {}
  console.error = () => {}
  console.info = () => {}
  console.log = () => {}
  console.warn = () => {}
  try {
    return await callback()
  } finally {
    console.debug = original.debug
    console.error = original.error
    console.info = original.info
    console.log = original.log
    console.warn = original.warn
  }
}

module.exports = {
  FAILURE_TYPES,
  PARSERS,
  classifyError,
  createSandboxRequire,
  getPackageMetadata,
  getSandboxRoot,
  sanitizeDiagnostic,
  sanitizeError,
  toArrayBuffer,
  withSilencedConsole,
  createDiagnosticBuffer,
}
