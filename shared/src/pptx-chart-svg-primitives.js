const { resolvedChartTextStyle } = require('./pptx-chart-visual-contract')
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )
function unsupported(path, code) {
  const error = new Error(`${code}: ${path}`)
  error.chartIssue = { code, path }
  throw error
}
function fill(value, path) {
  if (value?.kind === 'none') return 'none'
  if (value?.kind === 'solid' && value.color) return `#${value.color}`
  unsupported(
    path,
    value?.scheme ? 'chart-theme-paint-unresolved' : 'chart-source-paint-unresolved'
  )
}
function paint(value, path, needsFill = true) {
  let result = `fill="${needsFill ? fill(value?.fill, `${path}.fill`) : 'none'}"`
  const line = value?.line
  if (!needsFill && !line) unsupported(`${path}.line`, 'chart-source-line-unresolved')
  if (!line || line.fill?.kind === 'none') return `${result} stroke="none"`
  if (line.widthEmu === undefined)
    unsupported(`${path}.line.widthEmu`, 'chart-source-line-width-unresolved')
  if (line.dash && line.dash !== 'solid')
    unsupported(`${path}.line.dash`, 'chart-line-dash-unimplemented')
  result += ` stroke="${fill(line.fill, `${path}.line.fill`)}" stroke-width="${line.widthEmu / 9525}"`
  if (line.cap)
    result += ` stroke-linecap="${{ flat: 'butt', rnd: 'round', sq: 'square' }[line.cap]}"`
  if (line.join) result += ` stroke-linejoin="${line.join}"`
  return result
}
function text(document, value, localStyle, path, runtime) {
  if (value.includes('\n')) {
    const lines = value
      .split('\n')
      .map((line, i) => text(document, line, localStyle, `${path}.${i}`, runtime))
    return {
      width: Math.max(...lines.map((l) => l.width)),
      height: lines.reduce((sum, l) => sum + l.height, 0),
      at(x, y, anchor) {
        return lines
          .map((line) => {
            const svg = line.at(x, y, anchor)
            y += line.height
            return svg
          })
          .join('')
      },
    }
  }
  if (!runtime?.measurement || !runtime?.fontProfile || !runtime?.rendererProfile)
    unsupported(path, 'chart-font-runtime-unavailable')
  const { style, reason } = resolvedChartTextStyle(document, runtime.theme, localStyle)
  if (reason) unsupported(`${path}.fontFamily`, reason)
  for (const key of ['fontFamily', 'fontSizePt', 'color', 'bold', 'italic'])
    if (style[key] === undefined) unsupported(`${path}.${key}`, 'chart-text-style-unresolved')
  if (/[^\u0020-\u024f\u0370-\u052f\u2000-\u200b\u2010-\u2029\u2030-\u205f]/u.test(value))
    unsupported(path, 'chart-text-script-unimplemented')
  const stale = runtime.measurement.validate(runtime.fontProfile, runtime.rendererProfile)
  if (stale) unsupported(path, stale)
  const faces = runtime.fontProfile.faces.filter(
    (f) =>
      f.typeface === style.fontFamily &&
      Boolean(f.bold) === style.bold &&
      Boolean(f.italic) === style.italic
  )
  if (faces.length !== 1) unsupported(path, 'chart-font-face-unresolved')
  const face = faces[0],
    alias = runtime.fontFamilies?.[face.id]
  if (!alias || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(alias))
    unsupported(path, 'chart-output-font-unresolved')
  const measured = runtime.measurement.measureLine({
    properties: { direction: 'ltr' },
    fontScale: 1,
    startX: 0,
    items: [
      {
        kind: 'text',
        text: value,
        componentId: document.source.ownerDefinitionId,
        path,
        faceId: face.id,
        properties: style,
        start: 0,
        end: value.length,
      },
    ],
  })
  if (measured.issues?.length) unsupported(path, measured.issues[0].code)
  if (![measured.width, measured.height, measured.baseline].every(Number.isFinite))
    unsupported(path, 'chart-text-measurement-unavailable')
  return {
    width: measured.width,
    height: measured.height,
    at(x, y, anchor = 'start') {
      return `<text data-chart-text="${escape(path)}" x="${x}" y="${y + measured.baseline}" text-anchor="${anchor}" fill="#${style.color}" font-family="${alias}" font-size="${(style.fontSizePt * 4) / 3}" font-weight="${style.bold ? 700 : 400}" font-style="${style.italic ? 'italic' : 'normal'}"${style.language ? ` lang="${escape(style.language)}"` : ''} style="font-synthesis:none;white-space:pre" xml:space="preserve">${escape(value)}</text>`
    },
  }
}
function format(value, code = 'General') {
  if (code === 'General') return String(value)
  if (!/^(?:0|#,##0)(?:\.0{1,10})?%?$/.test(code))
    unsupported('numberFormat', 'chart-number-format-unimplemented')
  const percent = code.endsWith('%'),
    decimals = code.match(/\.([0]+)/)?.[1].length ?? 0
  const number = (percent ? value * 100 : value).toFixed(decimals).split('.')
  if (code.startsWith('#,')) number[0] = number[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return number.join('.') + (percent ? '%' : '')
}
const channelText = (channel) =>
  channel?.kind === 'text'
    ? channel.value
    : (channel?.cache?.points.find((p) => p.index === 0)?.value ?? '')
function dataLabel(d, plot, series, point, total, runtime) {
  const base = plot.dataLabels,
    own = series.dataLabels
  const b = base?.labels.find((l) => l.index === point.index),
    s = own?.labels.find((l) => l.index === point.index)
  const o = { ...base?.options, ...own?.options, ...b?.options, ...s?.options }
  if (o.delete) return null
  if (o.showPercent && total === null)
    unsupported(`labels.${point.index}.showPercent`, 'chart-percent-label-unimplemented')
  for (const key of ['showLegendKey', 'showLeaderLines', 'showBubbleSize'])
    if (o[key]) unsupported(`labels.${point.index}.${key}`, 'chart-label-option-unimplemented')
  const custom = s?.text ?? b?.text,
    fields = []
  const fmt = s?.numberFormat ?? own?.numberFormat ?? b?.numberFormat ?? base?.numberFormat
  if (custom) {
    if (custom.kind !== 'text' && !custom.cache)
      unsupported(`labels.${point.index}`, 'chart-label-cache-unavailable')
    fields.push(channelText(custom))
  } else {
    if (o.showSerName) fields.push(channelText(series.data.tx))
    if (o.showCatName)
      fields.push(series.data.cat?.cache?.points.find((p) => p.index === point.index)?.value ?? '')
    if (o.showVal) {
      const channel = series.data.val ?? series.data.yVal
      if (fmt?.sourceLinked && !channel?.cache?.formatCode)
        unsupported(`labels.${point.index}.numberFormat`, 'chart-source-number-format-unresolved')
      fields.push(
        format(point.value, fmt?.sourceLinked ? channel.cache.formatCode : fmt?.formatCode)
      )
    }
    if (o.showPercent) fields.push(format(total ? Math.abs(point.value) / total : 0, '0%'))
  }
  if (!fields.length) return null
  const label = text(
    d,
    fields.join(o.separator ?? '\n'),
    {
      ...base?.textStyle,
      ...own?.textStyle,
      ...b?.textStyle,
      ...s?.textStyle,
      ...custom?.textStyle,
    },
    `series.${series.id}.labels.${point.index}`,
    runtime
  )
  if (o.dLblPos !== 'ctr')
    unsupported(`labels.${point.index}.dLblPos`, 'chart-label-position-unimplemented')
  return label
}
module.exports = { escape, unsupported, fill, paint, text, format, channelText, dataLabel }
