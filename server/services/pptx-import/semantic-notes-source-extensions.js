const { readNativeCreationIdentity } = require('./ooxml-native-creation-identity')
const { buildGeometryStyleSources } = require('./ooxml-geometry-style-source')

const CREATION = 'http://schemas.microsoft.com/office/drawing/2014/main'
const HIDDEN = 'http://schemas.microsoft.com/office/drawing/2010/main'
const HIDDEN_NAMES = new Set(['hiddenFill', 'hiddenLine', 'hiddenEffects'])

// Notes retain authenticated XML, not slide paint. Reuse the source readers in
// an occurrence-free sandbox; none of its style records enter the saved graph.
async function validateNotesSourceExtensions({ zip, inventory, parts, nodes, noteParts, dispositions, fail }) {
  const byId = new Map(inventory.definitions.map((entry) => [entry.id, entry]))
  const owners = new Map(), pending = []
  const nativeOwner = (entry) => {
    let parent = byId.get(entry.parentDefinitionId)
    while (parent && parent.nativeId === null) parent = byId.get(parent.parentDefinitionId)
    return parent
  }
  for (const entry of inventory.definitions) {
    if (!noteParts.has(entry.partUri) || entry.kind !== 'unknown-extension' || dispositions.has(entry.id)) continue
    const owner = nativeOwner(entry)
    if (!owner) continue
    if (entry.namespaceUri === CREATION && entry.localName === 'creationId') {
      owners.set(owner.id, owner)
    } else if (entry.namespaceUri === HIDDEN && HIDDEN_NAMES.has(entry.localName)) {
      owners.set(owner.id, owner)
      pending.push(entry)
    }
  }
  if (!owners.size) return
  const components = new Map([...owners.keys()].map((id) => [id, []]))
  for (const entry of inventory.definitions) {
    const owner = nativeOwner(entry)
    if (components.has(owner?.id)) components.get(owner.id).push(entry)
  }
  const admit = (entry) => {
    if (dispositions.has(entry.id)) fail(entry, 'duplicate notes extension disposition')
    dispositions.set(entry.id, { definitionId: entry.id, partUri: entry.partUri,
      locator: entry.componentLocators[0], disposition: 'semantically-mapped' })
  }
  for (const owner of owners.values()) {
    const identity = readNativeCreationIdentity({ source: owner, node: nodes.get(owner.id),
      components: components.get(owner.id), nodes, xml: parts.get(owner.partUri).xml }, fail)
    if (identity) admit(byId.get(identity.componentId))
  }
  if (!pending.length) return
  const hiddenOwners = new Set(pending.map((entry) => nativeOwner(entry).id))
  const definitions = inventory.definitions.filter((entry) =>
    hiddenOwners.has(entry.id) || hiddenOwners.has(nativeOwner(entry)?.id))
  let validated
  try {
    validated = await buildGeometryStyleSources(zip, {
      ...inventory,
      definitions,
      slides: [],
      occurrences: [],
    })
  } catch (error) {
    if (error.code !== 'PPTX_SEMANTIC_ADMISSION_FAILED') throw error
    const source = pending.find((entry) => entry.partUri === error.sourceLocation?.partUri) || pending[0]
    fail(source, `notes extension ${error.message}`)
  }
  for (const entry of pending) {
    const binding = validated.definitionBindings[nativeOwner(entry).id]
    const declarations = validated.styles[binding?.styleId]?.payload
    const sources = ['hiddenFill', 'hiddenStroke', 'hiddenEffects']
      .map((key) => declarations?.[key]?.source).filter(Boolean)
    const matches = sources.filter((source) => source.partUri === entry.partUri &&
      source.preconditionHash === entry.preconditionHash &&
      JSON.stringify(source.componentLocator.path) === JSON.stringify(entry.componentLocators[0].path))
    if (matches.length !== 1) fail(entry, 'unbound notes hidden paint declaration')
    admit(entry)
  }
}

module.exports = { validateNotesSourceExtensions }
