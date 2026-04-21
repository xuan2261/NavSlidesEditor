import { useRef, useEffect, useState, useCallback } from 'react'
import { useEditorStore } from '../stores/editor-store'
import { EditorContent } from '@tiptap/react'
import katex from 'katex'
import QRCode from 'qrcode'
import hljs from 'highlight.js'
import { calculateGuides } from '../utils/smartGuides'
import MiniToolbar from './MiniToolbar'
import { cn } from '../lib/utils'

// Lazy-loaded on first render to avoid 764KB in initial bundle
let _iconPathsCache = null

function highlightCode(code, language) {
  try {
    if (language && language !== 'plaintext' && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value
    }
    return hljs.highlightAuto(code).value
  } catch {
    return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}

const SNAP_REF_OPTIONS = [
  { id: 'ul', label: 'Upper Left', fx: 0, fy: 0 },
  { id: 'uc', label: 'Upper Center', fx: 0.5, fy: 0 },
  { id: 'ur', label: 'Upper Right', fx: 1, fy: 0 },
  { id: 'ml', label: 'Middle Left', fx: 0, fy: 0.5 },
  { id: 'mc', label: 'Center', fx: 0.5, fy: 0.5 },
  { id: 'mr', label: 'Middle Right', fx: 1, fy: 0.5 },
  { id: 'll', label: 'Lower Left', fx: 0, fy: 1 },
  { id: 'lc', label: 'Lower Center', fx: 0.5, fy: 1 },
  { id: 'lr', label: 'Lower Right', fx: 1, fy: 1 },
]

function snapWithRef(rawX, rawY, w, h, ref, snapFn) {
  const opt = SNAP_REF_OPTIONS.find((o) => o.id === ref) || SNAP_REF_OPTIONS[0]
  const refX = rawX + opt.fx * w
  const refY = rawY + opt.fy * h
  return {
    x: snapFn(refX) - opt.fx * w,
    y: snapFn(refY) - opt.fy * h,
  }
}

const MIN_SIZE = 40

const HANDLE_STYLES = {
  nw: { top: -5, left: -5, cursor: 'nw-resize' },
  n: { top: -5, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize' },
  ne: { top: -5, right: -5, cursor: 'ne-resize' },
  e: { top: '50%', right: -5, transform: 'translateY(-50%)', cursor: 'e-resize' },
  se: { bottom: -5, right: -5, cursor: 'se-resize' },
  s: { bottom: -5, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' },
  sw: { bottom: -5, left: -5, cursor: 'sw-resize' },
  w: { top: '50%', left: -5, transform: 'translateY(-50%)', cursor: 'w-resize' },
}

// px/py are fractions (0 or 0.5 or 1) within the crop rect
const CROP_HANDLES = [
  { id: 'nw', px: 0, py: 0, cursor: 'nw-resize' },
  { id: 'n', px: 0.5, py: 0, cursor: 'n-resize' },
  { id: 'ne', px: 1, py: 0, cursor: 'ne-resize' },
  { id: 'e', px: 1, py: 0.5, cursor: 'e-resize' },
  { id: 'se', px: 1, py: 1, cursor: 'se-resize' },
  { id: 's', px: 0.5, py: 1, cursor: 's-resize' },
  { id: 'sw', px: 0, py: 1, cursor: 'sw-resize' },
  { id: 'w', px: 0, py: 0.5, cursor: 'w-resize' },
]

function applyResize(handle, startEl, dx, dy) {
  let { x, y, width, height } = startEl
  switch (handle) {
    case 'se':
      width = Math.max(MIN_SIZE, startEl.width + dx)
      height = Math.max(MIN_SIZE, startEl.height + dy)
      break
    case 'sw':
      x = startEl.x + dx
      width = Math.max(MIN_SIZE, startEl.width - dx)
      if (width === MIN_SIZE) x = startEl.x + startEl.width - MIN_SIZE
      height = Math.max(MIN_SIZE, startEl.height + dy)
      break
    case 'ne':
      width = Math.max(MIN_SIZE, startEl.width + dx)
      y = startEl.y + dy
      height = Math.max(MIN_SIZE, startEl.height - dy)
      if (height === MIN_SIZE) y = startEl.y + startEl.height - MIN_SIZE
      break
    case 'nw':
      x = startEl.x + dx
      width = Math.max(MIN_SIZE, startEl.width - dx)
      if (width === MIN_SIZE) x = startEl.x + startEl.width - MIN_SIZE
      y = startEl.y + dy
      height = Math.max(MIN_SIZE, startEl.height - dy)
      if (height === MIN_SIZE) y = startEl.y + startEl.height - MIN_SIZE
      break
    case 'n':
      y = startEl.y + dy
      height = Math.max(MIN_SIZE, startEl.height - dy)
      if (height === MIN_SIZE) y = startEl.y + startEl.height - MIN_SIZE
      break
    case 's':
      height = Math.max(MIN_SIZE, startEl.height + dy)
      break
    case 'e':
      width = Math.max(MIN_SIZE, startEl.width + dx)
      break
    case 'w':
      x = startEl.x + dx
      width = Math.max(MIN_SIZE, startEl.width - dx)
      if (width === MIN_SIZE) x = startEl.x + startEl.width - MIN_SIZE
      break
  }
  return { x, y, width, height }
}

function applyCropHandle(handle, startCrop, dx, dy, elW, elH) {
  // dx/dy are in element-pixel space; convert to fractions
  const fdx = dx / elW
  const fdy = dy / elH
  let { x, y, w, h } = startCrop
  const MIN_CROP = 0.05
  switch (handle) {
    case 'nw': {
      const nx = Math.min(x + fdx, x + w - MIN_CROP)
      const ny = Math.min(y + fdy, y + h - MIN_CROP)
      w = w - (nx - x)
      h = h - (ny - y)
      x = nx
      y = ny
      break
    }
    case 'n': {
      const ny = Math.min(y + fdy, y + h - MIN_CROP)
      h = h - (ny - y)
      y = ny
      break
    }
    case 'ne': {
      const ny = Math.min(y + fdy, y + h - MIN_CROP)
      h = h - (ny - y)
      y = ny
      w = Math.max(MIN_CROP, w + fdx)
      break
    }
    case 'e':
      w = Math.max(MIN_CROP, w + fdx)
      break
    case 'se':
      w = Math.max(MIN_CROP, w + fdx)
      h = Math.max(MIN_CROP, h + fdy)
      break
    case 's':
      h = Math.max(MIN_CROP, h + fdy)
      break
    case 'sw': {
      const nx = Math.min(x + fdx, x + w - MIN_CROP)
      w = w - (nx - x)
      x = nx
      h = Math.max(MIN_CROP, h + fdy)
      break
    }
    case 'w': {
      const nx = Math.min(x + fdx, x + w - MIN_CROP)
      w = w - (nx - x)
      x = nx
      break
    }
  }
  // Clamp to [0, 1]
  x = Math.max(0, x)
  y = Math.max(0, y)
  w = Math.min(w, 1 - x)
  h = Math.min(h, 1 - y)
  return { x, y, w, h }
}

function getBgStyle(bg) {
  if (!bg) return { backgroundColor: 'var(--bg-canvas-default, #ffffff)' }
  if (bg.type === 'color') return { backgroundColor: bg.color || 'var(--bg-canvas-default, #ffffff)' }
  if (bg.type === 'gradient')
    return { background: bg.gradient || 'linear-gradient(135deg, #ffffff, #f1f5f9)' }
  if (bg.type === 'image' && bg.image)
    return {
      backgroundImage: `url(${bg.image})`,
      backgroundSize: bg.size || 'cover',
      backgroundPosition: bg.position || 'center',
    }
  return { backgroundColor: 'var(--bg-canvas-default, #ffffff)' }
}

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
  onAddElements, // (newElements[]) => void — for clipboard paste/duplicate
}) {
  const SLIDE_W = resolution?.width || 960
  const SLIDE_H = resolution?.height || 540
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const [scale, setScale] = useState(1)
  const [userZoomMode, setUserZoomMode] = useState(false)
  const pendingDragRef = useRef(null)
  const draggingRef = useRef(null)
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
  const [rubberBand, setRubberBand] = useState(null) // render state
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [iconPaths, setIconPaths] = useState(_iconPathsCache || {})

  // Lazy-load icon-paths.json on first mount (764KB saved from initial bundle)
  useEffect(() => {
    if (_iconPathsCache) return
    import('../data/icon-paths.json').then((m) => {
      _iconPathsCache = m.default || m
      setIconPaths(_iconPathsCache)
    })
  }, [])

  // Clipboard state — shared via Zustand store
  const clipboard = useEditorStore(s => s.clipboard)
  const setClipboard = useEditorStore(s => s.setClipboard)
  const clipboardRef = useRef(null)
  useEffect(() => { clipboardRef.current = clipboard }, [clipboard])
  const slideRef = useRef(slide)
  useEffect(() => {
    showGridRef.current = showGrid
  }, [showGrid])
  useEffect(() => {
    gridSizeRef.current = gridSize
  }, [gridSize])
  useEffect(() => {
    scaleRef.current = scale
  }, [scale])
  useEffect(() => {
    selectedElementIdsRef.current = selectedElementIds
  }, [selectedElementIds])
  useEffect(() => {
    smartGuidesRef.current = smartGuidesEnabled
  }, [smartGuidesEnabled])
  const toggleSelectRef = useRef(onToggleSelectElement)
  useEffect(() => {
    toggleSelectRef.current = onToggleSelectElement
  }, [onToggleSelectElement])

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
  }, [])

  // Global mouse move/up for element drag + crop drag
  useEffect(() => {
    const snap = (v) =>
      showGridRef.current ? Math.round(v / gridSizeRef.current) * gridSizeRef.current : v

    const onMouseMove = (e) => {
      // Crop drag
      if (cropDragRef.current) {
        const cd = cropDragRef.current
        const dx = (e.clientX - cd.startX) / scaleRef.current
        const dy = (e.clientY - cd.startY) / scaleRef.current
        const newCrop = applyCropHandle(cd.handle, cd.startCrop, dx, dy, cd.elW, cd.elH)
        setCropMode((prev) => (prev ? { ...prev, ...newCrop } : prev))
        return
      }

      // Rubber-band selection drag
      if (rubberBandRef.current) {
        if (!canvasRef.current) return
        const rect = canvasRef.current.getBoundingClientRect()
        const mx = (e.clientX - rect.left) / scaleRef.current
        const my = (e.clientY - rect.top) / scaleRef.current
        rubberBandRef.current.currentX = mx
        rubberBandRef.current.currentY = my
        setRubberBand({ ...rubberBandRef.current })
        return
      }

      // Promote pending → active drag after 4px movement
      if (pendingDragRef.current && !draggingRef.current) {
        const px = pendingDragRef.current
        if (Math.abs(e.clientX - px.startClientX) + Math.abs(e.clientY - px.startClientY) > 4) {
          draggingRef.current = {
            type: px.type,
            handle: px.handle,
            elementId: px.elementId,
            startMouseX: px.startMouseX,
            startMouseY: px.startMouseY,
            startEl: px.startEl,
            startEls: px.startEls,
          }
          forceUpdate((n) => n + 1)
        }
      }
      const drag = draggingRef.current
      if (!drag || !canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const mouseX = (e.clientX - rect.left) / scaleRef.current
      const mouseY = (e.clientY - rect.top) / scaleRef.current
      const dx = mouseX - drag.startMouseX
      const dy = mouseY - drag.startMouseY
      if (drag.type === 'move') {
        if (drag.startEls && drag.startEls.length > 1) {
          const updates = drag.startEls.map((sel) => ({
            id: sel.id,
            x: Math.max(0, Math.min(SLIDE_W - sel.width, sel.x + dx)),
            y: Math.max(0, Math.min(SLIDE_H - sel.height, sel.y + dy)),
          }))
          onUpdateElements(updates)
        } else {
          const rawX = Math.max(0, Math.min(SLIDE_W - drag.startEl.width, drag.startEl.x + dx))
          const rawY = Math.max(0, Math.min(SLIDE_H - drag.startEl.height, drag.startEl.y + dy))
          let newX, newY
          if (showGridRef.current) {
            const { x: snappedX, y: snappedY } = snapWithRef(
              rawX,
              rawY,
              drag.startEl.width,
              drag.startEl.height,
              drag.startEl.snapRef || 'ul',
              snap
            )
            newX = Math.max(0, Math.min(SLIDE_W - drag.startEl.width, snappedX))
            newY = Math.max(0, Math.min(SLIDE_H - drag.startEl.height, snappedY))
            setActiveGuides([])
          } else if (smartGuidesRef.current) {
            const allEls = slideRef.current?.elements || []
            const draggedEl = {
              id: drag.elementId,
              x: rawX,
              y: rawY,
              width: drag.startEl.width,
              height: drag.startEl.height,
            }
            const { guides, snappedX, snappedY } = calculateGuides(
              draggedEl,
              allEls,
              SLIDE_W,
              SLIDE_H
            )
            newX = Math.max(0, Math.min(SLIDE_W - drag.startEl.width, snappedX))
            newY = Math.max(0, Math.min(SLIDE_H - drag.startEl.height, snappedY))
            setActiveGuides(guides)
          } else {
            newX = rawX
            newY = rawY
            setActiveGuides([])
          }
          onUpdateElement(drag.elementId, { x: newX, y: newY })
        }
      } else if (drag.type === 'resize') {
        let updates = applyResize(drag.handle, drag.startEl, dx, dy)
        if (e.shiftKey) {
          const ratio = drag.startEl.width / drag.startEl.height
          if (['nw', 'ne', 'sw', 'se'].includes(drag.handle)) {
            if (
              Math.abs(updates.width - drag.startEl.width) >=
              Math.abs(updates.height - drag.startEl.height)
            ) {
              updates.height = Math.max(MIN_SIZE, Math.round(updates.width / ratio))
              if (drag.handle === 'ne' || drag.handle === 'nw')
                updates.y = drag.startEl.y + drag.startEl.height - updates.height
            } else {
              updates.width = Math.max(MIN_SIZE, Math.round(updates.height * ratio))
              if (drag.handle === 'nw' || drag.handle === 'sw')
                updates.x = drag.startEl.x + drag.startEl.width - updates.width
            }
          }
        }
        updates.x = snap(Math.max(0, updates.x))
        updates.y = snap(Math.max(0, updates.y))
        updates.width = snap(Math.min(SLIDE_W - updates.x, updates.width))
        updates.height = snap(Math.min(SLIDE_H - updates.y, updates.height))
        updates.width = Math.max(MIN_SIZE, updates.width)
        updates.height = Math.max(MIN_SIZE, updates.height)
        onUpdateElement(drag.elementId, updates)
      } else if (drag.type === 'rotate') {
        // Calculate angle from element center to mouse position
        const centerX = drag.startEl.x + drag.startEl.width / 2
        const centerY = drag.startEl.y + drag.startEl.height / 2
        const angle = Math.atan2(mouseY - centerY, mouseX - centerX) * (180 / Math.PI) + 90
        // Snap to 15-degree increments when holding shift
        let rotation = Math.round(angle)
        if (e.shiftKey) rotation = Math.round(rotation / 15) * 15
        // Normalize to 0-360
        rotation = ((rotation % 360) + 360) % 360
        onUpdateElement(drag.elementId, { rotation })
      }
    }
    const onMouseUp = () => {
      // Rubber-band selection complete
      if (rubberBandRef.current) {
        const rb = rubberBandRef.current
        const x1 = Math.min(rb.startX, rb.currentX)
        const y1 = Math.min(rb.startY, rb.currentY)
        const x2 = Math.max(rb.startX, rb.currentX)
        const y2 = Math.max(rb.startY, rb.currentY)
        // Only select if rubber-band has meaningful size (>4px)
        if (x2 - x1 > 4 || y2 - y1 > 4) {
          const els = slideRef.current?.elements || []
          const hitIds = els
            .filter((el) => {
              const ex1 = el.x
              const ey1 = el.y
              const ex2 = el.x + el.width
              const ey2 = el.y + el.height
              return ex1 < x2 && ex2 > x1 && ey1 < y2 && ey2 > y1
            })
            .map((el) => el.id)
          if (hitIds.length > 0) {
            // Select all intersecting elements
            toggleSelectRef.current(null, false) // clear first
            hitIds.forEach((id) => toggleSelectRef.current(id, true))
          }
        }
        rubberBandRef.current = null
        setRubberBand(null)
      }
      // Only trigger re-render if a drag/crop/rubberband interaction was actually active
      const hadInteraction = cropDragRef.current || pendingDragRef.current || draggingRef.current
      cropDragRef.current = null
      pendingDragRef.current = null
      draggingRef.current = null
      if (hadInteraction) {
        setActiveGuides([])
        forceUpdate((n) => n + 1)
      }
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [onUpdateElement, onUpdateElements])

  // Keyboard shortcuts
   
  useEffect(() => {
    const onKeyDown = (e) => {
      if (cropMode) {
        if (e.key === 'Enter') {
          commitCrop()
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
        if ((e.ctrlKey || e.metaKey) && ['b','i','u','z','y','0'].includes(e.key.toLowerCase())) {
          return // Let browser/TipTap handle
        }
        return // Block other keys when editing
      }
      if (selectedElementIds.length > 0) {
        if (
          (e.key === 'Delete' || e.key === 'Backspace') &&
          tag !== 'INPUT' &&
          tag !== 'TEXTAREA' &&
          !slide?.locked
        ) {
          onDeleteSelectedElements()
          e.preventDefault()
        }
        if (e.key === 'Escape') {
          onToggleSelectElement(null, false)
          e.preventDefault()
        }
        // ── Clipboard shortcuts ────────────────────────────────────────────
        // Skip clipboard shortcuts when focus is inside a textarea or input
        // (e.g. the HTML editor modal, code editor, etc.)
        if ((e.ctrlKey || e.metaKey) && tag !== 'TEXTAREA' && tag !== 'INPUT') {
          if (e.key === 'c' || e.key === 'C') {
            // Copy selected elements
            const clones = (slide?.elements || [])
              .filter(el => selectedElementIds.includes(el.id))
              .map(el => {
                // eslint-disable-next-line unused-imports/no-unused-vars
                const { id, ...rest } = el
                return { ...rest }
              })
            setClipboard(clones)
            e.preventDefault()
          }
          if (e.key === 'x' || e.key === 'X') {
            // Cut: copy then delete originals (caller deletes)
            const clones = (slide?.elements || [])
              .filter(el => selectedElementIds.includes(el.id))
              .map(el => {
                // eslint-disable-next-line unused-imports/no-unused-vars
                const { id, ...rest } = el
                return { ...rest }
              })
            setClipboard(clones)
            // Notify parent to delete originals
            if (typeof onDeleteSelectedElements === 'function') {
              onDeleteSelectedElements()
            }
            e.preventDefault()
          }
          if (e.key === 'v' || e.key === 'V') {
            // Paste at offset position
            if (clipboardRef.current && clipboardRef.current.length > 0) {
              const newElements = clipboardRef.current.map(el => {
                const newId = `${el.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                return { ...el, id: newId, x: (el.x || 0) + 20, y: (el.y || 0) + 20 }
              })
              // Notify parent to add pasted elements
              if (typeof onAddElements === 'function') {
                onAddElements(newElements)
              }
              e.preventDefault()
            }
          }
          if (e.key === 'd' || e.key === 'D') {
            // Duplicate in place
            const clones = (slide?.elements || [])
              .filter(el => selectedElementIds.includes(el.id))
              .map(el => {
                // eslint-disable-next-line unused-imports/no-unused-vars
                const { id, ...rest } = el
                return { ...rest, id: `${rest.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }
              })
            if (typeof onAddElements === 'function' && clones.length > 0) {
              onAddElements(clones)
            }
            e.preventDefault()
          }
        }
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
    onAddElements,
  ])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [contextMenu])

  const startElementDrag = (e, elementId, type, handle = null) => {
    if (slide?.locked) return // Block drag on locked slides
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const element = slide?.elements?.find((el) => el.id === elementId)
    if (!element) return
    const allSelected = (slide?.elements || []).filter((el) =>
      selectedElementIdsRef.current.includes(el.id)
    )
    pendingDragRef.current = {
      type,
      handle,
      elementId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startMouseX: (e.clientX - rect.left) / scale,
      startMouseY: (e.clientY - rect.top) / scale,
      startEl: {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        snapRef: element.snapRef,
      },
      startEls: allSelected.map((el) => ({
        id: el.id,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
      })),
    }
  }

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

  // eslint-disable-next-line unused-imports/no-unused-vars
  const handleRulerMouseDown = (axis, e) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    // eslint-disable-next-line unused-imports/no-unused-vars
    const onMove = (me) => {
      // Show a preview line while dragging
    }
    const onUp = (me) => {
      const pos = axis === 'x' ? (me.clientX - rect.left) / scale : (me.clientY - rect.top) / scale
      if (pos >= 0 && pos <= (axis === 'x' ? SLIDE_W : SLIDE_H)) {
        onAddGuide?.({ axis, position: Math.round(pos) })
      }
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={containerRef}
      className={cn("tour-step-canvas bg-workspace")}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
      }}
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
      {showRulers && (
        <>
          {/* Top ruler */}
          <div
            className={cn("bg-panel/90 border-b border-border text-muted-foreground")}
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: `translateX(calc(-50% * 1)) scale(${scale})`,
              transformOrigin: 'top center',
              width: SLIDE_W,
              height: 20,
              zIndex: 100,
              cursor: 'crosshair',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'flex-end',
              userSelect: 'none',
              fontSize: 8,
            }}
            onMouseDown={(e) => handleRulerMouseDown('x', e)}
          >
            {Array.from({ length: Math.ceil(SLIDE_W / 50) }, (_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: i * 50,
                  bottom: 0,
                  borderLeft: '1px solid rgba(255,255,255,0.2)',
                  height: '100%',
                  paddingLeft: 2,
                }}
              >
                {i * 50}
              </div>
            ))}
          </div>
          {/* Left ruler */}
          <div
            className={cn("bg-panel/90 border-r border-border text-muted-foreground")}
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: `translateY(calc(-50% * 1)) scale(${scale})`,
              transformOrigin: 'left center',
              width: 20,
              height: SLIDE_H,
              zIndex: 100,
              cursor: 'crosshair',
              overflow: 'hidden',
              userSelect: 'none',
              fontSize: 8,
            }}
            onMouseDown={(e) => handleRulerMouseDown('y', e)}
          >
            {Array.from({ length: Math.ceil(SLIDE_H / 50) }, (_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: i * 50,
                  left: 0,
                  borderTop: '1px solid rgba(255,255,255,0.2)',
                  width: '100%',
                  paddingLeft: 2,
                  paddingTop: 1,
                }}
              >
                {i * 50}
              </div>
            ))}
          </div>
        </>
      )}
      <div
        ref={canvasRef}
        className={cn("slide-canvas shadow-lg")}
        style={{
          width: SLIDE_W,
          height: SLIDE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          flexShrink: 0,
          position: 'relative',
          fontSize: '16px',
          outline: dragOver ? '3px dashed #6366f1' : 'none',
          ...getBgStyle(slide?.background),
        }}
        onClick={(e) => {
          if (cropMode) return
          if (e.target === canvasRef.current) {
            onToggleSelectElement(null, false)
            onStopEdit()
          }
        }}
        onMouseDown={(e) => {
          // Start rubber-band only on canvas background click (not on elements)
          if (slide?.locked) return
          if (cropMode) return
          if (e.target !== canvasRef.current) return
          if (e.button !== 0) return // left click only
          if (!canvasRef.current) return
          const rect = canvasRef.current.getBoundingClientRect()
          const mx = (e.clientX - rect.left) / scale
          const my = (e.clientY - rect.top) / scale
          rubberBandRef.current = { startX: mx, startY: my, currentX: mx, currentY: my }
        }}
        onContextMenu={(e) => e.preventDefault()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Locked slide overlay */}
        {slide?.locked && (
          <div
            className={cn("bg-black/15 dark:bg-white/10")}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 997,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, fontFamily: 'sans-serif', userSelect: 'none' }}>
              🔒 Slide Locked
            </span>
          </div>
        )}
        {/* Grid overlay */}
        {showGrid && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 998,
              backgroundImage:
                'linear-gradient(to right, rgba(99,102,241,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.18) 1px, transparent 1px)',
              backgroundSize: `${gridSize}px ${gridSize}px`,
            }}
          />
        )}

        {/* Persistent guide lines (user-placed from rulers) */}
        {persistentGuides.map((guide, i) =>
          guide.axis === 'x' ? (
            <div
              key={`pg${i}`}
              style={{
                position: 'absolute',
                left: guide.position,
                top: 0,
                width: 1,
                height: SLIDE_H,
                background: '#22d3ee',
                zIndex: 998,
                pointerEvents: 'auto',
                cursor: 'col-resize',
              }}
              onDoubleClick={() => onRemoveGuide?.(i)}
              title="Double-click to remove guide"
            />
          ) : (
            <div
              key={`pg${i}`}
              style={{
                position: 'absolute',
                top: guide.position,
                left: 0,
                height: 1,
                width: SLIDE_W,
                background: '#22d3ee',
                zIndex: 998,
                pointerEvents: 'auto',
                cursor: 'row-resize',
              }}
              onDoubleClick={() => onRemoveGuide?.(i)}
              title="Double-click to remove guide"
            />
          )
        )}

        {/* Smart guide lines */}
        {activeGuides.map((guide, i) =>
          guide.axis === 'x' ? (
            <div
              key={`g${i}`}
              style={{
                position: 'absolute',
                left: guide.position,
                top: 0,
                width: 1,
                height: SLIDE_H,
                background: '#f59e0b',
                zIndex: 999,
                pointerEvents: 'none',
              }}
            />
          ) : (
            <div
              key={`g${i}`}
              style={{
                position: 'absolute',
                top: guide.position,
                left: 0,
                height: 1,
                width: SLIDE_W,
                background: '#f59e0b',
                zIndex: 999,
                pointerEvents: 'none',
              }}
            />
          )
        )}

        {/* Rubber-band selection rectangle */}
        {rubberBand && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(rubberBand.startX, rubberBand.currentX),
              top: Math.min(rubberBand.startY, rubberBand.currentY),
              width: Math.abs(rubberBand.currentX - rubberBand.startX),
              height: Math.abs(rubberBand.currentY - rubberBand.startY),
              border: '1.5px dashed #6366f1',
              background: 'rgba(99, 102, 241, 0.08)',
              zIndex: 998,
              pointerEvents: 'none',
              borderRadius: 2,
            }}
          />
        )}

        {slide?.elements
          ?.filter(el => !(el.hidden || false)) // hide elements with hidden:true
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
              onPointerDown={(e, type, handle) => {
                if (cropMode) return
                if (editingElementId === element.id) return
                if (element.locked && type === 'move') return
                e.stopPropagation()
                onToggleSelectElement(element.id, e.shiftKey)
                startElementDrag(e, element.id, type, handle)
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (!cropMode && editingElementId !== element.id) {
                  if (selectedElementIdsRef.current.includes(element.id) && element.type === 'table' && !e.shiftKey) {
                    onStartEdit(element.id)
                  } else {
                    onToggleSelectElement(element.id, e.shiftKey)
                  }
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                if (element.type === 'text' && editingElementId !== element.id) onStartEdit(element.id)
                else if (element.type === 'table' && editingElementId !== element.id) onStartEdit(element.id)
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
                cropDragRef.current = {
                  handle,
                  startX: clientX,
                  startY: clientY,
                  startCrop: { x: cropMode.x, y: cropMode.y, w: cropMode.w, h: cropMode.h },
                  elW: el.width,
                  elH: el.height,
                }
              }}
              onCommitCrop={commitCrop}
              onUpdateElement={onUpdateElement}
            />
          ))}

        {/* Footer overlay */}
        {(showFooter || showPageNumbers) &&
          (footerMode === 'sequence' && sequenceSections.length > 0 ? (
            <div
              style={{
                position: 'absolute',
                bottom: 6,
                left: 16,
                right: 16,
                zIndex: 900,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 0,
                fontSize: footerFontSize,
                fontFamily: footerFontFamily,
                pointerEvents: 'none',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flex: 1,
                  justifyContent: 'space-evenly',
                  alignItems: 'center',
                }}
              >
                {sequenceSections.map((sec, i) => (
                  <span
                    key={i}
                    style={{
                      color:
                        activeSection === i
                          ? footerColor || 'rgba(255,255,255,0.9)'
                          : footerInactiveColor,
                      fontWeight: activeSection === i ? 700 : 400,
                      fontSize: footerFontSize,
                      transition: 'color 0.2s, font-weight 0.2s',
                    }}
                  >
                    {sec || `Section ${i + 1}`}
                  </span>
                ))}
              </div>
              {showPageNumbers && pageNumber != null && (
                <span style={{ color: footerColor, marginLeft: 12, flexShrink: 0 }}>
                  {pageNumberFormat === 'c/t' ? `${pageNumber} / ${totalSlides}` : `${pageNumber}`}
                </span>
              )}
            </div>
          ) : (
            <div
              style={{
                position: 'absolute',
                bottom: 8,
                left: 16,
                right: 16,
                zIndex: 900,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: footerFontSize,
                color: footerColor,
                fontFamily: footerFontFamily,
                pointerEvents: 'none',
                boxSizing: 'border-box',
              }}
            >
              <span>{showFooter ? sectionName : ''}</span>
              <span>
                {showPageNumbers && pageNumber != null
                  ? pageNumberFormat === 'c/t'
                    ? `${pageNumber} / ${totalSlides}`
                    : `${pageNumber}`
                  : ''}
              </span>
            </div>
          ))}

        {/* Drop hint */}
        {dragOver && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 999,
              background: 'rgba(99,102,241,0.08)',
              fontSize: '16px',
              color: 'rgba(255,255,255,0.7)',
              fontFamily: 'sans-serif',
            }}
          >
            Drop image here
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu &&
        (() => {
          const ctxEl = slide?.elements?.find((e) => e.id === contextMenu.elementId)
          const currentRef = ctxEl?.snapRef || 'ul'
          return (
            <div
              className="canvas-context-menu"
              style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Clipboard actions (always visible when element is right-clicked) ── */}
              <button
                onClick={() => {
                  const clones = (slide?.elements || [])
                    .filter(el => contextMenu.elementId === el.id)
                    // eslint-disable-next-line unused-imports/no-unused-vars
                    .map(el => { const { id, ...rest } = el; return { ...rest } })
                  setClipboard(clones)
                  setContextMenu(null)
                }}
              >
                📋 Copy (Ctrl+C)
              </button>
              <button
                onClick={() => {
                  const clones = (slide?.elements || [])
                    .filter(el => contextMenu.elementId === el.id)
                    // eslint-disable-next-line unused-imports/no-unused-vars
                    .map(el => { const { id, ...rest } = el; return { ...rest } })
                  setClipboard(clones)
                  onDeleteElement(contextMenu.elementId)
                  setContextMenu(null)
                }}
              >
                ✂ Cut (Ctrl+X)
              </button>
              <button
                onClick={() => {
                  if (!clipboardRef.current || clipboardRef.current.length === 0) return
                  const newEls = clipboardRef.current.map(el => ({
                    ...el,
                    id: `${el.type || 'el'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    x: (el.x || 0) + 20,
                    y: (el.y || 0) + 20,
                  }))
                  if (typeof onAddElements === 'function') onAddElements(newEls)
                  setContextMenu(null)
                }}
              >
                📌 Paste (Ctrl+V)
              </button>
              <button
                onClick={() => {
                  if (!ctxEl) return
                  // eslint-disable-next-line unused-imports/no-unused-vars
                  const { id, ...rest } = ctxEl
                  const newEl = {
                    ...rest,
                    id: `${rest.type || 'el'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    x: (ctxEl.x || 0) + 20,
                    y: (ctxEl.y || 0) + 20,
                  }
                  if (typeof onAddElements === 'function') onAddElements([newEl])
                  setContextMenu(null)
                }}
              >
                ⧉ Duplicate (Ctrl+D)
              </button>
              <div className="canvas-context-menu-separator" />

              {contextMenu.elementType === 'image' && (
                <>
                  <button onClick={() => startCrop(contextMenu.elementId)}>✂ Crop</button>
                  <button
                    onClick={() => {
                      const el = slide?.elements?.find((e) => e.id === contextMenu.elementId)
                      if (el && el.imageW != null) {
                        onUpdateElement(contextMenu.elementId, {
                          x: el.x + (el.imageOffsetX ?? 0),
                          y: el.y + (el.imageOffsetY ?? 0),
                          width: el.imageW,
                          height: el.imageH,
                          imageW: null,
                          imageH: null,
                          imageOffsetX: null,
                          imageOffsetY: null,
                          crop: null,
                        })
                      }
                      setContextMenu(null)
                    }}
                  >
                    ↺ Reset crop
                  </button>
                  <div className="canvas-context-menu-separator" />
                </>
              )}
              <div
                style={{
                  padding: '4px 8px 2px',
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  userSelect: 'none',
                }}
              >
                Snap Reference
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3,1fr)',
                  gap: 2,
                  padding: '2px 6px 6px',
                }}
              >
                {SNAP_REF_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    title={opt.label}
                    style={{
                      padding: '5px 4px',
                      fontSize: 11,
                      background: currentRef === opt.id ? 'var(--accent)' : 'var(--bg-hover)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onClick={() => {
                      onUpdateElement(contextMenu.elementId, { snapRef: opt.id })
                      setContextMenu(null)
                    }}
                  >
                    {opt.id === 'ul'
                      ? '↖'
                      : opt.id === 'uc'
                        ? '↑'
                        : opt.id === 'ur'
                          ? '↗'
                          : opt.id === 'ml'
                            ? '←'
                            : opt.id === 'mc'
                              ? '⊕'
                              : opt.id === 'mr'
                                ? '→'
                                : opt.id === 'll'
                                  ? '↙'
                                  : opt.id === 'lc'
                                    ? '↓'
                                    : '↘'}
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

      {/* Zoom Controls */}
      <div className="zoom-controls">
        <button
          className="btn-icon zoom-btn"
          onClick={() => { setScale((s) => Math.max(0.1, s - 0.1)); setUserZoomMode(true) }}
          title="Zoom out"
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>−</span>
        </button>
        <select
          className="zoom-select"
          value={`${Math.round(scale * 100)}`}
          onChange={(e) => {
            const pct = parseInt(e.target.value) / 100
            setScale(Math.max(0.1, Math.min(4, pct)))
            setUserZoomMode(true)
          }}
        >
          <option value="25">25%</option>
          <option value="50">50%</option>
          <option value="75">75%</option>
          <option value="100">100%</option>
          <option value="150">150%</option>
          <option value="200">200%</option>
          <option value="400">400%</option>
        </select>
        <button
          className="btn-icon zoom-btn"
          onClick={() => { setScale((s) => Math.min(4, s + 0.1)); setUserZoomMode(true) }}
          title="Zoom in"
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
        </button>
        <button
          className="zoom-fit-btn"
          onClick={() => {
            setUserZoomMode(false)
            if (containerRef.current) {
              const { clientWidth: w, clientHeight: h } = containerRef.current
              setScale(Math.max(Math.min((w - 24) / SLIDE_W, (h - 24) / SLIDE_H), 0.1))
            }
          }}
          title="Fit to window"
        >
          Fit
        </button>
      </div>

      {/* Mini Toolbar — floating formatting bar when editing text */}
      {editingElementId && editor && (() => {
        const el = slide?.elements?.find(e => e.id === editingElementId)
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

function CanvasElement({
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
  // eslint-disable-next-line unused-imports/no-unused-vars
  onStopEdit,
  onCropHandleDown,
  onCommitCrop,
  onUpdateElement,
}) {
  const contentRef = useRef(null)

  // Render KaTeX math in preview (when not editing)
  useEffect(() => {
    if (isEditing || !contentRef.current) return
    contentRef.current.querySelectorAll('span[data-math-latex]').forEach((el) => {
      if (el.getAttribute('data-katex-done')) return
      try {
        katex.render(el.getAttribute('data-math-latex'), el, {
          throwOnError: false,
          displayMode: el.getAttribute('data-math-display') === 'true',
        })
        el.setAttribute('data-katex-done', '1')
      // eslint-disable-next-line unused-imports/no-unused-vars
      } catch (e) {}
    })
  }, [element.content, isEditing])

  return (
    <div
      className="element-wrapper"
      style={{
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        zIndex: element.zIndex || 1,
        pointerEvents: element.type === 'line' && !isSelected && !isEditing ? 'none' : 'auto',
        outline: element.locked
          ? '2px solid #f59e0b'
          : (isSelected || isEditing) && !isCropping
            ? '2px solid #6366f1'
            : isCropping
              ? '2px solid #f59e0b'
              : 'none',
        cursor: isCropping
          ? 'crosshair'
          : isEditing
            ? 'text'
            : isDragging
              ? 'grabbing'
              : element.locked
                ? 'not-allowed'
                : 'grab',
        userSelect: isEditing ? 'text' : 'none',
        overflow: 'hidden',
        boxSizing: 'border-box',
        borderRadius:
          (element.type === 'image' || element.type === 'code') && element.borderRadius
            ? element.borderRadius
            : undefined,
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
        boxShadow:
          element.shadowBlur || element.shadowX || element.shadowY
            ? `${element.shadowX || 0}px ${element.shadowY || 0}px ${element.shadowBlur || 0}px ${element.shadowColor || 'rgba(0,0,0,0.5)'}`
            : undefined,
      }}
      onMouseDown={(e) => {
        if (isEditing) { e.stopPropagation(); return }
        if (!isCropping) onPointerDown(e, 'move', null)
      }}
      onClick={(e) => {
        if (!isEditing) onClick(e); else e.stopPropagation();
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {element.type === 'text' && !isEditing && (
        <div
          ref={contentRef}
          className="slide-text-content ProseMirror-preview"
          style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            color: 'white',
            padding: '8px 12px',
            boxSizing: 'border-box',
            // Match reveal.js output: text elements render inside 16px section
            // Headings use em units, so explicit 16px base keeps preview consistent with generated HTML
            fontSize: '16px',
          }}
          dangerouslySetInnerHTML={{ __html: element.content || '' }}
        />
      )}
      {element.type === 'text' && isEditing && (
        <EditorContent editor={editor} style={{ width: '100%', height: '100%', color: 'white', boxSizing: 'border-box' }} />
      )}
      {element.type === 'image' &&
        (() => {
          const imgFilter =
            [
              element.filterBrightness != null && element.filterBrightness !== 100
                ? `brightness(${element.filterBrightness}%)`
                : '',
              element.filterContrast != null && element.filterContrast !== 100
                ? `contrast(${element.filterContrast}%)`
                : '',
              element.filterGrayscale ? `grayscale(${element.filterGrayscale}%)` : '',
            ]
              .filter(Boolean)
              .join(' ') || undefined
          return (
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: isCropping ? 'visible' : 'hidden',
              }}
            >
              <img
                src={element.src}
                alt={element.alt || ''}
                style={
                  element.imageW != null
                    ? {
                        // Pixel-exact positioning so scale never changes after crop
                        position: 'absolute',
                        left: element.imageOffsetX ?? 0,
                        top: element.imageOffsetY ?? 0,
                        width: element.imageW,
                        height: element.imageH,
                        objectFit: element.objectFit || 'contain',
                        pointerEvents: 'none',
                        filter: imgFilter,
                      }
                    : {
                        width: '100%',
                        height: '100%',
                        objectFit: element.objectFit || 'contain',
                        display: 'block',
                        pointerEvents: 'none',
                        filter: imgFilter,
                      }
                }
                draggable={false}
              />
              {isCropping && cropState && (
                <CropOverlay
                  crop={cropState}
                  elW={element.width}
                  elH={element.height}
                  onHandleDown={onCropHandleDown}
                  onCommit={onCommitCrop}
                />
              )}
            </div>
          )
        })()}
      {element.type === 'shape' && <ShapeRenderer element={element} />}
      {element.type === 'html' && (
        <iframe
          srcDoc={element.content || ''}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            pointerEvents: 'none',
          }}
          sandbox="allow-scripts"
          title="HTML embed"
        />
      )}
      {element.type === 'code' && (
        <pre
          className="hljs"
          style={{
            margin: 0,
            padding: '10px 14px',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            boxSizing: 'border-box',
            fontFamily: "'Fira Code','JetBrains Mono','Courier New',monospace",
            fontSize: element.fontSize || 14,
            lineHeight: 1.5,
            borderRadius: 0,
          }}
        >
          <code
            dangerouslySetInnerHTML={{
              __html: highlightCode(element.content || '', element.language || 'plaintext'),
            }}
          />
        </pre>
      )}
      {element.type === 'video' && (
        <video
          src={element.src}
          controls={element.controls !== false}
          muted={element.muted || false}
          loop={element.loop || false}
          poster={element.poster || undefined}
          style={{
            width: '100%',
            height: '100%',
            objectFit: element.objectFit || 'contain',
            display: 'block',
            pointerEvents: (isSelected && !isDragging) ? 'auto' : 'none',
          }}
        />
      )}
      {element.type === 'audio' && (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: 4,
          }}
        >
          <audio
            src={element.src}
            controls
            style={{ width: '90%', pointerEvents: (isSelected && !isDragging) ? 'auto' : 'none' }}
          />
        </div>
      )}
      {element.type === 'table' && <TableRenderer element={element} isEditing={isEditing} onUpdateElement={onUpdateElement} />}
      {element.type === 'latex' && <LatexRenderer element={element} isSelected={isSelected} isDragging={isDragging} />}
      {element.type === 'markdown' && <MarkdownRenderer element={element} />}
      {element.type === 'chart' && <ChartRenderer element={element} isSelected={isSelected} isDragging={isDragging} />}
      {element.type === 'callout' && <CalloutRenderer element={element} />}
      {element.type === 'icon' && <IconRenderer element={element} iconPaths={iconPaths} />}
      {element.type === 'drawing' && <DrawingRenderer element={element} />}
      {element.type === 'line' && <LineArrowRenderer element={element} />}
      {element.type === 'svg' && <SvgElementRenderer element={element} />}
      {element.type === 'qrcode' && <QrCodeRenderer element={element} />}

      {/* Fragment badge */}
      {element.fragment && (
        <div
          style={{
            position: 'absolute',
            top: -20,
            left: 0,
            zIndex: 101,
            pointerEvents: 'none',
            background: '#8b5cf6',
            color: 'white',
            fontSize: '10px',
            fontFamily: 'sans-serif',
            padding: '2px 6px',
            borderRadius: 3,
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          ▶ {element.fragmentIndex ?? 1}
        </div>
      )}

      {/* Group badge */}
      {element.groupId && isSelected && (
        <div
          style={{
            position: 'absolute',
            top: -20,
            right: 0,
            zIndex: 101,
            pointerEvents: 'none',
            background: '#14b8a6',
            color: 'white',
            fontSize: '9px',
            fontFamily: 'sans-serif',
            padding: '1px 5px',
            borderRadius: 3,
            userSelect: 'none',
          }}
        >
          Group
        </div>
      )}

      {/* Resize handles */}
      {isSelected &&
        !isEditing &&
        !isCropping &&
        !element.locked &&
        Object.entries(HANDLE_STYLES).map(([handle, hStyle]) => (
          <div
            key={handle}
            style={{
              position: 'absolute',
              width: 10,
              height: 10,
              background: '#6366f1',
              border: '2px solid white',
              borderRadius: 2,
              zIndex: 100,
              ...hStyle,
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
              onPointerDown(e, 'resize', handle)
            }}
          />
        ))}

      {/* Rotation handle */}
      {isSelected && !isEditing && !isCropping && !element.locked && (
        <>
          <div
            style={{
              position: 'absolute',
              top: -30,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 1,
              height: 20,
              background: '#6366f1',
              zIndex: 100,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: -40,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#6366f1',
              border: '2px solid white',
              zIndex: 100,
              cursor: 'grab',
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
              onPointerDown(e, 'rotate', null)
            }}
          />
        </>
      )}
    </div>
  )
}

// eslint-disable-next-line unused-imports/no-unused-vars
function CropOverlay({ crop, elW, elH, onHandleDown, onCommit }) {
  const { x, y, w, h } = crop
  // Dim regions outside crop using four absolutely positioned rects
  const dimStyle = { position: 'absolute', background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }

  const handleMouseDown = (e, handle) => {
    e.stopPropagation()
    e.preventDefault()
    onHandleDown(handle, e.clientX, e.clientY)
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50 }} onDoubleClick={onCommit}>
      {/* Top strip */}
      <div style={{ ...dimStyle, top: 0, left: 0, right: 0, height: `${y * 100}%` }} />
      {/* Bottom strip */}
      <div style={{ ...dimStyle, bottom: 0, left: 0, right: 0, height: `${(1 - y - h) * 100}%` }} />
      {/* Left strip (between top and bottom) */}
      <div
        style={{
          ...dimStyle,
          top: `${y * 100}%`,
          left: 0,
          width: `${x * 100}%`,
          height: `${h * 100}%`,
        }}
      />
      {/* Right strip */}
      <div
        style={{
          ...dimStyle,
          top: `${y * 100}%`,
          right: 0,
          width: `${(1 - x - w) * 100}%`,
          height: `${h * 100}%`,
        }}
      />

      {/* Crop border */}
      <div
        style={{
          position: 'absolute',
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: `${w * 100}%`,
          height: `${h * 100}%`,
          border: '2px solid white',
          boxSizing: 'border-box',
          pointerEvents: 'none',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
        }}
      />

      {/* Rule-of-thirds grid lines */}
      {[1 / 3, 2 / 3].map((f) => (
        <div
          key={`v${f}`}
          style={{
            position: 'absolute',
            left: `${(x + f * w) * 100}%`,
            top: `${y * 100}%`,
            width: 1,
            height: `${h * 100}%`,
            background: 'rgba(255,255,255,0.3)',
            pointerEvents: 'none',
          }}
        />
      ))}
      {[1 / 3, 2 / 3].map((f) => (
        <div
          key={`hz${f}`}
          style={{
            position: 'absolute',
            top: `${(y + f * h) * 100}%`,
            left: `${x * 100}%`,
            height: 1,
            width: `${w * 100}%`,
            background: 'rgba(255,255,255,0.3)',
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Crop handles */}
      {CROP_HANDLES.map((ch) => (
        <div
          key={ch.id}
          style={{
            position: 'absolute',
            left: `calc(${(x + ch.px * w) * 100}% - 5px)`,
            top: `calc(${(y + ch.py * h) * 100}% - 5px)`,
            width: 10,
            height: 10,
            background: 'white',
            border: '1px solid rgba(0,0,0,0.5)',
            borderRadius: 2,
            cursor: ch.cursor,
            zIndex: 51,
          }}
          onMouseDown={(e) => handleMouseDown(e, ch.id)}
        />
      ))}

      {/* Commit button */}
      <div
        style={{
          position: 'absolute',
          left: `${(x + w) * 100}%`,
          top: `${y * 100}%`,
          transform: 'translate(6px, -28px)',
          background: '#f59e0b',
          color: 'white',
          fontSize: '11px',
          padding: '3px 8px',
          borderRadius: 4,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          fontFamily: 'sans-serif',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          zIndex: 52,
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onCommit}
      >
        Apply ↵
      </div>
    </div>
  )
}

// Simple Markdown to HTML converter (no external deps)
function markdownToHtml(md) {
  let html = md
    // Code blocks
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_, lang, code) =>
        `<pre style="background:rgba(0,0,0,0.3);padding:10px 14px;border-radius:6px;overflow:auto;font-family:'Fira Code',monospace;font-size:13px;"><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
    )
    // Inline code
    .replace(
      /`([^`]+)`/g,
      '<code style="background:rgba(255,255,255,0.1);padding:2px 5px;border-radius:3px;font-family:monospace;font-size:0.9em;">$1</code>'
    )
    // Headings
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" style="color:#60a5fa;text-decoration:underline;">$1</a>'
    )
    // Horizontal rules
    .replace(
      /^---$/gm,
      '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.2);margin:12px 0;">'
    )
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
  // Wrap consecutive <li> in <ul>
  html = html.replace(
    /((?:<li>.*<\/li>\n?)+)/g,
    '<ul style="padding-left:1.5em;margin:0.4em 0;">$1</ul>'
  )
  // Paragraphs (lines not already wrapped)
  html = html
    .split('\n')
    .map((line) => {
      if (!line.trim()) return ''
      if (/^<(h[1-4]|ul|ol|li|pre|hr|div|blockquote)/.test(line.trim())) return line
      return `<p style="margin:0 0 0.4em;line-height:1.6;">${line}</p>`
    })
    .join('\n')
  return html
}

function MarkdownRenderer({ element }) {
  const html = markdownToHtml(element.content || '')
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        padding: '8px 12px',
        boxSizing: 'border-box',
        color: 'white',
        fontSize: '18px',
        lineHeight: 1.5,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function ChartRenderer({ element, isSelected, isDragging }) {
  const { chartType = 'bar', chartData = {} } = element
  const labels = chartData.labels || []
  const datasets = chartData.datasets || []

  const chartHtml = `<!doctype html><html><head>
<meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"><\/script>
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:transparent;overflow:hidden}</style>
</head><body>
<canvas id="c" style="width:100%;height:100%"></canvas>
<script>
new Chart(document.getElementById('c'),{
  type:'${chartType}',
  data:{
    labels:${JSON.stringify(labels)},
    datasets:${JSON.stringify(
      datasets.map((ds) => ({
        label: ds.label || '',
        data: ds.data || [],
        backgroundColor: ds.color || '#6366f1',
        borderColor: ds.color || '#6366f1',
        borderWidth: chartType === 'line' ? 2 : 0,
        fill: chartType === 'line' ? false : undefined,
      }))
    )}
  },
  options:{
    responsive:true,
    maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'rgba(255,255,255,0.7)',font:{size:12}}}},
    scales:${chartType === 'pie' || chartType === 'doughnut' ? '{}' : `{x:{ticks:{color:'rgba(255,255,255,0.6)'},grid:{color:'rgba(255,255,255,0.1)'}},y:{ticks:{color:'rgba(255,255,255,0.6)'},grid:{color:'rgba(255,255,255,0.1)'}}}`}
  }
});
<\/script></body></html>`

  return (
    <iframe
      srcDoc={chartHtml}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'block',
        pointerEvents: (isSelected && !isDragging) ? 'auto' : 'none',
        background: 'transparent',
      }}
      sandbox="allow-scripts"
      title="Chart"
    />
  )
}

function CalloutRenderer({ element }) {
  const num = element.calloutNumber || 1
  const bg = element.calloutColor || '#ef4444'
  const textColor = element.calloutTextColor || '#ffffff'
  const fontSize = element.fontSize || 16
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: textColor,
        fontSize,
        fontWeight: 700,
        fontFamily: '-apple-system, sans-serif',
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      {num}
    </div>
  )
}

// Lucide icon SVG paths (subset)
// ICON_PATHS loaded from shared/data/icon-paths.json (3448 icons)

function IconRenderer({ element, iconPaths }) {
  const svgPath = iconPaths[element.iconName] || iconPaths['Star']
  const color = element.iconColor || '#ffffff'
  const sw = element.iconStrokeWidth || 2
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="100%"
        height="100%"
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: svgPath }}
      />
    </div>
  )
}

function generateLatexIframeHtml(content) {
  // Detect if content has tikzpicture
  const hasTikz = /\\begin\{tikzpicture\}/.test(content)
  const tikzScript = hasTikz
    ? `<link rel="stylesheet" type="text/css" href="https://tikzjax.com/v1/fonts.css">
       <script src="https://tikzjax.com/v1/tikzjax.js"><\/script>`
    : ''

  // Wrap content: if it has tikzpicture, use <script type="text/tikz">, otherwise render as KaTeX display math
  let bodyContent
  if (hasTikz) {
    bodyContent = `<script type="text/tikz">${content}<\/script>`
  } else {
    // Treat as display math
    // eslint-disable-next-line unused-imports/no-unused-vars
    const escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    bodyContent = `<div id="math"></div>
    <script>
      try {
        katex.render(${JSON.stringify(content)}, document.getElementById('math'), { displayMode: true, throwOnError: false });
      } catch(e) {
        document.getElementById('math').textContent = e.message;
      }
    <\/script>`
  }

  return `<!doctype html><html><head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"><\/script>
${tikzScript}
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: transparent; overflow: hidden; color: white; }
  .katex { font-size: 1.4em; }
  svg { max-width: 100%; max-height: 100%; }
</style>
</head><body>${bodyContent}</body></html>`
}

function LatexRenderer({ element, isSelected, isDragging }) {
  const html = generateLatexIframeHtml(element.content || '')
  return (
    <iframe
      srcDoc={html}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'block',
        pointerEvents: (isSelected && !isDragging) ? 'auto' : 'none',
        background: 'transparent',
      }}
      sandbox="allow-scripts"
      title="LaTeX / TikZ"
    />
  )
}

function TableRenderer({ element, isEditing, onUpdateElement }) {
  const data = element.data || [['']]
  const headerBg = element.headerBgColor || 'rgba(99,102,241,0.3)'
  const cellBg = element.cellBgColor || 'transparent'
  const borderColor = element.borderColor || 'rgba(255,255,255,0.2)'
  const borderWidth = element.borderWidth ?? 1
  const textColor = element.textColor || '#ffffff'
  const fontSize = element.fontSize || 14
  const cellPadding = element.cellPadding || 8

  const [focusCell, setFocusCell] = useState(null)
  const inputRefs = useRef({})

  useEffect(() => {
    if (isEditing && focusCell) {
      const key = `${focusCell.ri}-${focusCell.ci}`
      const input = inputRefs.current[key]
      if (input) {
        input.focus()
        // Try to place cursor at the end
        if (typeof input.setSelectionRange === 'function') {
          input.setSelectionRange(input.value.length, input.value.length)
        }
      }
    }
  }, [isEditing, focusCell])

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <table
        style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}
      >
        <tbody>
          {data.map((row, ri) => (
            <tr key={ri}>
              {(row || []).map((cell, ci) => (
                <td
                  key={ci}
                  onMouseDown={() => {
                    if (!isEditing) {
                      setFocusCell({ ri, ci })
                    }
                  }}
                  style={{
                    padding: cellPadding,
                    border: `${borderWidth}px solid ${borderColor}`,
                    background: element.headerRow && ri === 0 ? headerBg : cellBg,
                    color: textColor,
                    fontSize,
                    fontWeight: element.headerRow && ri === 0 ? 600 : 400,
                    verticalAlign: 'top',
                    overflow: 'hidden',
                  }}
                >
                  {isEditing ? (
                    <textarea
                      ref={(el) => (inputRefs.current[`${ri}-${ci}`] = el)}
                      value={cell || ''}
                      onChange={(e) => {
                        const newData = data.map(r => [...r])
                        newData[ri][ci] = e.target.value
                        onUpdateElement(element.id, { data: newData })
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      style={{
                        width: '100%',
                        height: '100%',
                        background: 'transparent',
                        border: 'none',
                        color: 'inherit',
                        fontSize: 'inherit',
                        fontWeight: 'inherit',
                        outline: 'none',
                        textAlign: 'inherit',
                        fontFamily: 'inherit',
                        resize: 'none',
                        overflow: 'hidden',
                      }}
                    />
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {cell || ''}
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ShapeRenderer({ element }) {
  const w = element.width,
    h = element.height
  const fill = element.fill || '#6366f1'
  const stroke = element.stroke || 'none'
  const sw = element.strokeWidth || 0
  const shape = element.shape || 'rect'

  const renderShape = () => {
    if (shape === 'line') {
      const lw = element.strokeWidth || 3
      return (
        <line
          x1={lw}
          y1={h / 2}
          x2={w - lw}
          y2={h / 2}
          stroke={fill}
          strokeWidth={lw}
          fill="none"
        />
      )
    }
    const gProps = { fill, stroke, strokeWidth: sw }
    switch (shape) {
      case 'rect':
        return (
          <g {...gProps}>
            <rect
              x={sw / 2}
              y={sw / 2}
              width={w - sw}
              height={h - sw}
              rx={element.borderRadius || 0}
            />
          </g>
        )
      case 'rounded-rect':
        return (
          <g {...gProps}>
            <rect x={sw / 2} y={sw / 2} width={w - sw} height={h - sw} rx={Math.min(w, h) * 0.15} />
          </g>
        )
      case 'circle':
        return (
          <g {...gProps}>
            <ellipse
              cx={w / 2}
              cy={h / 2}
              rx={Math.max(0, w / 2 - sw / 2)}
              ry={Math.max(0, h / 2 - sw / 2)}
            />
          </g>
        )
      case 'triangle':
        return (
          <g {...gProps}>
            <polygon points={`${w / 2},${sw} ${w - sw},${h - sw} ${sw},${h - sw}`} />
          </g>
        )
      case 'diamond':
        return (
          <g {...gProps}>
            <polygon
              points={`${w / 2},${sw} ${w - sw},${h / 2} ${w / 2},${h - sw} ${sw},${h / 2}`}
            />
          </g>
        )
      case 'arrow-right':
        return (
          <g {...gProps}>
            <polygon
              points={`${sw},${h * 0.35} ${w * 0.6},${h * 0.35} ${w * 0.6},${sw} ${w - sw},${h / 2} ${w * 0.6},${h - sw} ${w * 0.6},${h * 0.65} ${sw},${h * 0.65}`}
            />
          </g>
        )
      case 'star': {
        const cx = w / 2,
          cy = h / 2,
          outerR = Math.min(w, h) / 2 - sw,
          innerR = outerR * 0.4
        const pts = []
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI / 5) * i - Math.PI / 2
          const r = i % 2 === 0 ? outerR : innerR
          pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`)
        }
        return (
          <g {...gProps}>
            <polygon points={pts.join(' ')} />
          </g>
        )
      }
      default:
        return (
          <g {...gProps}>
            <rect x={sw / 2} y={sw / 2} width={w - sw} height={h - sw} />
          </g>
        )
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: element.opacity || 1 }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        {renderShape()}
        {element.text && (
          <text
            x={w / 2}
            y={h / 2}
            dominantBaseline="middle"
            textAnchor="middle"
            fontSize={element.fontSize || 16}
            fill={element.textColor || '#ffffff'}
          >
            {element.text}
          </text>
        )}
      </svg>
    </div>
  )
}

function DrawingRenderer({ element }) {
  const paths = element.paths || []
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${element.width} ${element.height}`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0 }}
      >
        {paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            stroke={p.stroke || element.strokeColor || '#ffffff'}
            strokeWidth={p.strokeWidth || element.strokeWidth || 3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={p.opacity ?? 1}
          />
        ))}
      </svg>
      {paths.length === 0 && (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.3)',
            fontSize: 14,
            fontFamily: 'sans-serif',
          }}
        >
          ✏ Drawing (empty)
        </div>
      )}
    </div>
  )
}

const ARROWHEAD_MARKERS = {
  arrow: (id, color) => (
    <marker
      key={id}
      id={id}
      markerWidth="10"
      markerHeight="7"
      refX="9"
      refY="3.5"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <polygon points="0 0, 10 3.5, 0 7" fill={color} />
    </marker>
  ),
  diamond: (id, color) => (
    <marker
      key={id}
      id={id}
      markerWidth="10"
      markerHeight="10"
      refX="5"
      refY="5"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <polygon points="5 0, 10 5, 5 10, 0 5" fill={color} />
    </marker>
  ),
  circle: (id, color) => (
    <marker
      key={id}
      id={id}
      markerWidth="8"
      markerHeight="8"
      refX="4"
      refY="4"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <circle cx="4" cy="4" r="3" fill={color} />
    </marker>
  ),
  square: (id, color) => (
    <marker
      key={id}
      id={id}
      markerWidth="8"
      markerHeight="8"
      refX="4"
      refY="4"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <rect x="1" y="1" width="6" height="6" fill={color} />
    </marker>
  ),
}

function LineArrowRenderer({ element }) {
  const w = element.width, h = element.height
  const x1 = element.x1 ?? 0, y1 = element.y1 ?? h / 2
  const x2 = element.x2 ?? w, y2 = element.y2 ?? h / 2
  const cx = element.cx, cy = element.cy
  const color = element.stroke || '#ffffff'
  const sw = element.strokeWidth || 2
  const dash = element.dashArray || ''
  const startType = element.arrowStart || 'none'
  const endType = element.arrowEnd || 'none'
  const uid = element.id?.slice(0, 8) || 'line'

  const markers = []
  let markerStart = undefined, markerEnd = undefined
  if (startType !== 'none' && ARROWHEAD_MARKERS[startType]) {
    const sid = `ms-${uid}`
    markers.push(ARROWHEAD_MARKERS[startType](sid, color))
    markerStart = `url(#${sid})`
  }
  if (endType !== 'none' && ARROWHEAD_MARKERS[endType]) {
    const eid = `me-${uid}`
    markers.push(ARROWHEAD_MARKERS[endType](eid, color))
    markerEnd = `url(#${eid})`
  }

  const pathD = cx != null && cy != null
    ? `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
    : `M ${x1} ${y1} L ${x2} ${y2}`

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        <defs>{markers}</defs>
        <path
          d={pathD}
          stroke={color}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={dash}
          markerStart={markerStart}
          markerEnd={markerEnd}
          style={{ pointerEvents: 'stroke' }}
        />
      </svg>
    </div>
  )
}

function SvgElementRenderer({ element }) {
  const content = element.content || ''
  // Apply fill/stroke overrides via CSS variables or inline style
  let modifiedContent = content
  if (element.fillOverride) {
    modifiedContent = modifiedContent.replace(
      /fill="[^"]*"/g,
      `fill="${element.fillOverride}"`
    )
  }
  if (element.strokeOverride) {
    modifiedContent = modifiedContent.replace(
      /stroke="[^"]*"/g,
      `stroke="${element.strokeOverride}"`
    )
  }
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      dangerouslySetInnerHTML={{ __html: modifiedContent }}
    />
  )
}

function QrCodeRenderer({ element }) {
  const [dataUrl, setDataUrl] = useState('')

  useEffect(() => {
    QRCode.toDataURL(element.qrData || 'https://example.com', {
      color: {
        dark: element.qrColor || '#000000',
        light: element.qrBgColor || '#ffffff'
      },
      errorCorrectionLevel: element.qrErrorLevel || 'M',
      margin: 1,
      width: 500,
    }).then(setDataUrl).catch(console.error)
  }, [element.qrData, element.qrColor, element.qrBgColor, element.qrErrorLevel])

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: element.qrBgColor || '#ffffff', borderRadius: element.borderRadius || 0, overflow: 'hidden' }}>
      {dataUrl ? <img src={dataUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="QR Code" draggable={false} /> : null}
    </div>
  )
}
