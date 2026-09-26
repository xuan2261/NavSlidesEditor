import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_TOKENS, mergeTokens, resolveColorField, resolveColorForTokens, resolveConnectorGeometry, resolveEffectiveSlide, tokensToStyleObject } from 'revealjs-shared'
import { markdownToHtml } from '../../utils/markdown-utils'
import { sanitizeMediaSrc } from '../../utils/url-safety'
import { CalloutRenderer } from '../canvas/element-renderers/callout-element-renderer'
import { DrawingRenderer } from '../canvas/element-renderers/drawing-element-renderer'
import { IconRenderer } from '../canvas/element-renderers/icon-element-renderer'
import { LineArrowRenderer } from '../canvas/element-renderers/line-element-renderer'
import { QrCodeRenderer } from '../canvas/element-renderers/qrcode-element-renderer'
import { ShapeRenderer } from '../canvas/element-renderers/shape-element-renderer'
import { SvgElementRenderer } from '../canvas/element-renderers/svg-element-renderer'
import { TableRenderer } from '../canvas/element-renderers/table-element-renderer'
import { TimelineRenderer } from '../canvas/element-renderers/timeline-element-renderer'
import { sanitizeThumbnailHtml, sanitizeThumbnailSvg } from './thumbnail-markup-safety'

// Only static renderers belong here. Chart and LaTeX renderers mount executable frames.
const STATIC_RENDERERS = { callout: CalloutRenderer, drawing: DrawingRenderer, line: LineArrowRenderer, qrcode: QrCodeRenderer, shape: ShapeRenderer, svg: SvgElementRenderer, table: TableRenderer, timeline: TimelineRenderer }
const PLACEHOLDERS = { html: 'HTML', video: 'Video', audio: 'Audio', game: 'Game', embed: 'Embed', chart: 'Chart', latex: 'LaTeX' }
let iconPathsPromise

function StaticIcon({ element }) {
  const [paths, setPaths] = useState(null)
  useEffect(() => {
    let active = true
    iconPathsPromise ||= import('../../data/icon-paths.json').then((module) => module.default || module)
    iconPathsPromise.then((value) => { if (active) setPaths(value) })
    return () => { active = false }
  }, [])
  return paths ? <IconRenderer element={element} iconPaths={paths} /> : null
}

function backgroundStyle(background, tokens) {
  const color = resolveColorForTokens(background?.color, 'slide', 'bg', tokens) || tokens.colors.bg
  if (background?.type === 'color') return { backgroundColor: color }
  if (background?.type === 'gradient') return { background: background.gradient || color }
  if (background?.type === 'image' && background.image) {
    return { backgroundColor: tokens.colors.bg, backgroundImage: `url(${JSON.stringify(sanitizeMediaSrc(background.image))})`, backgroundSize: background.size || 'cover', backgroundPosition: background.position || 'center' }
  }
  if (background?.type === 'fx') return { backgroundColor: background.fx?.fallbackColor || '#0d0221' }
  return { backgroundColor: tokens.colors.bg }
}

function elementStyle(element) {
  return {
    position: 'absolute', left: element.x, top: element.y, width: element.width, height: element.height,
    zIndex: element.zIndex ?? 1, opacity: element.opacity,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    overflow: element.type === 'line' || element._pptxImportMeta?.textFit === 'wrap' ? 'visible' : 'hidden',
    boxSizing: 'border-box', borderRadius: ['image', 'code'].includes(element.type) ? element.borderRadius : undefined,
    boxShadow: element.shadowBlur || element.shadowX || element.shadowY ? `${element.shadowX || 0}px ${element.shadowY || 0}px ${element.shadowBlur || 0}px ${element.shadowColor || 'rgba(0,0,0,0.5)'}` : undefined,
  }
}

function textStyle(element, tokens) {
  const meta = element._pptxImportMeta
  const fit = Number(meta?.fitFontSizePx)
  const style = {
    width: '100%', height: '100%', boxSizing: 'border-box', padding: meta ? 0 : '8px 12px',
    fontSize: Number.isFinite(fit) && fit > 0 ? fit : element.fontSize || 16,
    fontFamily: element.fontFamily, lineHeight: element.lineHeight, textAlign: element.textAlign,
    color: resolveColorForTokens(element.textColor, 'text', 'textColor', tokens) || 'white',
    ...(meta ? { overflowWrap: 'anywhere', wordBreak: 'normal', whiteSpace: 'pre-wrap' } : {}),
  }
  if (meta?.textInsets) {
    const scale = meta.textInsetsUnit === 'px' ? 1 : 96 / 72
    for (const side of ['Left', 'Right', 'Top', 'Bottom']) {
      const raw = Number(meta.textInsets[side.toLowerCase()])
      const dimension = ['Left', 'Right'].includes(side) ? element.width : element.height
      const max = Math.min(Number.isFinite(dimension) && dimension >= 0 ? dimension / 2 : 96, 96)
      if (Number.isFinite(raw)) style[`padding${side}`] = Math.min(Math.round(Math.max(0, raw) * scale * 10) / 10, max)
    }
  }
  return style
}

function StaticMarkdown({ element }) {
  const style = {
    width: '100%', height: '100%', overflow: 'auto', padding: '8px 12px', boxSizing: 'border-box',
    color: resolveColorField(element.textColor, 'markdown', 'textColor') || '#141413',
    fontSize: element.fontSize ? `${element.fontSize}px` : '18px', lineHeight: 1.5,
  }
  return <div style={style} dangerouslySetInnerHTML={{ __html: sanitizeThumbnailHtml(markdownToHtml(element.content || '')) }} />
}

function SafeElement({ element, tokens }) {
  const Renderer = STATIC_RENDERERS[element.type]
  if (Renderer) {
    const safeElement = element.type === 'shape' && element.textHtml
      ? { ...element, textHtml: sanitizeThumbnailHtml(element.textHtml) }
      : element.type === 'svg' ? { ...element, content: sanitizeThumbnailSvg(element.content) } : element
    return <Renderer element={safeElement} isEditing={false} />
  }
  if (element.type === 'markdown') return <StaticMarkdown element={element} />
  if (element.type === 'icon') return <StaticIcon element={element} />
  if (element.type === 'text') {
    return <div className="slide-text-content ProseMirror-preview" style={textStyle(element, tokens)} dangerouslySetInnerHTML={{ __html: sanitizeThumbnailHtml(element.content || '') }} />
  }
  if (element.type === 'image') {
    const filter = [['Brightness', 100], ['Contrast', 100], ['Grayscale', 0], ['Saturate', 100]]
      .filter(([name, initial]) => element[`filter${name}`] != null && element[`filter${name}`] !== initial)
      .map(([name]) => `${name.toLowerCase()}(${element[`filter${name}`]}%)`).join(' ') || undefined
    return <div className="relative h-full w-full overflow-hidden" style={{ boxSizing: 'border-box', border: element.borderWidth > 0 ? `${element.borderWidth}px solid ${element.borderColor || '#000000'}` : undefined }}>
      <img src={sanitizeMediaSrc(element.src)} alt="" draggable={false} style={{
        display: 'block', width: '100%', height: '100%', objectFit: element.objectFit || 'contain', filter,
        transform: [element.flipH ? 'scaleX(-1)' : '', element.flipV ? 'scaleY(-1)' : ''].filter(Boolean).join(' ') || undefined,
        ...(element.imageW != null ? { position: 'absolute', left: element.imageOffsetX ?? 0, top: element.imageOffsetY ?? 0, width: element.imageW, height: element.imageH } : {}),
      }} />
    </div>
  }
  if (element.type === 'code') return <pre className="hljs" style={{ margin: 0, padding: '10px 14px', height: '100%', boxSizing: 'border-box', fontFamily: "'Fira Code','JetBrains Mono','Courier New',monospace", fontSize: element.fontSize || 14, lineHeight: 1.5 }}><code>{element.content || ''}</code></pre>
  return <span className="flex h-full items-center justify-center bg-black/20 text-white/70" style={{ fontSize: 24 }}>{PLACEHOLDERS[element.type] || 'Content'}</span>
}

export function SlideThumbnailPreview({ slide, width, height, resolution, designTokens, layoutMasters, className = '', 'data-testid': testId }) {
  const sourceWidth = width || resolution?.width || 960
  const sourceHeight = height || resolution?.height || 540
  const hostRef = useRef(null)
  const canvasRef = useRef(null)
  const effectiveSlide = useMemo(() => slide?.layoutId ? resolveEffectiveSlide(slide, layoutMasters).slide : slide, [slide, layoutMasters])
  const tokens = useMemo(() => mergeTokens(mergeTokens(DEFAULT_TOKENS, designTokens), effectiveSlide?.designTokens), [designTokens, effectiveSlide?.designTokens])
  const elements = useMemo(() => {
    const source = effectiveSlide?.elements || []
    const { effectiveLines } = resolveConnectorGeometry(source)
    return source.filter((element) => !element.hidden).map((element) => effectiveLines.get(element.id) || element)
  }, [effectiveSlide?.elements])
  const background = backgroundStyle(effectiveSlide?.background, tokens)

  useLayoutEffect(() => {
    const host = hostRef.current
    const resize = (availableWidth) => { canvasRef.current.style.transform = `scale(${availableWidth / sourceWidth})` }
    const measure = () => resize(host.getBoundingClientRect().width)
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(([entry]) => resize(entry.contentRect.width))
    observer.observe(host)
    return () => observer.disconnect()
  }, [sourceWidth])

  return (
    <div ref={hostRef} aria-hidden="true" inert="" data-testid={testId} className={`pointer-events-none relative overflow-hidden ${className}`} style={{ ...background, ...tokensToStyleObject(tokens), aspectRatio: `${sourceWidth} / ${sourceHeight}`, pointerEvents: 'none' }}>
      <div ref={canvasRef} style={{ ...background, position: 'absolute', left: 0, top: 0, width: sourceWidth, height: sourceHeight, fontSize: 16, transform: 'scale(0)', transformOrigin: 'top left' }}>
        {elements.map((element) => <div key={element.id} style={elementStyle(element)}><SafeElement element={element} tokens={tokens} /></div>)}
      </div>
    </div>
  )
}
