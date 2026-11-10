const { TEXT_SHAPING_RESET } = require('./pptx-text-layout-font.js')
const EMU_PER_PX = 9525, PX_PER_PT = 4 / 3
const formattingControl = (cp) => cp === 0x061c || cp === 0x200e || cp === 0x200f ||
  (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069)

function measureBrowserLine(doc, fonts, fontErrors, input, measureEquation) {
  const issues = [], equations = new Map()
  for (const item of input.items) {
    if (item.kind === 'equation') {
      const result = measureEquation?.(item, input.fontScale) ?? { issues: [{
        code: 'inline-equation-runtime-required', componentId: item.componentId, path: item.path,
      }] }
      issues.push(...result.issues)
      if (result.equation) equations.set(item, result.equation)
      continue
    }
    const font = fonts.get(item.faceId)
    if (!font) issues.push({ code: fontErrors.get(item.faceId) ?? 'font-not-loaded',
      componentId: item.componentId, path: item.path })
    else if (item.kind === 'text') {
      for (const character of item.text) {
        const cp = character.codePointAt(0)
        if (!formattingControl(cp) && !font.covers(cp)) {
          issues.push({ code: 'font-glyph-missing', componentId: item.componentId,
            path: item.path, faceId: item.faceId, codePoint: cp })
          break
        }
      }
    }
  }
  if (issues.length) return { issues }
  const line = doc.createElement('div')
  line.style.cssText = TEXT_SHAPING_RESET + 'position:fixed;left:0;top:0;display:inline-block;width:max-content;' +
    'margin:0;padding:0;border:0;white-space:pre;overflow-wrap:normal;word-break:normal;' +
    'font-size:0;line-height:normal;font-synthesis:none;direction:ltr;text-align:left;'
  line.style.direction = input.properties.direction ?? 'ltr'
  const nodes = input.items.map((item) => {
    const span = doc.createElement('span'), style = item.properties
    span.style.cssText = TEXT_SHAPING_RESET
    const fontSizePt = style.fontSizePt === undefined ? undefined : style.fontSizePt * input.fontScale
    const px = (fontSizePt ?? 0) * PX_PER_PT
    const shift = px * (style.baseline ?? 0) / 100000
    const equation = equations.get(item)
    if (equation) {
      span.style.cssText = require('./pptx-text-layout-equation').inlineEquationStyle(equation, shift)
      span.innerHTML = equation.svg
      line.append(span)
      return { span, item, fontSizePt, shift, equation }
    }
    Object.assign(span.style, {
      fontFamily: `"${fonts.get(item.faceId).alias}"`, fontSize: `${px}px`,
      fontWeight: style.bold ? '700' : '400', fontStyle: style.italic ? 'italic' : 'normal',
      fontKerning: style.kerningPt === undefined ? 'auto' : fontSizePt >= style.kerningPt ? 'normal' : 'none',
      fontVariantLigatures: 'normal', lineHeight: 'normal',
      letterSpacing: `${(style.spacingPt ?? 0) * input.fontScale * PX_PER_PT}px`,
      // Even 0px creates a separate inline alignment context in Chromium and
      // breaks kerning/Arabic ligatures across otherwise identical run spans.
      verticalAlign: shift === 0 ? 'baseline' : `${shift}px`,
    })
    if (style.language) span.lang = style.language
    if (style.direction) { span.style.direction = style.direction; span.style.unicodeBidi = 'embed' }
    if (item.kind === 'tab') {
      span.style.display = 'inline-block'
      span.style.width = '0px'
      span.style.height = '0px'
    } else span.textContent = item.text
    line.append(span)
    return { span, item, fontSizePt, shift }
  })
  // No soft wrapping in this profile: a single zero-size baseline marker cannot
  // change a line break. Text remains in intact inline runs for browser shaping.
  const marker = doc.createElement('span')
  marker.style.cssText = 'display:inline-block;width:0;height:0;padding:0;margin:0;vertical-align:baseline;'
  line.append(marker)
  doc.body.append(line)
  try {
    const stops = (input.properties.tabs ?? []).map((tab) => ({
      position: tab.positionEmu / EMU_PER_PX, alignment: tab.alignment ?? 'l',
    })).sort((a, b) => a.position - b.position)
    for (let i = 0; i < nodes.length; i++) {
      const { item, span } = nodes[i]
      if (item.kind !== 'tab') continue
      const current = input.startX + span.getBoundingClientRect().left - line.getBoundingClientRect().left
      const defaultSize = (input.properties.defaultTabSizeEmu ?? 0) / EMU_PER_PX
      const stop = stops.find((stop) => stop.position > current) ?? (defaultSize > 0
        ? { position: (Math.floor(current / defaultSize) + 1) * defaultSize, alignment: 'l' } : null)
      if (!stop) return { issues: [{ code: 'unresolved-tab-stop', componentId: item.componentId, path: item.path }] }
      const range = doc.createRange()
      range.setStartAfter(span)
      const next = nodes.slice(i + 1).find((node) => node.item.kind === 'tab')
      range.setEndBefore(next?.span ?? marker)
      const width = range.getBoundingClientRect().width
      let following = stop.alignment === 'ctr' ? width / 2 : stop.alignment === 'r' ? width : 0
      if (stop.alignment === 'dec') {
        // The locale is part of the declared browser profile. Align the actual
        // shaped decimal prefix (possibly spanning runs), never glyph estimates.
        const followingNodes = nodes.slice(i + 1, next ? nodes.indexOf(next) : nodes.length)
        const language = followingNodes.find((node) => node.item.properties.language)?.item.properties.language
          ?? doc.defaultView.navigator.language
        let decimal
        try { decimal = new Intl.NumberFormat(language).formatToParts(1.5).find((part) => part.type === 'decimal')?.value }
        catch { return { issues: [{ code: 'decimal-tab-locale-unavailable', componentId: item.componentId, path: item.path }] } }
        if (!decimal) return { issues: [{ code: 'decimal-tab-locale-unavailable', componentId: item.componentId, path: item.path }] }
        const target = followingNodes.find((node) => node.item.kind === 'text' && node.item.text.includes(decimal))
        if (target?.span.firstChild) range.setEnd(target.span.firstChild, target.item.text.indexOf(decimal))
        following = range.getBoundingClientRect().width
      }
      const gap = stop.position - current - following
      if (gap < 0) return { issues: [{ code: 'overlapping-tab-field', componentId: item.componentId, path: item.path }] }
      span.style.width = `${gap}px`
    }
    const box = line.getBoundingClientRect(), baseline = marker.getBoundingClientRect().top - box.top
    if (!(box.height > 0) || !Number.isFinite(baseline))
      return { issues: [{ code: 'browser-geometry-unavailable', componentId: input.items[0].componentId, path: input.items[0].path }] }
    const fragments = nodes.map(({ item, span, fontSizePt, shift, equation }) => {
      const range = doc.createRange()
      range.selectNodeContents(span)
      const rectangles = item.kind === 'tab' || equation ? [span.getBoundingClientRect()] : [...range.getClientRects()]
      return { componentId: item.componentId, kind: item.kind,
        ...(equation ? { ommlDocument: item.ommlDocument, equation } : { text: item.text, start: item.start, end: item.end }),
        path: item.path, properties: item.properties, sourceKind: item.sourceKind,
        ...(item.field ? { field: item.field } : {}),
        ...(fontSizePt === undefined ? {} : { sourceFontSizePt: item.properties.fontSizePt, fontSizePt }),
        ...(item.faceId === undefined ? {} : { faceId: item.faceId }), baseline: baseline - shift,
        rects: rectangles.map((rect) => ({ x: rect.left - box.left, y: rect.top - box.top,
          width: rect.width, height: rect.height })) }
    })
    let beforeRunIndex = 0
    const struts = fragments.flatMap((run) => run.kind === 'strut'
      ? [{ ...run, beforeRunIndex }] : (beforeRunIndex++, []))
    const runs = fragments.filter((run) => run.kind !== 'strut')
    return { issues: [], width: box.width, height: box.height, baseline, startX: input.startX, runs, struts }
  } finally { line.remove() }
}
module.exports = { measureBrowserLine }
