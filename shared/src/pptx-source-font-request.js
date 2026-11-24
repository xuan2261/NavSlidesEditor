const { normalizePptxSemanticDocument } = require('./pptx-semantic-document')
const { familyDescriptor, materializeFamilyDocument } = require('./pptx-family-operations')
const { requestTextFonts } = require('./pptx-source-font-request-text')
const { createSmartArtRenderModel } = require('./pptx-smartart-render')
const { smartArtNodeStyle } = require('./pptx-smartart-style')
const { collectOmmlFontRequests, materializeOmmlFrame } = require('./pptx-omml-source-style')
const { requestChartFonts } = require('./pptx-source-font-request-chart')
const { expandTextContext } = require('./pptx-semantic-text-context-codec')
const { resolveProperty, resolveProperties } = require('./pptx-style-resolution')
// Cache only owned results; recursively protect nested values from consumers.
function freezeOwnedResult(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value
  seen.add(value)
  for (const child of Object.values(value)) freezeOwnedResult(child, seen)
  return Object.freeze(value)
}
const {
  semanticDefinition,
  semanticStyle,
  semanticInstances,
  CATALOGS,
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
const occurrenceRequests = new WeakMap()
const occurrenceDependencies = ['schemaVersion', 'definitions', 'styles', 'fonts', ...CATALOGS]
// One bounded composition, never a raw-document identity shortcut. A changed
// occurrence can retain its part only after comparing its COMPLETE extracted
// output, including diagnostics and provenance (not just face signatures).
let lastComposition
function sameOutput(left, right) {
  if (Object.is(left, right)) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' ||
      Array.isArray(left) !== Array.isArray(right)) return false
  const keys = Object.keys(left)
  const otherKeys = Object.keys(right)
  return keys.length === otherKeys.length && keys.every((key, index) =>
    key === otherKeys[index] && sameOutput(left[key], right[key]))
}
// Expanded contexts can resolve declarations, themes and receipts through styles.
// Keep them local to one collection, never keyed globally by a shared payload.
function getExpandedTextContext(payload, styles, expandedContextCache) {
  if (!payload) return null
  if (payload.schemaVersion === 1) return payload
  let cached = expandedContextCache.get(payload)
  if (!cached) {
    cached = expandTextContext(payload, { styles })
    expandedContextCache.set(payload, cached)
  }
  return cached
}

// Only used after semantic normalization. Themes come from that immutable
// document (including expanded shared-resource contexts); synthesized layers
// are keyed by their complete JSON value, never by mutable wrapper identity.
// Keep the exact envelope, including source paths, so a cache hit cannot bypass
// a different validation budget or reuse another declaration's diagnostics.
function createFontStyleResolver() {
  const themes = new WeakMap()
  const unthemed = new Map()
  return (input, all = false) => {
    const { theme, ...envelope } = input
    let cache = unthemed
    if (theme) {
      cache = themes.get(theme)
      if (!cache) { cache = new Map(); themes.set(theme, cache) }
    }
    const key = JSON.stringify([all, Object.hasOwn(input, 'theme'), envelope])
    if (!cache.has(key)) cache.set(key, (all ? resolveProperties : resolveProperty)(input))
    return cache.get(key)
  }
}

function extractInstanceFontDeclarations(document, instance, expandedContextCache, resolveStyle) {
  const contextId = instance.textSourceBinding?.contextId
  const contextStyle = contextId
    ? (semanticStyle(document, contextId) ?? document.styles?.[contextId])
    : undefined
  const definition =
    semanticDefinition(document, instance.definitionId) ??
    document.definitions?.[instance.definitionId]
  if (!definition) return null

  const faces = []
  const issues = []
  const issue = (code, source) => issues.push({ code, ...source })
  function add(typeface, bold, italic, source) {
    if (!typeface || typeface.startsWith('+')) {
      issue('source-font-declaration-unresolved', source)
      return
    }
    faces.push({ typeface, bold, italic, source })
  }

  const source = {
    instanceId: instance.id,
    componentId: definition.id,
    part: definition.source?.partUri ?? 'project',
    path: 'content',
  }
  const payload = contextStyle?.payload
  const context = getExpandedTextContext(payload, document.styles, expandedContextCache)
  const textOptions = { context, source, add, issue, resolveStyle }
  const family = familyDescriptor(definition)
  let prov = null
  if (definition.content?.textDocument || family) {
    prov = {
      instanceId: instance.id,
      definitionId: definition.id,
      source: definition.source,
      contextId: contextId ?? null,
      contextProvenance: context?.provenance ?? [],
    }
  }
  if (definition.content?.textDocument) {
    const original = definition.content.textDocument
    const text = instance.overrides?.components?.[original.componentId]?.textDocument ?? original
    requestTextFonts(text, { ...textOptions, sourceText: original })
  }
  if (family) {
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
    if (prov) {
      prov.familySource = relatedSource
      if (family[0] === 'chart' && context) {
        prov.contextRelationships = context.relationships
      }
    }
    if (family[0] === 'table') {
      for (const row of effective.rows)
        for (const cell of row.cells) requestTextFonts(cell.textDocument, textOptions)
    } else if (family[0] === 'chart') {
      requestChartFonts(effective, textOptions)
    } else if (family[0] === 'smartart') {
      try {
        const extent = definition.content?.extent
        if (!extent) throw new TypeError('Source frame extent unavailable')
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

  return { faces, issues, prov }
}

function collectSemanticFontRequests(input) {
  // Normalize before consulting the cache: Object.freeze(input) alone does not
  // make nested declarations immutable or establish successful validation.
  const document = normalizePptxSemanticDocument(input)
  const cached = fontRequestCache.get(document)
  if (cached) return cached
  const expandedContextCache = new WeakMap()
  const resolveStyle = createFontStyleResolver()

  const instances = []
  for (const [, instance] of semanticInstances(document)) {
    if (instance && !instance.lineage?.tombstone) {
      instances.push(instance)
    }
  }
  instances.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  const dependencies = occurrenceDependencies.map(key => document[key])
  const previous = lastComposition && dependencies.every((value, index) =>
    value === lastComposition.dependencies[index]) ? lastComposition : null
  const previousParts = previous && new Map(previous.parts.map(part => [part.id, part]))
  const parts = instances.map(instance => {
    const prior = occurrenceRequests.get(instance)
    const reusable = prior && dependencies.every((value, index) =>
      value === prior.dependencies[index])
    let data = reusable ? prior.data
      : extractInstanceFontDeclarations(document, instance, expandedContextCache, resolveStyle)
    const previousPart = previousParts?.get(instance.id)
    if (previousPart && sameOutput(data, previousPart.data)) data = previousPart.data
    if (!reusable) occurrenceRequests.set(instance, { dependencies, data })
    return previousPart && data === previousPart.data ? previousPart : { id: instance.id, data }
  })
  // Membership AND order must match, including occurrences producing no fonts.
  // Normalization/validation and dependency checks have already run above.
  if (previous && parts.length === previous.parts.length &&
      parts.every((part, index) => part === previous.parts[index])) {
    fontRequestCache.set(document, previous.result)
    return previous.result
  }

  const faces = new Map(),
    locations = new Map(),
    issues = [],
    provenance = []

  for (const { data } of parts) {
    if (!data) continue
    if (data.prov) provenance.push(data.prov)
    for (const issue of data.issues) issues.push(issue)
    for (const item of data.faces) {
      const key = JSON.stringify([item.typeface, item.bold, item.italic])
      if (!faces.has(key)) {
        if (faces.size >= 256) throw new TypeError('Source font face budget')
        faces.set(key, { typeface: item.typeface, bold: item.bold, italic: item.italic })
        locations.set(key, [])
      }
      locations.get(key).push(item.source)
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
  const result = { faces: requested, locations: located, issues, identity: JSON.stringify(payload) }

  // Normalization owns the deeply immutable document. Its identity covers all
  // definitions, styles, resources and schema-3 catalogs used by this result.
  freezeOwnedResult(result)
  fontRequestCache.set(document, result)
  lastComposition = { dependencies, parts, result }
  return result
}
// Normalization is mandatory even for a peek: raw mutable inputs never acquire
// an identity receipt, and certification alone does not establish validation.
function readCachedSemanticFontRequests(input) {
  return fontRequestCache.get(normalizePptxSemanticDocument(input))
}
module.exports = { collectSemanticFontRequests, readCachedSemanticFontRequests }
