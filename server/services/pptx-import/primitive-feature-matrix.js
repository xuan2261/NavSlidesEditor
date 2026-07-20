const {
  CANONICAL_FEATURE_MATRIX,
  featureMatrixHash,
  featureRow: canonicalFeatureRow,
  unsupportedBlockingVerdict,
} = require('./canonical-feature-matrix')

const PRIMITIVE_FEATURE_MATRIX = Object.freeze(
  CANONICAL_FEATURE_MATRIX.filter((row) => row.family === 'primitive'),
)

function featureRow(id, lookup) {
  const metadata = CANONICAL_FEATURE_MATRIX.find((row) => row.id === id)
  if (metadata && metadata.family !== 'primitive') {
    return unsupportedBlockingVerdict(id, 'non-primitive-row')
  }
  return canonicalFeatureRow(id, lookup)
}

module.exports = { PRIMITIVE_FEATURE_MATRIX, featureMatrixHash, featureRow }
