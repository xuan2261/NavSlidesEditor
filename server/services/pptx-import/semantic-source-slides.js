const { createHash } = require('node:crypto')
const namespaces = new WeakMap()
function sourceNamespace(inventory) {
  if (!namespaces.has(inventory)) namespaces.set(inventory, createHash('sha256')
    .update(JSON.stringify(inventory.parts.map(({ partUri, preconditionHash }) =>
      [partUri, preconditionHash]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))).digest('hex'))
  return namespaces.get(inventory)
}
function sourceSlidesForImport(inventory, slides) {
  const sourceId = sourceNamespace(inventory)
  return inventory.slides.map(({ partUri, index }) => {
    const record = inventory.parts.find((part) => part.partUri === partUri)
    const slideId = slides[index]?.id
    if (!record || !slideId) throw new TypeError('Missing imported source slide reference')
    return { sourceId, partUri, preconditionHash: record.preconditionHash, slideId }
  })
}
module.exports = { sourceNamespace, sourceSlidesForImport }
