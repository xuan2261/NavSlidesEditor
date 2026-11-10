const { box, fit } = require('./pptx-omml-layout-boxes')
const { value } = require('./pptx-omml-render-properties')

function matrix(node, rows, props, metrics) {
  const widths = rows[0].children.map((_, i) =>
    Math.max(...rows.map((row) => row.children[i].width))
  )
  const declarations = node.children
    .find((n) => n.type === 'mPr')
    ?.children.find((n) => n.type === 'mcs')
  const alignments =
    declarations?.children.flatMap((column) => {
      const children = column.children[0].children
      return Array(Number(value(children.find((n) => n.type === 'count')) ?? 1)).fill(
        value(children.find((n) => n.type === 'mcJc')) ?? 'center'
      )
    }) || widths.map(() => 'center')
  for (const row of rows) {
    let x = 0
    row.children.forEach((cell, i) => {
      const extra = widths[i] - cell.width
      cell.x = x + (alignments[i] === 'right' ? extra : alignments[i] === 'left' ? 0 : extra / 2)
      x += widths[i] + metrics.columnGap
    })
    fit(row, x - metrics.columnGap)
  }
  return stack(node, rows, props, metrics)
}
function stack(node, rows, props, metrics, alignment = 'center') {
  const width = Math.max(...rows.map((r) => r.width))
  let y = 0
  for (const row of rows) {
    row.x =
      alignment === 'right' ? width - row.width : alignment === 'left' ? 0 : (width - row.width) / 2
    row.y = y + row.ascent
    y = row.y + row.descent + metrics.rowGap
  }
  const height = y - metrics.rowGap
  const baseline =
    props.baseJc === 'top'
      ? rows[0].y
      : props.baseJc === 'bottom'
        ? rows.at(-1).y
        : height / 2 + metrics.axisHeight
  rows.forEach((row) => {
    row.y -= baseline
  })
  return fit(box(node, rows), width)
}
module.exports = { matrix, stack }
