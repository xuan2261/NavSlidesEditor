const { normalizeTextListStyle } = require('./pptx-text-list-style')

// Source declarations stay separate from occurrence overrides and inheritance.
function validateTextListSource(definition) {
  if (definition.content.textListStyle === undefined) return
  const list = normalizeTextListStyle(definition.content.textListStyle)
  const fail = () => { throw new TypeError('Invalid source text list component binding') }
  const component = (id) => definition.components.find((c) => c.id === id)
  const body = component(definition.content.textDocument?.componentId)
  const root = component(list.componentId)
  const path = root?.locator?.path, bodyPath = body?.locator?.path
  if (!definition.source || root?.kind !== 'property' || !path || !bodyPath ||
      path.length !== bodyPath.length + 1 ||
      !bodyPath.every((n, i) => path[i] === n)) fail()
  for (const [index, entry] of list.entries.entries()) {
    const bound = component(entry.componentId)
    const expected = [...path, index]
    if (bound?.kind !== 'property' ||
        (bound.partUri ?? definition.source.partUri) !== definition.source.partUri ||
        bound.locator.preconditionHash !== definition.source.preconditionHash ||
        JSON.stringify(bound.locator.path) !== JSON.stringify(expected) ||
        entry.source.part !== definition.source.partUri ||
        entry.source.path !== expected.join('.')) fail()
  }
  if ((root.partUri ?? definition.source.partUri) !== definition.source.partUri ||
      root.locator.preconditionHash !== definition.source.preconditionHash) fail()
}

function isTextListSourceComponent(definition, componentId) {
  const list = definition.content.textListStyle
  if (!list) return false
  const root = definition.components.find((c) => c.id === list.componentId)?.locator.path
  const path = definition.components.find((c) => c.id === componentId)?.locator.path
  return root && path && root.every((n, i) => path[i] === n)
}

module.exports = { validateTextListSource, isTextListSourceComponent }
