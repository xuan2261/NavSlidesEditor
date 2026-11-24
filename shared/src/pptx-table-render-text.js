const { cloneTextData, normalizeTextDocument } = require('./pptx-text-document')
const { layoutTextDocument } = require('./pptx-text-layout')
const { escapePlainText } = require('./content-safety')
const { unsupported, paint } = require('./pptx-table-render-paint')
const { runHyperlinkAttributes } = require('./pptx-run-hyperlink-render')
const { textOutlineSvgStyle } = require('./pptx-text-outline')

function effectiveDocument(cell, defaults = {}) {
  const document = cloneTextData(cell.textDocument)
  document.body = { ...defaults.body, ...document.body }
  const properties = cell.properties
  for (const side of ['Left', 'Right', 'Top', 'Bottom']) {
    const value = properties[`margin${side}Emu`]
    if (value !== undefined) document.body[`inset${side}Emu`] = value
  }
  for (const key of ['verticalAlign', 'verticalText', 'anchorCenter'])
    if (properties[key] !== undefined) document.body[key] = properties[key]
  for (const paragraph of document.paragraphs) {
    paragraph.properties = { ...defaults.paragraph, ...paragraph.properties }
    paragraph.defaultRunProperties = { ...defaults.run, ...paragraph.defaultRunProperties }
    if (paragraph.properties.direction === 'rtl')
      unsupported(paragraph.componentId, 'properties.direction', 'RTL output shaping')
  }
  return normalizeTextDocument(document)
}
function runMarkup(run, options, sourceRun) {
  if (run.kind === 'strut' || run.kind === 'tab' || !run.text) return ''
  const properties = run.properties,
    id = run.componentId
  if (
    properties.direction === 'rtl' ||
    /[\u0590-\u08ff\u200c-\u200f\u202a-\u202e\u2066-\u2069]/u.test(run.text)
  )
    unsupported(id, 'properties.direction', 'bidirectional output shaping')
  if (properties.underline && !['none', 'sng'].includes(properties.underline))
    unsupported(id, 'properties.underline', 'unsupported underline')
  if (properties.strike && !['noStrike', 'sngStrike'].includes(properties.strike))
    unsupported(id, 'properties.strike', 'unsupported strike')
  const family = options.fontFamilies?.[run.faceId]
  if (typeof family !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(family))
    unsupported(id, 'fontFamilies', 'exact measured output font alias required')
  if (run.rects.length !== 1) unsupported(id, 'rects', 'fragmented run output')
  const color = paint(properties.color, options, id, 'properties.color', true)
  const decoration =
    [
      ...(properties.underline === 'sng' ? ['underline'] : []),
      ...(properties.strike === 'sngStrike' ? ['line-through'] : []),
    ].join(' ') || 'none'
  const kerning =
    properties.kerningPt === undefined
      ? 'auto'
      : run.fontSizePt >= properties.kerningPt
        ? 'normal'
        : 'none'
  const style =
    `font-family:${family};font-size:${(run.fontSizePt * 4) / 3}px;` +
    `font-weight:${properties.bold ? 700 : 400};font-style:${properties.italic ? 'italic' : 'normal'};` +
    `font-kerning:${kerning};font-variant-ligatures:normal;font-synthesis:none;` +
    `letter-spacing:${((properties.spacingPt ?? 0) * (run.fontSizePt / properties.fontSizePt) * 4) / 3}px;` +
    `text-decoration:${decoration};` +
    textOutlineSvgStyle(properties.outline, run.fontSizePt / properties.fontSizePt, options.theme)
  return (
    `<text data-pptx-text-run="${escapePlainText(id)}"${runHyperlinkAttributes(sourceRun, options.hyperlinkPresentation)} x="${run.rects[0].x}" y="${run.baseline}"` +
    ` fill="${color.value}" fill-opacity="${color.alpha}" style="${escapePlainText(style)}"` +
    (properties.language ? ` lang="${escapePlainText(properties.language)}"` : '') +
    ` xml:space="preserve">${escapePlainText(run.text)}</text>`
  )
}
function cellText(cell, widthEmu, heightEmu, options) {
  const document = effectiveDocument(cell, options.textDefaults)
  const sourceRuns = options.hyperlinkPresentation
    ? new Map(document.paragraphs.flatMap((paragraph) => paragraph.runs.map((run) => [run.componentId, run])))
    : null
  const layout = layoutTextDocument(
    {
      document,
      shape: { widthEmu, heightEmu, textRectEmu: { l: 0, t: 0, r: widthEmu, b: heightEmu } },
      fontProfile: options.fontProfile,
      rendererProfile: options.rendererProfile,
    },
    options.measurement
  )
  if (layout.status !== 'measured') {
    const issue = layout.issues[0]
    unsupported(issue.componentId, issue.path, issue.code)
  }
  const markup = layout.lines
    .map((line, index) => {
      const paragraph = document.paragraphs.find((p) => p.componentId === line.paragraphId)
      if (
        line.bullet &&
        paragraph.properties.bulletColor &&
        paragraph.properties.bulletColor !== 'text'
      )
        line.bullet.properties = {
          ...line.bullet.properties,
          color: paragraph.properties.bulletColor,
        }
      return (
        `<g data-pptx-table-line="${index}">` +
        [...(line.bullet ? [line.bullet] : []), ...line.runs]
          .map((run) => runMarkup(run, options, sourceRuns?.get(run.componentId)))
          .join('') +
        '</g>'
      )
    })
    .join('')
  if (cell.properties.horzOverflow === 'overflow') return markup
  // The OOXML default clips horizontally, not at the cell's top/bottom. Extend
  // the local viewport to measured font boxes and visible outline extents.
  let top = 0, bottom = heightEmu / 9525
  for (const line of layout.lines) {
    for (const run of [...(line.bullet ? [line.bullet] : []), ...line.runs]) {
      const outline = run.properties.outline
      const stroke = outline?.fill === 'none' || outline?.color?.kind === 'none' ? 0 :
        (outline?.width ?? 0) / 19050 * run.fontSizePt / run.properties.fontSizePt
      for (const box of run.rects) {
        top = Math.min(top, box.y - stroke)
        bottom = Math.max(bottom, box.y + box.height + stroke)
      }
    }
  }
  const width = widthEmu / 9525, height = bottom - top
  return `<svg x="0" y="${top}" width="${width}" height="${height}" viewBox="0 ${top} ${width} ${height}" overflow="hidden">${markup}</svg>`
}
module.exports = { cellText }
