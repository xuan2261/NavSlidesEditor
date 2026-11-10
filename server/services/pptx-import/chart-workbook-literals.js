const { readWorksheetCells } = require('./chart-workbook-cells')
const {
  openWorkbook,
  nodes,
  one,
  get,
  uint,
  attributes,
  richText,
  reject,
  S,
  R,
} = require('./chart-workbook-package')
async function readWorkbookLiterals(bytes) {
  const pkg = await openWorkbook(bytes)
  const rootRels = await pkg.relationships('/')
  const binding = pkg.relation(rootRels, 'officeDocument')
  const workbook = await pkg.load(binding.target)
  if (!S.has(workbook.root.uri) || workbook.root.local !== 'workbook')
    reject('invalid workbook root')
  const rels = await pkg.relationships(binding.target)
  const result = {
    source: workbook.source(workbook.root),
    parts: pkg.parts,
    relationships: [...rootRels, ...rels],
    sheets: [],
  }
  const properties = one(workbook.root, 'workbookPr')
  if (properties && get(properties, 'date1904')) {
    const raw = get(properties, 'date1904')
    if (!['0', '1', 'true', 'false'].includes(raw)) reject('invalid date1904')
    result.date1904 = raw === '1' || raw === 'true'
  }
  let shared = []
  for (const type of ['sharedStrings', 'styles']) {
    if (!rels.some((r) => R.some((prefix) => r.type === `${prefix}/${type}`))) continue
    const rel = pkg.relation(rels, type),
      state = await pkg.load(rel.target)
    if (!S.has(state.root.uri) || state.root.local !== (type === 'styles' ? 'styleSheet' : 'sst'))
      reject(`invalid ${type} root`)
    if (type === 'sharedStrings')
      shared = nodes(state.root, 'si').map((n) => ({
        value: richText(state, n),
        source: state.source(n),
      }))
    else {
      const formats = one(state.root, 'numFmts'),
        xfs = one(state.root, 'cellXfs')
      result.styles = {
        source: state.source(state.root),
        numberFormats: formats
          ? nodes(formats, 'numFmt').map((n) => ({
              numFmtId: uint(get(n, 'numFmtId')),
              formatCode: get(n, 'formatCode'),
              source: state.source(n),
            }))
          : [],
        cellFormats: xfs
          ? nodes(xfs, 'xf').map((n) => ({ attributes: attributes(n), source: state.source(n) }))
          : [],
      }
      if (
        new Set(result.styles.numberFormats.map((f) => f.numFmtId)).size !==
        result.styles.numberFormats.length
      )
        reject('duplicate number format')
    }
  }
  const sheetNames = new Set(),
    sheetIds = new Set(),
    sheetTargets = new Set()
  const budget = { count: 0 }
  for (const n of nodes(one(workbook.root, 'sheets', true), 'sheet')) {
    const name = get(n, 'name'),
      sheetId = get(n, 'sheetId'),
      relationshipId = pkg.rid(n)
    const rel = pkg.relation(rels, 'worksheet', relationshipId)
    if (
      !name ||
      !uint(sheetId) ||
      sheetNames.has(name) ||
      sheetIds.has(sheetId) ||
      sheetTargets.has(rel.target)
    )
      reject('duplicate/invalid sheet identity')
    sheetNames.add(name)
    sheetIds.add(sheetId)
    sheetTargets.add(rel.target)
    const state = await pkg.load(rel.target)
    if (!S.has(state.root.uri) || state.root.local !== 'worksheet') reject('invalid worksheet root')
    const sheet = {
      name,
      sheetId,
      relationshipId,
      source: workbook.source(n),
      worksheetSource: state.source(state.root),
      cells: [],
    }
    sheet.cells = readWorksheetCells(state, shared, result.styles, budget)
    result.sheets.push(sheet)
  }
  return result
}
module.exports = { readWorkbookLiterals }
