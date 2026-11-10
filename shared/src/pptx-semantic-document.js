const { invert } = require('./pptx-affine.js')
const { validatePresentationProperties } = require('./pptx-presentation-properties.js')
const { validateSourcePartIdentity } = require('./pptx-source-part-identities.js')
const { validateSourceGuideList } = require('./pptx-source-guides.js')
const { validateTransitionDefinition } = require('./pptx-transition-document.js')
const { validateSourceSlides } = require('./pptx-source-slide-references.js')
const { validateShape3dAppearance, validateShape3dOverride } = require('./pptx-shape-3d-appearance.js')
const {
  validateTextHyperlinkBindings,
  validateTextHyperlinkOverride,
} = require('./pptx-text-hyperlink-bindings.js')
const { normalizeTextDocument } = require('./pptx-text-document.js')
const {
  validateTextListSource,
  isTextListSourceComponent,
} = require('./pptx-semantic-text-sources.js')
const { validateTextContextBindings } = require('./pptx-semantic-text-context.js')
const {
  normalizeGeometryDocument,
  normalizeGeometryTemplate,
} = require('./pptx-geometry-document.js')
const {
  sourceGeometryForContext,
  validateHiddenGeometryStrokes,
  resolveGeometryStyle,
} = require('./pptx-geometry-style-resolution.js')
const { validateConnectorBindings } = require('./pptx-semantic-connectors.js')
const { validatePictureDefinition, validatePictureOverride } = require('./pptx-picture-document.js')
const { validateMediaDocument, validateMediaOverride } = require('./pptx-media-document.js')
const { familyRootId, validateFamilyOverride } = require('./pptx-family-operations.js')
const {
  validateFamilyDocuments,
  hasFamilyDocument,
  safePartUri,
} = require('./pptx-semantic-family-documents.js')
const {
  validateGeometryStyleRecords,
  geometryProvider,
  validateGeometryStyleOverride,
  validateInheritanceStyleRecords,
} = require('./pptx-geometry-style-records.js')
const {
  semanticRecord,
  semanticStyle,
  validateGraphStructure,
  cloneImmutableSemanticDocument,
  certifyImmutableSemanticDocument,
  isCertifiedSemanticDocument,
} = require('./pptx-semantic-records.js')

const DEFINITION_KINDS = new Set([
  'presentation-properties',
  'source-part-identity',
  'source-guide-list',
  'text',
  'shape',
  'line',
  'image',
  'svg',
  'group',
  'table',
  'chart',
  'diagram',
  'equation',
  'video',
  'audio',
  'media',
  'opaque',
  'ole',
  'activex',
  'model-3d',
  'unknown',
])
const COMPONENT_KINDS = new Set([
  'run',
  'paragraph',
  'cell',
  'row',
  'column',
  'series',
  'point',
  'node',
  'connection',
  'path',
  'control-point',
  'equation-node',
  'media-segment',
  'property',
  'hyperlink',
])
const SHA256 = /^[a-f0-9]{64}$/
const id = (value) => typeof value === 'string' && value.length > 0 && value.length <= 1024
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

class PptxSemanticValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PptxSemanticValidationError'
    this.code = 'INVALID_PPTX_SEMANTIC_DOCUMENT'
  }
}

function fail(message) {
  throw new PptxSemanticValidationError(message)
}

// Only this module's successfully validated, deeply frozen outputs are reusable.
// Mutable inputs and externally frozen lookalikes must always traverse validation.
const normalizedDocuments = new WeakMap()
const validatedDefinitionsCache = new WeakMap()
const validatedInstancesCache = new WeakSet()

function normalizePptxSemanticDocument(input, options = {}) {
  const schema =
    input && typeof input === 'object'
      ? Object.getOwnPropertyDescriptor(input, 'schemaVersion')
      : null
  if (!schema || !('value' in schema) || ![1, 2, 3].includes(schema.value))
    fail('Unsupported semantic schema')
  const limits = {
    maxDefinitions: 10000,
    maxInstances: 100000,
    maxComponents: 100000,
    maxDepth: 256,
    maxBytes: 8 * 1024 * 1024,
    ...options,
  }
  for (const value of Object.values(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) fail('Invalid semantic budget')
  }
  const validatedLimits = normalizedDocuments.get(input)
  if (validatedLimits && Object.keys(limits).length === Object.keys(validatedLimits).length &&
      Object.keys(limits).every((key) => limits[key] === validatedLimits[key])) return input
  const document = cloneImmutableSemanticDocument(input, limits, PptxSemanticValidationError)
  if (
    !record(document) ||
    ![1, 2, 3].includes(document.schemaVersion) ||
    Object.keys(document).some(
      (key) =>
        ![
          'schemaVersion',
          'definitions',
          'instances',
          'styles',
          'fonts',
          'sourceSlides',
          'declarationScopes',
          'sourceParts',
          'sourceLocations',
          'textShapes',
          'textInventories',
          'sourceIdentities',
          'typedPropertyValues',
          'sourceRelationships',
          'fontDescriptors',
          'partUris',
        ].includes(key)
    )
  ) {
    fail('Unsupported semantic schema')
  }
  if (new TextEncoder().encode(JSON.stringify(document)).byteLength > limits.maxBytes) {
    fail('Semantic byte budget exceeded')
  }
  for (const field of ['definitions', 'instances', 'styles', 'fonts']) {
    if (!record(document[field])) fail(`Invalid semantic ${field} dictionary`)
  }
  try {
    validateSourceSlides(document)
  } catch (error) {
    fail(error.message)
  }
  if (
    Object.keys(document.definitions).length > limits.maxDefinitions ||
    Object.keys(document.instances).length > limits.maxInstances
  )
    fail('Semantic inventory budget exceeded')
  if (document.schemaVersion === 3) {
    try {
      validateGraphStructure(document)
    } catch (error) {
      fail(error.message)
    }
  }
  certifyImmutableSemanticDocument(document)
  function locator(value, sourceHash) {
    if (document.schemaVersion === 3 && typeof value?.locatorId === 'number') {
      const loc = document.sourceLocations?.[value.locatorId]
      if (!loc || !Array.isArray(loc.path)) fail('Invalid structural component locator')
      return
    }
    if (!record(value) || value.preconditionHash !== sourceHash)
      fail('Invalid component locator precondition')
    if (value.nativeId !== undefined) {
      if (!id(value.nativeId)) fail('Invalid native component locator')
    } else if (
      !Array.isArray(value.path) ||
      !value.path.length ||
      value.path.some((index) => !Number.isSafeInteger(index) || index < 0)
    ) {
      fail('Invalid structural component locator')
    }
  }
  function textDocument(value) {
    try {
      return normalizeTextDocument(value)
    } catch (error) {
      fail(error.message)
    }
  }
  function geometryDocument(value, template = false) {
    try {
      return template ? normalizeGeometryTemplate(value) : normalizeGeometryDocument(value)
    } catch (error) {
      fail(error.message)
    }
  }
  let componentIds, familyBindings, sourceDefinitions, componentCount
  const cachedDefs = validatedDefinitionsCache.get(document.definitions)
  if (cachedDefs) {
    componentIds = cachedDefs.componentIds
    familyBindings = cachedDefs.familyBindings
    sourceDefinitions = cachedDefs.sourceDefinitions
    componentCount = cachedDefs.componentCount
  } else {
    componentIds = new Map()
    familyBindings = new Map()
    sourceDefinitions = new Set()
    componentCount = 0
    for (const [key, definition] of Object.entries(document.definitions)) {
      const isSchema3 = document.schemaVersion === 3
    const validDefId = isSchema3
      ? /^(?:0|[1-9]\d*)$/.test(key) && (definition.id === key || definition.id === Number(key))
      : id(key) && definition.id === key
    if (
      !record(definition) ||
      !validDefId ||
      !DEFINITION_KINDS.has(definition.kind)
    ) {
      fail('Invalid definition identity or kind')
    }
    if (definition.origin === 'project') {
      if (
        definition.kind !== 'group' ||
        definition.source !== null ||
        !Array.isArray(definition.components) ||
        definition.components.length ||
        !record(definition.content)
      )
        fail('Invalid project group definition')
      if (definition.content.geometry?.schemaVersion === 2)
        fail('Geometry templates require linked source definitions')
      if (hasFamilyDocument(definition.content)) fail('Family documents require source definitions')
      if (definition.content.pictureDocument !== undefined)
        fail('Picture documents require source definitions')
      if (definition.content.presentationProperties !== undefined || definition.content.colorMru !== undefined)
        fail('Presentation properties require source definitions')
      if (definition.content.sourcePartIdentity !== undefined)
        fail('Part identities require source definitions')
      if (definition.content.sourceGuideList !== undefined)
        fail('Guide lists require source definitions')
      if (definition.content.transitionDocument !== undefined)
        fail('Transition documents require source definitions')
      if (definition.content.shape3dAppearance !== undefined)
        fail('Source 3D appearance requires a source definition')
      componentIds.set(key, new Set())
      continue
    }
    if (definition.origin !== undefined && definition.origin !== 'source')
      fail('Unsupported definition origin')
    const source = definition.source
    if (document.schemaVersion === 3 && typeof source?.sourceId === 'number') {
      const loc = document.sourceLocations?.[source.sourceId]
      const part = document.sourceParts?.[loc?.part]
      if (!loc || !part || !SHA256.test(part.preconditionHash)) {
        fail('Invalid source definition location')
      }
      const sourceIdentity = JSON.stringify([source.sourceId, definition.kind])
      if (sourceDefinitions.has(sourceIdentity)) fail('Duplicate source definition identity')
      sourceDefinitions.add(sourceIdentity)
    } else {
      const partUri =
        document.schemaVersion === 3 && typeof source?.partUri === 'object' && source.partUri.partId !== undefined
          ? document.partUris?.[source.partUri.partId]
          : source?.partUri
      if (
        !record(source) ||
        !id(partUri) ||
        /[\\:#?]/.test(partUri) ||
        partUri
          .split('/')
          .some((segment) => !segment || segment === '.' || segment === '..') ||
        /%(?:2f|5c|2e)/i.test(partUri) ||
        !SHA256.test(source.preconditionHash)
      ) {
        fail('Invalid source definition location')
      }
      if (source.nativeId !== undefined) {
        if (!id(source.nativeId)) fail('Invalid source native identity')
      } else {
        locator(source.componentLocator, source.preconditionHash)
      }
      const sourceIdentity = JSON.stringify([
        partUri,
        source.nativeId || source.componentLocator,
        definition.kind,
      ])
      if (sourceDefinitions.has(sourceIdentity)) fail('Duplicate source definition identity')
      sourceDefinitions.add(sourceIdentity)
    }
    if (!Array.isArray(definition.components) || !record(definition.content)) {
      fail('Invalid definition component/content data')
    }
    let bindings = new Map()
    const decodedDef = isSchema3 ? semanticRecord(document, 'definitions', Number(key)) : definition
    try {
      bindings = validateFamilyDocuments(decodedDef)
    } catch (error) {
      fail(error.message)
    }
    familyBindings.set(key, bindings)
    const components = new Set()
    for (const [componentIndex, component] of definition.components.entries()) {
      const validCompId = isSchema3
        ? (typeof component.id === 'number' && component.id >= 0 && component.id < (document.sourceIdentities?.length ?? 0)) || id(component.id)
        : id(component.id)
      if (
        !record(component) ||
        !validCompId ||
        !COMPONENT_KINDS.has(component.kind) ||
        components.has(component.id)
      )
        fail('Invalid or duplicate component identity')
      const componentPartUri = isSchema3
        ? decodedDef.components[componentIndex].partUri
        : component.partUri
      if (component.partUri !== undefined && !safePartUri(componentPartUri))
        fail('Invalid component part URI')
      if (!isSchema3) {
        const binding = bindings.get(component.id)
        if ((component.partUri ?? source.partUri) !== source.partUri && !binding)
          fail('Foreign component requires a declared family source binding')
        locator(component.locator, binding?.preconditionHash ?? source.preconditionHash)
      } else {
        locator(component.locator)
      }
      components.add(component.id)
      if (++componentCount > limits.maxComponents) fail('Semantic component budget exceeded')
    }
    if (
      source.creationId !== undefined &&
      (!record(source.creationId) ||
        Object.keys(source.creationId).length !== 2 ||
        !Object.keys(source.creationId).every((key) => ['value', 'componentId'].includes(key)) ||
        typeof source.creationId.value !== 'string' ||
        !/^\{[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\}$/i.test(source.creationId.value) ||
        !definition.components.some(
          (component) =>
            component.id === source.creationId.componentId && component.kind === 'property'
        ))
    )
      fail('Invalid source creation identity')
    if (decodedDef.content.textDocument !== undefined) {
      const text = textDocument(decodedDef.content.textDocument)
      if (!decodedDef.components.some(component => component.id === text.componentId)) fail('Text body targets an unknown component')
    }
    try {
      validateTextListSource(decodedDef)
      validateTextHyperlinkBindings(decodedDef)
      validatePresentationProperties(decodedDef)
      validateSourcePartIdentity(decodedDef)
      validateSourceGuideList(decodedDef)
      validateTransitionDefinition(decodedDef)
      validatePictureDefinition(decodedDef)
      validateMediaDocument(decodedDef)
      validateShape3dAppearance(decodedDef)
    } catch (error) {
      fail(error.message)
    }
    if (decodedDef.content.geometry?.schemaVersion !== undefined) {
      const geometry = geometryDocument(
        decodedDef.content.geometry,
        decodedDef.content.geometry.schemaVersion === 2 &&
          (document.schemaVersion === 2 || document.schemaVersion === 3) &&
          decodedDef.origin !== 'project'
      )
      if (!decodedDef.components.some(component => component.id === geometry.componentId)) fail('Geometry targets an unknown component')
    } else if (
      decodedDef.content.geometry !== undefined &&
      (!record(decodedDef.content.geometry) ||
        Object.keys(decodedDef.content.geometry).length !== 1 ||
        !id(decodedDef.content.geometry.preset))
    ) {
      fail('Geometry schema is required')
    }
    componentIds.set(key, isSchema3 ? new Set(decodedDef.components.map(component => component.id)) : components)
  }
  validatedDefinitionsCache.set(document.definitions, {
    componentIds,
    familyBindings,
    sourceDefinitions,
    componentCount,
  })
}
  if (document.schemaVersion === 2) {
    try {
      validateGeometryStyleRecords(document, { maxBytes: limits.maxBytes })
      // Every checked context is source authority, including suppressed or
      // hidden occurrences. An override cannot mask an invalid source extent.
      for (const [styleId, style] of Object.entries(document.styles))
        if (style.kind === 'geometry-context') {
          sourceGeometryForContext(document, styleId)
          validateHiddenGeometryStrokes(document, styleId)
        }
    } catch (error) {
      fail(error.message)
    }
  } else if (document.schemaVersion === 3) {
    for (const cat of [
      'declarationScopes',
      'sourceParts',
      'sourceLocations',
      'textShapes',
      'textInventories',
      'sourceIdentities',
      'typedPropertyValues',
      'sourceRelationships',
      'fontDescriptors',
      'partUris',
    ]) {
      if (!Array.isArray(document[cat])) fail(`Invalid semantic ${cat} catalog`)
    }
    for (let i = 0; i < document.declarationScopes.length; i++) {
      let p = document.declarationScopes[i]?.parent
      let d = 0
      while (p !== null && p !== undefined) {
        if (!Number.isSafeInteger(p) || p < 0 || p >= document.declarationScopes.length || !document.declarationScopes[p]) {
          fail('Dangling declaration scope parent')
        }
        if (++d > 256 || p === i) fail('Semantic scope cycle/depth exceeded')
        p = document.declarationScopes[p]?.parent
      }
    }
    try {
      validateInheritanceStyleRecords(document)
    } catch (error) {
      fail(error.message)
    }
  }
  for (const [key, instance] of Object.entries(document.instances)) {
    const isSchema3 = document.schemaVersion === 3
    const validInstanceId = isSchema3
      ? /^(?:0|[1-9]\d*)$/.test(key) && (instance.id === key || instance.id === Number(key))
      : id(key) && instance.id === key
    const validDefRef =
      componentIds.has(instance.definitionId) ||
      (isSchema3 && componentIds.has(String(instance.definitionId)))
    if (
      !record(instance) ||
      !validInstanceId ||
      !id(instance.slideId) ||
      !validDefRef
    )
      fail('Invalid instance identity or definition')
    const visited = new Set([key])
    let parentId = instance.parentInstanceId
    let depth = 0
    while (parentId !== null) {
      if (visited.has(String(parentId))) fail('Semantic parent cycle')
      const parent = document.instances[parentId]
      const validParentId = isSchema3
        ? typeof parentId === 'number' || /^(0|[1-9]\d*)$/.test(parentId)
        : id(parentId)
      if (!validParentId || !parent || parent.slideId !== instance.slideId)
        fail('Invalid instance parent')
      visited.add(String(parentId))
      parentId = parent.parentInstanceId
      if (++depth > limits.maxDepth) fail('Semantic parent budget exceeded')
    }
    if (cachedDefs && validatedInstancesCache.has(instance)) continue
    let decodedDefinition, decodedInstance
    try {
      decodedDefinition = isSchema3
        ? semanticRecord(document, 'definitions', Number(instance.definitionId)) : document.definitions[instance.definitionId]
      decodedInstance = isSchema3 ? semanticRecord(document, 'instances', Number(key)) : instance
    } catch (error) {
      fail(error.message)
    }
    if (document.definitions[instance.definitionId].kind === 'presentation-properties')
      fail('Source presentation properties cannot have editable occurrences')
    if (document.definitions[instance.definitionId].kind === 'source-part-identity')
      fail('Source part identities cannot have editable occurrences')
    if (document.definitions[instance.definitionId].kind === 'source-guide-list')
      fail('Source guide lists cannot have editable occurrences')
    if (document.definitions[instance.definitionId].content.transitionDocument !== undefined)
      fail('Source transitions cannot have editable occurrences')
    if (
      instance.lineage?.paintOnly !== undefined &&
      (typeof instance.lineage.paintOnly !== 'boolean' ||
        (instance.lineage.paintOnly &&
          (document.definitions[instance.definitionId].kind !== 'group' ||
            instance.lineage.tombstone === true)))
    )
      fail('Invalid retained paint scope')
    const matrix = instance.localTransform
    if (
      !Array.isArray(matrix) ||
      matrix.length !== 6 ||
      matrix.some((value) => !Number.isFinite(value))
    )
      fail('Invalid instance transform')
    try {
      invert(matrix)
    } catch {
      fail('Invalid instance transform')
    }
    if (
      !Number.isSafeInteger(instance.paintIndex) ||
      instance.paintIndex < 0 ||
      !record(instance.overrides)
    )
      fail('Invalid instance paint/override data')
    if (hasFamilyDocument(instance.overrides)) fail('Unsupported family occurrence override')
    if (instance.overrides.sourceGuideList !== undefined) fail('Source guide lists cannot be overridden')
    if (instance.overrides.transitionDocument !== undefined) fail('Source transitions cannot be overridden')
    try {
      validateShape3dOverride(decodedDefinition, decodedInstance.overrides)
    } catch (error) {
      fail(error.message)
    }
    if (
      instance.overrides.pictureDocument !== undefined ||
      instance.overrides.picture !== undefined
    )
      fail('Picture overrides must target a source component')
    if (
      document.definitions[instance.definitionId].content.pictureDocument &&
      Object.hasOwn(instance.overrides, 'media')
    )
      fail('Picture source media binding is immutable')
    if (Object.hasOwn(instance.overrides, 'mediaPlayback'))
      fail('Media playback overrides must target a source component')
    const overrides = decodedInstance.overrides.components
    const provider = (document.schemaVersion === 2 || document.schemaVersion === 3) ? geometryProvider(document, decodedInstance) : null
    if (
      overrides !== undefined &&
      (!record(overrides) ||
        Object.keys(overrides).some(
          (component) =>
            !componentIds.get(String(instance.definitionId)).has(component) &&
            component !== provider?.geometry?.componentId &&
            component !== familyRootId(decodedDefinition)
        ))
    ) {
      fail('Override targets an unknown component')
    }
    for (const [componentId, override] of Object.entries(overrides || {})) {
      if (isTextListSourceComponent(decodedDefinition, componentId))
        fail('Source text list declarations are immutable')
      try {
        if (validateMediaOverride(decodedDefinition, componentId, override))
          continue
        if (
          validatePictureOverride(
            decodedDefinition,
            componentId,
            override
          )
        )
          continue
        if (
          validateFamilyOverride(decodedDefinition, componentId, override)
        )
          continue
      } catch (error) {
        fail(error.message)
      }
      if (
        familyBindings.get(String(instance.definitionId))?.has(componentId) ||
        (record(override) && hasFamilyDocument(override))
      )
        fail('Unsupported family component override')
      if (override?.textDocument !== undefined) {
        const text = textDocument(override.textDocument)
        if (text.componentId !== componentId) fail('Text override targets a different component')
        try {
          validateTextHyperlinkOverride(decodedDefinition, text)
        } catch (error) {
          fail(error.message)
        }
      }
      if (override?.geometryDocument !== undefined) {
        const geometry = geometryDocument(override.geometryDocument)
        if (
          geometry.componentId !== componentId ||
          (provider?.geometry ?? decodedDefinition.content.geometry)
            ?.componentId !== componentId
        )
          fail('Geometry override targets a different component')
        if (document.schemaVersion === 2 || document.schemaVersion === 3) {
          if (Object.hasOwn(geometry, 'style'))
            fail('Structural geometry override must not contain style')
          const identities = (value) => [
            value.componentId,
            ...(value.paths || []).flatMap((p) => [
              p.componentId,
              ...p.commands.flatMap((c) => (c.points || []).map((point) => point.componentId)),
            ]),
            ...(value.handles || []).map((h) => h.componentId),
            ...(value.connections || []).map((c) => c.componentId),
          ]
          if (
            JSON.stringify(identities(geometry)) !== JSON.stringify(identities(provider.geometry))
          )
            fail('Structural geometry override changes source component identities')
        }
      }
      if (
        (document.schemaVersion === 2 || document.schemaVersion === 3) &&
        (componentId === provider?.geometry?.componentId ||
          override?.geometryStyle !== undefined ||
          override?.geometryDocument !== undefined)
      ) {
        const ownerDefinition = decodedDefinition
        if (ownerDefinition.kind === 'group') {
          const declaration =
            semanticStyle(document, ownerDefinition.content.geometrySource?.styleId)?.payload
          if (
            !declaration ||
            componentId !== declaration.paintComponentId ||
            !record(override) ||
            Object.keys(override).length !== 1 ||
            !record(override.geometryStyle) ||
            Object.keys(override.geometryStyle).some((key) => key !== 'fill')
          )
            fail('Group fill override targets a different source paint component')
          try {
            validateGeometryStyleOverride(override.geometryStyle)
          } catch (error) {
            fail(error.message)
          }
          continue
        }
        if (
          !record(override) ||
          Object.keys(override).some(
            (field) => !['geometryDocument', 'geometryStyle'].includes(field)
          ) ||
          !provider.geometry ||
          provider.geometry.componentId !== componentId
        )
          fail('Geometry override targets a different provider component')
        if (override.geometryStyle !== undefined) {
          try {
            validateGeometryStyleOverride(
              override.geometryStyle,
              override.geometryDocument ?? provider.geometry
            )
          } catch (error) {
            fail(error.message)
          }
        }
      }
    }
    validatedInstancesCache.add(instance)
  }
  try {
    validateTextContextBindings(document)
    for (const instance of Object.values(document.instances)) {
      if (
        Object.values(instance.overrides.components ?? {}).some(
          (component) => component.geometryStyle?.fill?.gradientPatch !== undefined
        )
      )
        resolveGeometryStyle(document, instance.id)
    }
    validateConnectorBindings(document)
  } catch (error) {
    fail(error.message)
  }
  normalizedDocuments.set(document, limits)
  if (isCertifiedSemanticDocument(input)) {
    normalizedDocuments.set(input, limits)
  }
  return document
}

module.exports = { PptxSemanticValidationError, normalizePptxSemanticDocument }
module.exports.default = module.exports
