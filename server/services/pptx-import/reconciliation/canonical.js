const crypto = require('node:crypto')

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])])
  )
}

function stableJson(value) {
  return JSON.stringify(canonicalValue(value))
}

function sortRecords(records) {
  return [...(records || [])]
    .map(canonicalValue)
    .sort((left, right) => stableJson(left).localeCompare(stableJson(right)))
}

function canonicalReport(report) {
  const value = { ...report }
  delete value.hash
  for (const field of ['diffs', 'matches', 'ambiguities']) {
    if (field in value) value[field] = sortRecords(value[field])
  }
  return canonicalValue(value)
}

function reportHash(report) {
  return crypto.createHash('sha256').update(stableJson(canonicalReport(report))).digest('hex')
}

module.exports = { canonicalReport, reportHash, stableJson }
