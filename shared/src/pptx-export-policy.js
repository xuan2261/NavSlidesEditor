const {
  hasPptxImageVisualEffects,
  isPptxRasterSafeImageSource,
} = require('./pptx-image-options')
const { classifyPptxMediaSource } = require('./pptx-media-options')

const PPTX_ELEMENT_EXPORT_POLICY = {
  text: { mode: 'native' },
  image: { mode: 'native' },
  shape: { mode: 'native' },
  code: { mode: 'native' },
  latex: { mode: 'server-prefetch-raster', requiresServer: true, failure: 'error' },
  html: { mode: 'server-prefetch-raster', requiresServer: true, failure: 'error' },
  markdown: { mode: 'client-fallback-raster' },
  chart: { mode: 'native' },
  video: { mode: 'media-cover', fallback: 'placeholder' },
  audio: { mode: 'media-cover', fallback: 'placeholder' },
  table: { mode: 'native' },
  icon: { mode: 'client-fallback-raster' },
  callout: { mode: 'native' },
  qrcode: { mode: 'client-fallback-raster' },
  drawing: { mode: 'client-fallback-raster' },
  line: { mode: 'native' },
  svg: { mode: 'client-fallback-raster' },
  timeline: { mode: 'client-fallback-raster' },
  game: { mode: 'live-only-static', fallback: 'placeholder' },
}

const PPTX_CHART_EXPORT_POLICY = {
  bar: { mode: 'native' },
  doughnut: { mode: 'native' },
  line: { mode: 'native' },
  pie: { mode: 'native' },
  radar: { mode: 'native' },
  polarArea: { mode: 'client-fallback-raster', fallback: 'placeholder' },
}

function getPptxElementExportPolicy(type) {
  return PPTX_ELEMENT_EXPORT_POLICY[type] || { mode: 'client-fallback-raster' }
}

function getPptxElementExportStrategy(element) {
  if (element?.type === 'audio' || element?.type === 'video') {
    const media = classifyPptxMediaSource(element)
    return media.embeddable
      ? { mode: 'embedded-media', fallback: 'media-cover' }
      : getPptxElementExportPolicy(element.type)
  }
  if (
    element?.type === 'image' &&
    hasPptxImageVisualEffects(element) &&
    isPptxRasterSafeImageSource(element.src)
  ) {
    return {
      mode: 'server-prefetch-raster',
      requiresServer: true,
      fallback: 'native-image-effect-limit',
    }
  }
  if (element?.type !== 'chart') return getPptxElementExportPolicy(element?.type)

  return (
    PPTX_CHART_EXPORT_POLICY[element.chartType || 'bar'] || {
      mode: 'client-fallback-raster',
      fallback: 'placeholder',
    }
  )
}

function isPptxNativeElement(type) {
  return getPptxElementExportPolicy(type).mode === 'native'
}

function getPptxNativeElementTypes() {
  return Object.entries(PPTX_ELEMENT_EXPORT_POLICY)
    .filter(([, policy]) => policy.mode === 'native')
    .map(([type]) => type)
}

module.exports = {
  PPTX_CHART_EXPORT_POLICY,
  PPTX_ELEMENT_EXPORT_POLICY,
  getPptxElementExportStrategy,
  getPptxElementExportPolicy,
  getPptxNativeElementTypes,
  isPptxNativeElement,
}
