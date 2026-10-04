import {
  buildPptxImageBorderOverlayOptions,
  buildPptxImageOptions,
  gradientFallbackColor,
  resolveColorForTokens,
  resolveMergedCells,
  resolveTableDimensions,
} from 'revealjs-shared'
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_TEXT_COLOR,
  getNativeChartDefinition,
  getShapeType,
  htmlToPptTextRuns,
  mapArrowType,
  mapLineDashType,
  normalizeCssColor,
  normalizeImageSource,
  toPptFontSize,
} from './export-pptx-core'
import { buildTicks, parseDatePos } from 'revealjs-shared/src/timeline-utils.js'
import { resolveChartAuthoringOptions } from 'revealjs-shared/src/chart-authoring-options.js'

function effectiveFontSize(element) {
  const fit = Number(element?._pptxImportMeta?.fitFontSizePx)
  return Number.isFinite(fit) && fit > 0 ? fit : element.fontSize || 16
}

function resolvePptxColor(value, elementType, field, tokens, fallbackValue) {
  return resolveColorForTokens(value, elementType, field, tokens) || fallbackValue
}

export function addTextElement(slide, element, bounds, designTokens) {
  const fontSize = effectiveFontSize(element)
  const textColor = resolvePptxColor(
    element.textColor,
    'text',
    'textColor',
    designTokens,
    '#ffffff'
  )
  const runs = htmlToPptTextRuns(element.content || '', {
    align: element.textAlign,
    color: textColor,
    fontFace: element.fontFamily,
    fontSize,
  })
  if (!runs.length) return

  const baseColor = normalizeCssColor(textColor, DEFAULT_TEXT_COLOR)
  slide.addText(runs, {
    ...bounds,
    color: baseColor.color,
    fontFace: element.fontFamily,
    fontSize: toPptFontSize(fontSize),
    margin: 0.06,
    valign: 'top',
    fit: 'shrink',
    rotate: element.rotation || 0,
  })
}

export function addImageElement(slide, element, bounds, resolution, layout) {
  const source = normalizeImageSource(element.src)
  if (!source) throw new Error('Missing image source')

  slide.addImage(buildPptxImageOptions(source, element, bounds, resolution, layout))

  const borderOverlay = buildPptxImageBorderOverlayOptions(element, bounds)
  if (borderOverlay) slide.addShape('rect', borderOverlay)
}

export function addShapeElement(slide, element, bounds, designTokens) {
  const shapeType = getShapeType(element.shape)
  // pptxgenjs draws a solid fill; for an imported gradient shape (fill is the
  // 'gradient' sentinel) use the first stop color so the export keeps the
  // gradient's identity instead of falling back to the default background.
  const fillSource = element.fillGradient
    ? gradientFallbackColor(element)
    : resolvePptxColor(element.fill, 'shape', 'fill', designTokens, '#6366f1')
  const fill = normalizeCssColor(fillSource, DEFAULT_BACKGROUND_COLOR)
  const stroke = normalizeCssColor(
    element.stroke === 'none'
      ? '#000000'
      : resolvePptxColor(element.stroke, 'shape', 'stroke', designTokens, '#ffffff')
  )
  const transparency =
    element.opacity == null
      ? fill.transparency
      : Math.max(fill.transparency ?? 0, Math.round((1 - element.opacity) * 100))

  const shapeOptions = {
    ...bounds,
    rotate: element.rotation || 0,
    fill: { color: fill.color, transparency },
    line:
      element.stroke === 'none'
        ? { color: stroke.color, transparency: 100, width: 0 }
        : { color: stroke.color, width: element.strokeWidth || 1 },
  }
  if (shapeType === 'roundRect' && element.borderRadius) {
    const maxRadius = Math.min(bounds.w, bounds.h) / 2
    shapeOptions.rectRadius =
      maxRadius > 0 ? Math.min(1, Number(element.borderRadius) / maxRadius) : 0
  }

  slide.addShape(shapeType || 'rect', shapeOptions)

  if (element.text || element.textHtml) {
    const fontSize = effectiveFontSize(element)
    const resolvedTextColor = resolvePptxColor(
      element.textColor,
      'shape',
      'textColor',
      designTokens,
      '#ffffff'
    )
    const textColor = normalizeCssColor(resolvedTextColor, DEFAULT_TEXT_COLOR)
    const textOptions = {
      ...bounds,
      color: textColor.color,
      fontFace: element.fontFamily,
      fontSize: toPptFontSize(fontSize),
      margin: 0.05,
      align: element.textAlign || 'center',
      valign: 'mid',
      fit: 'shrink',
      rotate: element.rotation || 0,
    }
    const runs = element.textHtml
      ? htmlToPptTextRuns(element.textHtml, {
          align: element.textAlign || 'center',
          color: resolvedTextColor,
          fontFace: element.fontFamily,
          fontSize,
        })
      : []
    if (runs.length || element.text) slide.addText(runs.length ? runs : element.text, textOptions)
  }
}

export function addLineElement(slide, element, bounds, resolution, layout, designTokens) {
  const scaleX = layout.width / resolution.width
  const scaleY = layout.height / resolution.height
  const midY = (Number(element.height) || 0) / 2
  const x1 = bounds.x + (element.x1 ?? 0) * scaleX
  const y1 = bounds.y + (element.y1 ?? midY) * scaleY
  const x2 = bounds.x + (element.x2 ?? element.width ?? 0) * scaleX
  const y2 = bounds.y + (element.y2 ?? midY) * scaleY

  // pptxgenjs misrenders negative w/h; normalize to a positive box and use
  // flipH/flipV to preserve the line's direction (and arrowhead orientation).
  slide.addShape('line', {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
    flipH: x2 < x1,
    flipV: y2 < y1,
    line: {
      color: normalizeCssColor(
        resolvePptxColor(element.stroke, 'line', 'stroke', designTokens, '#ffffff')
      ).color,
      width: element.strokeWidth || 2,
      dashType: mapLineDashType(element.dashArray),
      beginArrowType: mapArrowType(element.arrowStart),
      endArrowType: mapArrowType(element.arrowEnd),
    },
    rotate: element.rotation || 0,
  })
}

export function addCodeElement(slide, element, bounds) {
  slide.addText(element.content || '', {
    ...bounds,
    color: normalizeCssColor('#e2e8f0').color,
    fill: { color: normalizeCssColor('#111827').color },
    fontFace: 'Courier New',
    fontSize: toPptFontSize(element.fontSize || 12),
    margin: 0.06,
    valign: 'top',
    fit: 'shrink',
    rotate: element.rotation || 0,
  })
}

export function addCalloutElement(slide, element, bounds, designTokens) {
  const fill = normalizeCssColor(element.calloutColor || '#ef4444')
  const text = normalizeCssColor(
    resolvePptxColor(
      element.calloutTextColor,
      'callout',
      'calloutTextColor',
      designTokens,
      '#ffffff'
    )
  )
  slide.addShape('ellipse', {
    ...bounds,
    fill: { color: fill.color, transparency: fill.transparency },
    line: { color: fill.color, width: 1 },
    rotate: element.rotation || 0,
  })
  slide.addText(String(element.calloutNumber || 1), {
    ...bounds,
    color: text.color,
    fontSize: toPptFontSize(element.fontSize || 16),
    bold: true,
    align: 'center',
    valign: 'mid',
    fit: 'shrink',
    rotate: element.rotation || 0,
  })
}

export function addTableElement(slide, element, bounds, designTokens) {
  const data = Array.isArray(element.data) && element.data.length ? element.data : [['']]
  const columnCount = data.reduce(
    (count, row) => Math.max(count, Array.isArray(row) ? row.length : 0),
    0
  )
  const { spans: mergeByStart, covered } = resolveMergedCells(element.mergedCells, {
    rowCount: data.length,
    colCount: columnCount,
  })

  const cellStyles = element.cellStyles || {}
  const getCellStyle = (key, rowIndex, colIndex) => cellStyles[key]?.[rowIndex]?.[colIndex]
  const mapVAlign = (value) => (value === 'middle' ? 'mid' : value || undefined)
  const safeFontFamily = (value) => {
    const family = typeof value === 'string' ? value.trim() : ''
    if (!family) return undefined
    if ([...family].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))
      return undefined
    if (/[;:()\\/]/.test(family)) return undefined
    if (/\/\*|\*\/|url|import|expression|javascript|behavior|binding/i.test(family))
      return undefined
    return /^[a-zA-Z0-9 _.-]+$/.test(family) ? family : undefined
  }
  const colWidths = resolveTableDimensions(element.colWidths, bounds.w)
  const rowHeights = resolveTableDimensions(element.rowHeights, bounds.h)
  const padding = Number(element.cellPadding ?? 8)
  const paddingPoints = (Number.isFinite(padding) ? Math.max(0, padding) : 8) * 0.75
  // PptxGenJS table margins below one are inches; larger values are points.
  const cellMargin = paddingPoints >= 1 ? paddingPoints : paddingPoints / 72
  const tableTextColor = resolvePptxColor(
    element.textColor,
    'table',
    'textColor',
    designTokens,
    '#ffffff'
  )
  const headerTextColor = resolvePptxColor(
    element.headerTextColor,
    'table',
    'headerTextColor',
    designTokens,
    tableTextColor
  )

  const rows = data.map((row, rowIndex) =>
    (Array.isArray(row) ? row : []).reduce((cells, cell, colIndex) => {
      if (covered.has(`${rowIndex}:${colIndex}`)) return cells
      const merge = mergeByStart.get(`${rowIndex}:${colIndex}`)
      const fillColor = normalizeCssColor(
        getCellStyle('bgColors', rowIndex, colIndex) ||
          (element.headerRow && rowIndex === 0
            ? resolvePptxColor(
                element.headerBgColor,
                'table',
                'headerBgColor',
                designTokens,
                '#6366f1'
              )
            : resolvePptxColor(
                element.cellBgColor,
                'table',
                'cellBgColor',
                designTokens,
                '#1e1e2e'
              )),
        DEFAULT_BACKGROUND_COLOR
      )
      const textColor = normalizeCssColor(
        getCellStyle('textColors', rowIndex, colIndex) ||
          (element.headerRow && rowIndex === 0 ? headerTextColor : tableTextColor),
        DEFAULT_TEXT_COLOR
      )
      const cellFontSize = Number(getCellStyle('fontSizes', rowIndex, colIndex))
      const cellFontFamily = safeFontFamily(getCellStyle('fontFamilies', rowIndex, colIndex))
      cells.push({
        text: String(cell ?? ''),
        options: {
          color: textColor.color,
          fontSize: toPptFontSize(
            Number.isFinite(cellFontSize) && cellFontSize > 0
              ? cellFontSize
              : element.fontSize || 12
          ),
          margin: cellMargin,
          fill: { color: fillColor.color, transparency: fillColor.transparency },
          border: {
            color: normalizeCssColor(element.borderColor || '#475569').color,
            pt: element.borderWidth ?? 1,
          },
          ...(cellFontFamily && { fontFace: cellFontFamily }),
          bold:
            getCellStyle('isBold', rowIndex, colIndex) != null
              ? Boolean(getCellStyle('isBold', rowIndex, colIndex))
              : Boolean(element.headerRow && rowIndex === 0 && (element.headerIsBold ?? true)),
          ...(getCellStyle('aligns', rowIndex, colIndex) && {
            align: getCellStyle('aligns', rowIndex, colIndex),
          }),
          ...(getCellStyle('vAligns', rowIndex, colIndex) && {
            valign: mapVAlign(getCellStyle('vAligns', rowIndex, colIndex)),
          }),
          ...(merge?.colSpan > 1 && { colspan: merge.colSpan }),
          ...(merge?.rowSpan > 1 && { rowspan: merge.rowSpan }),
        },
      })
      return cells
    }, [])
  )

  const tableOptions = {
    ...bounds,
    margin: cellMargin,
    ...(colWidths && { colW: colWidths.map((value) => Math.round(value * 100) / 100) }),
    ...(rowHeights && { rowH: rowHeights.map((value) => Math.round(value * 100) / 100) }),
  }

  if (rows.length) slide.addTable(rows, tableOptions)
}

export function addChartElement(slide, element, bounds, pptx) {
  const definition = getNativeChartDefinition(pptx, element)
  if (!definition) throw new Error(`Unsupported chart type: ${element.chartType || 'chart'}`)
  const authoredOptions = resolveChartAuthoringOptions(element)
  slide.addChart(definition.type, definition.data, {
    ...bounds,
    ...definition.options,
    showLegend: element.showLegend === false ? false : (authoredOptions.legend.display ?? true),
  })
}

function childBounds(element, bounds, x, y, width, height) {
  const w = (width * bounds.w) / element.width,
    h = (height * bounds.h) / element.height
  const cx = ((x + width / 2) * bounds.w) / element.width - bounds.w / 2
  const cy = ((y + height / 2) * bounds.h) / element.height - bounds.h / 2
  const angle = ((Number(element.rotation) || 0) * Math.PI) / 180
  return {
    x: bounds.x + bounds.w / 2 + cx * Math.cos(angle) - cy * Math.sin(angle) - w / 2,
    y: bounds.y + bounds.h / 2 + cx * Math.sin(angle) + cy * Math.cos(angle) - h / 2,
    w,
    h,
    rotate: element.rotation || 0,
  }
}

export function addTimelineElement(slide, source, bounds, designTokens) {
  const element = {
    ...source,
    width: Number(source.width) || 800,
    height: Number(source.height) || 400,
  }
  const { width, height } = element
  const lineY = height / 2,
    pad = 30,
    fontSize = Number(element.fontSize) || 11
  const paint = (field, fallback) =>
    normalizeCssColor(
      resolveColorForTokens(element[field], 'timeline', field, designTokens) || fallback
    ).color
  const lineColor = paint('lineColor', '#6366f1'),
    dotColor = paint('dotColor', `#${lineColor}`),
    textColor = paint('textColor', '#ffffff')
  const start = element.timelineStart ?? element.startDate ?? '2000'
  const end = element.timelineEnd ?? element.endDate ?? '2025'
  const spacing = element.tickSpacing || 'auto'
  const yearMode =
    ['year', '10year', '100year', '1000year'].includes(spacing) ||
    (spacing === 'auto' && /^-?\d+$/.test(String(start)))
  const position = (date) => parseDatePos(date, start, end, width, pad, yearMode)
  const line = (x, y, w, h, options = {}) =>
    slide.addShape('line', {
      ...childBounds(
        element,
        bounds,
        x + Math.min(0, w),
        y + Math.min(0, h),
        Math.abs(w),
        Math.abs(h)
      ),
      line: { color: lineColor, width: 1, ...options },
    })
  const text = (value, x, y, size = fontSize, options = {}) =>
    slide.addText(String(value ?? ''), {
      ...childBounds(element, bounds, x - 110, y - size, 220, size * 1.5),
      color: textColor,
      fontFace: element.fontFamily || designTokens?.fonts?.body || 'Arial',
      fontSize: toPptFontSize(size),
      margin: 0,
      align: 'center',
      valign: 'top',
      ...options,
    })
  line(pad, lineY, width - pad * 2, 0, { width: 1.5 })
  for (const tick of buildTicks(start, end, spacing, yearMode, width - pad * 2, fontSize - 1)) {
    const x = position(tick.date)
    line(x, lineY - 4, 0, 8)
    text(tick.label, x, lineY + 18, fontSize - 1, { transparency: 50 })
  }
  for (const item of element.events || element.items || []) {
    const x = position(item.date),
      top = item.side !== 'bottom'
    const connector = item.connectorLength ?? item.connectorOffset ?? element.connectorOffset ?? 0
    const cardY = top ? 8 - connector : lineY + 28 + connector
    const cardHeight = top ? lineY - 36 : height - lineY - 36
    const image = item.imageUrl ?? item.image ?? ''
    const imageHeight = image ? Math.min(cardHeight * 0.55, 60) : 0
    const connectorY = top ? cardY + cardHeight : lineY
    line(x, connectorY, 0, top ? lineY - connectorY : cardY - lineY, {
      dashType: 'dash',
      transparency: 50,
    })
    slide.addShape('ellipse', {
      ...childBounds(element, bounds, x - 4, lineY - 4, 8, 8),
      fill: { color: dotColor },
      line: { color: dotColor, transparency: 100 },
    })
    let y = top ? cardY + fontSize : cardY + imageHeight + fontSize + 2
    text(item.title ?? item.label ?? '', x, y, fontSize, { bold: true })
    y += fontSize + 2
    if (item.description) {
      text(item.description, x, y, fontSize - 1, { transparency: 40 })
      y += fontSize
    }
    text(yearMode ? String(parseInt(item.date) || item.date) : item.date, x, y, fontSize - 2, {
      transparency: 65,
    })
    if (image)
      slide.addImage({
        ...normalizeImageSource(image),
        ...childBounds(element, bounds, x - 40, top ? y + 4 : cardY, 80, imageHeight),
      })
  }
}
