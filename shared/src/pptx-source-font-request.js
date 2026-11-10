const { normalizePptxSemanticDocument } = require('./pptx-semantic-document')
const { familyDescriptor, materializeFamilyDocument } = require('./pptx-family-operations')
const { requestTextFonts } = require('./pptx-source-font-request-text')
const { createSmartArtRenderModel } = require('./pptx-smartart-render')
const { smartArtNodeStyle } = require('./pptx-smartart-style')
const { collectOmmlFontRequests, materializeOmmlFrame } = require('./pptx-omml-source-style')
const { requestChartFonts } = require('./pptx-source-font-request-chart')
const { expandTextContext } = require('./pptx-semantic-text-context-codec')
const {
  semanticDefinition,
  semanticStyle,
  semanticInstances,
} = require('./pptx-semantic-records')

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])])
    )
  return value
}
const fontRequestCache = new WeakMap()


function collectSemanticFontRequests(input) {
  if (input && typeof input === 'object' && Object.isFrozen(input) && fontRequestCache.has(input)) {
    return fontRequestCache.get(input)
  }
  const document = normalizePptxSemanticDocument(input)
  const faces = new Map(),
    locations = new Map(),
    issues = [],
    provenance = []
  const issue = (code, source) => issues.push({ code, ...source })
  function add(typeface, bold, italic, source) {
    if (!typeface || typeface.startsWith('+')) {
      issue('source-font-declaration-unresolved', source)
      return
    }
    const key = JSON.stringify([typeface, bold, italic])
    if (!faces.has(key)) {
      if (faces.size >= 256) throw new TypeError('Source font face budget')
      faces.set(key, { typeface, bold, italic })
      locations.set(key, [])
    }
    locations.get(key).push(source)
  }
  const instances = []
  for (const [, instance] of semanticInstances(document)) {
    if (instance && !instance.lineage?.tombstone) {
      instances.push(instance)
    }
  }
  instances.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  for (const instance of instances) {
    const definition = semanticDefinition(document, instance.definitionId)
    if (!definition) continue
    const source = {
      instanceId: instance.id,
      componentId: definition.id,
      part: definition.source?.partUri ?? 'project',
      path: 'content',
    }
    const contextStyle = instance.textSourceBinding?.contextId
      ? semanticStyle(document, instance.textSourceBinding.contextId)
      : undefined
    const payload = contextStyle?.payload
    const context = payload && (payload.schemaVersion === 1 ? payload : expandTextContext(payload, { styles: document.styles }))
    const textOptions = { context, source, add, issue }
    const family = familyDescriptor(definition)
    if (definition.content?.textDocument || family)
      provenance.push({
        instanceId: instance.id,
        definitionId: definition.id,
        source: definition.source,
        contextId: instance.textSourceBinding?.contextId ?? null,
        contextProvenance: context?.provenance ?? [],
      })
    if (definition.content?.textDocument) {
      const original = definition.content.textDocument
      const text = instance.overrides?.components?.[original.componentId]?.textDocument ?? original
      requestTextFonts(text, { ...textOptions, sourceText: original })
    }
    if (!family) continue
    const effective = materializeFamilyDocument(definition, instance)
    const relatedSource = {
      table: null,
      chart: effective.source ?? null,
      smartart: effective.sourceStyles
        ? {
            style: effective.sourceStyles.styleSource,
            colors: effective.sourceStyles.colorSource,
            theme: effective.sourceStyles.themeSource,
          }
        : null,
      omml: definition.content?.mathFrame?.source ?? null,
    }[family[0]]
    provenance.at(-1).familySource = relatedSource
    if (family[0] === 'chart' && context)
      provenance.at(-1).contextRelationships = context.relationships
    if (family[0] === 'table') {
      for (const row of effective.rows)
        for (const cell of row.cells) requestTextFonts(cell.textDocument, textOptions)
    } else if (family[0] === 'chart') {
      requestChartFonts(effective, textOptions)
    } else if (family[0] === 'smartart') {
      try {
        const extent = definition.content?.extent
        if (!extent) throw new TypeError('Source frame extent unavailable')
        // Source label selection uses the actual logical layout, not native
        // physical-unit qualification of its nonzero literal constraints.
        const model = createSmartArtRenderModel(effective, {
          x: 0,
          y: 0,
          width: extent.cx,
          height: extent.cy,
        })
        const nodes = model.nodes.map((node) => ({
          ...node,
          style: smartArtNodeStyle(effective, node),
        }))
        for (const node of nodes)
          if (node.textDocument)
            requestTextFonts(node.textDocument, {
              ...textOptions,
              defaults: node.style.textDefaults,
            })
      } catch (error) {
        issue('source-smartart-font-context-unavailable', {
          ...source,
          ...(error.componentId ? { componentId: error.componentId } : {}),
        })
      }
    } else if (family[0] === 'omml') {
      try {
        for (const font of collectOmmlFontRequests(effective, {
          mathFrame: materializeOmmlFrame(definition.content?.mathFrame, context),
          theme: context?.theme,
        }))
          add(font.fontFamily, font.bold, font.italic, {
            ...source,
            componentId: font.componentId,
            path: font.path.join('.'),
          })
      } catch (error) {
        issue('source-math-font-context-unavailable', {
          ...source,
          ...(error.componentId ? { componentId: error.componentId } : {}),
          ...(error.path ? { path: error.path.join('.') } : {}),
        })
      }
    }
  }
  const requested = [...faces.keys()].sort().map((key, index) => ({
    ...faces.get(key),
    faceId: `source-${index}`,
  }))
  const located = Object.fromEntries(
    [...faces.keys()].sort().map((key, index) => [`source-${index}`, locations.get(key)])
  )
  const payload = stable({
    schemaVersion: 1,
    faces: requested,
    locations: located,
    issues,
    provenance,
  })
  // This exact key is shared by browser/server; hashes are transport identities,
  // never claimed physical font hashes. Exclude geometry, colors, sizes and data.
  const result = { faces: requested, locations: located, issues, identity: JSON.stringify(payload) }
  if (input && typeof input === 'object' && Object.isFrozen(input)) {
    fontRequestCache.set(input, result)
  }
  return result
}
module.exports = { collectSemanticFontRequests }
