const fs = require('fs')
const crypto = require('crypto')
const path = require('path')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue)
  if (!value || typeof value !== 'object' || Buffer.isBuffer(value)) return value

  return Object.keys(value)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = sortValue(value[key])
      return sorted
    }, {})
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(sortValue(value), null, 2)}\n`)
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function redactString(value) {
  return {
    __type: 'String',
    length: value.length,
    sha256: crypto.createHash('sha256').update(value).digest('hex'),
  }
}

function scrubRawValue(value, seen = new WeakSet()) {
  if (Buffer.isBuffer(value)) {
    return { __type: 'Buffer', byteLength: value.byteLength }
  }
  if (ArrayBuffer.isView(value)) {
    return { __type: value.constructor.name, byteLength: value.byteLength }
  }
  if (value instanceof ArrayBuffer) {
    return { __type: 'ArrayBuffer', byteLength: value.byteLength }
  }
  if (typeof value === 'string') return redactString(value)
  if (!value || typeof value !== 'object') return value
  if (seen.has(value)) return '[Circular]'

  seen.add(value)
  if (Array.isArray(value)) return value.map((item) => scrubRawValue(item, seen))

  return Object.keys(value)
    .sort()
    .reduce((scrubbed, key) => {
      scrubbed[key] = scrubRawValue(value[key], seen)
      return scrubbed
    }, {})
}

function writeRawJson(filePath, value) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(scrubRawValue(value), null, 2)}\n`)
  return fs.statSync(filePath).size
}

module.exports = {
  ensureDir,
  readJson,
  scrubRawValue,
  writeJson,
  writeRawJson,
}
