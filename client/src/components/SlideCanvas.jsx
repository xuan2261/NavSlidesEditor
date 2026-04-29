import { useRef, useEffect, useState, useCallback } from 'react'
import CanvasGridOverlay from './canvas/canvas-grid-overlay'
import CanvasRulers from './canvas/canvas-rulers'
import CanvasZoomControls from './canvas/canvas-floating-zoom-in-out-fit-controls'
import CanvasFooterOverlay from './canvas/canvas-footer-overlay-with-section-and-page-number'
import CanvasContextMenu from './canvas/canvas-right-click-context-menu-for-slide-elements'
import {
  snapWithRef,
  getPersistentGuideStyle,
  getActiveGuideStyle,
} from './canvas/use-canvas-snapping-helpers-for-grid-and-smart-guides'
import {
  applyResize,
  getRotationAngle,
  applyResizeAspectRatio,
  clampToSlide,
} from './canvas/use-canvas-resize-rotate'
import useCanvasPointerInteraction from './canvas/use-canvas-pointer-interaction'
import useCanvasRubberBandSelection from './canvas/use-canvas-rubber-band-drag-selection'
import CanvasElement from './canvas/canvas-element-wrapper'
import MiniToolbar from './MiniToolbar'
import { cn } from '../lib/utils'

function getBgStyle(bg) {
  if (!bg || bg.type === 'none') return { backgroundColor: 'var(--bg-canvas-default, #ffffff)' }
  if (bg.type === 'color') return { backgroundColor: bg.color || 'var(--bg-canvas-default, #ffffff)' }
  if (bg.type === 'gradient') return { background: bg.gradient || 'var(--bg-canvas-default, #ffffff)' }
  if (bg.type === 'image' && bg.image) return { backgroundImage: `url(${bg.image})`, backgroundSize: bg.size || 'cover', backgroundPosition: bg.position || 'center' }
  return { backgroundColor: 'var(--bg-canvas-default, #ffffff)' }
}

// Lazy-loaded on first render to avoid 764KB in initial bundle
let _iconPathsCache = null

export default function SlideCanvas({
  editor,
  slide,
  selectedElementIds,
  editingElementId,
  showGrid,
  gridSize = 40,
  resolution,
  showFooter,
  showPageNumbers,
  pageNumberFormat,
  pageNumber,
  totalSlides,
  sectionName,
  footerFontSize = 14,
  footerFontFamily = '-apple-system,sans-serif',
  footerColor = 'rgba(255,255,255,0.65)',
  footerInactiveColor = 'rgba(255,255,255,0.25)',
  smartGuidesEnabled = true,
  footerMode = 'basic',
  sequenceSections = [],
  activeSection = null,
  showRulers = false,
  persistentGuides = [],
  onAddGuide,
  onRemoveGuide,
  onToggleSelectElement,
  onStartEdit,
  onStopEdit,
  onUpdateElement,
  onUpdateElements,
  onDeleteElement,
  onDeleteSelectedElements,
  onAddImage,
  onOpenHtmlEditor,
  onOpenCodeEditor,
  onOpenLatexEditor,
  // Command callbacks (from useClipboard via EditorPage)
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
}) {
  const SLIDE_W = resolution?.width || 960
  const SLIDE_H = resolution?.height || 540
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const [scale, setScale] = useState(1)
  const [userZoomMode, setUserZoomMode] = useState(false)
  const pendingDragRef = useRef(null)
  const draggingRef = useRef(null)
  const suppressCanvasClickRef = useRef(false)
  const [, forceUpdate] = useState(0)
  const showGridRef = useRef(showGrid)
  const selectedElementIdsRef = useRef(selectedElementIds)
  const gridSizeRef = useRef(gridSize)
  const [contextMenu, setContextMenu] = useState(null) // { elementId, x, y }
  const [cropMode, setCropMode] = useState(null) // { elementId, x, y, w, h }
  const cropDragRef = useRef(null) // { handle, startX, startY, startCrop, elW, elH }
  const [dragOver, setDragOver] = useState(false)
  const [activeGuides, setActiveGuides] = useState([])
  const scaleRef = useRef(scale)
  const smartGuidesRef = useRef(smartGuidesEnabled)
  const rubberBandRef = useRef(null) // { startX, startY, currentX, currentY }
  const [_rubberBand, setRubberBand] = useState(null) // render state
  const [iconPaths, setIconPaths] = useState(_iconPathsCache || {})
  const commitCropRef = useRef(null)

  // Lazy-load icon-paths.json on first mount (764KB saved from initial bundle)
  useEffect(() => {
    if (_iconPathsCache) return
    import('../data/icon-paths.json').then((m) => {
      _iconPathsCache = m.default || m
      setIconPaths(_iconPathsCache)
    })
  }, [])

  // slideRef must be declared before all hooks that use it (fixes TDZ error)
  const slideRef = useRef(slide)
  useEffect(() => { slideRef.current = slide }, [slide])
  useEffect(() => { showGridRef.current = showGrid }, [showGrid])
  useEffect(() => { gridSizeRef.current = gridSize }, [gridSize])
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { selectedElementIdsRef.current = selectedElementIds }, [selectedElementIds])
  useEffect(() => { smartGuidesRef.current = smartGuidesEnabled }, [smartGuidesEnabled])

  // Rubber-band selection hook — must be called before useCanvasPointerInteraction
  // (its helpers are passed into that hook)
  const {
    startRubberBand: rbStart,
    updateRubberBand: rbUpdate,
    endRubberBand: rbEnd,
    applyRubberBandSelection: rbApply,
  } = useCanvasRubberBandSelection({
    slide,
    onToggleSelectElement,
    rubberBandRef,
  })

  // Wire useCanvasPointerInteraction hook (Phase 2: replaces inline mouse listeners)
  const { startElementDrag, setCropDrag } = useCanvasPointerInteraction({
    scaleRef,
    showGridRef,
    gridSizeRef,
    smartGuidesRef,
    slideRef,
    selectedElementIdsRef,
    draggingRef,
    pendingDragRef,
    cropDragRef,
    rubberBandRef,
    onUpdateElement,
    onUpdateElements,
    snapToGrid: (v) => showGridRef.current ? Math.round(v / gridSizeRef.current) * gridSizeRef.current : v,
    snapWithRef,
    getRotationAngle,
    applyResize,
    applyResizeAspectRatio,
    clampToSlide,
    updateRubberBand: rbUpdate,
    endRubberBand: rbEnd,
    applyRubberBandSelection: rbApply,
    setRubberBand,
    setActiveGuides,
    forceUpdate,
    setSuppressCanvasClick: (v) => { suppressCanvasClickRef.current = v },
    setCropMode,
    slideW: SLIDE_W,
    slideH: SLIDE_H,
  })

  // Scale to fit container (skip auto-fit when user manually zoomed)
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return
      const { clientWidth: w, clientHeight: h } = containerRef.current
      const newScale = Math.max(Math.min((w - 24) / SLIDE_W, (h - 24) / SLIDE_H), 0.1)
      if (!userZoomMode) setScale(newScale)
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [SLIDE_H, SLIDE_W, userZoomMode])


  // Keyboard shortcuts

  useEffect(() => {
    const onKeyDown = (e) => {
      if (cropMode) {
        if (e.key === 'Enter') {
          commitCropRef.current?.()
          e.preventDefault()
        }
        if (e.key === 'Escape') {
          setCropMode(null)
          e.preventDefault()
        }
        return
      }
      const tag = document.activeElement?.tagName
      if (editingElementId) {
        if (e.key === 'Escape') {
          onStopEdit()
          e.preventDefault()
          return
        }
        // Forward formatting shortcuts to TipTap — do NOT block them
        if (
          (e.ctrlKey || e.metaKey) &&
          ['b', 'i', 'u', 'z', 'y', '0'].includes(e.key.toLowerCase())
        ) {
          return // Let browser/TipTap handle
        }
        return // Block other keys when editing
      }
      const selectedElements = (slideRef.current?.elements || []).filter((el) =>
        selectedElementIds.includes(el.id)
      )
      const hasLockedSelection = selectedElements.some((el) => el.locked)
      if (selectedElementIds.length > 0) {
        if (
          (e.key === 'Delete' || e.key === 'Backspace') &&
          tag !== 'INPUT' &&
          tag !== 'TEXTAREA' &&
            !slideRef.current?.locked &&
            !hasLockedSelection
        ) {
          onDeleteSelectedElements()
          e.preventDefault()
        }
        if (e.key === 'Escape') {
          onToggleSelectElement(null, false)
          e.preventDefault()
        }
        // ── Clipboard shortcuts — delegated to command callbacks ────────────
        // Skip clipboard shortcuts when focus is inside a textarea or input
        // (e.g. the HTML editor modal, code editor, etc.)
        if ((e.ctrlKey || e.metaKey) && tag !== 'TEXTAREA' && tag !== 'INPUT') {
          if (e.key === 'c' || e.key === 'C') {
            onCopy?.()
            e.preventDefault()
          }
          if (e.key === 'x' || e.key === 'X') {
            if (hasLockedSelection) {
              e.preventDefault()
              return
            }
            onCut?.()
            e.preventDefault()
          }
          if (e.key === 'v' || e.key === 'V') {
            onPaste?.()
            e.preventDefault()
          }
          if (e.key === 'd' || e.key === 'D') {
            if (hasLockedSelection) {
              e.preventDefault()
              return
            }
            onDuplicate?.()
            e.preventDefault()
          }
        }
      }

      // Allow paste even when no element is selected (e.g. after slide change).
      // Locked slide blocks paste-on-empty.
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'v' || e.key === 'V') &&
        selectedElementIds.length === 0 &&
        tag !== 'TEXTAREA' &&
        tag !== 'INPUT' &&
        !slideRef.current?.locked
      ) {
        onPaste?.()
        e.preventDefault()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [
    selectedElementIds,
    editingElementId,
    cropMode,
    onStopEdit,
    onToggleSelectElement,
    onDeleteSelectedElements,
    onCopy,
    onCut,
    onPaste,
    onDuplicate,
  ])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [contextMenu])

  const startCrop = (elementId) => {
    if (slide?.locked) return // Block crop on locked slides
    const element = slide?.elements?.find((el) => el.id === elementId)
    if (!element) return
    // cropMode uses {x,y,w,h} as fractions of the CURRENT element box
    setCropMode({ elementId, x: 0, y: 0, w: 1, h: 1 })
    setContextMenu(null)
  }

  const commitCrop = useCallback(() => {
    if (!cropMode) return
    const element = slide?.elements?.find((el) => el.id === cropMode.elementId)
    if (!element) return
    const { x: cx, y: cy, w: cw, h: ch } = cropMode

    // Pixel crop amounts relative to current element box
    const dx = Math.round(cx * element.width)
    const dy = Math.round(cy * element.height)
    const newW = Math.round(cw * element.width)
    const newH = Math.round(ch * element.height)

    // imageW/H = the absolute pixel size the image renders at (never changes after first crop)
    const imgW = element.imageW ?? element.width
    const imgH = element.imageH ?? element.height
    // imageOffsetX/Y = offset of image render origin relative to element top-left
    const offX = (element.imageOffsetX ?? 0) - dx
    const offY = (element.imageOffsetY ?? 0) - dy

    onUpdateElement(cropMode.elementId, {
      x: element.x + dx,
      y: element.y + dy,
      width: newW,
      height: newH,
      imageW: imgW,
      imageH: imgH,
      imageOffsetX: offX,
      imageOffsetY: offY,
      crop: null, // no longer used
    })
    setCropMode(null)
  }, [cropMode, slide, onUpdateElement])

  useEffect(() => {
    commitCropRef.current = commitCrop
  }, [commitCrop])

  // File drop on canvas
  const onDragOver = (e) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    setDragOver(true)
  }
  const onDragLeave = () => setDragOver(false)
  const onDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(
      (f) =>
        f.type.startsWith('image/') || f.type.startsWith('video/') || f.type.startsWith('audio/')
    )
    if (!files.length || !onAddImage) return
    // Get drop position in slide coordinates
    let dropX = 130,
      dropY = 100
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      dropX = Math.round((e.clientX - rect.left) / scale)
      dropY = Math.round((e.clientY - rect.top) / scale)
    }
    for (const file of files) {
      await onAddImage(file, dropX, dropY)
    }
  }

  const canvasStyle = {
    width: SLIDE_W,
    height: SLIDE_H,
    transform: `scale(${scale})`,
    transformOrigin: 'center center',
    flexShrink: 0,
    position: 'relative',
    fontSize: '16px',
    outline: dragOver ? '3px dashed #6366f1' : 'none',
    ...getBgStyle(slide?.background),
  }

  return (
    <div
      ref={containerRef}
      className="tour-step-canvas bg-workspace w-full h-full flex items-center justify-center overflow-hidden relative"
      onWheel={(e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          const delta = e.deltaY > 0 ? -0.1 : 0.1
          setScale((s) => Math.max(0.1, Math.min(4, s + delta)))
          setUserZoomMode(true)
        }
      }}
    >
      {/* Rulers */}
      {showRulers && <CanvasRulers scale={scale} onAddGuide={onAddGuide} />}
      <div
        ref={canvasRef}
        className={cn('slide-canvas shadow-lg')}
        style={canvasStyle}
        onClick={(e) => {
          if (cropMode) return
          if (suppressCanvasClickRef.current) {
            suppressCanvasClickRef.current = false
            return
          }
          if (e.target === canvasRef.current) {
            onToggleSelectElement(null, false)
            onStopEdit()
          }
        }}
        onMouseDown={(e) => {
          if (slide?.locked) return
          if (cropMode) return
          if (e.target !== canvasRef.current) return
          if (e.button !== 0) return
          if (!canvasRef.current) return
          const rect = canvasRef.current.getBoundingClientRect()
          const mx = (e.clientX - rect.left) / scale
          const my = (e.clientY - rect.top) / scale
          rbStart(mx, my)
        }}
        onContextMenu={(e) => e.preventDefault()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Locked slide overlay */}
        {slide?.locked && (
          <div className={cn('absolute inset-0 z-[997] pointer-events-none flex items-center justify-center')}>
            <span className="text-white/30 text-sm select-none">🔒 Slide Locked</span>
          </div>
        )}

        {/* Grid overlay */}
        <CanvasGridOverlay showGrid={showGrid} gridSize={gridSize} />

        {/* Persistent guide lines */}
        {persistentGuides.map((guide, i) => (
          <div
            key={`pg${i}`}
            data-testid={`persistent-guide-${guide.axis}`}
            style={getPersistentGuideStyle(guide, SLIDE_W, SLIDE_H)}
            onDoubleClick={() => onRemoveGuide?.(i)}
            title="Double-click to remove guide"
          />
        ))}

        {/* Smart guide lines */}
        {activeGuides.map((guide, i) => (
          <div
            key={`g${i}`}
            data-testid={`smart-guide-${guide.axis}`}
            style={getActiveGuideStyle(guide, SLIDE_W, SLIDE_H)}
          />
        ))}

        {/* Rubber-band selection */}
        {rubberBandRef.current && (
          <div style={{
            position: 'absolute',
            left: Math.min(rubberBandRef.current.startX, rubberBandRef.current.currentX),
            top: Math.min(rubberBandRef.current.startY, rubberBandRef.current.currentY),
            width: Math.abs(rubberBandRef.current.currentX - rubberBandRef.current.startX),
            height: Math.abs(rubberBandRef.current.currentY - rubberBandRef.current.startY),
            border: '1.5px dashed #6366f1',
            background: 'rgba(99, 102, 241, 0.08)',
            zIndex: 998, pointerEvents: 'none', borderRadius: 2,
          }} />
        )}

        {slide?.elements
          ?.filter((el) => !(el.hidden || false)) // hide elements with hidden:true
          .slice()
          .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
          .map((element) => (
            <CanvasElement
              key={element.id}
              element={element}
              isSelected={selectedElementIds.includes(element.id)}
              isEditing={editingElementId === element.id}
              isCropping={cropMode?.elementId === element.id}
              cropState={cropMode?.elementId === element.id ? cropMode : null}
              isDragging={draggingRef.current?.elementId === element.id}
              editor={editor}
              iconPaths={iconPaths}
              onPointerDown={(e, type, handle) => {
                if (cropMode) return
                if (editingElementId === element.id) return
                if (element.locked && type === 'move') return
                e.stopPropagation()
                if (
                  type === 'move' &&
                  !e.shiftKey &&
                  !selectedElementIdsRef.current.includes(element.id)
                ) {
                  onToggleSelectElement(element.id, false)
                }
                startElementDrag(e, element.id, type, handle, slide, scale, selectedElementIdsRef.current)
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (!cropMode && editingElementId !== element.id) {
                  if (
                    selectedElementIdsRef.current.includes(element.id) &&
                    element.type === 'table' &&
                    !e.shiftKey
                  ) {
                    onStartEdit(element.id)
                  } else {
                    onToggleSelectElement(element.id, e.shiftKey)
                  }
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                if (element.type === 'text' && editingElementId !== element.id)
                  onStartEdit(element.id)
                else if (element.type === 'table' && editingElementId !== element.id)
                  onStartEdit(element.id)
                else if (element.type === 'html') onOpenHtmlEditor?.(element.id)
                else if (element.type === 'code') onOpenCodeEditor?.(element.id)
                else if (element.type === 'latex') onOpenLatexEditor?.(element.id)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setContextMenu({
                  elementId: element.id,
                  elementType: element.type,
                  x: e.clientX,
                  y: e.clientY,
                })
              }}
              onStopEdit={onStopEdit}
              onCropHandleDown={(handle, clientX, clientY) => {
                const el = slide?.elements?.find((el) => el.id === element.id)
                if (!el) return
                setCropDrag(handle, clientX, clientY, { x: cropMode.x, y: cropMode.y, w: cropMode.w, h: cropMode.h }, el.width, el.height)
              }}
              onCommitCrop={commitCrop}
              onUpdateElement={onUpdateElement}
            />
          ))}

        {/* Footer overlay */}
        <CanvasFooterOverlay
          showFooter={showFooter}
          showPageNumbers={showPageNumbers}
          pageNumber={pageNumber}
          totalSlides={totalSlides}
          sectionName={sectionName}
          footerFontSize={footerFontSize}
          footerFontFamily={footerFontFamily}
          footerColor={footerColor}
          footerInactiveColor={footerInactiveColor}
          footerMode={footerMode}
          sequenceSections={sequenceSections}
          activeSection={activeSection}
          pageNumberFormat={pageNumberFormat}
        />

        {/* Drop hint */}
        {dragOver && <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 999,
          background: 'rgba(99,102,241,0.08)',
          fontSize: '16px', color: 'rgba(255,255,255,0.7)',
          fontFamily: 'sans-serif',
        }}>Drop image here</div>}
      </div>

      {/* Context menu */}
      <CanvasContextMenu
        contextMenu={contextMenu}
        slide={slide}
        onCopy={onCopy}
        onCut={onCut}
        onPaste={onPaste}
        onDuplicate={onDuplicate}
        onDeleteElement={onDeleteElement}
        onUpdateElement={onUpdateElement}
        onStartCrop={startCrop}
        onClose={() => setContextMenu(null)}
      />

      {/* Zoom Controls */}
      <CanvasZoomControls
        scale={scale}
        onZoomIn={() => { setScale((s) => Math.min(4, s + 0.1)); setUserZoomMode(true) }}
        onZoomOut={() => { setScale((s) => Math.max(0.1, s - 0.1)); setUserZoomMode(true) }}
        onZoomReset={() => {
          setUserZoomMode(false)
          if (containerRef.current) {
            const { clientWidth: w, clientHeight: h } = containerRef.current
            setScale(Math.max(Math.min((w - 24) / SLIDE_W, (h - 24) / SLIDE_H), 0.1))
          }
        }}
        onScaleChange={setScale}
        onSetUserZoomMode={setUserZoomMode}
      />

      {/* Mini Toolbar — floating formatting bar when editing text */}
      {editingElementId &&
        editor &&
        (() => {
          const el = slide?.elements?.find((e) => e.id === editingElementId)
          if (!el || el.type !== 'text') return null
          const containerLeft = containerRef.current?.getBoundingClientRect().left ?? 0
          const containerTop = containerRef.current?.getBoundingClientRect().top ?? 0
          return (
            <MiniToolbar
              editor={editor}
              position={{
                x: containerLeft + (el.x + (el.width ?? 200) / 2) * scale,
                y: containerTop + el.y * scale,
              }}
              onClose={onStopEdit}
            />
          )
        })()}
    </div>
  )
}
