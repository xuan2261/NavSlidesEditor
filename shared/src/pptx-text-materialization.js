const {
  cloneTextData,
  normalizeTextDocument,
  TEXT_PROPERTY_SCOPES,
} = require('./pptx-text-document')
const { expandTextContext } = require('./pptx-semantic-text-context-codec')
const { resolveProperties } = require('./pptx-style-resolution')
const { evaluateTextFieldPreviews } = require('./pptx-text-field-preview')
const { resolveGeometryColorPaint } = require('./pptx-geometry-color')
const { findInheritanceOverride } = require('./pptx-inheritance-targets')
const { semanticInstance, semanticDefinition, semanticStyle, semanticStyles } = require('./pptx-semantic-records')

const cache = new WeakMap()
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

function materializeProperties(scope, layers, direct, path, additional = []) {
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
  const properties = resolveProperties({
    scope,
    layers: { ...layers, entries },
    ...(direct.theme ? { theme: direct.theme } : {}),
  })
  for (const property of TEXT_PROPERTY_SCOPES[scope]) {
    const resolved = canonicalResolved(property, properties[property])
    if (resolved !== undefined) result[property] = resolved
  }
  return result
}

function materializeTextDocument(document, instanceId, fieldContext) {
  let byInstance = cache.get(document)
  if (!byInstance) {
    byInstance = new Map()
    cache.set(document, byInstance)
  }
  if (byInstance.has(instanceId)) {
    const materialized = byInstance.get(instanceId)
    return fieldContext ? evaluateTextFieldPreviews(materialized, fieldContext) : materialized
  }
  const instance = semanticInstance(document, instanceId)
  const definition = semanticDefinition(document, instance?.definitionId)
  const sourceText = definition?.content.textDocument
  if (!sourceText) return undefined
  const directOverride = instance.overrides.components?.[sourceText.componentId]?.textDocument
  const ownerInheritanceOverride = findInheritanceOverride(document, instance)
  const sourceRuns = sourceText.paragraphs?.flatMap((p) => p.runs).filter((r) => r.kind === 'text') || []
  const directRuns = directOverride?.paragraphs?.flatMap((p) => p.runs).filter((r) => r.kind === 'text') || []
  const sourceLabel = sourceRuns.length === 1 ? sourceRuns[0].text : null
  const directLabel = directRuns.length === 1 ? directRuns[0].text : null
  const labelLocallyOverridden = Boolean(directOverride && sourceLabel !== null && directLabel !== sourceLabel)

  let effective = directOverride ? cloneTextData(directOverride) : cloneTextData(sourceText)
  if (!labelLocallyOverridden && ownerInheritanceOverride?.values?.label !== undefined) {
    const runs = effective.paragraphs?.flatMap((p) => p.runs).filter((r) => r.kind === 'text')
    if (runs?.length === 1) {
      runs[0].text = ownerInheritanceOverride.values.label
    }
  }

  const payload = semanticStyle(document, instance.textSourceBinding?.contextId)?.payload
  if (!payload) {
    const normalized = normalizeTextDocument(effective)
    byInstance.set(instanceId, normalized)
    return fieldContext ? evaluateTextFieldPreviews(normalized, fieldContext) : normalized
  }
  const context = expandTextContext(payload, { styles: document.styles })
  const theme = textTheme(context.theme, document, payload.resourcesId)
  const result = cloneTextData(effective)

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

  result.body = materializeProperties(
    'body',
    context.body,
    {
      source: sourceText.body ?? {},
      owner: ownerTextStyle,
      local: localDiff(directOverride?.body, sourceText.body),
      theme,
    },
    'body'
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
      `paragraphs[${index}].properties`
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
      ['run']
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
        ['paragraph']
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
        ['paragraph']
      )
    }
  }
  const normalized = normalizeTextDocument(result)
  byInstance.set(instanceId, normalized)
  return fieldContext ? evaluateTextFieldPreviews(normalized, fieldContext) : normalized
}

function materializeTextTheme(document, instanceId) {
  const instance = semanticInstance(document, instanceId)
  const payload = semanticStyle(document, instance?.textSourceBinding?.contextId)?.payload
  if (!payload) return undefined
  const context = expandTextContext(payload, { styles: document.styles })
  return textTheme(context.theme, document, payload.resourcesId)
}

module.exports = { materializeTextDocument, materializeTextTheme }
