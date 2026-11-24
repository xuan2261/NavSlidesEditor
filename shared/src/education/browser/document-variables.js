const { createInteractionVariableStore } = require('../interaction-variables.js')
const stores = new WeakMap()
function getDocumentVariables(document) {
  if (!stores.has(document)) {
    const source = document.querySelector('script[data-ns-interaction-variables]')
    const declarations = source ? JSON.parse(source.textContent) : []
    stores.set(document, createInteractionVariableStore(declarations))
  }
  return stores.get(document)
}
function destroyDocumentVariables(document) {
  stores.get(document)?.destroy()
  stores.delete(document)
}
module.exports = { getDocumentVariables, destroyDocumentVariables }
