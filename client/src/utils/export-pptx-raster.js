import katex from 'katex'
import { marked } from 'marked'
import QRCode from 'qrcode'
import iconPaths from '../../../shared/data/icon-paths.json'
import { createSvgDataUri, normalizeCssColor } from './export-pptx-core'
import { sanitizeSvgContent } from './content-safety'
import { classifyPptxPosterSource, resolveColorForTokens } from 'revealjs-shared'
import {
  renderHtmlDocumentToPngDataUri,
  renderHtmlToPngDataUri,
  renderIframeCanvasToPngDataUri,
} from './export-pptx-raster-capture'

const LATEX_RASTER_SCALE = 3
const assetTextCache = new Map()
const assetDataUriCache = new Map()

export function clearPptxRasterAssetCaches() {
  assetTextCache.clear()
  assetDataUriCache.clear()
}

const CDN_TO_VENDOR = [
  {
    pattern: /cdn\.jsdelivr\.net\/npm\/d3(?:@[^/"']*)?(?:\/[^"']*)?/i,
    vendor: '/vendor/d3/dist/d3.min.js',
  },
  {
    pattern: /cdnjs\.cloudflare\.com\/ajax\/libs\/d3\/[^/]+\/d3\.min\.js/i,
    vendor: '/vendor/d3/dist/d3.min.js',
  },
  {
    pattern: /cdn\.jsdelivr\.net\/npm\/chart\.js(?:@[^/"']*)?(?:\/[^"']*)?/i,
    vendor: '/vendor/chart.js/dist/chart.umd.js',
  },
  {
    pattern: /cdn\.jsdelivr\.net\/npm\/katex(?:@[^/"']*)?\/?dist\/katex\.min\.css/i,
    vendor: '/vendor/katex/dist/katex.min.css',
  },
  {
    pattern: /cdn\.jsdelivr\.net\/npm\/katex(?:@[^/"']*)?\/?dist\/katex\.min\.js/i,
    vendor: '/vendor/katex/dist/katex.min.js',
  },
  {
    pattern: /tikzjax\.com\/v1\/fonts\.css/i,
    vendor: '/vendor/tikzjax/fonts.css',
  },
  {
    pattern: /tikzjax\.com\/v1\/tikzjax\.js/i,
    vendor: '/vendor/tikzjax/tikzjax.js',
  },
]

function getAssetOrigin() {
  if (typeof window !== 'undefined' && window.location && window.location.origin !== 'null') {
    return window.location.origin
  }
  return ''
}

function resolveKnownVendorPath(url) {
  const raw = String(url || '')
  if (!raw) return ''
  const vendorIndex = raw.indexOf('/vendor/')
  if (vendorIndex >= 0) return raw.slice(vendorIndex)
  for (const mapping of CDN_TO_VENDOR) {
    if (mapping.pattern.test(raw)) return mapping.vendor
  }
  return ''
}

function resolveFetchUrl(url) {
  const raw = String(url || '')
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  const origin = getAssetOrigin()
  return origin ? `${origin}${raw.startsWith('/') ? '' : '/'}${raw}` : raw
}

async function fetchTextAsset(url) {
  const fetchUrl = resolveFetchUrl(url)
  if (!fetchUrl || typeof fetch !== 'function') return null
  if (assetTextCache.has(fetchUrl)) return assetTextCache.get(fetchUrl)
  try {
    const response = await fetch(fetchUrl)
    if (!response.ok) return null
    const text = await response.text()
    assetTextCache.set(fetchUrl, text)
    return text
  } catch {
    return null
  }
}

async function fetchDataUriAsset(url) {
  const fetchUrl = resolveFetchUrl(url)
  if (!fetchUrl || typeof fetch !== 'function' || typeof FileReader === 'undefined') return null
  if (assetDataUriCache.has(fetchUrl)) return assetDataUriCache.get(fetchUrl)
  try {
    const response = await fetch(fetchUrl)
    if (!response.ok) return null
    const blob = await response.blob()
    const dataUri = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
    if (dataUri) assetDataUriCache.set(fetchUrl, dataUri)
    return dataUri
  } catch {
    return null
  }
}

function safeInlineJs(js) {
  return String(js || '').split('</script').join('<\\/script')
}

async function replaceCssUrls(css, stylesheetUrl) {
  const baseUrl = resolveFetchUrl(stylesheetUrl)
  const matches = [...String(css || '').matchAll(/url\((['"]?)([^'")]+)\1\)/gi)]
  let result = css

  for (const match of matches) {
    const rawUrl = match[2]
    if (!rawUrl || /^(data:|blob:|#)/i.test(rawUrl)) continue

    let absoluteUrl = rawUrl
    try {
      absoluteUrl = new URL(rawUrl, baseUrl || window.location.href).href
    } catch {
      continue
    }

    const dataUri =
      /\/katex\//i.test(baseUrl) && /\.(woff2?|ttf|otf)(?:\?|$)/i.test(absoluteUrl)
        ? await fetchDataUriAsset(absoluteUrl)
        : null
    result = result.split(match[0]).join(`url(${dataUri || absoluteUrl})`)
  }

  return result
}

async function inlineCaptureAssets(html) {
  let result = String(html || '').replace(/<\\\//g, '</')

  const scriptMatches = [
    ...result.matchAll(
      /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*(?:<\/script>|<\\\/script>)/gi
    ),
  ]
  for (const match of scriptMatches) {
    const vendorPath = resolveKnownVendorPath(match[2])
    const js = vendorPath ? await fetchTextAsset(vendorPath) : null
    if (!js) continue
    result = result.split(match[0]).join(`<script>/* ${vendorPath} */\n${safeInlineJs(js)}\n</script>`)
  }

  const cssMatches = [...result.matchAll(/<link\b[^>]*\bhref=["']([^"']+\.css(?:\?[^"']*)?)["'][^>]*\/?>/gi)]
  for (const match of cssMatches) {
    const vendorPath = resolveKnownVendorPath(match[1])
    const fetchUrl = vendorPath || match[1]
    const css = await fetchTextAsset(fetchUrl)
    if (!css) continue
    const rewrittenCss = await replaceCssUrls(css, fetchUrl)
    result = result.split(match[0]).join(`<style>/* ${fetchUrl} */\n${rewrittenCss}\n</style>`)
  }

  return result
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildLatexRasterMarkup(content) {
  return katex.renderToString(content || '', {
    displayMode: true,
    throwOnError: false,
    output: 'html',
  })
}

async function renderHtmlEmbedToPngDataUri(content, width, height) {
  return await renderHtmlDocumentToPngDataUri(content, width, height, {
    inlineAssets: inlineCaptureAssets,
  })
}

function buildLatexCaptureDocument(content) {
  const hasTikz = /\\begin\{tikzpicture\}/.test(content || '')
  const origin = getAssetOrigin()
  const katexCss = `${origin}/vendor/katex/dist/katex.min.css`
  const tikzAssets = hasTikz
    ? `<link rel="stylesheet" type="text/css" href="${origin}/vendor/tikzjax/fonts.css"><script src="${origin}/vendor/tikzjax/tikzjax.js"></script>`
    : ''
  const bodyContent = hasTikz
    ? `<script type="text/tikz">${content || ''}</script>`
    : `<div class="navslides-latex">${buildLatexRasterMarkup(content || '')}</div>`

  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${katexCss}">${tikzAssets}<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:transparent;overflow:hidden;color:white}.navslides-latex{max-width:100%;max-height:100%;padding:8px}.katex{font-size:1.55em}svg{max-width:100%;max-height:100%}</style></head><body>${bodyContent}</body></html>`
}

async function renderLatexToPngDataUri(content, width, height) {
  try {
    return (
      (await renderHtmlDocumentToPngDataUri(buildLatexCaptureDocument(content), width, height, {
        scale: LATEX_RASTER_SCALE,
        inlineAssets: inlineCaptureAssets,
      })) ||
      (await renderHtmlToPngDataUri({
        html: buildLatexRasterMarkup(content || ''),
        width,
        height,
        scale: LATEX_RASTER_SCALE,
        style:
          'display:flex;align-items:center;justify-content:center;padding:8px;color:#ffffff;background:transparent;font-size:22px;',
      }))
    )
  } catch {
    return null
  }
}

function buildChartDatasets(element) {
  const { chartType = 'bar', chartData = {} } = element || {}
  const datasets = Array.isArray(chartData.datasets) ? chartData.datasets : []
  return datasets.map((dataset) => ({
    label: dataset?.label || '',
    data: Array.isArray(dataset?.data) ? dataset.data : [],
    backgroundColor: dataset?.color || '#6366f1',
    borderColor: dataset?.color || '#6366f1',
    borderWidth: chartType === 'line' ? 2 : 0,
    fill: chartType === 'line' ? false : undefined,
  }))
}

function buildChartSrcdoc(element) {
  const chartType = element?.chartType || 'bar'
  const chartData = element?.chartData || {}
  const datasets = JSON.stringify(buildChartDatasets(element))
  const labels = JSON.stringify(chartData.labels || [])
  const assetOrigin = getAssetOrigin()
  const scales =
    chartType === 'pie' || chartType === 'doughnut' || chartType === 'polarArea'
      ? '{}'
      : `{x:{ticks:{color:'rgba(255,255,255,0.6)'},grid:{color:'rgba(255,255,255,0.1)'}},y:{ticks:{color:'rgba(255,255,255,0.6)'},grid:{color:'rgba(255,255,255,0.1)'}}}`

  return `<!doctype html><html><head><meta charset="utf-8"><script src="${assetOrigin}/vendor/chart.js/dist/chart.umd.js"></script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:transparent;overflow:hidden}canvas{width:100%!important;height:100%!important}</style></head><body><canvas id="chart"></canvas><script>(function(){function mount(){if(typeof Chart==='undefined'){setTimeout(mount,50);return}new Chart(document.getElementById('chart'),{type:${JSON.stringify(chartType)},data:{labels:${labels},datasets:${datasets}},options:{animation:false,responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'rgba(255,255,255,0.7)',font:{size:12}}}},scales:${scales}})}mount()})()</script></body></html>`
}

function resolveRasterColor(value, elementType, field, designTokens, fallback) {
  return resolveColorForTokens(value, elementType, field, designTokens) || fallback
}

function renderIconSvg(element, designTokens) {
  const rawName = element?.iconName || 'Star'
  const iconKey = rawName.endsWith('Icon') && rawName !== 'ImageIcon' ? rawName.replace(/Icon$/, '') : rawName
  const path = iconPaths[iconKey] || iconPaths.Star || ''
  const stroke = element?.iconStrokeWidth || 2
  const color = resolveRasterColor(element?.iconColor, 'icon', 'iconColor', designTokens, '#ffffff')
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${element.width}" height="${element.height}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">
      ${path}
    </svg>
  `
}

function renderDrawingSvg(element, designTokens) {
  const paths = (element?.paths || [])
    .map((path) => {
      const stroke =
        path.stroke || resolveRasterColor(element.strokeColor, 'drawing', 'strokeColor', designTokens, '#ffffff')
      const strokeWidth = path.strokeWidth || element.strokeWidth || 3
      const opacity = path.opacity ?? 1
      return `<path d="${escapeHtml(path.d || '')}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" />`
    })
    .join('')

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${element.width} ${element.height}" width="${element.width}" height="${element.height}">
      ${paths}
    </svg>
  `
}

export async function renderGradientBackgroundDataUri(background, width, height) {
  const stops = Array.isArray(background?.stops) ? background.stops : []
  const cssStops = stops
    .map((stop) => `${stop.color || '#000000'} ${Math.round((Number(stop.offset) || 0) * 100)}%`)
    .join(', ')
  const gradient = background?.gradient || (cssStops ? `linear-gradient(${Number(background?.angle) || 0}deg, ${cssStops})` : '')
  return await renderHtmlToPngDataUri({
    html: '',
    width,
    height,
    style: 'border:none;',
    background: gradient || '#1e1e2e',
  })
}

export async function renderElementFallbackDataUri(element, designTokens) {
  const width = Math.max(1, Number(element?.width) || 1)
  const height = Math.max(1, Number(element?.height) || 1)

  switch (element?.type) {
    case 'drawing':
      return createSvgDataUri(renderDrawingSvg(element, designTokens))
    case 'chart':
      return await renderIframeCanvasToPngDataUri(buildChartSrcdoc(element), width, height)
    case 'html':
      return await renderHtmlEmbedToPngDataUri(element?.content || '', width, height)
    case 'icon':
      return createSvgDataUri(renderIconSvg(element, designTokens))
    case 'latex':
      return await renderLatexToPngDataUri(element?.content || '', width, height)
    case 'markdown': {
      const html = marked.parse(element?.content || '')
      return await renderHtmlToPngDataUri({
        html,
        width,
        height,
        style:
          `padding:12px;color:${resolveRasterColor(element?.textColor, 'markdown', 'textColor', designTokens, '#ffffff')};font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;background:transparent;`,
      })
    }
    case 'qrcode':
      try {
        return await QRCode.toDataURL(element?.qrData || 'https://example.com', {
          color: {
            dark: element?.qrColor || '#000000',
            light: element?.qrBgColor || '#ffffff',
          },
          errorCorrectionLevel: element?.qrErrorLevel || 'M',
          margin: 1,
          width: Math.max(width, height),
        })
      } catch {
        return null
      }
    case 'svg':
      return element?.content ? createSvgDataUri(sanitizeSvgContent(element.content)) : null
    default:
      return null
  }
}

export function getMediaCoverSource(element) {
  if (!element) return ''
  if (element.type === 'video') {
    return classifyPptxPosterSource(element.poster)?.source || ''
  }
  return ''
}

export function buildPptxPlaceholderLabel(element) {
  const type = element?.type || 'element'
  switch (type) {
    case 'audio':
      return 'Audio preview unavailable'
    case 'chart':
      return `Unsupported chart: ${element?.chartType || 'chart'}`
    case 'html':
      return 'Interactive HTML not rasterized'
    case 'latex':
      return 'LaTeX/TikZ preview unavailable'
    case 'video':
      return 'Video preview unavailable'
    default:
      return `${type} preview unavailable`
  }
}

export function getPlaceholderTheme() {
  return {
    fill: normalizeCssColor('#1f2937').color,
    line: normalizeCssColor('#94a3b8').color,
    text: normalizeCssColor('#e2e8f0').color,
  }
}
