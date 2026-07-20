const JSZip = require('jszip')
const { patchPlainRun } = require('./ooxml-text-run-xml')

function fail(message) {
  const error = new Error(message)
  error.code = 'NATIVE_SEMANTIC_POSTCONDITION_FAILED'
  throw error
}

async function verifyNativePlainRunPostcondition({ afterBytes, journal }) {
  if (!Buffer.isBuffer(afterBytes) || !Array.isArray(journal?.operations) ||
      journal.operations.length !== 1) fail('Expected exactly one plain-run operation')
  const operation = journal.operations[0]
  if (operation?.rowId !== 'primitive.text.run.plain-replacement' ||
      operation.objectKind !== 'text-run' || typeof operation.after !== 'string') {
    fail('Expected a canonical plain-run operation')
  }
  const ref = operation.sourceRef
  if (!ref?.partUri || !ref?.nativeId) fail('Authoritative text source is unavailable')
  const zip = await JSZip.loadAsync(afterBytes, { checkCRC32: true })
  const part = zip.file(ref.partUri)
  if (!part) fail('Authoritative text part is unavailable')
  try {
    patchPlainRun(await part.async('string'), String(ref.nativeId), operation.after, operation.after)
  } catch {
    fail('Patched OOXML text does not match the requested canonical text')
  }
  return true
}

module.exports = { verifyNativePlainRunPostcondition }
