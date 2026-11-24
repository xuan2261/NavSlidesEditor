const { P, MC, P14, fail, parseTransitionXml, attributes } = require('./pptx-transition-xml')
const { record, sameLocator } = require('./pptx-timing-source')
const exactPath = (a, b) => JSON.stringify(a) === JSON.stringify(b)
function readTransitionDocument(source) {
  record(source, ['schemaVersion', 'xml', 'namespaces', 'locator'])
  record(source.locator, ['path', 'preconditionHash'])
  if (source.schemaVersion !== 1 || !Array.isArray(source.locator.path) || !source.locator.path.length ||
      source.locator.path.some(item => !Number.isSafeInteger(item) || item < 0) ||
      !/^[a-f\d]{64}$/u.test(source.locator.preconditionHash)) fail('source locator')
  const root = parseTransitionXml(source.xml, source.namespaces)
  function transition(node) {
    if (!P.has(node.namespace) || node.name !== 'transition') fail('unsupported transition node')
    let duration = null
    for (const entry of attributes(node)) {
      if (entry.namespace === P14 && entry.name === 'dur') {
        if (!/^\d+$/u.test(entry.value) || !Number.isSafeInteger(Number(entry.value)) ||
            Number(entry.value) < 100 || Number(entry.value) > 10000) fail('unsupported duration')
        duration = Number(entry.value)
      } else if (entry.namespace === null && entry.name === 'spd' && ['slow', 'med', 'fast'].includes(entry.value)) {
        // Speed remains authored source data, not an invented millisecond mapping.
      } else if (entry.namespace === null && entry.name === 'advClick' && ['1', 'true'].includes(entry.value)) {
        // Reveal already advances slides on user input.
      } else fail(`unsupported transition attribute ${entry.qualifiedName}`)
    }
    if (node.children.length !== 1) fail('unsupported transition children')
    const effect = node.children[0]
    if (!P.has(effect.namespace) || effect.name !== 'fade' || effect.children.length || attributes(effect).length)
      fail('unsupported transition effect')
    return { transition: 'fade', ...(duration === null ? {} : { transitionDuration: duration }) }
  }
  let selected, nodes
  if (P.has(root.namespace) && root.name === 'transition') {
    selected = transition(root); nodes = [root]
  } else {
    if (root.namespace !== MC || root.name !== 'AlternateContent' || attributes(root).length ||
        root.children.length < 2) fail('alternate content root')
    nodes = []
    let fallback = false
    for (const branch of root.children) {
      if (branch.namespace !== MC || !['Choice', 'Fallback'].includes(branch.name) || fallback || branch.children.length !== 1)
        fail('alternate content branch')
      const attrs = attributes(branch)
      if (branch.name === 'Choice') {
        if (attrs.length !== 1 || attrs[0].namespace !== null || attrs[0].name !== 'Requires') fail('choice requirements')
        const requires = attrs[0].value.trim().split(/\s+/u)
        if (!requires.length ||
            requires.some(prefix => !/^[A-Za-z_][\w.-]*$/u.test(prefix) || branch.bindings[prefix] !== P14))
          fail('unsupported choice namespace')
      } else {
        if (attrs.length) fail('fallback attributes')
        fallback = true
      }
      const effect = transition(branch.children[0])
      nodes.push(branch.children[0])
      if (!selected) selected = effect
    }
    if (!fallback) fail('missing alternate fallback')
  }
  if (!Object.hasOwn(selected, 'transitionDuration')) fail('effective transition duration is unsupported')
  return { projection: selected, transitionPaths: nodes.map(node => [...source.locator.path, ...node.path]) }
}
function validateTransitionDefinition(definition) {
  const source = definition.content.transitionDocument
  if (source === undefined) return
  if (definition.kind !== 'opaque' || definition.origin === 'project' ||
      source.locator?.preconditionHash !== definition.source.preconditionHash) fail('source definition')
  const parsed = readTransitionDocument(source)
  if (!Array.isArray(definition.components) || definition.components.length !== parsed.transitionPaths.length ||
      source.locator.path.length !== 2 || source.locator.path[0] !== 0 ||
      !/^ppt\/slides\/slide[1-9]\d*\.xml$/u.test(definition.source.partUri)) fail('source component inventory')
  parsed.transitionPaths.forEach((path, index) => {
    const component = definition.components[index]
    const id = `${definition.source.partUri}#transition:${path.join('.')}`
    if (component?.id !== id || component.kind !== 'property' ||
        !sameLocator(component.locator, { path, preconditionHash: source.locator.preconditionHash }))
      fail('source component binding')
    if (index === 0 && (definition.id !== id || !sameLocator(definition.source.componentLocator, component.locator)))
      fail('source owner binding')
  })
}
function sourceTransition(document, slide) {
  if (!document) return {}
  const parts = new Set((document.sourceSlides || []).filter(item => item.slideId === slide.id).map(item => item.partUri))
  const found = Object.values(document.definitions).filter(item => item.content.transitionDocument && parts.has(item.source.partUri))
  if (!found.length) return {}
  const roots = new Set()
  let result
  for (const definition of found) {
    validateTransitionDefinition(definition)
    const source = definition.content.transitionDocument
    roots.add(`${definition.source.partUri}#${JSON.stringify(source.locator.path)}`)
    const projection = readTransitionDocument(source).projection
    if (result && !exactPath(result, projection)) fail('conflicting source transitions')
    result = projection
  }
  if (roots.size !== 1) fail('multiple slide transitions')
  return result
}
module.exports = { readTransitionDocument, validateTransitionDefinition, sourceTransition }
