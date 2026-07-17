const { createHash } = require('node:crypto')
const { hashCanonical } = require('./canonical-hash')

const LOCAL_RECEIPT_ROLES = Object.freeze(['app-storage', 'security', 'release'])

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)
}

function unique(reasons) {
  return [...new Set(reasons)].sort()
}

function receiptPayload(receipt) {
  const { receiptHash: _receiptHash, ...payload } = receipt
  return payload
}

function createRoleReceipt(input = {}) {
  const record = {
    receiptId: input.receiptId,
    role: input.role,
    decision: input.decision,
    subjectHash: input.subjectHash,
    observedExecutionHash: input.observedExecutionHash,
    terminalMachineResultHash: input.terminalMachineResultHash,
    owner: Object.freeze({ source: input.owner?.source, digest: input.owner?.digest }),
    authorizationPolicyHash: input.authorizationPolicyHash,
    invocationId: input.invocationId,
    decidedAt: input.decidedAt,
  }
  return Object.freeze({ ...record, receiptHash: hashCanonical(record) })
}

function validateReceipt(receipt, expectedSubjectHash, start, publishedAt, reasons) {
  if (!receipt || typeof receipt !== 'object') {
    reasons.push('invalid-role-receipt')
    return
  }
  if (!LOCAL_RECEIPT_ROLES.includes(receipt.role)) reasons.push('unknown-role-receipt')
  if (!['approve', 'reject'].includes(receipt.decision)) reasons.push('invalid-role-decision')
  for (const field of [
    'subjectHash', 'observedExecutionHash', 'terminalMachineResultHash', 'authorizationPolicyHash',
  ]) if (!isSha256(receipt[field])) reasons.push(`invalid-role-receipt-${field}`)
  if (receipt.subjectHash !== expectedSubjectHash) reasons.push('role-receipt-subject-mismatch')
  if (!receipt.owner?.source || !isSha256(receipt.owner?.digest)) reasons.push('invalid-role-owner')
  if (typeof receipt.receiptId !== 'string' || !receipt.receiptId) reasons.push('invalid-receipt-id')
  if (typeof receipt.invocationId !== 'string' || !receipt.invocationId) reasons.push('invalid-receipt-invocation')
  const decidedAt = Date.parse(receipt.decidedAt)
  if (!Number.isFinite(decidedAt)) reasons.push('invalid-role-receipt-time')
  const startAt = Date.parse(start)
  const published = Date.parse(publishedAt)
  if (Number.isFinite(decidedAt) && Number.isFinite(startAt) && decidedAt < startAt) {
    reasons.push('role-receipt-before-window')
  }
  if (Number.isFinite(decidedAt) && Number.isFinite(published) && decidedAt >= published) {
    reasons.push('role-receipt-after-publication')
  }
  if (receipt.receiptHash !== hashCanonical(receiptPayload(receipt))) reasons.push('role-receipt-hash-mismatch')
}

function verifyRoleReceiptBundle(receipts, {
  subjectHash, start, publishedAt,
} = {}) {
  const reasons = []
  if (!isSha256(subjectHash)) reasons.push('invalid-role-receipt-subject')
  const startAt = Date.parse(start)
  const publishedAtMs = Date.parse(publishedAt)
  if (!Number.isFinite(startAt) || !Number.isFinite(publishedAtMs) || startAt >= publishedAtMs) {
    reasons.push('invalid-role-receipt-window')
  }
  if (!Array.isArray(receipts) || receipts.length !== LOCAL_RECEIPT_ROLES.length) {
    reasons.push('incomplete-role-receipt-bundle')
  }
  const seenRoles = new Set()
  const seenIds = new Set()
  const seenInvocationIds = new Set()
  const decisions = new Set()
  for (const receipt of receipts || []) {
    validateReceipt(receipt, subjectHash, start, publishedAt, reasons)
    if (seenRoles.has(receipt?.role)) reasons.push('duplicate-role-receipt')
    if (seenIds.has(receipt?.receiptId)) reasons.push('duplicate-receipt-id')
    if (seenInvocationIds.has(receipt?.invocationId)) reasons.push('duplicate-receipt-invocation')
    seenRoles.add(receipt?.role)
    seenIds.add(receipt?.receiptId)
    seenInvocationIds.add(receipt?.invocationId)
    decisions.add(receipt?.decision)
  }
  for (const role of LOCAL_RECEIPT_ROLES) if (!seenRoles.has(role)) reasons.push('missing-role-receipt')
  if (decisions.size > 1) reasons.push('mixed-role-decisions')
  const orderedReasons = unique(reasons)
  if (orderedReasons.length > 0) return { valid: false, verdict: 'unverified', reasons: orderedReasons }
  return {
    valid: true,
    verdict: decisions.has('approve') ? 'approved' : 'rejected',
    reasons: [],
  }
}

module.exports = { LOCAL_RECEIPT_ROLES, createRoleReceipt, verifyRoleReceiptBundle, sha256 }
