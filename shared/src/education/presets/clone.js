const { remapInteractionReferences } = require('../interaction-references.js')
const { isGameSubtype } = require('../game-registry.js')
const configEntries = (element) => Object.entries(element).filter(([key]) => isGameSubtype(key))
const ID_FIELDS = new Set([
  'id',
  'groupId',
  'promptId',
  'targetId',
  'optionId',
  'leftId',
  'rightId',
  'itemId',
  'bucketId',
  'elementId',
  'targetElementId',
])
const ID_ARRAYS = new Set(['optionIds', 'itemIds', 'questionIds', 'dailyDouble'])
function collectConfigIds(value, mapping, allocate) {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item) => collectConfigIds(item, mapping, allocate))
    return
  }
  for (const key of ['id', 'promptId', 'targetId']) {
    if (typeof value[key] === 'string' && !mapping.has(value[key]))
      mapping.set(value[key], allocate(value[key]))
  }
  Object.values(value).forEach((child) => collectConfigIds(child, mapping, allocate))
}
function remapOwned(value, mapping, key = '') {
  if (typeof value === 'string')
    return (ID_FIELDS.has(key) || ID_ARRAYS.has(key)) && mapping.has(value)
      ? mapping.get(value)
      : value
  if (Array.isArray(value)) return value.map((child) => remapOwned(child, mapping, key))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).map(([field, child]) => [field, remapOwned(child, mapping, field)])
  )
}
function remapElementLinks(element, mapping) {
  const configs = configEntries(element)
  const links = { ...element }
  for (const [key] of configs) delete links[key]
  return { ...remapOwned(links, mapping), ...Object.fromEntries(configs) }
}

function clonePresetElements(
  preset,
  {
    createId = () => globalThis.crypto.randomUUID(),
    destinationElements = [],
    preserveExternalTargets = false,
  } = {}
) {
  if (!preset || !Array.isArray(preset.elements) || !preset.elements.length)
    throw new Error('Choose a preset containing elements.')
  if (
    typeof createId !== 'function' ||
    !Array.isArray(destinationElements) ||
    [...preset.elements, ...destinationElements].some(
      (element) => !element || typeof element.id !== 'string' || !element.id
    )
  )
    throw new Error(
      'Preset and destination elements require nonempty IDs and a callable ID factory.'
    )
  const occupied = new Set(destinationElements.map((element) => element.id))
  const original = new Set(preset.elements.map((element) => element.id))
  for (const element of preset.elements) {
    if (element.groupId) original.add(element.groupId)
    for (const [, config] of configEntries(element))
      collectConfigIds(config, new Map(), (id) => {
        original.add(id)
        return id
      })
  }
  const allocate = () => {
    const id = createId()
    if (typeof id !== 'string' || !id || occupied.has(id) || original.has(id))
      throw new Error('Preset ID factory must return fresh, unique string IDs.')
    occupied.add(id)
    return id
  }
  const idMap = new Map()
  for (const element of preset.elements) {
    if (!element.id || idMap.has(element.id))
      throw new Error('Preset element IDs must be nonempty and unique.')
    idMap.set(element.id, allocate())
  }
  for (const element of preset.elements)
    if (element.groupId && !idMap.has(element.groupId)) idMap.set(element.groupId, allocate())
  const copies = structuredClone(preset.elements).map((element) => {
    const configMap = new Map()
    const configs = configEntries(element)
    for (const [, config] of configs) collectConfigIds(config, configMap, allocate)
    const owned = {
      ...element,
      ...Object.fromEntries(configs.map(([key, config]) => [key, remapOwned(config, configMap)])),
    }
    const { action, ...withoutAction } = owned
    return { ...remapElementLinks(withoutAction, idMap), ...(action ? { action } : {}) }
  })
  const { elements, warnings } = remapInteractionReferences(copies, idMap, {
    destinationElements: [...destinationElements, ...copies],
    preserveExternalTargets,
  })
  return { elements, warnings, idMap }
}
module.exports = { clonePresetElements, remapElementLinks }
