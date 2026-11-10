const { cloneFamilyData } = require('./pptx-family-operations-data')
const {
  familyOperationType, familyRootId, validateFamilyOverride, familyCompatibilityElement,
} = require('./pptx-family-operations')

function familyOperationAvailable(document, instanceId) {
  let instance = document.instances[instanceId]
  if (!instance || instance.lineage?.tombstone || instance.lineage?.paintOnly ||
      !familyOperationType(document.definitions[instance.definitionId])) return false
  while (instance) {
    if (instance.overrides.locked || instance.lineage?.tombstone) return false
    instance = document.instances[instance.parentInstanceId]
  }
  return true
}
function applyFamilyPresentationOperation(input, intent) {
  const { normalizeSemanticPresentation } = require('./pptx-semantic-presentation')
  const operation = cloneFamilyData(intent)
  if (!operation || Object.keys(operation).length !== 4 ||
      !['type', 'instanceId', 'componentId', 'command'].every((key) => Object.hasOwn(operation, key)))
    throw new TypeError('Invalid typed family operation envelope')
  const presentation = normalizeSemanticPresentation(input)
  const document = presentation.pptxSemantic
  const instance = document?.instances[operation.instanceId]
  const definition = document?.definitions[instance?.definitionId]
  if (!document || !familyOperationAvailable(document, operation.instanceId) ||
      operation.type !== familyOperationType(definition) ||
      operation.componentId !== familyRootId(definition))
    throw new TypeError('Unavailable or foreign semantic family operation')
  const components = { ...instance.overrides.components }
  const command = operation.command
  if (command?.type === 'reset') {
    if (Object.keys(command).length !== 1)
      throw new TypeError('Invalid family reset operation')
    delete components[operation.componentId]
  } else {
    const previous = components[operation.componentId]?.familyOperations?.commands ?? []
    const override = { familyOperations: {
      family: operation.type.slice(0, -5), commands: [...previous, command],
    } }
    validateFamilyOverride(definition, operation.componentId, override)
    components[operation.componentId] = override
  }
  const overrides = { ...instance.overrides }
  if (Object.keys(components).length) overrides.components = components
  else delete overrides.components
  const next = {
    ...document,
    instances: { ...document.instances, [instance.id]: { ...instance, overrides } },
  }
  let matched = false
  function project(slides, inheritedLock = false) {
    return slides.map((slide) => {
      const locked = inheritedLock || slide.locked
      return {
        ...slide,
        elements: (slide.elements || []).map((element) => {
          if (element.pptxInstanceId !== instance.id) return element
          if (matched || slide.id !== instance.slideId || locked || element.locked ||
              definition.content.frameProperties?.locks?.noSelect)
            throw new TypeError('Locked or ambiguous semantic family target')
          matched = true
          return familyCompatibilityElement(next, element)
        }),
        ...(slide.children ? { children: project(slide.children, locked) } : {}),
      }
    })
  }
  const slides = project(presentation.slides)
  if (!matched) throw new TypeError('Missing semantic family target')
  return normalizeSemanticPresentation({ ...presentation, pptxSemantic: next, slides })
}
module.exports = { applyFamilyPresentationOperation, familyOperationAvailable }
