function axisOptions(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text ? { title: { display: true, text } } : {}
}

function resolveChartAuthoringOptions(element) {
  const text = typeof element.chartTitle === 'string' ? element.chartTitle.trim() : ''
  const position = ['top', 'right', 'bottom', 'left'].includes(element.legendPosition)
    ? element.legendPosition
    : 'right'
  return {
    title: { display: Boolean(text), text, font: { size: 16, weight: 'normal' } },
    legend:
      element.legendPosition === 'topRight' ? { position: 'top', align: 'end' } : { position },
    categoryAxis: axisOptions(element.axisTitles?.category),
    valueAxis: axisOptions(element.axisTitles?.value),
  }
}

module.exports = { resolveChartAuthoringOptions }
