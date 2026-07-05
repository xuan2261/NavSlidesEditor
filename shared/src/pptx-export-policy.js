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

function getPptxElementExportPolicy(type) {
  return PPTX_ELEMENT_EXPORT_POLICY[type] || { mode: 'client-fallback-raster' }
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
  PPTX_ELEMENT_EXPORT_POLICY,
  getPptxElementExportPolicy,
  getPptxNativeElementTypes,
  isPptxNativeElement,
}
