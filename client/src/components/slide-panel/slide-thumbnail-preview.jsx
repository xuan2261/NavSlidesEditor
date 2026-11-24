import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_TOKENS,
  mergeTokens,
  resolveColorField,
  resolveColorForTokens,
  resolveConnectorGeometry,
  resolveEffectiveSlide,
  tokensToStyleObject,
} from 'revealjs-shared'
import { useOutputPixelScale } from '../../hooks/use-output-pixel-scale'
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
import semanticTree from 'revealjs-shared/src/pptx-semantic-render-tree.js'
import projectionCache from 'revealjs-shared/src/pptx-slide-projection-cache.js'
import { semanticElement } from '../../utils/pptx-semantic-geometry-bridge'
import NativeOmmlRenderer from '../properties/native-omml-renderer'

// Legacy chart/LaTeX payloads mount executable frames; typed OMML is static SVG.
const STATIC_RENDERERS = {
  callout: CalloutRenderer,
  drawing: DrawingRenderer,
  line: LineArrowRenderer,
  qrcode: QrCodeRenderer,
  shape: ShapeRenderer,
  svg: SvgElementRenderer,
  table: TableRenderer,
  timeline: TimelineRenderer,
}
const PLACEHOLDERS = {
  html: 'HTML',
  video: 'Video',
  audio: 'Audio',
  game: 'Game',
  embed: 'Embed',
  chart: 'Chart',
  latex: 'LaTeX',
}
let iconPathsPromise

function StaticIcon({ element }) {
  const [paths, setPaths] = useState(null)
  useEffect(() => {
    let active = true
    iconPathsPromise ||= import('../../data/icon-paths.json').then(
      (module) => module.default || module
    )
    iconPathsPromise.then((value) => {
      if (active) setPaths(value)
    })
    return () => {
      active = false
    }
  }, [])
  return paths ? <IconRenderer element={element} iconPaths={paths} /> : null
}

function backgroundStyle(background, tokens) {
  const color = resolveColorForTokens(background?.color, 'slide', 'bg', tokens) || tokens.colors.bg
  if (background?.type === 'color') return { backgroundColor: color }
  if (background?.type === 'gradient') return { background: background.gradient || color }
  if (background?.type === 'image' && background.image) {
    return {
      backgroundColor: tokens.colors.bg,
      backgroundImage: `url(${JSON.stringify(sanitizeMediaSrc(background.image))})`,
      backgroundSize: background.size || 'cover',
      backgroundPosition: background.position || 'center',
    }
  }
  if (background?.type === 'fx')
    return { backgroundColor: background.fx?.fallbackColor || '#0d0221' }
  return { backgroundColor: tokens.colors.bg }
}

function elementStyle(element) {
  return {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    zIndex: element.zIndex ?? 1,
    opacity: element.opacity,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    overflow:
      element.pptxGeometry || element.type === 'line' || element._pptxImportMeta?.textFit === 'wrap'
        ? 'visible'
        : 'hidden',
    boxSizing: 'border-box',
    borderRadius: ['image', 'code'].includes(element.type) ? element.borderRadius : undefined,
    boxShadow:
      element.shadowBlur || element.shadowX || element.shadowY
        ? `${element.shadowX || 0}px ${element.shadowY || 0}px ${element.shadowBlur || 0}px ${element.shadowColor || 'rgba(0,0,0,0.5)'}`
        : undefined,
  }
}

function textStyle(element, tokens) {
  const meta = element._pptxImportMeta
  const fit = Number(meta?.fitFontSizePx)
  const style = {
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    padding: meta ? 0 : '8px 12px',
    fontSize: Number.isFinite(fit) && fit > 0 ? fit : element.fontSize || 16,
    fontFamily: element.fontFamily,
    lineHeight: element.lineHeight,
    textAlign: element.textAlign,
    color: resolveColorForTokens(element.textColor, 'text', 'textColor', tokens) || 'white',
    ...(meta ? { overflowWrap: 'anywhere', wordBreak: 'normal', whiteSpace: 'pre-wrap' } : {}),
  }
  if (meta?.textInsets) {
    const scale = meta.textInsetsUnit === 'px' ? 1 : 96 / 72
    for (const side of ['Left', 'Right', 'Top', 'Bottom']) {
      const raw = Number(meta.textInsets[side.toLowerCase()])
      const dimension = ['Left', 'Right'].includes(side) ? element.width : element.height
      const max = Math.min(Number.isFinite(dimension) && dimension >= 0 ? dimension / 2 : 96, 96)
      if (Number.isFinite(raw))
        style[`padding${side}`] = Math.min(Math.round(Math.max(0, raw) * scale * 10) / 10, max)
    }
  }
  return style
}

function StaticMarkdown({ element }) {
  const style = {
    width: '100%',
    height: '100%',
    overflow: 'auto',
    padding: '8px 12px',
    boxSizing: 'border-box',
    color: resolveColorField(element.textColor, 'markdown', 'textColor') || '#141413',
    fontSize: element.fontSize ? `${element.fontSize}px` : '18px',
    lineHeight: 1.5,
  }
  return (
    <div
      style={style}
      dangerouslySetInnerHTML={{
        __html: sanitizeThumbnailHtml(markdownToHtml(element.content || '')),
      }}
    />
  )
}

function SafeElement({ element, tokens, outputPixelScale }) {
  if (element.type === 'latex' && element.ommlDocument)
    return (
      <NativeOmmlRenderer
        document={element.ommlDocument}
        mathFrame={element.mathFrame}
        theme={element.pptxTextContext?.theme}
      />
    )
  const Renderer = STATIC_RENDERERS[element.type]
  if (Renderer) {
    const safeElement =
      element.type === 'shape' && element.textHtml
        ? { ...element, textHtml: sanitizeThumbnailHtml(element.textHtml) }
        : element.type === 'svg'
          ? { ...element, content: sanitizeThumbnailSvg(element.content) }
          : element
    return (
      <Renderer element={safeElement} isEditing={false} outputPixelScale={outputPixelScale} />
    )
  }
  if (element.type === 'markdown') return <StaticMarkdown element={element} />
  if (element.type === 'icon') return <StaticIcon element={element} />
  if (element.type === 'text') {
    return (
      <div
        className="slide-text-content ProseMirror-preview"
        style={textStyle(element, tokens)}
        dangerouslySetInnerHTML={{ __html: sanitizeThumbnailHtml(element.content || '') }}
      />
    )
  }
  if (element.type === 'image') {
    const filter =
      [
        ['Brightness', 100, '%'],
        ['Contrast', 100, '%'],
        ['Grayscale', 0, '%'],
        ['Saturate', 100, '%'],
        ['Sepia', 0, '%'],
        ['Blur', 0, 'px'],
      ]
        .filter(
          ([name, initial]) =>
            element[`filter${name}`] != null && element[`filter${name}`] !== initial
        )
        .map(([name, , unit]) => `${name.toLowerCase()}(${element[`filter${name}`]}${unit})`)
        .join(' ') || undefined
    return (
      <div
        className="relative h-full w-full overflow-hidden"
        style={{
          boxSizing: 'border-box',
          border:
            element.borderWidth > 0
              ? `${element.borderWidth}px solid ${element.borderColor || '#000000'}`
              : undefined,
        }}
      >
        <img
          src={sanitizeMediaSrc(element.src)}
          alt=""
          draggable={false}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: element.objectFit || 'contain',
            filter,
            transform:
              [element.flipH ? 'scaleX(-1)' : '', element.flipV ? 'scaleY(-1)' : '']
                .filter(Boolean)
                .join(' ') || undefined,
            ...(element.imageW != null
              ? {
                  position: 'absolute',
                  left: element.imageOffsetX ?? 0,
                  top: element.imageOffsetY ?? 0,
                  width: element.imageW,
                  height: element.imageH,
                }
              : {}),
          }}
        />
      </div>
    )
  }
  if (element.type === 'code')
    return (
      <pre
        className="hljs"
        style={{
          margin: 0,
          padding: '10px 14px',
          height: '100%',
          boxSizing: 'border-box',
          fontFamily: "'Fira Code','JetBrains Mono','Courier New',monospace",
          fontSize: element.fontSize || 14,
          lineHeight: 1.5,
        }}
      >
        <code>{element.content || ''}</code>
      </pre>
    )
  return (
    <span
      className="flex h-full items-center justify-center bg-black/20 text-white/70"
      style={{ fontSize: 24 }}
    >
      {PLACEHOLDERS[element.type] || 'Content'}
    </span>
  )
}

// Raw nodes are owned/frozen and their identity certifies the entire render
// envelope (catalogs, occurrences, ancestry, connectors and slide values).
const thumbnailProjections = new WeakMap()
function thumbnailProjection(document, rawNodes) {
  const previous = thumbnailProjections.get(rawNodes)
  if (previous) return previous
  function project(nodes) {
    return Object.freeze(nodes.map((node) => Object.freeze({
      ...node,
      projectedElement: node.kind !== 'group' && node.element && node.instanceId
        ? Object.freeze(semanticElement(document, node.instanceId, node.element)) : node.element,
      children: project(node.children || []),
    })))
  }
  const result = project(rawNodes)
  thumbnailProjections.set(rawNodes, result)
  return result
}

// Default shallow React comparison only: no mutable slide identity comparator.
const SemanticContent = memo(function SemanticContent({ nodes, tokens, outputPixelScale }) {
  const element = (value) => (
    <div key={value.id} style={elementStyle(value)}>
      <SafeElement element={value} tokens={tokens} outputPixelScale={outputPixelScale} />
    </div>
  )
  function nodeContent(node) {
    if (node.hidden) return null
    if (!node.instanceId) return element(node.element)
    return (
      <div key={node.instanceId} data-thumbnail-instance-id={node.instanceId}
        style={{ position: 'absolute', left: 0, top: 0, transform: node.transform,
          transformOrigin: '0 0', overflow: 'visible', zIndex: node.paintIndex,
          ...(node.kind === 'group' ? { opacity: node.opacity } : {}) }}>
        {node.kind !== 'group' && element(node.projectedElement)}
        {node.children.map(nodeContent)}
      </div>
    )
  }
  return nodes.map(nodeContent)
})

// Admit shared values once per panel render, comparing descriptors rather than
// mutable input identities. A failed admission is never a reusable context.
export function deriveNavigatorContext(options, previous) {
  try {
    const values = Object.create(null)
    for (const key of ['resolution', 'designTokens', 'layoutMasters']) {
      const descriptor = Object.getOwnPropertyDescriptor(options, key)
      if (descriptor && !('value' in descriptor)) return null
      values[key] = descriptor?.value
    }
    return projectionCache.ownedSlideSnapshot(values, previous)
  } catch {
    return null
  }
}

// The optional context keeps direct callers compatible; the panel supplies its
// single admission to every parent and child. Semantic roots never enter it.
export function deriveNavigatorView(slide, options, previous, context = deriveNavigatorContext(options, previous?.context)) {
  const { resolution, designTokens, layoutMasters, pptxSemantic } = options
  let admission = null
  if (context) {
    try {
      admission = projectionCache.ownedSlideSnapshot(slide, previous?.admission)
    } catch {
      // Preserve legacy handling for exotic slides without certifying reuse.
    }
  }
  const admitted = Boolean(context && admission)
  const source = admitted ? admission : slide
  const effectiveSlide = admitted && admission === previous?.admission && context === previous?.context
    ? previous.effectiveSlide
    : source?.layoutId
      ? resolveEffectiveSlide(source, admitted ? context.layoutMasters : layoutMasters).slide : source
  const values = admitted ? null : JSON.stringify({ slide, effectiveSlide, resolution, designTokens, semantic: Boolean(pptxSemantic) })
  const ownedEffective = admitted ? projectionCache.ownedSlideSnapshot(effectiveSlide) : effectiveSlide
  let semanticNodes = null
  if (pptxSemantic && effectiveSlide) {
    try {
      const prior = admitted && projectionCache.priorSlideProjection(pptxSemantic, ownedEffective)
      semanticNodes = thumbnailProjection(pptxSemantic,
        prior || semanticTree.immutableSemanticRenderTree(pptxSemantic, ownedEffective))
    } catch (error) {
      semanticNodes = error
    }
  }
  // Mutable inputs still go through validation/projection and value comparison on
  // every render. Only the immutable projection API can supply the fast identity hit.
  const nodeValues = semanticNodes instanceof Error ? null
    : semanticNodes === previous?.semanticNodes ? previous.nodeValues : JSON.stringify(semanticNodes)
  if (previous && admitted && admission === previous.admission && context === previous.context &&
      Boolean(pptxSemantic) === previous.semantic && !(semanticNodes instanceof Error) &&
      (semanticNodes === previous.semanticNodes || nodeValues === previous.nodeValues)) return previous
  const freezeOwned = (value) => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freezeOwned)
      Object.freeze(value)
    }
    return value
  }
  const owned = admitted ? { ...context, slide: admission, effectiveSlide: ownedEffective }
    : freezeOwned(JSON.parse(values))
  return Object.freeze({
    context, admission, values, nodeValues, semanticNodes,
    slide: owned.slide,
    effectiveSlide: owned.effectiveSlide,
    resolution: owned.resolution,
    designTokens: owned.designTokens,
    semantic: Boolean(pptxSemantic),
  })
}

export function SlideThumbnailPreview({
  slide,
  width,
  height,
  resolution,
  designTokens,
  layoutMasters,
  pptxSemantic,
  renderView,
  className = '',
  'data-testid': testId,
}) {
  if (renderView) {
    slide = renderView.effectiveSlide
    resolution = renderView.resolution
    designTokens = renderView.designTokens
    layoutMasters = undefined
  }
  const sourceWidth = width || resolution?.width || 960
  const sourceHeight = height || resolution?.height || 540
  const hostRef = useRef(null)
  const [scale, setScale] = useState(0)
  const outputPixelScale = useOutputPixelScale(scale)
  const effectiveSlide = renderView ? renderView.effectiveSlide
    : slide?.layoutId ? resolveEffectiveSlide(slide, layoutMasters).slide : slide
  const tokenValues = JSON.stringify(
    mergeTokens(mergeTokens(DEFAULT_TOKENS, designTokens), effectiveSlide?.designTokens)
  )
  const tokens = useMemo(() => JSON.parse(tokenValues), [tokenValues])
  const elements = useMemo(() => {
    const source = effectiveSlide?.elements || []
    const { effectiveLines } = resolveConnectorGeometry(source)
    return source
      .filter((element) => !element.hidden)
      .map((element) => effectiveLines.get(element.id) || element)
  }, [effectiveSlide?.elements])
  const background = backgroundStyle(effectiveSlide?.background, tokens)
  const renderElement = (element) => (
    <div key={element.id} style={elementStyle(element)}>
      <SafeElement element={element} tokens={tokens} outputPixelScale={outputPixelScale} />
    </div>
  )
  const semanticNodes = (() => {
    if (renderView) return renderView.semanticNodes
    if (!pptxSemantic || !effectiveSlide) return null
    try {
      const rawNodes = semanticTree.immutableSemanticRenderTree(pptxSemantic, effectiveSlide)
      return thumbnailProjection(pptxSemantic, rawNodes)
    } catch (error) {
      return error
    }
  })()
  let content
  if (renderView ? renderView.semantic : pptxSemantic) {
    if (semanticNodes instanceof Error) {
      content = <span data-thumbnail-error>{semanticNodes.message}</span>
    } else if (semanticNodes) {
      content = <SemanticContent nodes={semanticNodes} tokens={tokens} outputPixelScale={outputPixelScale} />
    }
  } else content = elements.map(renderElement)

  useLayoutEffect(() => {
    const host = hostRef.current
    const resize = (availableWidth) => {
      // Keep geometry sampling in sync with the measured CSS scale, independently of editor zoom.
      setScale(availableWidth / sourceWidth)
    }
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
    <div
      ref={hostRef}
      aria-hidden="true"
      inert=""
      data-testid={testId}
      className={`pointer-events-none relative overflow-hidden ${className}`}
      style={{
        ...background,
        ...tokensToStyleObject(tokens),
        aspectRatio: `${sourceWidth} / ${sourceHeight}`,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          ...background,
          position: 'absolute',
          left: 0,
          top: 0,
          width: sourceWidth,
          height: sourceHeight,
          fontSize: 16,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {content}
      </div>
    </div>
  )
}
