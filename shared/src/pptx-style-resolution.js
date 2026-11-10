const {
  cloneTextData,
  normalizeTextProperties,
  TEXT_PROPERTY_SCOPES,
} = require('./pptx-text-document')

// Pre-parsed declarations only. Each entry has {id,kind,source:{part,path},
// properties,placeholder?:{index,type},level?,category?}. levels are zero-based;
// absent level is defPPr, not level 0. target carries the current level/placeholder.
const BODY_ORDER = ['body', 'layoutBody', 'masterBody']
const PARAGRAPH_ORDER = [
  'paragraph',
  'shapeList',
  'layoutParagraph',
  'layoutList',
  'masterParagraph',
  'masterList',
  'masterTextStyle',
  'presentationDefault',
]
const RUN_ORDER = [
  'run',
  'paragraph',
  'shapeList',
  'layoutParagraph',
  'layoutList',
  'masterParagraph',
  'masterList',
  'fontReference',
  'layoutFontReference',
  'masterFontReference',
  'masterTextStyle',
  'presentationDefault',
  'theme',
]
const SCOPE_ORDERS = { body: BODY_ORDER, run: RUN_ORDER, paragraph: PARAGRAPH_ORDER }
const SCOPE_ENVELOPE_PROPERTY = Object.fromEntries(
  Object.entries(TEXT_PROPERTY_SCOPES).map(([scope, names]) => [
    scope,
    names.reduce((longest, name) => name.length > longest.length ? name : longest),
  ])
)
const KINDS = new Set([...BODY_ORDER, ...PARAGRAPH_ORDER, ...RUN_ORDER])
const PH_TYPES = [
  'title',
  'body',
  'ctrTitle',
  'subTitle',
  'dt',
  'sldNum',
  'ftr',
  'hdr',
  'obj',
  'chart',
  'tbl',
  'clipArt',
  'dgm',
  'media',
  'sldImg',
  'pic',
]
const fail = (path) => {
  throw new TypeError(`Invalid PPTX style contract: ${path}`)
}
const string = (v) => typeof v === 'string' && v.length > 0 && v.length <= 1024
const id = (v) => string(v) && v.length <= 256
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max
function record(v, fields, required = []) {
  return (
    v !== null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    required.every((k) => Object.hasOwn(v, k)) &&
    Object.keys(v).every((k) => Object.hasOwn(fields, k) && fields[k](v[k]))
  )
}
const source = (v) => record(v, { part: string, path: string }, ['part', 'path'])
const placeholder = (v) =>
  record(v, {
    index: (n) => integer(n, 0, 4294967295),
    type: (t) => PH_TYPES.includes(t),
  })
const properties = (v) => {
  normalizeTextProperties(v)
  return true
}
const fontSet = (v) =>
  record(v, {
    latin: (s) => typeof s === 'string' && s.length <= 1024,
    eastAsian: (s) => typeof s === 'string' && s.length <= 1024,
    complexScript: (s) => typeof s === 'string' && s.length <= 1024,
    scripts: (s) =>
      s &&
      typeof s === 'object' &&
      !Array.isArray(s) &&
      Object.entries(s).every(
        ([key, face]) => /^[A-Z][a-z]{3}$/.test(key) && string(face) && !face.startsWith('+')
      ),
  })
function validate(input) {
  if (
    !record(
      input,
      {
        property: string,
        scope: (s) => Object.hasOwn(TEXT_PROPERTY_SCOPES, s),
        layers: (v) =>
          record(
            v,
            {
              target: (t) => record(t, { level: (n) => integer(n, 0, 8), placeholder }),
              entries: (e) => Array.isArray(e) && e.length <= 4096,
            },
            ['target', 'entries']
          ),
        theme: (t) =>
          record(
            t,
            {
              id,
              source,
              colors: (c) =>
                c &&
                typeof c === 'object' &&
                !Array.isArray(c) &&
                Object.entries(c).every(
                  ([k, v]) =>
                    /^(dk[12]|lt[12]|accent[1-6]|hlink|folHlink)$/.test(k) &&
                    typeof v === 'string' &&
                    /^[\da-fA-F]{6}$/.test(v)
                ),
              colorAlpha: (c) =>
                c && typeof c === 'object' && !Array.isArray(c) &&
                Object.entries(c).every(([k, v]) =>
                  /^(dk[12]|lt[12]|accent[1-6]|hlink|folHlink)$/.test(k) &&
                  Number.isFinite(v) && v >= 0 && v <= 1
                ),
              colorMap: (m) =>
                m &&
                typeof m === 'object' &&
                !Array.isArray(m) &&
                Object.entries(m).every(
                  ([k, v]) =>
                    /^(bg[12]|tx[12]|accent[1-6]|hlink|folHlink)$/.test(k) &&
                    /^(dk[12]|lt[12]|accent[1-6]|hlink|folHlink)$/.test(v)
                ),
              fonts: (f) => record(f, { major: fontSet, minor: fontSet }),
            },
            ['id', 'source']
          ),
      },
      ['property', 'layers']
    )
  )
    fail('input')
  const ids = new Set()
  for (const entry of input.layers.entries) {
    if (
      !record(
        entry,
        {
          id,
          kind: (v) => KINDS.has(v),
          source,
          properties,
          placeholder,
          level: (n) => integer(n, 0, 8),
          category: (v) => ['title', 'body', 'other'].includes(v),
        },
        ['id', 'kind', 'source', 'properties']
      ) ||
      ids.has(entry.id)
    )
      fail('layer or duplicate ID')
    ids.add(entry.id)
  }
  if (input.theme && ids.has(input.theme.id)) fail('duplicate theme ID')
}
function applies(entry, target, property, order, masterType) {
  if (!order.includes(entry.kind)) return false
  if (
    (entry.kind.endsWith('FontReference') ||
      entry.kind === 'fontReference' ||
      entry.kind === 'theme') &&
    !['fontLatin', 'fontEastAsian', 'fontComplexScript', 'color'].includes(property)
  )
    return false
  if (entry.kind.startsWith('layout')) {
    if (
      !target.placeholder ||
      !entry.placeholder ||
      (entry.placeholder.index ?? 0) !== (target.placeholder.index ?? 0)
    )
      return false
  } else if (entry.kind.startsWith('master') && entry.kind !== 'masterTextStyle') {
    if (!target.placeholder || !entry.placeholder) return false
    const type = masterType,
      candidate = entry.placeholder.type ?? 'obj'
    if (type !== candidate && !(type === 'obj' && candidate === 'body')) return false
  }
  if (entry.kind === 'masterTextStyle') {
    if (!target.placeholder) return false
    const type = masterType
    const category = ['title', 'ctrTitle', 'subTitle'].includes(type)
      ? 'title'
      : ['obj', 'body'].includes(type)
        ? 'body'
        : 'other'
    if (entry.category !== category) return false
  }
  if (entry.kind === 'presentationDefault' && order === RUN_ORDER && target.placeholder)
    return false
  return entry.level === undefined || entry.level === (target.level ?? 0)
}
const clamp = (v) => Math.max(0, Math.min(1, v))
function luminance(rgb, transform) {
  const max = Math.max(...rgb),
    min = Math.min(...rgb),
    delta = max - min
  const light = (max + min) / 2
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1))
  const hue =
    delta === 0
      ? 0
      : max === rgb[0]
        ? ((rgb[1] - rgb[2]) / delta + 6) % 6
        : max === rgb[1]
          ? (rgb[2] - rgb[0]) / delta + 2
          : (rgb[0] - rgb[1]) / delta + 4
  const next = clamp(
    transform.kind === 'lumMod'
      ? (light * transform.value) / 100000
      : light + transform.value / 100000
  )
  const chroma = (1 - Math.abs(2 * next - 1)) * saturation
  const x = chroma * (1 - Math.abs((hue % 2) - 1))
  return [
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x],
  ][Math.floor(hue)].map((channel) => channel + next - chroma / 2)
}
// ISO/IEC 29500-1 20.1.2.3: tint retains val of input plus (1-val) white;
// shade retains val of input. Preserve order and round only at the output.
const toLinearRgb = (channel) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
const fromLinearRgb = (channel) =>
  channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055
function resolveColor(value, theme, dependencies, linearTintShade = false) {
  let hex = value.value, alpha = 1
  // Reuse the DrawingML preset vocabulary/RGB authority, then apply the same
  // ordered text transforms as sRGB and theme colors. Source remains typed.
  if (value.kind === 'preset')
    hex = require('./pptx-geometry-color').resolveGeometryColorPaint({ kind: 'preset', value: value.value }).rgb
  if (value.kind === 'scheme') {
    if (theme) dependencies.push(theme.id)
    const slot = theme?.colorMap?.[value.value] ?? value.value
    hex = theme?.colors?.[slot]
    if (!hex) return { value: null, reason: 'missing-theme-color' }
    alpha = theme.colorAlpha?.[slot] ?? 1
  }
  let rgb = hex.match(/../g).map((channel) => parseInt(channel, 16) / 255)
  for (const transform of value.transforms ?? []) {
    const amount = transform.value / 100000
    if (transform.kind === 'tint' || transform.kind === 'shade') {
      rgb = rgb.map((channel) => {
        const input = linearTintShade ? toLinearRgb(channel) : channel
        const output = transform.kind === 'tint' ? input * amount + 1 - amount : input * amount
        return linearTintShade ? fromLinearRgb(clamp(output)) : output
      })
    } else if (transform.kind === 'lumMod' || transform.kind === 'lumOff')
      rgb = luminance(rgb, transform)
    else if (transform.kind === 'alpha') alpha = amount
    else if (transform.kind === 'alphaMod') alpha = clamp(alpha * amount)
    else if (transform.kind === 'alphaOff') alpha = clamp(alpha + amount)
  }
  return {
    value: {
      rgb: rgb
        .map((c) =>
          Math.round(clamp(c) * 255)
            .toString(16)
            .padStart(2, '0')
        )
        .join('')
        .toUpperCase(),
      alpha,
    },
    reason: null,
  }
}
function resolveFontTypeface(value, theme, dependencies = []) {
  if (!value.typeface.startsWith('+')) return { value: value.typeface, reason: null }
  const token = /^\+(mj|mn)-(lt|ea|cs)$/.exec(value.typeface)
  if (!token) return { value: null, reason: 'unsupported-theme-font-token' }
  if (theme) dependencies.push(theme.id)
  const family = theme?.fonts?.[token[1] === 'mj' ? 'major' : 'minor']
  const face =
    (value.script ? family?.scripts?.[value.script] : null) ||
    family?.[{ lt: 'latin', ea: 'eastAsian', cs: 'complexScript' }[token[2]]]
  return face && !face.startsWith('+')
    ? { value: face, reason: null }
    : { value: null, reason: 'missing-theme-font' }
}
function resolveValue(property, value, theme, dependencies) {
  if (property === 'highlight')
    return value.kind === 'none' ? { value: { kind: 'none' }, reason: null } : resolveColor(value, theme, dependencies)
  if (['bulletFont', 'bulletColor', 'bulletSize'].includes(property) && value === 'text')
    return { value: null, reason: 'requires-bullet-run-style' }
  if (['color', 'bulletColor'].includes(property) && value !== 'text')
    return resolveColor(value, theme, dependencies)
  if (['fontLatin', 'fontEastAsian', 'fontComplexScript', 'bulletFont'].includes(property))
    return resolveFontTypeface(value, theme, dependencies)
  if (property === 'outline' && value?.color && value.color.kind !== 'none') {
    const colorRes = resolveColor(value.color, theme, dependencies)
    if (colorRes.value) {
      const alpha = Math.round(colorRes.value.alpha * 100000)
      const res = cloneTextData(value)
      res.color = {
        kind: 'srgb',
        value: colorRes.value.rgb,
        ...(alpha === 100000 ? {} : { transforms: [{ kind: 'alpha', value: alpha }] }),
      }
      return { value: res, reason: null }
    }
    return colorRes
  }
  return { value: cloneTextData(value), reason: null }
}
function propertyOrder(property, scope) {
  const scopes = Object.keys(TEXT_PROPERTY_SCOPES).filter((s) =>
    TEXT_PROPERTY_SCOPES[s].includes(property)
  )
  if (scope ? !scopes.includes(scope) : scopes.length !== 1)
    fail('unsupported or ambiguous property scope')
  return SCOPE_ORDERS[scope ?? scopes[0]]
}
function resolutionContext(layers) {
  const layout = layers.entries.filter(
    (e) =>
      e.kind.startsWith('layout') &&
      layers.target.placeholder &&
      e.placeholder &&
      (e.placeholder.index ?? 0) === (layers.target.placeholder.index ?? 0)
  )
  const types = new Set(layout.map((e) => e.placeholder.type ?? 'obj'))
  if (types.size > 1) fail('conflicting layout placeholder types')
  const masterType =
    layout[0]?.placeholder.type ??
    (layout.length ? 'obj' : (layers.target.placeholder?.type ?? 'obj'))
  return { layout, masterType }
}
function resolvePropertyCore(property, { layers, theme }, order, { layout, masterType }) {
  const candidates = layers.entries
    .filter((e) => applies(e, layers.target, property, order, masterType))
    .map((entry) => ({
      entry,
      rank: order.indexOf(entry.kind) * 2 + (entry.level === undefined ? 1 : 0),
    }))
    .sort((a, b) => a.rank - b.rank || a.entry.id.localeCompare(b.entry.id, 'en'))
  const result = {
    property,
    authored: null,
    resolved: null,
    source: null,
    dependencyIds: [],
    unsupportedReason: 'property-not-defined',
  }
  for (let index = 0; index < candidates.length;) {
    const rank = candidates[index].rank,
      group = []
    while (index < candidates.length && candidates[index].rank === rank)
      group.push(candidates[index++].entry)
    const dependencies = group[0].kind.startsWith('master') ? [...layout, ...group] : group
    for (const entry of dependencies)
      if (!result.dependencyIds.includes(entry.id)) result.dependencyIds.push(entry.id)
    const declarations = group.filter((entry) => Object.hasOwn(entry.properties, property))
    if (declarations.length > 1) {
      result.unsupportedReason = 'ambiguous-style-source'
      return result
    }
    if (!declarations.length) continue
    const winner = declarations[0]
    result.authored = winner.properties[property]
    result.source = {
      layerId: winner.id,
      kind: winner.kind,
      part: winner.source.part,
      path: winner.source.path,
    }
    const resolved = resolveValue(property, result.authored, theme, result.dependencyIds)
    result.resolved = resolved.value
    result.unsupportedReason = resolved.reason
    return result
  }
  return result
}
/**
 * Resolve one property, never merge style objects. Missing is null in this
 * result only; authored false, zero and empty tab lists remain declarations.
 * dependencyIds includes inspected eligible layers, then any referenced theme.
 * source is the winning declaration location, not an export authority grant.
 * scope is required for properties shared by scopes (currently direction).
 * Layout entries carry the matched placeholder type even with empty properties.
 */
function resolveProperty(input) {
  const data = cloneTextData(input)
  validate(data)
  const order = propertyOrder(data.property, data.scope)
  return resolvePropertyCore(data.property, data, order, resolutionContext(data.layers))
}
/**
 * Resolve every property in one explicit scope with one invocation-owned clone
 * and full declaration validation. Results have the same contract as individual
 * resolveProperty calls, with no retained caller data or cross-call cache.
 */
function resolveProperties(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.getPrototypeOf(input) !== Object.prototype || Object.hasOwn(input, 'property'))
    fail('input')
  const scope = Object.getOwnPropertyDescriptor(input, 'scope')
  if (!scope?.enumerable || !Object.hasOwn(scope, 'value') ||
      typeof scope.value !== 'string' || !Object.hasOwn(TEXT_PROPERTY_SCOPES, scope.value))
    fail('input')
  // Preserve every descriptor for cloneTextData to reject unsafe JSON without
  // invoking accessors. The longest property recreates the strictest original
  // single-property envelope's node/depth/byte budget; batching never widens it.
  const envelope = Object.defineProperties(
    { property: SCOPE_ENVELOPE_PROPERTY[scope.value] },
    Object.getOwnPropertyDescriptors(input)
  )
  const data = cloneTextData(envelope)
  validate(data)
  const context = resolutionContext(data.layers)
  const results = {}
  for (const property of TEXT_PROPERTY_SCOPES[data.scope])
    results[property] = resolvePropertyCore(property, data, propertyOrder(property, data.scope), context)
  return results
}
function resolveRgbPaint(input) {
  const color = normalizeTextProperties({ color: input }, 'run').color
  if (color.kind !== 'srgb') fail('RGB paint requires a resolved source color')
  // Shape-paint native references establish linear RGB tint/shade. The
  // existing text property contract retains its previously tested mode.
  return resolveColor(color, undefined, [], true).value
}
module.exports = { resolveProperty, resolveProperties, resolveRgbPaint, resolveFontTypeface }
