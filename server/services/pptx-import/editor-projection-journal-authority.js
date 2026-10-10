const { hashRecord } = require('./package-store/schemas')
const { MUTATION_OPERATIONS: OPERATIONS } = require('./mutation-operation-scope')

function isNoOpExportReceipt(result) {
  return result.state === 'committed' &&
    result.operation === OPERATIONS.VALIDATED_EDITED_EXPORT &&
    Array.isArray(result.operationIds) && result.operationIds.length === 0 &&
    result.requestIdentity?.expectedGeneration === result.generation &&
    result.requestIdentity.snapshotHash === hashRecord(result.projection)
}

function hasValidCommittedJournal(result, journalHash) {
  const { journal } = result
  if ((journal?.journalHash ?? null) !== (journalHash ?? null)) return false
  if (!journal) {
    return result.operation !== OPERATIONS.VALIDATED_EDITED_EXPORT || isNoOpExportReceipt(result)
  }
  const subjects = Object.fromEntries([
    'featureMatrixSchemaVersion',
    'featureMatrixVersion',
    'featureMatrixHash',
    'matrixAuthoritySubject',
    'reasonCodeSubject',
  ].map((key) => [key, journal[key]]))
  const payload = journal.metadata
    ? { operations: journal.operations, metadata: journal.metadata, subjects }
    : { ...subjects, operations: journal.operations }
  return Array.isArray(journal.operations) && hashRecord(payload) === journal.journalHash &&
    (isNoOpExportReceipt(result) ||
      hashRecord(journal.operations.map((item) => item.operationId)) === hashRecord(result.operationIds))
}

module.exports = { isNoOpExportReceipt, hasValidCommittedJournal }
