const { executeMutation } = require('./mutation-transaction-execution')

function createMutationTransactionService(dependencies) {
  const { store, nativeTextAdapter, loadSourceMap, loadCanonicalProjection } = dependencies || {}
  if (!store || typeof nativeTextAdapter?.applyTextPatch !== 'function' ||
      typeof loadSourceMap !== 'function' || typeof loadCanonicalProjection !== 'function') {
    throw new TypeError('Mutation transaction dependencies are required')
  }
  return Object.freeze({
    execute: (request) => executeMutation(dependencies, request),
  })
}

module.exports = { createMutationTransactionService }
