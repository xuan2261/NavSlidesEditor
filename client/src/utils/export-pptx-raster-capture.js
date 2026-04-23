import { createSvgDataUri } from './export-pptx-core'

const HTML_RASTER_SCALE = 2
const HTML_CAPTURE_TIMEOUT_MS = 8000

function hasBrowserRasterRuntime() {
  return typeof document !== 'undefined' && typeof Image !== 'undefined'
}

function getCanvas(width, height, scale = 1) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  return canvas
}

function createOffscreenIframe(width, height, { sandbox } = {}) {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;border:0;opacity:0;pointer-events:none;`
  if (sandbox) iframe.setAttribute('sandbox', sandbox)
  return iframe
}

async function rasterizeSvgDataUri(svgDataUri, width, height, scale = 1) {
  if (!hasBrowserRasterRuntime()) return null

  return await new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = getCanvas(width, height, scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = svgDataUri
  })
}

export async function renderHtmlToPngDataUri({
  html,
  width,
  height,
  style = '',
  background = 'transparent',
  scale = HTML_RASTER_SCALE,
}) {
  if (!hasBrowserRasterRuntime()) return null

  const pixelWidth = Math.max(1, Math.round(width * scale))
  const pixelHeight = Math.max(1, Math.round(height * scale))
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${pixelHeight}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="${width}" height="${height}">
        <div xmlns="http://www.w3.org/1999/xhtml"
             style="width:${width}px;height:${height}px;box-sizing:border-box;overflow:hidden;background:${background};${style}">
          ${html}
        </div>
      </foreignObject>
    </svg>
  `
  return await rasterizeSvgDataUri(createSvgDataUri(svg), width, height, scale)
}

export async function renderIframeCanvasToPngDataUri(srcdoc, width, height, settleDelay = 120) {
  if (!hasBrowserRasterRuntime()) return null

  return await new Promise((resolve) => {
    const iframe = createOffscreenIframe(width, height)

    let settled = false
    let timeoutId = null
    let pollId = null

    const finish = (result) => {
      if (settled) return
      settled = true
      if (timeoutId) clearTimeout(timeoutId)
      if (pollId) clearTimeout(pollId)
      iframe.remove()
      resolve(result)
    }

    const pollCanvas = () => {
      try {
        const canvas = iframe.contentDocument?.querySelector('canvas')
        if (canvas?.width && canvas?.height) {
          setTimeout(() => {
            try {
              finish(canvas.toDataURL('image/png'))
            } catch {
              finish(null)
            }
          }, settleDelay)
          return
        }
      } catch {
        finish(null)
        return
      }

      pollId = setTimeout(pollCanvas, 60)
    }

    timeoutId = setTimeout(() => finish(null), 4000)
    iframe.onload = () => {
      pollId = setTimeout(pollCanvas, 120)
    }
    iframe.srcdoc = srcdoc
    document.body.appendChild(iframe)
  })
}

function buildHtmlCaptureScript(width, height, captureId, scale = HTML_RASTER_SCALE) {
  const safeWidth = Math.max(1, Math.round(width))
  const safeHeight = Math.max(1, Math.round(height))
  const safeScale = Math.max(1, Math.min(4, Number(scale) || 1))
  return `<script data-navslides-pptx-capture="true">(function(){const CAPTURE_ID=${JSON.stringify(captureId)};const WIDTH=${safeWidth};const HEIGHT=${safeHeight};const SCALE=${safeScale};const PIXEL_WIDTH=Math.max(1,Math.round(WIDTH*SCALE));const PIXEL_HEIGHT=Math.max(1,Math.round(HEIGHT*SCALE));let posted=false;const post=(kind,payload)=>{if(posted)return;posted=true;parent.postMessage({__navslidesPptxCapture:true,id:CAPTURE_ID,kind,payload},'*')};const stripScripts=(root)=>{root.querySelectorAll('script').forEach((node)=>node.remove())};const collectCssText=()=>{const chunks=[];for(const sheet of Array.from(document.styleSheets||[])){try{const rules=Array.from(sheet.cssRules||[]).map((rule)=>rule.cssText).join('\\n');if(rules)chunks.push(rules)}catch{}}return chunks.join('\\n')};const cloneBody=()=>{if(!document.body)return '';const clone=document.body.cloneNode(true);stripScripts(clone);return clone.innerHTML};const buildForeignObjectSvg=()=>{const css=collectCssText();const bodyHtml=cloneBody();return '<svg xmlns="http://www.w3.org/2000/svg" width="'+PIXEL_WIDTH+'" height="'+PIXEL_HEIGHT+'" viewBox="0 0 '+WIDTH+' '+HEIGHT+'"><foreignObject width="'+WIDTH+'" height="'+HEIGHT+'"><div xmlns="http://www.w3.org/1999/xhtml" style="width:'+WIDTH+'px;height:'+HEIGHT+'px;box-sizing:border-box;overflow:hidden;background:transparent;"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;}'+css+'</style>'+bodyHtml+'</div></foreignObject></svg>'};const ensureSvgSize=(svg)=>{const clone=svg.cloneNode(true);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width',String(PIXEL_WIDTH));clone.setAttribute('height',String(PIXEL_HEIGHT));if(!clone.getAttribute('viewBox')){clone.setAttribute('viewBox','0 0 '+WIDTH+' '+HEIGHT)}return new XMLSerializer().serializeToString(clone)};const canvasToPng=(source)=>{const canvas=document.createElement('canvas');canvas.width=PIXEL_WIDTH;canvas.height=PIXEL_HEIGHT;const ctx=canvas.getContext('2d');if(!ctx)return null;ctx.drawImage(source,0,0,PIXEL_WIDTH,PIXEL_HEIGHT);return canvas.toDataURL('image/png')};const rasterizeSvgString=(svgString)=>new Promise((resolve)=>{const img=new Image();img.onload=()=>{try{resolve(canvasToPng(img))}catch{resolve(null)}};img.onerror=()=>resolve(null);img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgString)});const capture=async()=>{try{if(!document.body){schedule(120);return}const canvas=document.querySelector('canvas');if(canvas&&canvas.width&&canvas.height){const png=canvasToPng(canvas);if(png){post('png',png);return}}const svg=document.querySelector('svg');if(svg){const png=await rasterizeSvgString(ensureSvgSize(svg));if(png){post('png',png);return}}const foreignObjectPng=await rasterizeSvgString(buildForeignObjectSvg());if(foreignObjectPng){post('png',foreignObjectPng);return}post('error','capture failed')}catch(error){post('error',error&&error.message?error.message:String(error))}};const schedule=(delay)=>setTimeout(()=>requestAnimationFrame(()=>requestAnimationFrame(capture)),delay);if(document.readyState==='complete'){schedule(80)}else{document.addEventListener('DOMContentLoaded',()=>schedule(180),{once:true});window.addEventListener('load',()=>schedule(80),{once:true})}schedule(1600);schedule(3200)})()</script>`
}

function wrapHtmlEmbedContent(content) {
  const source = String(content || '')
  if (/<!doctype\s+html|<html[\s>]/i.test(source)) return source
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;}</style></head><body>${source}</body></html>`
}

async function buildHtmlCaptureSrcdoc(content, width, height, captureId, scale, inlineAssets) {
  const rawSource = wrapHtmlEmbedContent(content)
  const source = inlineAssets ? await inlineAssets(rawSource) : rawSource
  const scriptTag = buildHtmlCaptureScript(width, height, captureId, scale)

  if (/<head[^>]*>/i.test(source)) {
    return source.replace(/<head[^>]*>/i, (match) => `${match}${scriptTag}`)
  }

  if (/<\/body>/i.test(source)) {
    return source.replace(/<\/body>/i, `${scriptTag}</body>`)
  }

  return `${scriptTag}${source}`
}

export async function renderHtmlDocumentToPngDataUri(
  content,
  width,
  height,
  { scale = HTML_RASTER_SCALE, timeout = HTML_CAPTURE_TIMEOUT_MS, inlineAssets } = {}
) {
  if (!hasBrowserRasterRuntime()) return null
  const captureId = `html-capture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const srcdoc = await buildHtmlCaptureSrcdoc(content, width, height, captureId, scale, inlineAssets)

  return await new Promise((resolve) => {
    const iframe = createOffscreenIframe(width, height, { sandbox: 'allow-scripts' })
    const cleanup = () => {
      window.removeEventListener('message', handleMessage)
      clearTimeout(timeoutId)
      iframe.remove()
    }
    const handleMessage = (event) => {
      if (event.source !== iframe.contentWindow) return
      if (!event.data?.__navslidesPptxCapture || event.data.id !== captureId) return
      cleanup()
      resolve(event.data.kind === 'png' ? event.data.payload : null)
    }
    const timeoutId = setTimeout(() => {
      cleanup()
      resolve(null)
    }, timeout)

    window.addEventListener('message', handleMessage)
    iframe.srcdoc = srcdoc
    document.body.appendChild(iframe)
  })
}
