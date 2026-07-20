const { hashRecord } = require('./package-store/schemas')

const KINDS = new Set(['slide-add', 'slide-delete', 'slide-reorder', 'slide-duplicate'])

function createSlideStructureOperation(input) {
  if (!KINDS.has(input?.kind)) throw new TypeError('Unsupported slide structure journal operation')
  const operation = {
    schemaVersion: 1,
    kind: input.kind,
    slidePartUri: input.slidePartUri || null,
    slidePartUris: input.slidePartUris ? [...input.slidePartUris] : null,
    index: Number.isInteger(input.index) ? input.index : null,
    referencePolicy: input.referencePolicy || 'block',
    affectedProperties: ['slides'],
    impactClosure: [...new Set(input.impactClosure || [
      'ppt/presentation.xml',
      'ppt/_rels/presentation.xml.rels',
      '[Content_Types].xml',
    ])].sort(),
  }
  operation.operationId = `op-${hashRecord(operation).slice(0, 24)}`
  return Object.freeze(operation)
}

module.exports = { createSlideStructureOperation }
