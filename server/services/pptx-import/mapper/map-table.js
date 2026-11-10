const { readNumber } = require('../geometry')
const { baseElement, placeholder } = require('./utils-base')
const { mapTableCellValue } = require('./table-rich-cell')
const { cellInsets, cellTextStyle, cellVerticalAlign } = require('./table-cell-style')

const DEFAULT_TABLE_BORDER = Object.freeze({ color: '#d1d5db', width: 1, style: 'solid' })
const TABLE_BORDER_SIDES = ['top', 'right', 'bottom', 'left']
const TABLE_BORDER_STYLES = new Set(['solid', 'dashed', 'dotted', 'double', 'none'])

function sanitizeCssColor(value, fallback) {
  const color = typeof value === 'string' ? value.trim() : ''
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color
  if (/^rgba?\(\s*[\d.\s,%]+\)$/i.test(color)) return color
  if (/^hsla?\(\s*[\d.\s,%deg]+\)$/i.test(color)) return color
  if (['transparent', 'currentColor'].includes(color)) return color
  return fallback
}

function sanitizeBorderStyle(value, fallback) {
  const style = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return TABLE_BORDER_STYLES.has(style) ? style : fallback
}

function normalizeBorderSide(raw, fallback = DEFAULT_TABLE_BORDER) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const fallbackStyle = fallback.style || DEFAULT_TABLE_BORDER.style
  return {
    color: sanitizeCssColor(source.color || source.borderColor, fallback.color),
    width: readNumber(source.width ?? source.borderWidth, fallback.width, 0),
    style: sanitizeBorderStyle(source.style || source.borderType || source.type, fallbackStyle),
  }
}

function normalizeBorderSet(rawBorders, fallbackRaw = null) {
  const fallback = fallbackRaw ? normalizeBorderSide(fallbackRaw, DEFAULT_TABLE_BORDER) : DEFAULT_TABLE_BORDER
  const raw = rawBorders && typeof rawBorders === 'object' ? rawBorders : {}
  const uniform = raw.color || raw.borderColor || raw.width != null || raw.borderWidth != null || raw.style || raw.borderType
    ? normalizeBorderSide(raw, fallback)
    : fallback
  return Object.fromEntries(TABLE_BORDER_SIDES.map((side) => [side, normalizeBorderSide(raw[side], uniform)]))
}

function pushEmptyCell(row, tableBorders) {
  row.textColors.push(null)
  row.bgColors.push(null)
  row.isBold.push(false)
  row.fontSizes.push(null)
  row.fontFamilies.push(null)
  row.aligns.push('left')
  row.vAligns.push('middle')
  row.borders.push(normalizeBorderSet(null, tableBorders))
  row.insets.push(null)
}

function scaleDimensionList(values, axisScale) {
  return Array.isArray(values)
    ? values.map((value) => Math.round(readNumber(value, 0, 0) * axisScale))
    : []
}

function mapTable(element, context) {
  if (!Array.isArray(element.data) || !element.data.length) {
    return [placeholder(element, context.scale, context.zIndex, context.slideIndex, context.warnings, 'table-unusable', 'Table structure unavailable')]
  }

  const rows = element.data.length
  const cols = Math.max(...element.data.map((row) => (row || []).length))
  const data = []
  const mergedCells = []
  const cellStyles = {
    textColors: [],
    bgColors: [],
    isBold: [],
    fontSizes: [],
    fontFamilies: [],
    aligns: [],
    vAligns: [],
    borders: [],
    insets: [],
  }
  const tableBorders = element.borders || {
    color: element.borderColor,
    width: element.borderWidth,
    style: element.borderType || element.borderStyle,
  }

  for (let ri = 0; ri < rows; ri++) {
    const row = element.data[ri] || []
    const dataRow = []
    const cellStylesRow = {
      textColors: [],
      bgColors: [],
      isBold: [],
      fontSizes: [],
      fontFamilies: [],
      aligns: [],
      vAligns: [],
      borders: [],
      insets: [],
    }

    for (let ci = 0; ci < cols; ci++) {
      const rawCell = row[ci]
      const cell = rawCell && typeof rawCell === 'object' ? rawCell : { text: rawCell ?? '' }
      if (rawCell == null || cell.vMerge === 0 || cell.hMerge === 0) {
        dataRow.push('')
        pushEmptyCell(cellStylesRow, tableBorders)
        continue
      }

      const html = cell.text ?? cell.content ?? ''
      const textStyle = cellTextStyle(cell, typeof html === 'string' ? html : '', context.scale)
      dataRow.push(typeof rawCell === 'object' ? mapTableCellValue(html, context.scale, textStyle.bold) : rawCell)
      cellStylesRow.textColors.push(textStyle.textColor)
      cellStylesRow.bgColors.push(cell.fillColor ?? null)
      cellStylesRow.isBold.push(textStyle.bold)
      cellStylesRow.fontSizes.push(textStyle.fontSize)
      cellStylesRow.fontFamilies.push(textStyle.fontFamily)
      cellStylesRow.aligns.push(['left', 'center', 'right', 'justify'].includes(textStyle.align) ? textStyle.align : 'left')
      cellStylesRow.vAligns.push(cellVerticalAlign(cell.vAlign))
      cellStylesRow.insets.push(cellInsets(cell, context.scale))
      cellStylesRow.borders.push(normalizeBorderSet(cell.borders || cell.border, tableBorders))

      if ((cell.rowSpan && cell.rowSpan > 1) || (cell.colSpan && cell.colSpan > 1)) {
        mergedCells.push({ row: ri, col: ci, rowSpan: cell.rowSpan || 1, colSpan: cell.colSpan || 1 })
      }
    }

    data.push(dataRow)
    cellStyles.textColors.push(cellStylesRow.textColors)
    cellStyles.bgColors.push(cellStylesRow.bgColors)
    cellStyles.isBold.push(cellStylesRow.isBold)
    cellStyles.fontSizes.push(cellStylesRow.fontSizes)
    cellStyles.fontFamilies.push(cellStylesRow.fontFamilies)
    cellStyles.aligns.push(cellStylesRow.aligns)
    cellStyles.vAligns.push(cellStylesRow.vAligns)
    cellStyles.borders.push(cellStylesRow.borders)
    cellStyles.insets.push(cellStylesRow.insets)
  }

  context.stats.tableCount += 1
  const border = normalizeBorderSide(tableBorders)
  const table = {
    ...baseElement(element, context.scale, context.zIndex),
    type: 'table',
    data,
    rows,
    cols,
    headerRow: element.headerRow ?? true,
    borderColor: border.color,
    borderWidth: border.width,
    textColor: '#111827',
    cellBgColor: 'transparent',
    headerBgColor: 'rgba(99,102,241,0.18)',
    headerTextColor: '#1e40af',
    headerIsBold: element.headerIsBold ?? true,
    cellStyles,
    mergedCells,
    colWidths: scaleDimensionList(element.colWidths, context.scale.x),
    rowHeights: scaleDimensionList(element.rowHeights, context.scale.y),
  }
  if (!cellStyles.insets.some((row) => row.some(Boolean))) delete cellStyles.insets
  if (element.cellPadding != null) table.cellPadding = element.cellPadding
  if (element.borderType != null || element.borderStyle != null || tableBorders.style != null) table.borderStyle = border.style
  if (element.fill && element.fill.type === 'color') table.headerBgColor = element.fill.value || table.headerBgColor
  return [table]
}

module.exports = {
  DEFAULT_TABLE_BORDER,
  mapTable,
  normalizeBorderSet,
  sanitizeCssColor,
}
