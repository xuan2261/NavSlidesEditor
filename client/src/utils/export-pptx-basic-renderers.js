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
} from './export-pptx-core'

export function addTextElement(slide, element, bounds) {
  const runs = htmlToPptTextRuns(element.content || '', {
    align: element.textAlign,
    color: element.textColor || '#ffffff',
    fontFace: element.fontFamily,
    fontSize: element.fontSize || 16,
  })
  if (!runs.length) return

  const baseColor = normalizeCssColor(element.textColor || '#ffffff', DEFAULT_TEXT_COLOR)
  slide.addText(runs, {
    ...bounds,
    color: baseColor.color,
    fontFace: element.fontFamily,
    fontSize: element.fontSize || 16,
    margin: 0.06,
    valign: 'top',
    fit: 'shrink',
    rotate: element.rotation || 0,
  })
}

export function addImageElement(slide, element, bounds, resolution, layout) {
  const source = normalizeImageSource(element.src)
  if (!source) throw new Error('Missing image source')

  const imageOptions = {
    ...source,
    ...bounds,
    rotate: element.rotation || 0,
  }
  if (element.flipH) imageOptions.flipH = true
  if (element.flipV) imageOptions.flipV = true
  if (element.alt || element.altText) imageOptions.altText = element.alt || element.altText

  if (element.cropData) {
    const crop = element.cropData || {}
    const left = Number(crop.left) || 0
    const right = Number(crop.right) || 0
    const top = Number(crop.top) || 0
    const bottom = Number(crop.bottom) || 0
    const visibleW = Math.max(0.01, 1 - left - right)
    const visibleH = Math.max(0.01, 1 - top - bottom)
    imageOptions.sizing = {
      type: 'crop',
      x: bounds.x - (bounds.w * left) / visibleW,
      y: bounds.y - (bounds.h * top) / visibleH,
      w: bounds.w / visibleW,
      h: bounds.h / visibleH,
    }
  } else if (element.imageW != null && element.imageH != null) {
    imageOptions.sizing = {
      type: 'crop',
      x: Math.max(0, (-(element.imageOffsetX || 0) * layout.width) / resolution.width),
      y: Math.max(0, (-(element.imageOffsetY || 0) * layout.height) / resolution.height),
      w: Math.max(bounds.w, (element.imageW * layout.width) / resolution.width),
      h: Math.max(bounds.h, (element.imageH * layout.height) / resolution.height),
    }
  } else if (element.objectFit) {
    imageOptions.sizing = {
      type: element.objectFit === 'cover' ? 'cover' : 'contain',
      w: bounds.w,
      h: bounds.h,
    }
  }

  slide.addImage(imageOptions)

  if (element.borderColor && element.borderWidth) {
    const border = normalizeCssColor(element.borderColor)
    slide.addShape('rect', {
      ...bounds,
      fill: { color: 'FFFFFF', transparency: 100 },
      line: { color: border.color, transparency: border.transparency, width: element.borderWidth },
      rotate: element.rotation || 0,
    })
  }
}

export function addShapeElement(slide, element, bounds) {
  const shapeType = getShapeType(element.shape)
  const fill = normalizeCssColor(element.fill || '#6366f1', DEFAULT_BACKGROUND_COLOR)
  const stroke = normalizeCssColor(element.stroke === 'none' ? '#000000' : element.stroke || '#ffffff')
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
    shapeOptions.rectRadius = maxRadius > 0 ? Math.min(1, Number(element.borderRadius) / maxRadius) : 0
  }

  slide.addShape(shapeType || 'rect', shapeOptions)

  if (element.text || element.textHtml) {
    const textColor = normalizeCssColor(element.textColor || '#ffffff', DEFAULT_TEXT_COLOR)
    const textOptions = {
      ...bounds,
      color: textColor.color,
      fontFace: element.fontFamily,
      fontSize: element.fontSize || 16,
      margin: 0.05,
      align: element.textAlign || 'center',
      valign: 'mid',
      fit: 'shrink',
      rotate: element.rotation || 0,
    }
    const runs = element.textHtml
      ? htmlToPptTextRuns(element.textHtml, {
        align: element.textAlign || 'center',
        color: element.textColor || '#ffffff',
        fontFace: element.fontFamily,
        fontSize: element.fontSize || 16,
      })
      : []
    if (runs.length || element.text) slide.addText(runs.length ? runs : element.text, textOptions)
  }
}

export function addLineElement(slide, element, bounds, resolution, layout) {
  const scaleX = layout.width / resolution.width
  const scaleY = layout.height / resolution.height
  const midY = (Number(element.height) || 0) / 2
  const x1 = bounds.x + (element.x1 ?? 0) * scaleX
  const y1 = bounds.y + (element.y1 ?? midY) * scaleY
  const x2 = bounds.x + (element.x2 ?? element.width ?? 0) * scaleX
  const y2 = bounds.y + (element.y2 ?? midY) * scaleY

  slide.addShape('line', {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    line: {
      color: normalizeCssColor(element.stroke || '#ffffff').color,
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
    fontSize: element.fontSize || 12,
    margin: 0.06,
    valign: 'top',
    fit: 'shrink',
    rotate: element.rotation || 0,
  })
}

export function addCalloutElement(slide, element, bounds) {
  const fill = normalizeCssColor(element.calloutColor || '#ef4444')
  const text = normalizeCssColor(element.calloutTextColor || '#ffffff')
  slide.addShape('ellipse', {
    ...bounds,
    fill: { color: fill.color, transparency: fill.transparency },
    line: { color: fill.color, width: 1 },
    rotate: element.rotation || 0,
  })
  slide.addText(String(element.calloutNumber || 1), {
    ...bounds,
    color: text.color,
    fontSize: element.fontSize || 16,
    bold: true,
    align: 'center',
    valign: 'mid',
    fit: 'shrink',
    rotate: element.rotation || 0,
  })
}

export function addTableElement(slide, element, bounds) {
  const mergedCells = Array.isArray(element.mergedCells) ? element.mergedCells : []
  const mergeByStart = new Map()
  const covered = new Set()
  mergedCells.forEach((merge) => {
    const row = Number(merge.row) || 0
    const col = Number(merge.col) || 0
    const rowSpan = Math.max(1, Number(merge.rowSpan) || 1)
    const colSpan = Math.max(1, Number(merge.colSpan) || 1)
    mergeByStart.set(`${row}:${col}`, { rowSpan, colSpan })
    for (let ri = row; ri < row + rowSpan; ri++) {
      for (let ci = col; ci < col + colSpan; ci++) {
        if (ri !== row || ci !== col) covered.add(`${ri}:${ci}`)
      }
    }
  })

  const cellStyles = element.cellStyles || {}
  const getCellStyle = (key, rowIndex, colIndex) => cellStyles[key]?.[rowIndex]?.[colIndex]
  const mapVAlign = (value) => (value === 'middle' ? 'mid' : value || undefined)

  const rows = (element.data || []).map((row, rowIndex) =>
    (row || []).reduce((cells, cell, colIndex) => {
      if (covered.has(`${rowIndex}:${colIndex}`)) return cells
      const merge = mergeByStart.get(`${rowIndex}:${colIndex}`)
      const fillColor = normalizeCssColor(
        getCellStyle('bgColors', rowIndex, colIndex) ||
          (element.headerRow && rowIndex === 0
            ? element.headerBgColor || '#6366f1'
            : element.cellBgColor || '#1e1e2e'),
        DEFAULT_BACKGROUND_COLOR
      )
      const textColor = normalizeCssColor(
        getCellStyle('textColors', rowIndex, colIndex) || element.textColor || '#ffffff',
        DEFAULT_TEXT_COLOR
      )
      cells.push({
        text: cell || '',
        options: {
          color: textColor.color,
          fontSize: element.fontSize || 12,
          margin: 0.04,
          fill: { color: fillColor.color, transparency: fillColor.transparency },
          border: {
            color: normalizeCssColor(element.borderColor || '#475569').color,
            pt: element.borderWidth || 1,
          },
          ...(getCellStyle('isBold', rowIndex, colIndex) != null && { bold: Boolean(getCellStyle('isBold', rowIndex, colIndex)) }),
          ...(getCellStyle('aligns', rowIndex, colIndex) && { align: getCellStyle('aligns', rowIndex, colIndex) }),
          ...(getCellStyle('vAligns', rowIndex, colIndex) && { valign: mapVAlign(getCellStyle('vAligns', rowIndex, colIndex)) }),
          ...(merge?.colSpan > 1 && { colspan: merge.colSpan }),
          ...(merge?.rowSpan > 1 && { rowspan: merge.rowSpan }),
        },
      })
      return cells
    }, [])
  )

  if (rows.length) slide.addTable(rows, { ...bounds, margin: 0.04 })
}

export function addChartElement(slide, element, bounds, pptx) {
  const definition = getNativeChartDefinition(pptx, element)
  if (!definition) throw new Error(`Unsupported chart type: ${element.chartType || 'chart'}`)
  slide.addChart(definition.type, definition.data, {
    ...bounds,
    ...definition.options,
  })
}
