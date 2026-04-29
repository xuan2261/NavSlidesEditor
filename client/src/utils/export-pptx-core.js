import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../data/slide-constants'
import { DEFAULT_BACKGROUND_COLOR, DEFAULT_TEXT_COLOR, normalizeCssColor } from './export-pptx-color-utils'

const DEFAULT_PPT_WIDTH = 10
const DEFAULT_PPT_HEIGHT = 10

function roundCoord(value) {
  return Number(value.toFixed(4))
}

export { htmlToPptTextRuns, stripHtmlToPlainText } from './export-pptx-text-runs'

export function getPresentationResolution(presentation) {
  const width = Number(presentation?.resolution?.width) || CANVAS_WIDTH
  const height = Number(presentation?.resolution?.height) || CANVAS_HEIGHT
  return { width, height }
}

export function getPptxLayout(resolution) {
  const width = Number(resolution?.width) || CANVAS_WIDTH
  const height = Number(resolution?.height) || CANVAS_HEIGHT
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

export function scaleElementBounds(element, resolution, layout) {
  const scaleX = layout.width / resolution.width
  const scaleY = layout.height / resolution.height
  return {
    x: roundCoord((element?.x || 0) * scaleX),
    y: roundCoord((element?.y || 0) * scaleY),
    w: roundCoord((element?.width || 0) * scaleX),
    h: roundCoord((element?.height || 0) * scaleY),
  }
}

export function normalizeImageSource(src) {
  if (!src) return null
  if (String(src).startsWith('data:')) return { data: src }
  return { path: src }
}

export function getBackgroundImageUrl(background) {
  if (!background || background.type !== 'image') return ''
  return background.image || background.src || ''
}

export function createSvgDataUri(svg) {
  const binary = encodeURIComponent(svg).replace(/%([0-9A-F]{2})/gi, (_, value) =>
    String.fromCharCode(Number.parseInt(value, 16))
  )
  const encoded =
    typeof btoa === 'function'
      ? btoa(binary)
      : globalThis.Buffer.from(svg, 'utf8').toString('base64')
  return `data:image/svg+xml;base64,${encoded}`
}

export function getShapeType(shape) {
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

export function mapLineDashType(dashArray) {
  if (!dashArray) return 'solid'
  if (String(dashArray).includes('2')) return 'sysDot'
  if (String(dashArray).includes('10') || String(dashArray).includes('12')) return 'lgDash'
  return 'dash'
}

export function mapArrowType(marker) {
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
      return 'triangle'
    case 'square':
      return 'triangle'
    default:
      return 'none'
  }
}

export function isNativeChartType(chartType) {
  return ['bar', 'doughnut', 'line', 'pie', 'radar'].includes(chartType)
}

export function getNativeChartDefinition(pptx, element) {
  const chartType = element?.chartType || 'bar'
  if (!isNativeChartType(chartType)) return null

  const datasets = Array.isArray(element?.chartData?.datasets) ? element.chartData.datasets : []
  const labels = Array.isArray(element?.chartData?.labels) ? element.chartData.labels : []
  const data = datasets.map((dataset, index) => ({
    name: dataset?.label || `Series ${index + 1}`,
    labels,
    values: Array.isArray(dataset?.data) ? dataset.data.map((value) => Number(value) || 0) : [],
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
        .map((dataset) => normalizeCssColor(dataset?.color || '#6366f1').color)
        .filter(Boolean),
    },
  }
}

export { DEFAULT_BACKGROUND_COLOR, DEFAULT_TEXT_COLOR, normalizeCssColor }
