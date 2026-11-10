const { normalizeTextProperties } = require('./pptx-text-document')
const { PRESET_DASH_PATTERNS, LINE_END_TYPES, LINE_END_SIZES } = require('./pptx-geometry-document')

// DrawingML CT_TableCellProperties attribute defaults (EMU). Keep absent source
// declarations absent; consumers apply defaults only to the effective cell view.
const TABLE_CELL_DEFAULTS = Object.freeze({
  marginLeftEmu: 91440, marginRightEmu: 91440,
  marginTopEmu: 45720, marginBottomEmu: 45720,
})

function tableFailure(detail, componentId) {
  const error = new TypeError(`Invalid PPTX table contract: ${detail}`)
  error.componentId = componentId
  throw error
}
function record(value, keys, required = [], componentId) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some((key) => !keys.includes(key)) ||
      required.some((key) => !Object.hasOwn(value, key))) tableFailure('record fields', componentId)
}
function integer(value, min, max, componentId) {
  if (!Number.isSafeInteger(value) || value < min || value > max) tableFailure('integer range', componentId)
}
function choice(value, options, componentId) {
  if (!options.includes(value)) tableFailure('enum value', componentId)
}
function color(value, componentId) {
  if (value?.kind === 'none') record(value, ['kind'], ['kind'], componentId)
  else {
    try { normalizeTextProperties({ color: value }, 'run') } catch { tableFailure('color', componentId) }
  }
}
function fill(value, componentId) {
  record(value, ['color'], ['color'], componentId)
  color(value.color, componentId)
}
function lineEnd(value, componentId) {
  record(value, ['type', 'w', 'len'], [], componentId)
  for (const [attribute, item] of Object.entries(value))
    if (!(attribute === 'type' ? LINE_END_TYPES : LINE_END_SIZES).includes(item))
      tableFailure('line end', componentId)
}
function border(value, componentId) {
  record(value, ['color', 'width', 'cap', 'compound', 'alignment', 'dash', 'join', 'headEnd', 'tailEnd'], [], componentId)
  if (value.color !== undefined) color(value.color, componentId)
  if (value.width !== undefined) integer(value.width, 0, 20116800, componentId)
  if (value.cap !== undefined) choice(value.cap, ['flat', 'rnd', 'sq'], componentId)
  if (value.compound !== undefined) choice(value.compound, ['sng', 'dbl', 'thinThick', 'thickThin', 'tri'], componentId)
  if (value.alignment !== undefined) choice(value.alignment, ['ctr', 'in'], componentId)
  if (value.dash !== undefined) {
    record(value.dash, ['kind', 'value'], ['kind', 'value'], componentId)
    choice(value.dash.kind, ['preset'], componentId)
    choice(value.dash.value, Object.keys(PRESET_DASH_PATTERNS), componentId)
  }
  if (value.join !== undefined) {
    record(value.join, ['kind', 'limit'], ['kind'], componentId)
    choice(value.join.kind, ['round', 'bevel', 'miter'], componentId)
    if (value.join.limit !== undefined) {
      choice(value.join.kind, ['miter'], componentId)
      integer(value.join.limit, 0, 2147483647, componentId)
    }
  }
  for (const field of ['headEnd', 'tailEnd'])
    if (value[field] !== undefined) lineEnd(value[field], componentId)
}
function validateTableProperties(value, componentId, cell = false) {
  const flags = ['rtl', 'firstRow', 'lastRow', 'firstCol', 'lastCol', 'bandRow', 'bandCol']
  const margins = ['marginLeftEmu', 'marginRightEmu', 'marginTopEmu', 'marginBottomEmu']
  record(value, cell ? [...margins, 'verticalAlign', 'anchorCenter', 'verticalText', 'horzOverflow', 'fill', 'borders'] :
    [...flags, 'fill', 'tableStyleId'], [], componentId)
  for (const key of cell ? ['anchorCenter'] : flags)
    if (value[key] !== undefined && typeof value[key] !== 'boolean') tableFailure('boolean', componentId)
  if (value.tableStyleId !== undefined && (typeof value.tableStyleId !== 'string' ||
      !/^\{[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\}$/i.test(value.tableStyleId)))
    tableFailure('table style identity', componentId)
  for (const key of margins)
    if (value[key] !== undefined) integer(value[key], 0, 2147483647, componentId)
  if (value.verticalAlign !== undefined) choice(value.verticalAlign, ['t', 'ctr', 'b', 'just', 'dist'], componentId)
  if (value.verticalText !== undefined)
    choice(value.verticalText, ['horz', 'vert', 'vert270', 'wordArtVert', 'eaVert', 'mongolianVert', 'wordArtVertRtl'], componentId)
  if (value.horzOverflow !== undefined) choice(value.horzOverflow, ['overflow', 'clip'], componentId)
  if (value.fill !== undefined) fill(value.fill, componentId)
  if (value.borders !== undefined) {
    record(value.borders, ['left', 'right', 'top', 'bottom', 'topLeftToBottomRight', 'bottomLeftToTopRight'], [], componentId)
    for (const item of Object.values(value.borders)) border(item, componentId)
  }
}
module.exports = { tableFailure, record, integer, validateTableProperties, TABLE_CELL_DEFAULTS }
