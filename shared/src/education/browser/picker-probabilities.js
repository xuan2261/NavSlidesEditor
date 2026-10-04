const { node } = require('./dom.js')

function createPickerProbabilities(document, config) {
  const element = node(document, 'ul', undefined, { 'aria-label': 'Selection probabilities' })
  const rows = config.items.map((item) => {
    const row = node(document, 'li')
    element.append(row)
    return { item, row }
  })
  function render(available) {
    let count = 0,
      max = 0,
      total = 0
    for (const { item } of rows)
      if (available.has(item.id)) {
        count++
        max = Math.max(max, item.weight ?? 1)
      }
    if (config.weighted && max > 0) {
      for (const { item } of rows) if (available.has(item.id)) total += (item.weight ?? 1) / max
    }
    for (const { item, row } of rows) {
      const probability =
        !available.has(item.id) || !count
          ? 0
          : config.weighted
            ? (item.weight ?? 1) / max / total
            : 1 / count
      const percent =
        probability > 0 && probability < 0.0001
          ? '<0.01%'
          : `${Math.round(probability * 10000) / 100}%`
      row.textContent = `${item.label} · ${percent}${available.has(item.id) ? '' : ' · picked'}`
    }
  }
  return { element, render }
}
module.exports = { createPickerProbabilities }
