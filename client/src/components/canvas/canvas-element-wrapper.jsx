import { useRef, useEffect } from 'react'
import { EditorContent } from '@tiptap/react'
import hljs from 'highlight.js'
import katex from 'katex'
import { sanitizeRichTextHtml } from '../../utils/content-safety'
import { getElementRenderer, CropOverlay } from './element-renderers/registry'
import { HANDLE_STYLES } from './use-canvas-resize-rotate'
import PluginSandbox from '../../plugins/plugin-sandbox'
import { isPluginElementType } from '../../plugins'

function getMediaFragmentSrc(src, startTime, endTime) {
  if (!src) return src
  const start = Number(startTime)
  const end = Number(endTime)
  const hasStart = Number.isFinite(start) && start > 0
  const hasEnd = Number.isFinite(end) && end > 0
  if (!hasStart && !hasEnd) return src
  const rangeStart = hasStart ? start : 0
  const rangeEnd = hasEnd && end > rangeStart ? `,${end}` : ''
  return `${String(src).split('#')[0]}#t=${rangeStart}${rangeEnd}`
}

function getPlaybackRate(value) {
  const rate = Number(value)
  return Number.isFinite(rate) && rate > 0 ? rate : null
}

function importedTextInsetStyles(element) {
  const insets = element?._pptxImportMeta?.textInsets
  if (!insets) return null
  const unitScale = element._pptxImportMeta.textInsetsUnit === 'px' ? 1 : 96 / 72
  const side = (value, maxDimension) => {
    const raw = Number(value)
    if (!Number.isFinite(raw)) return null
    const max = Math.min(Number.isFinite(maxDimension) && maxDimension >= 0 ? maxDimension / 2 : 96, 96)
    return `${Math.min(Math.round(Math.max(0, raw) * unitScale * 10) / 10, max)}px`
  }
  return {
    paddingLeft: side(insets.left, element.width),
    paddingRight: side(insets.right, element.width),
    paddingTop: side(insets.top, element.height),
    paddingBottom: side(insets.bottom, element.height),
  }
}

function importedTextWrapStyles(element) {
  return element?._pptxImportMeta
    ? { overflowWrap: 'anywhere', wordBreak: 'normal', whiteSpace: 'pre-wrap' }
    : null
}

function importedFontSize(element) {
  const fit = Number(element?._pptxImportMeta?.fitFontSizePx)
  return Number.isFinite(fit) && fit > 0 ? fit : element.fontSize || 16
}

export default function CanvasElement({
  element,
  isSelected,
  isEditing,
  isCropping,
  cropState,
  isDragging,
  editor,
  onPointerDown,
  onClick,
  onDoubleClick,
  onContextMenu,
  onCropHandleDown,
  onCommitCrop,
  onUpdateElement,
  iconPaths,
}) {
  const contentRef = useRef(null)
  const videoRef = useRef(null)

  // Render KaTeX math in preview
  useEffect(() => {
    if (isEditing || !contentRef.current) return
    contentRef.current.querySelectorAll('span[data-math-latex]').forEach((el) => {
      if (el.getAttribute('data-katex-done')) return
      try {
        katex.render(el.getAttribute('data-math-latex'), el, { throwOnError: false, displayMode: el.getAttribute('data-math-display') === 'true' })
        el.setAttribute('data-katex-done', '1')
        // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (e) {}
    })
  }, [element.content, isEditing])

  useEffect(() => {
    if (element.type !== 'video' || !videoRef.current) return
    const playbackRate = getPlaybackRate(element.playbackRate)
    videoRef.current.playbackRate = playbackRate || 1
  }, [element.playbackRate, element.type])

  const elementWrapperStyle = {
    position: 'absolute', left: element.x, top: element.y,
    width: element.width, height: element.height,
    zIndex: element.zIndex || 1,
    pointerEvents: element.type === 'line' && !isSelected && !isEditing ? 'none' : 'auto',
    outline: element.locked ? '2px solid #f59e0b'
      : (isSelected || isEditing) && !isCropping ? '2px solid #6366f1'
      : isCropping ? '2px solid #f59e0b' : 'none',
    cursor: isCropping ? 'crosshair' : isEditing ? 'text' : isDragging ? 'grabbing'
      : element.locked ? 'not-allowed' : 'grab',
    userSelect: isEditing ? 'text' : 'none',
    overflow: (isSelected || isEditing || isCropping || element.type === 'line') ? 'visible' : 'hidden',
    boxSizing: 'border-box',
    borderRadius: (element.type === 'image' || element.type === 'code') && element.borderRadius ? element.borderRadius : undefined,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    boxShadow: element.shadowBlur || element.shadowX || element.shadowY
      ? `${element.shadowX || 0}px ${element.shadowY || 0}px ${element.shadowBlur || 0}px ${element.shadowColor || 'rgba(0,0,0,0.5)'}`
      : undefined,
  }
  const textInsetStyles = importedTextInsetStyles(element)
  const textWrapStyles = importedTextWrapStyles(element)
  const textElementStyle = {
    color: element.textColor || 'white',
    fontFamily: element.fontFamily,
    fontSize: importedFontSize(element),
    lineHeight: element.lineHeight,
  }
  const textPadding = element?._pptxImportMeta ? 0 : '8px 12px'
  const textPreviewStyle = { width: '100%', height: '100%', overflow: 'hidden', padding: textPadding, boxSizing: 'border-box', ...textElementStyle, ...textWrapStyles, ...textInsetStyles }
  const editorContentStyle = { width: '100%', height: '100%', boxSizing: 'border-box', ...textElementStyle, ...textWrapStyles, ...textInsetStyles }
  const imageWrapperStyle = { position: 'relative', width: '100%', height: '100%', overflow: isCropping ? 'visible' : 'hidden' }
  const sourceCropData = element.type === 'image' && element._pptxImportMeta?.sourceCrop
    ? element._pptxImportMeta.cropData
    : null
  const cropDiagnostics = sourceCropData
    ? {
        'data-pptx-crop-intent': 'source-crop',
        'data-pptx-crop-data': JSON.stringify(sourceCropData),
      }
    : {}
  const htmlFrameStyle = { width: '100%', height: '100%', border: 'none', display: 'block', pointerEvents: 'none' }
  const codeBlockStyle = { margin: 0, padding: '10px 14px', width: '100%', height: '100%', overflow: 'hidden', boxSizing: 'border-box', fontFamily: "'Fira Code','JetBrains Mono','Courier New',monospace", fontSize: element.fontSize || 14, lineHeight: 1.5, borderRadius: element.borderRadius || 0 }
  // Opacity is applied to the element-CONTENT layer only, so selection chrome
  // (outline, resize/rotation handles, badges) stays fully opaque.
  const contentOpacity = element.opacity !== undefined && element.opacity !== 1 ? element.opacity : undefined
  const contentLayerStyle = { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: contentOpacity }
  // Flip targets the <img>, not the wrapper, so handles aren't mirrored; composes
  // with the wrapper's rotation rather than canceling it.
  const imageFlipTransform = [element.flipH ? 'scaleX(-1)' : '', element.flipV ? 'scaleY(-1)' : ''].filter(Boolean).join(' ') || undefined
  const videoStyle = { width: '100%', height: '100%', objectFit: element.objectFit || 'contain', display: 'block', pointerEvents: isSelected && !isDragging ? 'auto' : 'none' }
  const audioWrapperStyle = { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: 4 }
  const audioControlStyle = { width: '90%', pointerEvents: isSelected && !isDragging ? 'auto' : 'none' }
  const fragmentBadgeStyle = { position: 'absolute', top: -20, left: 0, zIndex: 101, pointerEvents: 'none', background: '#8b5cf6', color: 'white', fontSize: '10px', fontFamily: 'sans-serif', padding: '2px 6px', borderRadius: 3, userSelect: 'none', whiteSpace: 'nowrap' }
  const groupBadgeStyle = { position: 'absolute', top: -20, right: 0, zIndex: 101, pointerEvents: 'none', background: '#14b8a6', color: 'white', fontSize: '9px', fontFamily: 'sans-serif', padding: '1px 5px', borderRadius: 3, userSelect: 'none' }
  const getResizeHandleStyle = (handleStyle) => ({ position: 'absolute', width: 10, height: 10, background: '#6366f1', border: '2px solid white', borderRadius: 2, zIndex: 100, ...handleStyle })
  const rotationGuideStyle = { position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)', width: 1, height: 20, background: '#6366f1', zIndex: 100, pointerEvents: 'none' }
  const rotationHandleStyle = { position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)', width: 14, height: 14, borderRadius: '50%', background: '#6366f1', border: '2px solid white', zIndex: 100, cursor: 'grab' }

  return (
    <div
      className="element-wrapper"
      data-testid={`slide-element-${element.id}`}
      data-element-id={element.id}
      data-element-type={element.type}
      {...cropDiagnostics}
      style={elementWrapperStyle}
      onMouseDown={(e) => { if (isEditing) { e.stopPropagation(); return }; if (!isCropping) onPointerDown(e, 'move', null) }}
      onClick={(e) => { if (!isEditing) onClick(e); else e.stopPropagation() }}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <div data-element-content style={contentLayerStyle}>
      {element.type === 'text' && !isEditing && (
        <div ref={contentRef} className="slide-text-content ProseMirror-preview" style={textPreviewStyle} dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(element.content || '') }} />
      )}
      {element.type === 'text' && isEditing && (
        <EditorContent editor={editor} style={editorContentStyle} />
      )}
      {element.type === 'image' && (() => {
        const imgFilter = [element.filterBrightness != null && element.filterBrightness !== 100 ? `brightness(${element.filterBrightness}%)` : '', element.filterContrast != null && element.filterContrast !== 100 ? `contrast(${element.filterContrast}%)` : '', element.filterGrayscale ? `grayscale(${element.filterGrayscale}%)` : '', element.filterSaturate != null && element.filterSaturate !== 100 ? `saturate(${element.filterSaturate}%)` : ''].filter(Boolean).join(' ') || undefined
        return (
          <div style={imageWrapperStyle}>
            <img src={element.src} alt={element.alt || ''} style={element.imageW != null ? { position: 'absolute', left: element.imageOffsetX ?? 0, top: element.imageOffsetY ?? 0, width: element.imageW, height: element.imageH, objectFit: element.objectFit || 'contain', pointerEvents: 'none', filter: imgFilter, transform: imageFlipTransform } : { width: '100%', height: '100%', objectFit: element.objectFit || 'contain', display: 'block', pointerEvents: 'none', filter: imgFilter, transform: imageFlipTransform }} draggable={false} />
            {isCropping && cropState && <CropOverlay crop={cropState} elW={element.width} elH={element.height} onHandleDown={onCropHandleDown} onCommit={onCommitCrop} />}
          </div>
        )
      })()}
      {element.type !== 'text' && element.type !== 'image' && (() => {
        const Renderer = getElementRenderer(element.type)
        if (isPluginElementType(element.type)) {
          const sandbox = element.pluginRuntime?.sandbox
          const sandboxUrl = sandbox && element.pluginSlug
            ? `/api/plugins/${element.pluginSlug}/assets/${sandbox}`
            : ''
          if (!sandboxUrl) {
            return <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">Plugin unavailable</div>
          }
          return (
            <PluginSandbox
              sandboxUrl={sandboxUrl}
              pluginData={element.pluginData || {}}
              width={element.width}
              height={element.height}
              interactive={isSelected && !isDragging}
              onDataUpdate={(patch) =>
                onUpdateElement?.(element.id, {
                  pluginData: { ...(element.pluginData || {}), ...patch },
                })
              }
            />
          )
        }
        if (element.type === 'html') return <iframe srcDoc={element.content || ''} style={htmlFrameStyle} sandbox="allow-scripts allow-same-origin" title="HTML embed" />
        if (element.type === 'code') return <pre className="hljs" style={codeBlockStyle}><code dangerouslySetInnerHTML={{ __html: hljs.highlight(element.content || '', { language: element.language || 'plaintext' }).value }} /></pre>
        if (element.type === 'video') {
          const playbackRate = getPlaybackRate(element.playbackRate)
          const videoSrc = element.videoUrl || element.src
          return (
            <video
              ref={videoRef}
              src={getMediaFragmentSrc(videoSrc, element.startTime, element.endTime)}
              controls={element.controls !== false}
              muted={element.muted || false}
              loop={element.loop || false}
              poster={element.poster || undefined}
              style={videoStyle}
              onLoadedMetadata={(event) => {
                if (playbackRate && playbackRate !== 1) event.currentTarget.playbackRate = playbackRate
              }}
            />
          )
        }
        if (element.type === 'audio') return <div style={audioWrapperStyle}><audio src={element.src} controls style={audioControlStyle} /></div>
        if (Renderer) {
          if (element.type === 'table') return <Renderer element={element} isEditing={isEditing} onUpdateElement={onUpdateElement} />
          if (element.type === 'chart' || element.type === 'latex') return <Renderer element={element} isSelected={isSelected} isDragging={isDragging} />
          if (element.type === 'icon') return <Renderer element={element} iconPaths={iconPaths} />
          return <Renderer element={element} />
        }
        return null
      })()}
      </div>
      {element.fragment && <div style={fragmentBadgeStyle}>▶ {element.fragmentIndex ?? 1}</div>}
      {element.groupId && isSelected && <div style={groupBadgeStyle}>Group</div>}
      {isSelected && !isEditing && !isCropping && !element.locked && Object.entries(HANDLE_STYLES).map(([handle, hStyle]) => (
        <div key={handle} data-testid={`resize-handle-${handle}`} style={getResizeHandleStyle(hStyle)} onMouseDown={(e) => { e.stopPropagation(); onPointerDown(e, 'resize', handle) }} />
      ))}
      {isSelected && !isEditing && !isCropping && !element.locked && (
        <>
          <div style={rotationGuideStyle} />
          <div style={rotationHandleStyle} data-testid="rotation-handle" onMouseDown={(e) => { e.stopPropagation(); onPointerDown(e, 'rotate', null) }} />
        </>
      )}
    </div>
  )
}
