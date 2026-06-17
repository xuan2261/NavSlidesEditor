const { DEFAULT_BACKGROUND_COLOR, DEFAULT_TEXT_COLOR, normalizeCssColor } = require('./shared-color-utils')
const { htmlToPptTextRuns, stripHtmlToPlainText } = require('./shared-text-runs')

const CANVAS_WIDTH = 960
const CANVAS_HEIGHT = 540
const DEFAULT_PPT_WIDTH = 10
const DEFAULT_PPT_HEIGHT = 10
const SAFE_IMAGE_DATA_URL = /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]*$/i

function roundCoord(value) {
  return Number(value.toFixed(4))
}

function toPptFontSize(value) {
  const size = Number(value)
  if (!Number.isFinite(size) || size <= 0) return undefined
  return Math.round(size * 0.75 * 10) / 10
}

function getPresentationResolution(presentation) {
  const width = Number(presentation && presentation.resolution && presentation.resolution.width) || CANVAS_WIDTH
  const height = Number(presentation && presentation.resolution && presentation.resolution.height) || CANVAS_HEIGHT
  return { width, height }
}

function getPptxExportLayout(presentation) {
  const originalSize = presentation && presentation._pptxMeta && presentation._pptxMeta.originalSize
  const width = Number(originalSize && originalSize.width)
  const height = Number(originalSize && originalSize.height)
  if (width > 0 && height > 0) return { width, height }
  return getPresentationResolution(presentation)
}

function getPptxLayout(resolution) {
  const width = Number(resolution && resolution.width) || CANVAS_WIDTH
  const height = Number(resolution && resolution.height) || CANVAS_HEIGHT
  const aspect = height > 0 ? width / height : CANVAS_WIDTH / CANVAS_HEIGHT

  if (aspect >= 1) {
    return {
      width: DEFAULT_PPT_WIDTH,
      height: roundCoord(DEFAULT_PPT_WIDTH / aspect),
    }
  }

  return {
    width: roundCoord(DEFAULT_PPT_HEIGHT * aspect),
    height: DEFAULT_PPT_HEIGHT,
  }
}

function scaleElementBounds(element, resolution, layout) {
  const scaleX = layout.width / resolution.width
  const scaleY = layout.height / resolution.height
  return {
    x: roundCoord((element && element.x ? element.x : 0) * scaleX),
    y: roundCoord((element && element.y ? element.y : 0) * scaleY),
    w: roundCoord((element && element.width ? element.width : 0) * scaleX),
    h: roundCoord((element && element.height ? element.height : 0) * scaleY),
  }
}

function normalizeImageSource(src) {
  if (!src) return null
  const raw = String(src).trim()
  if (!raw) return null
  if (raw.startsWith('data:')) return SAFE_IMAGE_DATA_URL.test(raw) ? { data: raw } : null
  return { path: raw }
}

function getBackgroundImageUrl(background) {
  if (!background || background.type !== 'image') return ''
  return background.image || background.src || ''
}

function createSvgDataUri(svg) {
  const encoded = Buffer.from(String(svg || ''), 'utf8').toString('base64')
  return `data:image/svg+xml;base64,${encoded}`
}

function getShapeType(shape) {
  switch (shape) {
    case 'arrow-right':
      return 'rightArrow'
    case 'bracket':
      return 'leftBrace'
    case 'circle':
      return 'ellipse'
    case 'cloud':
      return 'cloud'
    case 'cylinder':
      return 'can'
    case 'diamond':
      return 'diamond'
    case 'hexagon':
      return 'hexagon'
    case 'parallelogram':
      return 'parallelogram'
    case 'pentagon':
      return 'pentagon'
    case 'rounded-rect':
      return 'roundRect'
    case 'star':
      return 'star5'
    case 'trapezoid':
      return 'trapezoid'
    case 'triangle':
      return 'triangle'
    default:
      return 'rect'
  }
}

function mapLineDashType(dashArray) {
  if (!dashArray) return 'solid'
  if (String(dashArray).includes('2')) return 'sysDot'
  if (String(dashArray).includes('10') || String(dashArray).includes('12')) return 'lgDash'
  return 'dash'
}

function mapArrowType(marker) {
  switch (marker) {
    case 'arrow':
      return 'arrow'
    case 'circle':
    case 'oval':
      return 'oval'
    case 'diamond':
      return 'diamond'
    case 'stealth':
      return 'stealth'
    case 'triangle':
    case 'square':
      return 'triangle'
    default:
      return 'none'
  }
}

function isNativeChartType(chartType) {
  return ['bar', 'doughnut', 'line', 'pie', 'radar'].includes(chartType)
}

function getNativeChartDefinition(pptx, element) {
  const chartType = (element && element.chartType) || 'bar'
  if (!isNativeChartType(chartType)) return null

  const datasets = Array.isArray(element && element.chartData && element.chartData.datasets)
    ? element.chartData.datasets
    : []
  const labels = Array.isArray(element && element.chartData && element.chartData.labels)
    ? element.chartData.labels
    : []

  const data = datasets.map((dataset, index) => ({
    name: (dataset && dataset.label) || `Series ${index + 1}`,
    labels,
    values: Array.isArray(dataset && dataset.data)
      ? dataset.data.map((value) => Number(value) || 0)
      : [],
  }))

  if (!data.length) return null

  return {
    type: pptx.ChartType[chartType],
    data,
    options: {
      showLegend: datasets.length > 1,
      showTitle: false,
      lineSize: chartType === 'line' ? 2 : undefined,
      chartColors: datasets
        .map((dataset) => normalizeCssColor((dataset && dataset.color) || '#6366f1').color)
        .filter(Boolean),
    },
  }
}

module.exports = {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_TEXT_COLOR,
  createSvgDataUri,
  getBackgroundImageUrl,
  getNativeChartDefinition,
  getPptxExportLayout,
  getPptxLayout,
  getPresentationResolution,
  getShapeType,
  htmlToPptTextRuns,
  isNativeChartType,
  mapArrowType,
  mapLineDashType,
  normalizeCssColor,
  normalizeImageSource,
  scaleElementBounds,
  stripHtmlToPlainText,
  toPptFontSize,
}
