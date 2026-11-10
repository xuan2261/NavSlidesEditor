const { resolvedChartTextStyle } = require('./pptx-chart-visual-contract')

function requestChartFonts(document, { context, source, add, issue }) {
  function request(path, ...styles) {
    const { style, reason } = resolvedChartTextStyle(document, context?.theme, ...styles)
    const location = { ...source, path }
    if (reason) issue(reason, location)
    else if (style.fontFamily)
      add(style.fontFamily, style.bold ?? false, style.italic ?? false, location)
    else issue('source-font-declaration-missing', location)
  }
  request('textStyle')
  if (document.title) request('title', document.title.textStyle)
  if (document.legend) request('legend', document.legendTextStyle)
  for (const axis of document.axes) {
    request(`axes.${axis.id}`, axis.textStyle)
    if (axis.title) request(`axes.${axis.id}.title`, axis.title.textStyle)
  }
  for (const [plotIndex, plot] of document.plots.entries()) {
    const base = plot.dataLabels
    for (const series of plot.series) {
      const own = series.dataLabels
      if (!base && !own) continue
      const path = `plots.${plotIndex}.series.${series.id}.labels`
      request(path, base?.textStyle, own?.textStyle)
      const indices = new Set([...(base?.labels ?? []), ...(own?.labels ?? [])].map((l) => l.index))
      for (const index of [...indices].sort((a, b) => a - b)) {
        const b = base?.labels.find((l) => l.index === index)
        const s = own?.labels.find((l) => l.index === index)
        const custom = s?.text ?? b?.text
        request(
          `${path}.${index}`,
          base?.textStyle,
          own?.textStyle,
          b?.textStyle,
          s?.textStyle,
          custom?.textStyle
        )
      }
    }
  }
}
module.exports = { requestChartFonts }
