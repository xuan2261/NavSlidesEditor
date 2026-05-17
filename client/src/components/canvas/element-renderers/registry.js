import { CalloutRenderer } from './callout-element-renderer'
import { IconRenderer } from './icon-element-renderer'
import { QrCodeRenderer } from './qrcode-element-renderer'
import { DrawingRenderer } from './drawing-element-renderer'
import { SvgElementRenderer } from './svg-element-renderer'
import { MarkdownRenderer } from './markdown-element-renderer'
import { CropOverlay, CROP_HANDLES } from '../canvas-crop-overlay-with-handles'
import { ChartRenderer } from './chart-element-renderer'
import { LatexRenderer } from './latex-element-renderer'
import { TableRenderer } from './table-element-renderer'
import { ShapeRenderer } from './shape-element-renderer'
import { LineArrowRenderer, ARROWHEAD_MARKERS } from './line-element-renderer'
import { GameElementRenderer } from './game-element-renderer'
import { TimelineRenderer } from './timeline-element-renderer'

export const elementRendererRegistry = {
  callout: CalloutRenderer,
  icon: IconRenderer,
  qrcode: QrCodeRenderer,
  drawing: DrawingRenderer,
  svg: SvgElementRenderer,
  markdown: MarkdownRenderer,
  chart: ChartRenderer,
  latex: LatexRenderer,
  table: TableRenderer,
  shape: ShapeRenderer,
  line: LineArrowRenderer,
  game: GameElementRenderer,
  timeline: TimelineRenderer,
}

export function getElementRenderer(type) {
  return elementRendererRegistry[type] || null
}

export { CropOverlay, CROP_HANDLES, ARROWHEAD_MARKERS }
