const JSZip = require('jszip')

const ROW_ID = 'primitive.shape.solid-fill'
const RGB = /^#[A-F0-9]{6}$/
const tag = '(?:\\w+:)?'

function fail(message) {
  const error = new Error(message)
  error.code = 'NATIVE_SEMANTIC_POSTCONDITION_FAILED'
  throw error
}

function nativeShape(xml, nativeId) {
  const blocks = [...xml.matchAll(new RegExp(`<${tag}sp\\b[\\s\\S]*?<\\/${tag}sp>`, 'g'))]
    .filter((match) => new RegExp(`<${tag}cNvPr\\b[^>]*\\bid=(?:"${nativeId}"|'${nativeId}')`).test(match[0]))
  if (blocks.length !== 1) fail(blocks.length ? 'Authoritative shape is ambiguous' : 'Authoritative shape is unavailable')
  return blocks[0][0]
}

function expectedRgb(operation) {
  if (operation?.rowId !== ROW_ID || operation.objectKind !== 'shape' ||
      operation.propertyId !== 'solid-fill' || operation.operationId !== 'set-style' ||
      typeof operation.after !== 'string' || !RGB.test(operation.after)) {
    fail('Expected exactly one canonical solid-fill operation')
  }
  return operation.after.slice(1)
}

async function verifyNativeShapeFillPostcondition({ afterBytes, journal }) {
  if (!Buffer.isBuffer(afterBytes) || !Array.isArray(journal?.operations) || journal.operations.length !== 1) {
    fail('Expected exactly one solid-fill operation')
  }
  const operation = journal.operations[0]
  const rgb = expectedRgb(operation)
  const ref = operation.sourceRef
  if (ref?.status !== 'authoritative' || ref.kind !== 'shape' || !ref.partUri || !ref.nativeId) {
    fail('Authoritative shape source is unavailable')
  }
  const zip = await JSZip.loadAsync(afterBytes, { checkCRC32: true })
  const part = zip.file(ref.partUri)
  if (!part) fail('Authoritative shape part is unavailable')
  const shape = nativeShape(await part.async('string'), String(ref.nativeId))
  const fills = [...shape.matchAll(new RegExp(`<${tag}solidFill\\b[\\s\\S]*?<\\/${tag}solidFill>`, 'g'))]
  if (fills.length !== 1) fail('Expected exactly one solid RGB fill')
  const colors = [...fills[0][0].matchAll(new RegExp(`<${tag}srgbClr\\b[^>]*\\bval=(?:"([A-F0-9]{6})"|'([A-F0-9]{6})')`, 'g'))]
  if (colors.length !== 1 || (colors[0][1] || colors[0][2]) !== rgb) fail('Patched OOXML fill does not match the requested canonical RGB')
  return true
}

module.exports = { verifyNativeShapeFillPostcondition }
