const { normalizeTextDocument } = require('./pptx-text-document.js')
const { deriveGeometryPaths } = require('./pptx-geometry-document.js')
const { geometryRenderTransform } = require('./pptx-geometry-svg.js')
const { escapePlainText } = require('./content-safety.js')
const { resolveProperty } = require('./pptx-style-resolution.js')
const { runHyperlinkAttributes } = require('./pptx-run-hyperlink-render')
const { layoutTextDocument } = require('./pptx-text-layout.js')
const { renderMeasuredTextLines } = require('./pptx-text-layout-render.js')
const { textOutlineCss } = require('./pptx-text-outline.js')
const { TEXT_SHAPING_RESET } = require('./pptx-text-layout-font.js')

const EMU_TO_CSS = 96 / 914400
const spacing = (value) =>
  value.unit === 'points' ? `${value.value}pt` : `${value.value / 1000}%`

// Source font aliases are supplied only by the verified local font runtime.
function runStyle(properties = {}, fontScale = 1, fontAlias) {
  const style = [TEXT_SHAPING_RESET.replace(/;+$/, '')]
  if (properties.fontSizePt !== undefined)
    style.push(`font-size:${properties.fontSizePt * fontScale}pt`)
  if (fontAlias) style.push(`font-family:"${fontAlias}"`)
  else if (properties.fontLatin) {
    const family = properties.fontLatin.typeface.replace(
      /[^a-zA-Z0-9 _.-]/gu,
      (character) => `\\${character.codePointAt(0).toString(16)} `
    )
    style.push(`font-family:"${family}"`)
  }
  style.push(`font-weight:${properties.bold ? 'bold' : 'normal'}`)
  style.push(`font-style:${properties.italic ? 'italic' : 'normal'}`)
  if (['srgb', 'preset'].includes(properties.color?.kind)) {
    const paint = resolveProperty({
      property: 'color',
      layers: { target: {}, entries: [{
        id: 'label', kind: 'run', source: { part: 'pptxTextDocument', path: 'properties.color' },
        properties: { color: properties.color },
      }] },
    }).resolved
    const rgb = paint.rgb.match(/../g).map((channel) => parseInt(channel, 16))
    style.push(`color:rgba(${rgb.join(',')},${paint.alpha})`)
  }
  if (properties.highlight?.kind === 'none') style.push('background-color:transparent')
  else if (['srgb', 'preset'].includes(properties.highlight?.kind)) {
    const paint = resolveProperty({ property: 'color', layers: { target: {}, entries: [{
      id: 'label-highlight', kind: 'run', source: { part: 'pptxTextDocument', path: 'properties.highlight' },
      properties: { color: properties.highlight },
    }] } }).resolved
    const rgb = paint.rgb.match(/../g).map((channel) => parseInt(channel, 16))
    style.push(`background-color:rgba(${rgb.join(',')},${paint.alpha})`)
  }
  if (properties.underline !== undefined || properties.strike !== undefined) {
    const decorations = []
    if (properties.underline && properties.underline !== 'none') decorations.push('underline')
    if (properties.strike && properties.strike !== 'noStrike') decorations.push('line-through')
    style.push(`text-decoration:${decorations.join(' ') || 'none'}`)
  }
  style.push(`letter-spacing:${(properties.spacingPt ?? 0) * fontScale}pt`)
  const fontSizePt = (properties.fontSizePt ?? 0) * fontScale
  style.push('line-height:normal', 'font-variant-ligatures:normal', 'font-synthesis:none')
  style.push(`font-kerning:${properties.kerningPt === undefined ? 'auto' : fontSizePt >= properties.kerningPt ? 'normal' : 'none'}`)
  // A zero-length CSS shift is not equivalent to baseline for cross-run shaping.
  const shift = fontSizePt * (4 / 3) * (properties.baseline ?? 0) / 100000
  style.push(`vertical-align:${shift === 0 ? 'baseline' : `${shift}px`}`)
  if (properties.direction) style.push(`direction:${properties.direction};unicode-bidi:embed`)
  style.push(textOutlineCss(properties.outline, fontScale))
  return style.filter(Boolean).join(';').replace(/;+/g, ';')
}

function measuredRun(run, source, runtime, options, fontScale) {
  if (run.kind === 'equation') {
    const shift = (run.sourceFontSizePt ?? 0) * fontScale * (4 / 3) * (run.properties?.baseline ?? 0) / 100000
    const style = require('./pptx-text-layout-equation').inlineEquationStyle(run.equation, shift)
    return `<span data-pptx-text-run="${escapePlainText(run.componentId)}" data-pptx-inline-equation="${escapePlainText(source.ommlDocument.root.componentId)}" style="${escapePlainText(style)}">${run.equation.svg}</span>`
  }
  const alias = runtime.fontFamilies[run.faceId]
  if (typeof alias !== 'string' || !alias) throw new TypeError(`Source font face unavailable: ${run.faceId}`)
  const properties = run.properties || {}
  const language = properties.language ? ` lang="${escapePlainText(properties.language)}"` : ''
  const field = source?.kind === 'field' && source.field
    ? ` data-pptx-field-id="${escapePlainText(source.field.id)}" data-pptx-field-type="${escapePlainText(source.field.type)}"`
    : ''
  const identity = run.kind === 'strut' ? 'data-pptx-text-strut' : 'data-pptx-text-run'
  const attrs = `${identity}="${escapePlainText(run.componentId)}" data-pptx-text-offset="${run.start}:${run.end}"${language}${field}${source ? runHyperlinkAttributes(source, options.hyperlinkPresentation) : ''}`
  return `<span ${attrs} style="${escapePlainText(runStyle(properties, fontScale, alias))}">${escapePlainText(run.text)}</span>`
}

function measuredLayout(document, element, geometry, rect, options) {
  const runtime = options.fontRuntime
  if (!runtime) return null
  const widthEmu = geometry?.width ?? Math.round(element.width / EMU_TO_CSS)
  const heightEmu = geometry?.height ?? Math.round(element.height / EMU_TO_CSS)
  const theme = options.theme ?? element.pptxTextTheme
  const input = {
    document,
    shape: { widthEmu, heightEmu, textRectEmu: rect },
    fontProfile: runtime.fontProfile,
    rendererProfile: runtime.rendererProfile,
    ...(theme ? { theme } : {}),
  }
  const layout = layoutTextDocument(input, runtime.measurement)
  if (layout.status !== 'measured')
    return { html: null, issueCode: layout.issues[0]?.code ?? 'layout-unsupported', issues: layout.issues }
  return { html: renderMeasuredTextLines(input, layout,
    (run, source) => measuredRun(run, source, runtime, options, layout.fontScale)), issueCode: null }

}
function paragraphHtml(paragraph, body, options) {
  const properties = paragraph.properties || {}
  const style = ['margin:0', 'padding:0']
  const alignment = { l: 'left', ctr: 'center', r: 'right', just: 'justify' }[properties.alignment]
  if (alignment) style.push(`text-align:${alignment}`)
  const lineScale =
    body.autofit?.mode === 'normal' ? 1 - (body.autofit.lineSpaceReduction ?? 0) / 100000 : 1
  if (properties.lineSpacing) {
    const value = { ...properties.lineSpacing, value: properties.lineSpacing.value * lineScale }
    style.push(`line-height:${spacing(value)}`)
  } else if (lineScale !== 1) style.push(`line-height:${lineScale * 100}%`)
  for (const [key, css] of [
    ['marginLeftEmu', 'margin-left'], ['marginRightEmu', 'margin-right'], ['indentEmu', 'text-indent'],
  ]) {
    if (properties[key] !== undefined) style.push(`${css}:${properties[key] * EMU_TO_CSS}px`)
  }
  for (const [key, css] of [['spaceBefore', 'margin-top'], ['spaceAfter', 'margin-bottom']]) {
    if (properties[key]?.unit === 'points') style.push(`${css}:${spacing(properties[key])}`)
  }
  const fontScale =
    body.autofit?.mode === 'normal' ? (body.autofit.fontScale ?? 100000) / 100000 : 1
  const runs = paragraph.runs.map((run) => {
    if (run.kind === 'equation') throw Object.assign(
      new TypeError('Canonical text layout unavailable: browser-measurement-required'), {
        code: 'browser-measurement-required', componentId: run.componentId,
      })
    const properties = { ...paragraph.defaultRunProperties, ...run.properties }
    const language = properties.language ? ` lang="${escapePlainText(properties.language)}"` : ''
    const field = run.kind === 'field'
      ? ` data-pptx-field-id="${escapePlainText(run.field.id)}" data-pptx-field-type="${escapePlainText(run.field.type)}"`
      : ''
    const attrs = `data-pptx-text-run="${escapePlainText(run.componentId)}"${language}${field}${runHyperlinkAttributes(run, options.hyperlinkPresentation)} style="${escapePlainText(runStyle(properties, fontScale))}"`
    return run.kind === 'break' ? `<br ${attrs}/>` :
      `<span ${attrs}>${escapePlainText(run.text)}</span>`
  }).join('')
  if (!paragraph.runs.length)
    style.push(runStyle({ ...paragraph.defaultRunProperties, ...paragraph.endRunProperties }, fontScale))
  return `<p data-pptx-text-paragraph="${escapePlainText(paragraph.componentId)}" style="${escapePlainText(style.filter(Boolean).join(';'))}">${runs || '<br/>'}</p>`
}

function textDocumentHtml(input, options = {}) {
  const document = normalizeTextDocument(input)
  return document.paragraphs.map((paragraph) => paragraphHtml(paragraph, document.body ?? {}, options)).join('')
}

function shapeLabelSvgString(element, options = {}) {
  const document = normalizeTextDocument(element.pptxTextDocument)
  const geometry = element.pptxGeometry
  const scale = geometry ? geometryRenderTransform(geometry, element) : [EMU_TO_CSS, 0, 0, EMU_TO_CSS]
  const rect = geometry
    ? deriveGeometryPaths(geometry).textRect ?? { l: 0, t: 0, r: geometry.width, b: geometry.height }
    : { l: 0, t: 0, r: Math.round(element.width / EMU_TO_CSS), b: Math.round(element.height / EMU_TO_CSS) }
  const body = document.body || {}
  const bodyStyle = [
    'position:absolute', 'display:flex', 'flex-direction:column',
    `justify-content:${{ ctr: 'center', b: 'flex-end' }[body.verticalAlign] || 'flex-start'}`,
    'text-align:left', 'overflow:visible', 'overflow-wrap:normal', 'word-break:normal',
    `white-space:${body.wrap === false ? 'pre' : 'pre-wrap'}`,
  ]
  for (const [side, key] of [
    ['left', 'insetLeftEmu'], ['right', 'insetRightEmu'],
    ['top', 'insetTopEmu'], ['bottom', 'insetBottomEmu'],
  ]) bodyStyle.push(`${side}:${(body[key] ?? 0) * EMU_TO_CSS}px`)
  const layout = measuredLayout(document, element, geometry, rect, options)
  const hasEquations = document.paragraphs.some((paragraph) => paragraph.runs.some((run) => run.kind === 'equation'))
  if ((options.requireMeasuredText || hasEquations) && layout?.html == null) {
    const code = layout?.issueCode ?? 'browser-measurement-required'
    throw Object.assign(new TypeError(`Canonical text layout unavailable: ${code}`), {
      code, componentId: document.componentId,
      issues: layout?.issues ?? [{ code, componentId: document.componentId, path: 'rendererProfile' }],
    })
  }
  const measured = layout?.html ?? null
  const html = measured ?? document.paragraphs.map((paragraph) => paragraphHtml(paragraph, body, options)).join('')
  if (measured !== null) {
    bodyStyle.splice(0, bodyStyle.length, 'position:relative', 'display:block', 'width:100%', 'height:100%',
      'overflow:visible', 'white-space:pre', 'font-synthesis:none')
  }
  const autofit = body.autofit?.mode === 'normal'
    ? ` data-pptx-autofit="normal" data-pptx-font-scale="${(body.autofit.fontScale ?? 100000) / 100000}" data-pptx-line-space-reduction="${(body.autofit.lineSpaceReduction ?? 0) / 100000}"`
    : ''
  const layoutState = measured !== null ? 'measured' : layout?.issueCode ? 'unsupported-preview' : 'unmeasured-preview'
  const result = `<g data-pptx-shape-label="${escapePlainText(document.componentId)}" data-pptx-text-layout="${layoutState}"${layout?.issueCode ? ` data-pptx-text-layout-issue="${escapePlainText(layout.issueCode)}"` : ''} transform="matrix(${scale[0] / EMU_TO_CSS} 0 0 ${scale[3] / EMU_TO_CSS} 0 0)"><foreignObject x="${rect.l * EMU_TO_CSS}" y="${rect.t * EMU_TO_CSS}" width="${(rect.r - rect.l) * EMU_TO_CSS}" height="${(rect.b - rect.t) * EMU_TO_CSS}" style="overflow:visible;"><div xmlns="http://www.w3.org/1999/xhtml" data-pptx-text-body="${escapePlainText(document.componentId)}"${autofit} style="${escapePlainText(bodyStyle.join(';'))}">${html}</div></foreignObject></g>`
  const mount = options.textOutputMount
  return mount ? `<g data-pptx-semantic-mount="${escapePlainText(mount.instanceId)}" data-pptx-semantic-slide="${escapePlainText(mount.slideId)}">${result}</g>` : result
}

module.exports = { shapeLabelSvgString, textDocumentHtml }
