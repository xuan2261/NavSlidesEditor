const { nativeSourceContext, child, value, decoded, body } = require('./ooxml-native-text-style-source')
const { textContent, P_URIS, A_URIS, isNode } = require('./ooxml-text-run-xml')
const { normalizeFontFamily } = require('./mapper/utils-text')
const { correctNativeHtml } = require('./ooxml-native-text-style-html')
const { nativeTheme } = require('./ooxml-native-text-style-theme')
const { nativeParagraphLayout } = require('./ooxml-native-text-style-paragraph')

function listStyles(list, level) { return [child(list, `lvl${level}pPr`), child(list, 'defPPr')].filter(Boolean) }
function shapeStyles(shape, level) {
  const txBody = body(shape)
  const paragraphs = txBody?.children.filter((node) => isNode(node, A_URIS, 'p')) || []
  return [...(paragraphs.length === 1 ? [child(paragraphs[0], 'pPr')] : []),
    ...listStyles(child(txBody, 'lstStyle'), level)].filter(Boolean)
}
function paragraphStyles(context, paragraph, defaults) {
  const pPr = child(paragraph, 'pPr')
  const level = Number(value(pPr, 'lvl') ?? 0) + 1
  const base = [pPr, ...listStyles(child(context.body, 'lstStyle'), level),
    ...shapeStyles(context.layoutShape, level), ...shapeStyles(context.masterShape, level)].filter(Boolean)
  const tail = []
  if (context.ph) {
    const type = value(context.ph, 'type') || 'obj'
    const styles = child(context.master?.children[0], 'txStyles', P_URIS)
    const category = /^(title|ctrTitle|subTitle)$/u.test(type) ? 'titleStyle'
      : /^(body|obj)$/u.test(type) ? 'bodyStyle' : 'otherStyle'
    tail.push(...listStyles(child(styles, category, P_URIS), level))
    if (type === 'subTitle') tail.push(...listStyles(child(styles, 'bodyStyle', P_URIS), level))
  }
  return { base, tail, defaults: listStyles(defaults, level) }
}
function fontRefs(context) {
  return [context.shape, context.layoutShape, context.masterShape]
    .map((shape) => child(child(shape, 'style', P_URIS), 'fontRef')).filter(Boolean)
}
function face(node, theme) {
  const latin = child(node, 'latin')
  if (!latin) return undefined
  const raw = decoded(latin, 'typeface')
  if (!raw) return null
  // EA/CS declarations are independent defaults, not conflicts for Latin text.
  const resolved = raw === '+mj-lt' ? theme.fonts?.major : raw === '+mn-lt' ? theme.fonts?.minor
    : raw.startsWith('+') ? null : raw
  return normalizeFontFamily(resolved) || null
}
function color(node, theme, reference = false) {
  const fill = reference ? node : child(node, 'solidFill')
  if (!fill) return node?.children.some((item) => ['gradFill', 'noFill', 'pattFill', 'blipFill'].includes(item.local)) ? null : undefined
  const rgb = child(fill, 'srgbClr')
  const scheme = child(fill, 'schemeClr')
  const system = child(fill, 'sysClr')
  const source = rgb || scheme || system
  if (!source || source.children.length) return null // Preserve transformed/unsupported color in parser HTML.
  const raw = value(rgb, 'val') || value(system, 'lastClr')
  if (raw && /^[\da-fA-F]{6}$/u.test(raw)) return `#${raw.toUpperCase()}`
  const resolved = theme.schemeColor(value(scheme, 'val'))
  return typeof resolved === 'string' && /^#[\da-fA-F]{6}$/u.test(resolved) ? resolved : null
}
function first(nodes, resolve) {
  for (const node of nodes) { const result = resolve(node); if (result !== undefined) return result }
  return undefined
}
function runStyle(context, run, styles, theme, text) {
  const direct = child(run, 'rPr')
  const refs = fontRefs(context)
  const candidates = [direct,
    ...styles.base.map((node) => child(node, 'defRPr')), ...refs,
    ...styles.tail.map((node) => child(node, 'defRPr')),
    ...(!context.ph ? styles.defaults.map((node) => child(node, 'defRPr')) : [])].filter(Boolean)
  // Project a single Latin face only for Latin or neutral-only source runs.
  // Mixed/non-Latin scripts require shaping/font selection we do not replace.
  const latinOnly = /^[\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]*$/u.test(text)
  const family = latinOnly ? first(candidates, (node) => refs.includes(node)
    ? value(node, 'idx') === 'major' ? normalizeFontFamily(theme.fonts?.major) || null
      : value(node, 'idx') === 'minor' ? normalizeFontFamily(theme.fonts?.minor) || null : undefined
    : face(node, theme)) : null
  const resolvedColor = first(candidates, (node) => color(node, theme, refs.includes(node)))
  return { ...(family ? { 'font-family': family } : {}), ...(resolvedColor ? { color: resolvedColor } : {}) }
}
function spacing(styles, property, scale, line = false) {
  const node = styles.map((style) => child(style, property)).find(Boolean)
  if (!node) return line ? 'normal' : '0px'
  const pct = child(node, 'spcPct')
  const pts = child(node, 'spcPts')
  const raw = value(pct || pts, 'val')
  if (raw === null || !/^\d+$/u.test(raw) || !Number.isSafeInteger(Number(raw))) return null
  return pct ? `${Number(raw) / 100000}${line ? '' : 'em'}` : `${Number(raw) / 100 * scale.y}px`
}
function bodyProperty(context, key) {
  return first([context.body, body(context.layoutShape), body(context.masterShape)].filter(Boolean),
    (txBody) => value(child(txBody, 'bodyPr'), key) ?? undefined)
}
function sourceParagraphs(context, defaults, scale, theme) {
  const paragraphs = context.body.children.filter((node) => isNode(node, A_URIS, 'p'))
  const firstLast = /^(1|true)$/u.test(bodyProperty(context, 'spcFirstLastPara') || '')
  return paragraphs.map((paragraph, index) => {
    const styles = paragraphStyles(context, paragraph, defaults)
    const paragraphDefaults = [...styles.base, ...styles.tail, ...styles.defaults]
    const before = index === 0 && !firstLast ? '0px' : spacing(paragraphDefaults, 'spcBef', scale)
    const after = index === paragraphs.length - 1 && !firstLast ? '0px' : spacing(paragraphDefaults, 'spcAft', scale)
    const leading = spacing(paragraphDefaults, 'lnSpc', scale, true)
    const runs = paragraph.children.filter((node) => ['r', 'fld', 'br'].some((local) => isNode(node, A_URIS, local)))
      .map((run) => {
        if (run.local === 'br') return { kind: 'break', text: '', style: {} }
        const text = child(run, 't') ? textContent(context.source.xml, child(run, 't')) : ''
        return { text, style: runStyle(context, run, styles, theme, text) }
      })
    const layout = nativeParagraphLayout(paragraphDefaults, scale, runs.some((run) => run.text.includes('\t')))
    const unsupported = layout.unsupported || [before, after, leading].includes(null) ||
      [before, after].some((amount) => Math.abs(parseFloat(amount)) > 100000)
    return { runs, unsupported, style: { ...layout.style, 'margin-top': '0px', 'margin-bottom': '0px',
      ...(before !== null ? { 'padding-top': before } : {}), ...(after !== null ? { 'padding-bottom': after } : {}),
      ...(leading !== null ? { 'line-height': leading } : {}) } }
  })
}

async function applyNativeTextStyles({ slide, zip, slideIndex = 0, scale = { x: 1, y: 1 } }) {
  if (!slide || !Array.isArray(slide.elements) || !zip?.file) return slide
  if (!Number.isInteger(slideIndex) || slideIndex < 0 || !Number.isFinite(scale.x) || scale.x <= 0 ||
      !Number.isFinite(scale.y) || scale.y <= 0) {
    throw new TypeError('Native text requires a nonnegative slide index and positive vertical scale and horizontal scale')
  }
  const sources = await nativeSourceContext(zip, slideIndex)
  if (!sources) return slide
  async function prepare(element) {
    if (!element || typeof element !== 'object') return element
    if (Array.isArray(element.elements)) return { ...element, elements: await Promise.all(element.elements.map(prepare)) }
    if (typeof element.content !== 'string' || !element.content) return element
    const context = await sources.resolve(element)
    if (!context) return element
    const anchor = bodyProperty(context, 'anchor') ?? 't'
    return { ...element, content: correctNativeHtml(element.content, sourceParagraphs(context, sources.defaults, scale, nativeTheme(context))),
      ...(['t', 'ctr', 'b'].includes(anchor) ? { vAlign: { t: 'up', ctr: 'mid', b: 'down' }[anchor] } : {}) }
  }
  return { ...slide, elements: await Promise.all(slide.elements.map(prepare)) }
}

module.exports = { applyNativeTextStyles }
