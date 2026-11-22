const {
  cloneTextData,
  cloneOwnedTextData,
  normalizeOwnedTextDocument,
  TEXT_PROPERTY_SCOPES,
} = require('./pptx-text-document')
const { expandTextContext } = require('./pptx-semantic-text-context-codec')
const { resolveProperties } = require('./pptx-style-resolution')
const { evaluateTextFieldPreviews } = require('./pptx-text-field-preview')
const { resolveGeometryColorPaint } = require('./pptx-geometry-color')
const { findInheritanceOverride } = require('./pptx-inheritance-targets')
const {
  semanticInstance, semanticDefinition, semanticStyle, semanticStyles,
  isCertifiedSemanticDocument, CATALOGS,
} = require('./pptx-semantic-records')

// An occurrence survives edits to other occurrences. Its text does not depend
// on the instances dictionary, but does depend on every source/style catalog
// used by semantic decoding and inherited text/theme resolution.
// Cache only owned results; recursively protect nested values from consumers.
function freezeOwnedResult(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value
  seen.add(value)
  for (const child of Object.values(value)) freezeOwnedResult(child, seen)
  return Object.freeze(value)
}
const cache = new WeakMap()
const DEPENDENCIES = ['schemaVersion', 'definitions', 'styles', ...CATALOGS]
function cachedOccurrence(document, instance) {
  if (!instance || !isCertifiedSemanticDocument(document)) return undefined
  const cached = cache.get(instance)
  return cached && DEPENDENCIES.every((key, index) => document[key] === cached.dependencies[index])
    ? cached : undefined
}
function cacheOccurrence(document, instance, value) {
  if (instance && isCertifiedSemanticDocument(document)) {
    freezeOwnedResult(value)
    cache.set(instance, { dependencies: DEPENDENCIES.map((key) => document[key]), ...value })
  }
}
const DIRECT_KIND = Object.freeze({ body: 'body', paragraph: 'paragraph', run: 'run' })

function source(path) {
  return { part: 'pptx-occurrence', path }
}

function canonicalResolved(property, result) {
  if (['outline', 'highlight'].includes(property) && result.authored !== null && result.resolved === null)
    throw new TypeError(`Unresolved text ${property}: ${result.unsupportedReason}`)
  if (result.resolved === null) return undefined
  if (['fontLatin', 'fontEastAsian', 'fontComplexScript', 'bulletFont'].includes(property)) {
    if (result.resolved === 'text') return 'text'
    return {
      ...(result.authored && typeof result.authored === 'object' ? result.authored : {}),
      typeface: result.resolved,
    }
  }
  if (property === 'highlight' && result.resolved.kind === 'none') return { kind: 'none' }
  if (['color', 'bulletColor', 'highlight'].includes(property)) {
    if (result.resolved === 'text') return 'text'
    const alpha = Math.round(result.resolved.alpha * 100000)
    return {
      kind: 'srgb',
      value: result.resolved.rgb,
      ...(alpha === 100000 ? {} : { transforms: [{ kind: 'alpha', value: alpha }] }),
    }
  }
  return cloneTextData(result.resolved)
}

function textTheme(theme, document, resourcesId) {
  if (typeof theme === 'string')
    theme = semanticStyle(document, resourcesId)?.payload.records[theme]?.value
  let override
  for (const [, style] of semanticStyles(document, { kind: 'theme-override' })) {
    const base = semanticStyle(document, style.baseStyleId)
    if (base?.kind === 'theme' && base.source.partUri === theme.source.part) {
      override = style
      break
    }
  }
  if (!override || !Object.keys(override.values.colors ?? {}).length) return theme
  const colors = { ...theme.colors }, colorAlpha = { ...theme.colorAlpha }
  for (const [slot, value] of Object.entries(override.values.colors)) {
    const paint = resolveGeometryColorPaint(value)
    colors[slot] = paint.rgb
    if (paint.alpha === 1) delete colorAlpha[slot]
    else colorAlpha[slot] = paint.alpha
  }
  return { ...theme, colors, ...(Object.keys(colorAlpha).length ? { colorAlpha } : {}) }
}

function materializeProperties(scope, layers, direct, path, additional = [], compositions) {
  const ownerScoped = direct.owner
    ? Object.fromEntries(Object.entries(direct.owner).filter(([k]) => TEXT_PROPERTY_SCOPES[scope].includes(k)))
    : undefined
  const localScoped = direct.local
    ? Object.fromEntries(Object.entries(direct.local).filter(([k]) => TEXT_PROPERTY_SCOPES[scope].includes(k)))
    : undefined
  const sourceScoped = direct.source
    ? Object.fromEntries(Object.entries(direct.source).filter(([k]) => TEXT_PROPERTY_SCOPES[scope].includes(k)))
    : undefined
  const own = { ...sourceScoped, ...ownerScoped, ...localScoped }
  if (!layers) return cloneTextData(own ?? {})
  const kind = DIRECT_KIND[scope]
  const entries = layers.entries.filter((entry) => entry.kind !== kind && !additional.includes(entry.kind))
  for (const entry of additional) {
    const properties = entry === 'paragraph' ? direct.paragraph : direct.run
    if (properties && Object.keys(properties).length)
      entries.push({
        id: `effective-${entry}`,
        kind: entry,
        source: source(path),
        properties,
      })
  }
  if (own && Object.keys(own).length)
    entries.unshift({ id: `effective-${kind}`, kind, source: source(path), properties: own })
  const result = {}
  // Invocation-local canonical tuples: full expanded source/decode context is
  // fixed for this materialization. Keep the complete value key: layers, target,
  // generated source paths, scoped source/owner/local declarations, paragraph
  // defaults and theme are not all owned identities. Raw identity shortcuts
  // would hide mutable children or conflate provenance across occurrences.
  const tuple = { layers: { ...layers, entries }, ...(direct.theme ? { theme: direct.theme } : {}) }
  const key = JSON.stringify(tuple)
  let admitted = compositions.get(key)
  if (!admitted) {
    admitted = cloneOwnedTextData(tuple)
    compositions.set(key, admitted)
  }
  const properties = resolveProperties({ scope, ...admitted })
  for (const property of TEXT_PROPERTY_SCOPES[scope]) {
    const resolved = canonicalResolved(property, properties[property])
    if (resolved !== undefined) result[property] = resolved
  }
  return result
}

function materializeTextDocument(document, instanceId, fieldContext) {
  const instance = semanticInstance(document, instanceId)
  const cached = cachedOccurrence(document, instance)
  if (cached && Object.hasOwn(cached, 'text')) {
    if (cached.text === undefined) return undefined
    return fieldContext ? evaluateTextFieldPreviews(cached.text, fieldContext) : cached.text
  }
  const definition = semanticDefinition(document, instance?.definitionId)
  const sourceText = definition?.content.textDocument
  if (!sourceText) {
    cacheOccurrence(document, instance, { ...cached, text: undefined })
    return undefined
  }
  const directOverride = instance.overrides.components?.[sourceText.componentId]?.textDocument
  const ownerInheritanceOverride = findInheritanceOverride(document, instance)
  const sourceRuns = sourceText.paragraphs?.flatMap((p) => p.runs).filter((r) => r.kind === 'text') || []
  const directRuns = directOverride?.paragraphs?.flatMap((p) => p.runs).filter((r) => r.kind === 'text') || []
  const sourceLabel = sourceRuns.length === 1 ? sourceRuns[0].text : null
  const directLabel = directRuns.length === 1 ? directRuns[0].text : null
  const labelLocallyOverridden = Boolean(directOverride && sourceLabel !== null && directLabel !== sourceLabel)

  let effective = normalizeOwnedTextDocument(directOverride ?? sourceText)
  let working
  const mutableText = () => working ??= cloneTextData(effective)
  if (!labelLocallyOverridden && ownerInheritanceOverride?.values?.label !== undefined) {
    const runs = effective.paragraphs?.flatMap((p) => p.runs).filter((r) => r.kind === 'text')
    if (runs?.length === 1) {
      const mutableRuns = mutableText().paragraphs.flatMap((p) => p.runs).filter((r) => r.kind === 'text')
      mutableRuns[0].text = ownerInheritanceOverride.values.label
    }
  }

  const payload = semanticStyle(document, instance.textSourceBinding?.contextId)?.payload
  if (!payload) {
    const normalized = working ? normalizeOwnedTextDocument(working) : effective
    cacheOccurrence(document, instance, { ...cached, text: normalized })
    return fieldContext ? evaluateTextFieldPreviews(normalized, fieldContext) : normalized
  }
  const context = expandTextContext(payload, { styles: document.styles })
  const theme = textTheme(context.theme, document, payload.resourcesId)
  const result = mutableText()

  function localDiff(directObj = {}, sourceObj = {}) {
    if (!directOverride) return {}
    const diff = {}
    for (const [key, val] of Object.entries(directObj || {})) {
      if (val !== undefined && JSON.stringify(val) !== JSON.stringify(sourceObj?.[key])) {
        diff[key] = val
      }
    }
    return diff
  }

  const ownerTextStyle = ownerInheritanceOverride?.values?.textStyle
  const compositions = new Map()

  result.body = materializeProperties(
    'body',
    context.body,
    {
      source: sourceText.body ?? {},
      owner: ownerTextStyle,
      local: localDiff(directOverride?.body, sourceText.body),
      theme,
    },
    'body', [], compositions
  )

  const sourceParagraphs = new Map(
    sourceText.paragraphs.map((paragraph, index) => [paragraph.componentId, { paragraph, index }])
  )
  const directParagraphs = new Map(
    (directOverride?.paragraphs || []).map((paragraph, index) => [paragraph.componentId, { paragraph, index }])
  )

  for (const [index, paragraph] of result.paragraphs.entries()) {
    const sourceParaInfo = sourceParagraphs.get(paragraph.componentId)
    const sourcePara = sourceParaInfo?.paragraph
    const directPara = directParagraphs.get(paragraph.componentId)?.paragraph ?? directOverride?.paragraphs?.[index]
    const inherited = sourceParaInfo && context.paragraphs[sourceParaInfo.index]
    if (!inherited) continue

    paragraph.properties = materializeProperties(
      'paragraph',
      inherited.paragraph,
      {
        source: sourcePara?.properties ?? {},
        owner: ownerTextStyle,
        local: localDiff(directPara?.properties, sourcePara?.properties),
        theme,
      },
      `paragraphs[${index}].properties`, [], compositions
    )

    paragraph.defaultRunProperties = materializeProperties(
      'run',
      inherited.run,
      {
        source: sourcePara?.defaultRunProperties ?? {},
        owner: ownerTextStyle,
        local: localDiff(directPara?.defaultRunProperties, sourcePara?.defaultRunProperties),
        theme,
      },
      `paragraphs[${index}].defaultRunProperties`,
      ['run'], compositions
    )

    const sourceRunsMap = new Map(
      (sourcePara?.runs || []).map((run, sourceIndex) => [run.componentId, { run, sourceIndex }])
    )
    const directRunsMap = new Map(
      (directPara?.runs || []).map((run) => [run.componentId, run])
    )

    for (const [runIndex, run] of paragraph.runs.entries()) {
      const sourceRunInfo = sourceRunsMap.get(run.componentId)
      const directRun = directRunsMap.get(run.componentId) ?? directPara?.runs?.[runIndex]
      const sourceIndex = sourceRunInfo?.sourceIndex
      const layers =
        sourceIndex === undefined ? inherited.run : inherited.runs[sourceIndex]?.layers ?? inherited.run

      run.properties = materializeProperties(
        'run',
        layers,
        {
          source: sourceRunInfo?.run?.properties ?? {},
          owner: ownerTextStyle,
          local: localDiff(directRun?.properties, sourceRunInfo?.run?.properties),
          paragraph: paragraph.defaultRunProperties,
          theme,
        },
        `paragraphs[${index}].runs[${runIndex}].properties`,
        ['paragraph'], compositions
      )
    }

    if (paragraph.endRunProperties) {
      paragraph.endRunProperties = materializeProperties(
        'run',
        inherited.run,
        {
          source: sourcePara?.endRunProperties ?? {},
          owner: ownerTextStyle,
          local: localDiff(directPara?.endRunProperties, sourcePara?.endRunProperties),
          paragraph: paragraph.defaultRunProperties,
          theme,
        },
        `paragraphs[${index}].endRunProperties`,
        ['paragraph'], compositions
      )
    }
  }
  // Changed declarations/text must earn fresh schema proof, never source proof.
  const normalized = normalizeOwnedTextDocument(result)
  cacheOccurrence(document, instance, { ...cached, text: normalized, theme })
  return fieldContext ? evaluateTextFieldPreviews(normalized, fieldContext) : normalized
}

function materializeTextTheme(document, instanceId) {
  const instance = semanticInstance(document, instanceId)
  const cached = cachedOccurrence(document, instance)
  if (cached && Object.hasOwn(cached, 'theme')) return cached.theme
  const payload = semanticStyle(document, instance?.textSourceBinding?.contextId)?.payload
  if (!payload) return undefined
  const context = expandTextContext(payload, { styles: document.styles })
  const theme = textTheme(context.theme, document, payload.resourcesId)
  cacheOccurrence(document, instance, { ...cached, theme })
  return theme
}

module.exports = { materializeTextDocument, materializeTextTheme }
