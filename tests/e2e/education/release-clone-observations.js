const definitions = new Set(['id', 'groupId', 'promptId', 'targetId'])
const references = new Set([
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
const referenceArrays = new Set(['optionIds', 'itemIds', 'questionIds', 'dailyDouble'])

export function cloneProjection(element) {
  const content = structuredClone(element)
  for (const key of ['id', 'x', 'y']) delete content[key]
  const identities = new Map()
  function collect(value) {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach(collect)
      return
    }
    for (const [key, child] of Object.entries(value)) {
      if (definitions.has(key) && typeof child === 'string' && !identities.has(child))
        identities.set(child, `owned-${identities.size}`)
      collect(child)
    }
  }
  function normalize(value, key = '') {
    if (typeof value === 'string' && (references.has(key) || referenceArrays.has(key)))
      return identities.get(value) || value
    if (Array.isArray(value)) return value.map((child) => normalize(child, key))
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(
      Object.entries(value).map(([field, child]) => [field, normalize(child, field)])
    )
  }
  collect(content)
  return { content: normalize(content), ownedIds: [...identities.keys()] }
}
