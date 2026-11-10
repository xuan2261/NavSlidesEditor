const { textContent } = require('./ooxml-text-run-xml')
const {
  nodes,
  one,
  get,
  uint,
  attributes,
  richText,
  reject,
  S,
} = require('./chart-workbook-package')
function readWorksheetCells(state, shared, styles, budget) {
  const cells = []
  const references = new Set(),
    rows = new Set()
  const sheetData = one(state.root, 'sheetData', true)
  if (sheetData.children.some((child) => !S.has(child.uri) || child.local !== 'row'))
    reject('unsupported sheet data')
  for (const row of nodes(sheetData, 'row')) {
    if (row.children.some((child) => !S.has(child.uri) || child.local !== 'c'))
      reject('unsupported row data')
    const rowId = uint(get(row, 'r'), 1048576)
    if (!rowId || rows.has(rowId)) reject('invalid/duplicate row')
    rows.add(rowId)
    for (const c of nodes(row, 'c')) {
      if (++budget.count > 100000) reject('cell budget exceeded')
      const reference = get(c, 'r'),
        match = /^([A-Z]{1,3})([1-9]\d*)$/.exec(reference)
      const col = match?.[1].split('').reduce((v, char) => v * 26 + char.charCodeAt(0) - 64, 0)
      if (!match || col > 16384 || Number(match[2]) !== rowId || references.has(reference))
        reject('invalid/duplicate cell reference')
      references.add(reference)
      if (c.children.some((child) => !S.has(child.uri) || !['v', 'f', 'is'].includes(child.local)))
        reject('unsupported cell child')
      const v = one(c, 'v'),
        f = one(c, 'f'),
        inline = one(c, 'is')
      const type = get(c, 't') || 'n'
      if (!['n', 'b', 'e', 's', 'str', 'inlineStr', 'd'].includes(type))
        reject('unsupported cell type')
      const cell = { reference, source: state.source(c), literal: { kind: 'blank' } }
      if (get(c, 's')) {
        cell.styleIndex = uint(get(c, 's'))
        if (!styles || cell.styleIndex >= styles.cellFormats.length) reject('missing cell style')
      }
      if (f) {
        cell.formula = { text: textContent(state.xml, f), attributes: attributes(f) }
        if (
          Object.keys(cell.formula.attributes).some(
            (key) =>
              ![
                't',
                'ref',
                'si',
                'aca',
                'bx',
                'ca',
                'del1',
                'del2',
                'dt2D',
                'dtr',
                'r1',
                'r2',
              ].includes(key)
          )
        )
          reject('unsupported formula attributes')
        cell.cached = !!v || !!inline
      }
      if (inline) {
        if (type !== 'inlineStr' || v || f) reject('ambiguous inline string')
        cell.literal = { kind: 'string', value: richText(state, inline), storage: 'inline' }
      } else if (v) {
        const raw = textContent(state.xml, v)
        if (type === 'n' && raw === '') {
          cell.literal = { kind: 'blank' }
        } else if (type === 'n') {
          if (
            !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw) ||
            !Number.isFinite(Number(raw))
          )
            reject('invalid number')
          cell.literal = { kind: 'number', value: Number(raw), lexicalValue: raw }
        } else if (type === 'b') {
          if (!['0', '1', 'true', 'false'].includes(raw)) reject('invalid boolean')
          cell.literal = {
            kind: 'boolean',
            value: raw === '1' || raw === 'true',
            lexicalValue: raw,
          }
        } else if (type === 's') {
          const index = uint(raw)
          if (!shared[index]) reject('missing shared string')
          cell.literal = {
            kind: 'string',
            value: shared[index].value,
            storage: 'shared',
            sharedStringIndex: index,
          }
          cell.sharedStringSource = shared[index].source
        } else if (type === 'str') cell.literal = { kind: 'string', value: raw, storage: 'formula' }
        else if (type === 'e') cell.literal = { kind: 'error', value: raw }
        else if (type === 'd') {
          const year = Number(raw.slice(0, 4)),
            month = Number(raw.slice(5, 7)),
            day = Number(raw.slice(8, 10))
          const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
          const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
          if (
            !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(
              raw
            ) ||
            !Number.isFinite(Date.parse(raw)) ||
            day < 1 ||
            day > (days[month - 1] || 0)
          )
            reject('invalid explicit date')
          cell.literal = { kind: 'date', value: raw }
        } else reject('invalid inline value')
      }
      cells.push(cell)
    }
  }
  return cells
}
module.exports = { readWorksheetCells }
