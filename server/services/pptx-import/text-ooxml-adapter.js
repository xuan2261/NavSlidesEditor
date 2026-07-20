const crypto = require('node:crypto')
const JSZip = require('jszip')
const { assertPatchableSource } = require('./source-map')
const { patchPlainRun, validText } = require('./ooxml-text-run-xml')
const { INVALID, isPlainRecord, ownData } = require('./own-plain-data')

const SEED_ROW_ID = 'primitive.text.run.plain-replacement'

function fail(code, message) {
  const error = new Error(message)
  error.code = code
  throw error
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function own(record, field, code) {
  const value = ownData(record, field)
  if (value === INVALID) fail(code, 'Native text adapter requires own data properties')
  return value
}

function assertSeedOperation(operation) {
  if (!isPlainRecord(operation)) {
    fail('TEXT_OPERATION_NOT_SEED', 'Native text adapter accepts only the G2 plain-run seed')
  }
  const rowId = own(operation, 'rowId', 'TEXT_OPERATION_NOT_SEED')
  const objectKind = own(operation, 'objectKind', 'TEXT_OPERATION_NOT_SEED')
  if (rowId !== SEED_ROW_ID || objectKind !== 'text-run') {
    fail('TEXT_OPERATION_NOT_SEED', 'Native text adapter accepts only the G2 plain-run seed')
  }
  const sourceRef = own(operation, 'sourceRef', 'TEXT_SOURCE_KIND_MISMATCH')
  if (!isPlainRecord(sourceRef) || own(sourceRef, 'kind', 'TEXT_SOURCE_KIND_MISMATCH') !== 'text-run') {
    fail('TEXT_SOURCE_KIND_MISMATCH', 'Native text adapter requires a text-run source reference')
  }
  const before = own(operation, 'before', 'TEXT_BEFORE_REQUIRED')
  if (typeof before !== 'string') fail('TEXT_BEFORE_REQUIRED', 'Native text adapter requires journal before text')
  const normalizedText = own(operation, 'normalizedText', 'TEXT_NORMALIZATION_REQUIRED')
  if (typeof normalizedText !== 'string') {
    fail('TEXT_NORMALIZATION_REQUIRED', 'Native text adapter requires planner-normalized plain text')
  }
  if (own(operation, 'after', 'TEXT_AFTER_MISMATCH') !== normalizedText) {
    fail('TEXT_AFTER_MISMATCH', 'Journal after text must equal planner-normalized text')
  }
  if (!validText(normalizedText) || !validText(before)) {
    fail('TEXT_XML_CHARACTER_INVALID', 'Text is not XML 1.0 safe')
  }
  const code = 'TEXT_SOURCE_REFERENCE_INVALID'
  return Object.freeze({ before, normalizedText, ref: Object.freeze({
    kind: 'text-run', status: own(sourceRef, 'status', code),
    partUri: own(sourceRef, 'partUri', code), nativeId: own(sourceRef, 'nativeId', code),
    sourceHash: own(sourceRef, 'sourceHash', code),
  }) })
}

function createNativeTextAdapter() {
  return Object.freeze({
    async applyTextPatch(bytes, operation) {
      const { before, normalizedText, ref } = assertSeedOperation(operation)
      assertPatchableSource(ref)
      const zip = await JSZip.loadAsync(bytes, { checkCRC32: true })
      const part = zip.file(ref.partUri)
      if (!part) fail('SOURCE_PART_MISSING', 'Authoritative source part is missing')
      const xml = await part.async('string')
      const result = patchPlainRun(xml, ref.nativeId, before, normalizedText)
      assertPatchableSource(ref, Buffer.from(result.shape))
      zip.file(ref.partUri, result.patched)
      return {
        bytes: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
        sourceHash: hash(result.patchedShape),
        impactClosure: [ref.partUri],
      }
    },
    sourceHash(shapeXml) {
      return hash(shapeXml)
    },
  })
}

module.exports = { createNativeTextAdapter }
