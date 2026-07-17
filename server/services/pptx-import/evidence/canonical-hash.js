const { createHash } = require('node:crypto')

function canonical(value) {
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function hashCanonical(value) {
  return createHash('sha256').update(canonical(value)).digest('hex')
}

module.exports = { hashCanonical }
