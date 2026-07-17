const { createHash } = require('node:crypto')

const CANONICAL_REASON_CODE_SCHEMA_VERSION = 1
const CANONICAL_REASON_CODE_VERSION = '1.0.0'

const REASON_PRECEDENCE = Object.freeze([
  'unknown-reason-code',
  'missing-matrix-subject',
  'invalid-matrix-subject',
  'stale-matrix-subject',
  'unknown-row',
  'invalid-lookup',
  'incomplete-scope',
  'unsupported-scope',
  'incomplete-binding',
  'binding-mismatch',
  'missing-feature-matrix',
  'invalid-feature-matrix',
  'stale-feature-matrix-subject',
  'missing-corpus-matrix-subject',
  'invalid-corpus-matrix-subject',
  'stale-corpus-matrix-subject',
  'missing-claim-subject',
  'invalid-claim-subject',
  'stale-claim-subject',
  'original-package-unverified',
  'validated-edited-export-unavailable',
  'transaction-eligible-not-verified-editable',
  'original-only-package',
  'level4-promotion-unproven',
  'OPERATION_KIND_UNSUPPORTED',
  'NON_SEED_ROW',
  'OBJECT_KIND_MISMATCH',
  'OPERATION_INVALID',
  'BINDING_MISSING',
  'BINDING_MISMATCH',
  'SCOPE_MISMATCH',
  'SOURCE_REFERENCE_INVALID',
  'RELATIONSHIP_CHAIN_INVALID',
  'SOURCE_NOT_AUTHORITATIVE',
  'SOURCE_OBJECT_KIND_MISMATCH',
  'IMPACT_CLOSURE_INVALID',
  'ROW_ADAPTER_UNQUALIFIED',
  'ROW_TRANSACTION_INELIGIBLE',
  'ADAPTER_REGISTRY_MISSING',
  'TEXT_VALUE_INVALID',
  'AFTER_NORMALIZATION_MISMATCH',
  'MALFORMED_INPUT',
  'SOLID_FILL_INVALID',
  'ROW_ID_MISSING',
  'COMPACTION_SOURCE_IDENTITY_CHANGED',
  'COMPACTION_BEFORE_AFTER_DISCONTINUITY',
  'JOURNAL_INVALID',
  'JOURNAL_MATRIX_SCHEMA_MISSING',
  'JOURNAL_MATRIX_SCHEMA_MISMATCH',
  'JOURNAL_MATRIX_VERSION_MISSING',
  'JOURNAL_MATRIX_VERSION_MISMATCH',
  'JOURNAL_MATRIX_HASH_MISSING',
  'JOURNAL_MATRIX_HASH_MISMATCH',
  'STALE_MATRIX_AUTHORITY',
  'TIPTAP_LEGACY_PLAIN_STRING_NOT_ALLOWED',
  'TIPTAP_XML_CHARACTER_INVALID',
  'TIPTAP_HARD_BREAK_NOT_ALLOWED',
])
const REASON_SET = new Set(REASON_PRECEDENCE)

function reasonCodeSubject() {
  return Object.freeze({
    schemaVersion: CANONICAL_REASON_CODE_SCHEMA_VERSION,
    version: CANONICAL_REASON_CODE_VERSION,
    hash: createHash('sha256').update(JSON.stringify(REASON_PRECEDENCE)).digest('hex'),
  })
}

function canonicalReasonCodes(codes) {
  const normalized = Array.isArray(codes)
    ? codes.map((code) => REASON_SET.has(code) ? code : 'unknown-reason-code')
    : ['unknown-reason-code']
  return Object.freeze([...new Set(normalized)].sort(
    (left, right) => REASON_PRECEDENCE.indexOf(left) - REASON_PRECEDENCE.indexOf(right),
  ))
}

function publicReasonCodes(codes) {
  return canonicalReasonCodes(codes)
}

module.exports = {
  CANONICAL_REASON_CODE_SCHEMA_VERSION,
  CANONICAL_REASON_CODE_VERSION,
  REASON_PRECEDENCE,
  canonicalReasonCodes,
  publicReasonCodes,
  reasonCodeSubject,
}
