import { useState, useEffect, useRef, useCallback, useContext } from 'react'
import { useEditorStore } from '../stores/editor-store'
import { useSlideOperations } from '../hooks/use-slide-operations'
import { useKeyboard } from '../hooks/use-keyboard'
import { useClipboard, createDuplicateOperation } from '../hooks/use-clipboard'
import { useElementCreation } from '../hooks/use-element-creation'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Color } from '@tiptap/extension-color'
import TextStyle from '@tiptap/extension-text-style'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { ChevronLeft } from 'lucide-react'
import { api } from '../utils/api'
import { presentInWindow } from '../utils/generateHTML'
import { useExportActions } from '../hooks/use-export-actions'
import { useAiActions } from '../hooks/use-ai-actions'
import { resolveActiveSlide, mapActiveSlide } from '../utils/active-slide-mapper'
import SlidePanel from '../components/SlidePanel'
import SlideCanvas from '../components/SlideCanvas'
import PropertiesPanel from '../components/PropertiesPanel'
import DesignIdeasPanel from '../components/design-ideas-panel'
import { SLIDE_TEMPLATES } from '../data/slide-templates'
import { getThemePreset } from 'revealjs-shared'
import RibbonHeaderBar from '../components/ribbon/ribbon-header-bar'
import RibbonPanel from '../components/ribbon/ribbon-panel'
import { useUIStore } from '../stores/ui-store'
import QuickAccessToolbar from '../components/QuickAccessToolbar'
import ProductTour from '../components/ProductTour'
import { MathNode } from '../extensions/MathExtension'
import { FontSize } from '../extensions/FontSize'
import { FontFamily } from '../extensions/FontFamily'
import { FontWeight } from '../extensions/tiptap-font-weight-extension'
import { LineHeight } from '../extensions/tiptap-line-height-extension'
import monokaiCSS from '../../../node_modules/highlight.js/styles/monokai.min.css?raw'
import githubDarkCSS from '../../../node_modules/highlight.js/styles/github-dark.min.css?raw'
import atomOneDarkCSS from '../../../node_modules/highlight.js/styles/atom-one-dark.min.css?raw'
import tokyoNightCSS from '../../../node_modules/highlight.js/styles/tokyo-night-dark.min.css?raw'
import vs2015CSS from '../../../node_modules/highlight.js/styles/vs2015.min.css?raw'
import nightOwlCSS from '../../../node_modules/highlight.js/styles/night-owl.min.css?raw'
import anOldHopeCSS from '../../../node_modules/highlight.js/styles/an-old-hope.min.css?raw'
import atomOneLightCSS from '../../../node_modules/highlight.js/styles/atom-one-light.min.css?raw'
import githubCSS from '../../../node_modules/highlight.js/styles/github.min.css?raw'
import vsCSS from '../../../node_modules/highlight.js/styles/vs.min.css?raw'
import { Button, Input } from '../components/ui'
import { LiveSocketContext } from '../contexts/live-socket-context-provider.jsx'
import { GAME_SHORTCUT_CONFIG } from '../utils/game-shortcut-config.js'
import { invalidatePptxFitMetaForUpdates } from '../utils/pptx-import-meta'
import EditorModals from '../components/EditorModals'
import { normalizePresentationNotes } from '../utils/slide-notes'
import { sanitizeRichTextHtml } from '../utils/content-safety'

const CODE_THEME_CSS = {
  monokai: monokaiCSS,
  'github-dark': githubDarkCSS,
  'atom-one-dark': atomOneDarkCSS,
  'tokyo-night-dark': tokyoNightCSS,
  vs2015: vs2015CSS,
  'night-owl': nightOwlCSS,
  'an-old-hope': anOldHopeCSS,
  'atom-one-light': atomOneLightCSS,
  github: githubCSS,
  vs: vsCSS,
}

export function getElementForActiveSlideEdit(activeSlide, fallbackSlide, elementId) {
  const slide = activeSlide || fallbackSlide
  const element = slide?.elements?.find((el) => el.id === elementId)
  return element?.type === 'text' ? element : null
}

export function getSelectionIdsForActiveSlideElement(activeSlide, fallbackSlide, elementId) {
  const slide = activeSlide || fallbackSlide
  const element = slide?.elements?.find((el) => el.id === elementId)
  if (!element?.groupId) return [elementId]
  return (slide?.elements || []).filter((el) => el.groupId === element.groupId).map((el) => el.id)
}

export function getGameElementForActiveSlide(activeSlide, fallbackSlide) {
  const slide = activeSlide || fallbackSlide
  return slide?.elements?.find((element) => element.type === 'game') || null
}

// eslint-disable-next-line unused-imports/no-unused-vars
const THEMES = [
  'black',
  'white',
  'league',
  'beige',
  'sky',
  'night',
  'serif',
  'simple',
  'solarized',
  'moon',
  'dracula',
]
// eslint-disable-next-line unused-imports/no-unused-vars
const TRANSITIONS = ['none', 'fade', 'slide', 'convex', 'concave', 'zoom']

const migrateSlide = (slide) => {
  // Recurse into vertical children first (legacy children may lack `elements`).
  // Child html is sanitized on migration (untrusted-content boundary).
  const withChildren =
    slide.children && slide.children.length > 0
      ? { ...slide, children: slide.children.map(migrateChild) }
      : slide

  if (!withChildren.elements) {
    return {
      ...withChildren,
      elements: withChildren.html
        ? [
            {
              id: crypto.randomUUID(),
              type: 'text',
              x: 80,
              y: 100,
              width: 800,
              height: 340,
              zIndex: 1,
              content: withChildren.html,
            },
          ]
        : [],
    }
  }
  return withChildren
}

const migrateChild = (child) => {
  if (child.elements) return child
  return {
    ...child,
    elements: child.html
      ? [
          {
            id: crypto.randomUUID(),
            type: 'text',
            x: 80,
            y: 100,
            width: 800,
            height: 340,
            zIndex: 1,
            content: sanitizeRichTextHtml(child.html),
          },
        ]
      : [],
  }
}

export default function EditorPage({ presentationId, isTemplate = false, onGoHome }) {
  const [presentation, setPresentation] = useState(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  // Active vertical (child) edit target, tracked by PARENT id for reorder
  // stability: { parentId, child } | null. child===null/absent ⇒ editing the
  // parent. The parent ARRAY INDEX is derived at render (currentVerticalIndex).
  const [verticalEdit, setVerticalEdit] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('') // '', 'saving', 'saved', 'error'
  const [lastSaveError, setLastSaveError] = useState('')
  const [loading, setLoading] = useState(true)

  // ─── Live socket context (Phase 2: timer sync) ───────────────────────────────
  const liveSocket = useContext(LiveSocketContext)

  // ─── Zustand store (UI state) ───────────────────────────────────────────────
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds)
  const setSelectedElementIds = useEditorStore((s) => s.setSelectedElementIds)
  const editingElementId = useEditorStore((s) => s.editingElementId)
  const setEditingElementId = useEditorStore((s) => s.setEditingElementId)
  const clipboard = useEditorStore((s) => s.clipboard)
  const setClipboard = useEditorStore((s) => s.setClipboard)
  const showGrid = useEditorStore((s) => s.showGrid)
  const gridSize = useEditorStore((s) => s.gridSize)
  const setGridSize = useEditorStore((s) => s.setGridSize)
  const smartGuidesEnabled = useEditorStore((s) => s.smartGuidesEnabled)
  const showRulers = useEditorStore((s) => s.showRulers)
  const guides = useEditorStore((s) => s.guides)
  const setGuides = useEditorStore((s) => s.setGuides)
  const showTimeline = useEditorStore((s) => s.showTimeline)
  const setShowTimeline = useEditorStore((s) => s.setShowTimeline)
  const showFindReplace = useEditorStore((s) => s.showFindReplace)
  const setShowFindReplace = useEditorStore((s) => s.setShowFindReplace)
  const viewMode = useEditorStore((s) => s.viewMode)
  const setViewMode = useEditorStore((s) => s.setViewMode)
  const zoomIn = useEditorStore((s) => s.zoomIn)
  const zoomOut = useEditorStore((s) => s.zoomOut)
  const resetZoom = useEditorStore((s) => s.resetZoom)
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen)
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen)
  const showDesignIdeas = useUIStore((s) => s.showDesignIdeas)
  const setRightPanelOpen = useUIStore((s) => s.setRightPanelOpen)
  const setActiveTab = useUIStore((s) => s.setActiveTab)
  const setFormatContext = useUIStore((s) => s.setFormatContext)
  const setSlidePosition = useUIStore((s) => s.setSlidePosition)
  const setPresentHandler = useUIStore((s) => s.setPresentHandler)

  // Ribbon
  // Derived from selectedElementIds — must be declared before any useEffect that references it
  const selectedElementId = selectedElementIds[selectedElementIds.length - 1] ?? null

  // ─── Editor-only payload modal state (carries data — stays local) ──────────
  const [htmlEditorState, setHtmlEditorState] = useState(null) // { elementId, content }
  const [codeEditorState, setCodeEditorState] = useState(null) // { elementId, content, language }
  const [latexEditorState, setLatexEditorState] = useState(null) // { elementId, content }
  const [galleryPreviewTemplate, setGalleryPreviewTemplate] = useState(null)
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [shareStatus, setShareStatus] = useState({ shared: false, token: null })
  const [_lastSavedAt, setLastSavedAt] = useState(null)
  const [liveRoomCode, setLiveRoomCode] = useState(null)
  const [livePresenterToken, setLivePresenterToken] = useState(null)

  // ─── Boolean modal/visibility flags — centralized in ui-store ──────────────
  // EditorModals reads the flags it renders directly from the store, so here we
  // keep only the setters wired into the ribbon/panel/canvas props (plus the
  // command-palette flag, read by onEscape). Select per-flag for re-render
  // isolation; setters are stable Zustand actions.
  const setShowTemplateModal = useUIStore((s) => s.setShowTemplateModal)
  const setShowTemplateGallery = useUIStore((s) => s.setShowTemplateGallery)
  const setShowMediaLibrary = useUIStore((s) => s.setShowMediaLibrary)
  const setShowGithubModal = useUIStore((s) => s.setShowGithubModal)
  const setShowAnimationPreview = useUIStore((s) => s.setShowAnimationPreview)
  const setShowShareModal = useUIStore((s) => s.setShowShareModal)
  const setShowSyncModal = useUIStore((s) => s.setShowSyncModal)
  const setShowHistoryModal = useUIStore((s) => s.setShowHistoryModal)
  const setShowCssEditor = useUIStore((s) => s.setShowCssEditor)
  const setShowAICopywriter = useUIStore((s) => s.setShowAICopywriter)
  const setShowAIGenerator = useUIStore((s) => s.setShowAIGenerator)
  const setShowAITranslate = useUIStore((s) => s.setShowAITranslate)
  const setShowLiveModal = useUIStore((s) => s.setShowLiveModal)
  const setShowAnalytics = useUIStore((s) => s.setShowAnalytics)
  const setShowImageUrlPrompt = useUIStore((s) => s.setShowImageUrlPrompt)
  const showCommandPalette = useUIStore((s) => s.showCommandPalette)
  const setShowCommandPalette = useUIStore((s) => s.setShowCommandPalette)
  const setShowKineticTextModal = useUIStore((s) => s.setShowKineticTextModal)
  const setShowMathGridModal = useUIStore((s) => s.setShowMathGridModal)
  const setShowAnimeModal = useUIStore((s) => s.setShowAnimeModal)
  const setShowThreeModal = useUIStore((s) => s.setShowThreeModal)
  const setShowFileBrowser = useUIStore((s) => s.setShowFileBrowser)

  // Game presenter overlays (reachable in-editor via activeGameType) — local
  const [showGameHud, setShowGameHud] = useState(false)
  const [showGameLeaderboard, setShowGameLeaderboard] = useState(false)

  // Track if we're programmatically setting editor content (to avoid loops)
  const settingContent = useRef(false)
  const saveTimerRef = useRef(null)
  const saveStatusResetTimerRef = useRef(null)
  const isFirstLoad = useRef(true)
  const historyRef = useRef([]) // undo history: array of presentation snapshots
  const applyingUndoRef = useRef(false)
  const editingElementIdRef = useRef(null)
  const currentSlideIndexRef = useRef(0)
  const verticalEditRef = useRef(null)
  const selectedElementIdsRef = useRef([])
  const redoStackRef = useRef([])
  const saveAttemptRef = useRef(0)
  const saveInFlightRef = useRef(false)
  const queuedSaveRef = useRef(null)

  // Keep refs in sync with state
  useEffect(() => {
    editingElementIdRef.current = editingElementId
  }, [editingElementId])

  useEffect(() => {
    currentSlideIndexRef.current = currentSlideIndex
  }, [currentSlideIndex])

  useEffect(() => {
    verticalEditRef.current = verticalEdit
  }, [verticalEdit])

  // Drop a stale vertical-child edit if the tracked parent slide or child index
  // no longer exists (e.g. after a parent/child delete). resolveActiveSlide
  // already falls back safely, but this clears the phantom selection state.
  useEffect(() => {
    if (!presentation || !verticalEdit || verticalEdit.child == null) return
    const parent = presentation.slides.find((s) => s.id === verticalEdit.parentId)
    if (!parent || !parent.children || verticalEdit.child >= parent.children.length) {
      setVerticalEdit(null)
    }
  }, [presentation, verticalEdit])

  useEffect(() => {
    selectedElementIdsRef.current = selectedElementIds
  }, [selectedElementIds])

  const clearSaveStatusResetTimer = useCallback(() => {
    if (saveStatusResetTimerRef.current) {
      clearTimeout(saveStatusResetTimerRef.current)
      saveStatusResetTimerRef.current = null
    }
  }, [])

  const persistPresentation = useCallback(
    async (snapshot, attemptId) => {
      if (!snapshot?.id) return false

      try {
        const saveFn = isTemplate ? api.updateTemplate : api.updatePresentation
        await saveFn(snapshot.id, normalizePresentationNotes(snapshot))
        if (attemptId !== saveAttemptRef.current) return true
        clearSaveStatusResetTimer()
        setSaveStatus('saved')
        setLastSaveError('')
        setLastSavedAt(new Date())
        saveStatusResetTimerRef.current = setTimeout(() => setSaveStatus(''), 2000)
        return true
      } catch (err) {
        if (attemptId !== saveAttemptRef.current) return false
        clearSaveStatusResetTimer()
        const message =
          typeof err?.message === 'string' && err.message.trim() ? err.message.trim() : 'Save failed'
        console.error('Auto-save failed', err)
        setSaveStatus('error')
        setLastSaveError(message)
        return false
      } finally {
        if (attemptId === saveAttemptRef.current) setSaving(false)
      }
    },
    [clearSaveStatusResetTimer, isTemplate]
  )

  const processSaveQueue = useCallback(async () => {
    if (saveInFlightRef.current || !queuedSaveRef.current) return

    const nextSave = queuedSaveRef.current
    queuedSaveRef.current = null
    saveInFlightRef.current = true

    try {
      await persistPresentation(nextSave.snapshot, nextSave.attemptId)
    } finally {
      saveInFlightRef.current = false
      if (queuedSaveRef.current) void processSaveQueue()
    }
  }, [persistPresentation])

  const schedulePresentationSave = useCallback(
    (snapshot, delayMs = 1500) => {
      if (!snapshot) return

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      clearSaveStatusResetTimer()
      const attemptId = saveAttemptRef.current + 1
      saveAttemptRef.current = attemptId
      queuedSaveRef.current = { snapshot, attemptId }
      setSaving(true)
      setSaveStatus('saving')
      setLastSaveError('')

      if (delayMs <= 0) {
        void processSaveQueue()
        return
      }

      saveTimerRef.current = setTimeout(() => {
        void processSaveQueue()
      }, delayMs)
    },
    [clearSaveStatusResetTimer, processSaveQueue]
  )

  // Load presentation (or template) on mount
  useEffect(() => {
    if (!presentationId) return
    const loadFn = isTemplate ? api.getTemplate : api.getPresentation
    loadFn(presentationId)
      .then((data) => {
        // Migrate old slide format to new elements-based format
        const migrated = normalizePresentationNotes({
          ...data,
          slides: (data.slides || []).map(migrateSlide),
        })
        historyRef.current = [JSON.parse(JSON.stringify(migrated))]
        redoStackRef.current = []
        if (window.__E2E__) window.__NAVSLIDES_E2E_HISTORY_LENGTH = historyRef.current.length
        setPresentation(migrated)
        if (migrated.gridSize) setGridSize(migrated.gridSize)
        setLoading(false)
        isFirstLoad.current = true
      })
      .catch((err) => {
        console.error('Failed to load presentation', err)
        setLoading(false)
      })
  }, [isTemplate, presentationId, setGridSize])

  // Load share status
  useEffect(() => {
    if (presentationId) {
      api
        .getShareStatus(presentationId)
        .then(setShareStatus)
        .catch(() => {})
    }
  }, [presentationId])

  const currentSlide = presentation?.slides[currentSlideIndex]

  // Active edit target: the parent slide, or the active vertical child.
  const activeSlide = resolveActiveSlide(presentation?.slides, currentSlideIndex, verticalEdit)

  // { parent, child } shape SlidePanel expects: resolve the tracked parent id to
  // its current array index at read time (parent-by-id keeps this reorder-safe).
  const currentVerticalIndex =
    verticalEdit && verticalEdit.child != null
      ? {
          parent: presentation?.slides?.findIndex((s) => s.id === verticalEdit.parentId) ?? -1,
          child: verticalEdit.child,
        }
      : null

  // Single routing point for EVERY element write: targets the active child when
  // one is selected, else the parent at currentSlideIndex. Reads refs so it is
  // stable for callbacks that fire outside render (clipboard, TipTap onUpdate).
  const mapActive = useCallback((prev, fn) => {
    return mapActiveSlide(prev, currentSlideIndexRef.current, verticalEditRef.current, fn)
  }, [])

  // Ref to the active slide for call-time lookups (open*Editor, locked checks).
  const activeSlideRef = useRef(null)
  useEffect(() => {
    activeSlideRef.current = activeSlide
  })

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Color,
      TextStyle,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder: 'Click to start typing...' }),
      MathNode,
      FontFamily,
      FontSize,
      FontWeight,
      LineHeight,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      // Don't trigger if we're setting content programmatically
      if (settingContent.current) return
      const elemId = editingElementIdRef.current
      if (!elemId) return
      const html = editor.getHTML()
      setPresentation((prev) =>
        mapActive(prev, (s) => ({
          ...s,
          elements: (s.elements || []).map((el) =>
            el.id === elemId
              ? { ...el, ...invalidatePptxFitMetaForUpdates(el, { content: html }) }
              : el
          ),
        }))
      )
    },
  })

  // When presentation first loads, clear editor content
  useEffect(() => {
    if (editor && presentation && isFirstLoad.current) {
      settingContent.current = true
      editor.commands.setContent('', false)
      settingContent.current = false
    }
  }, [editor, presentation])

  // When currentSlideIndex changes, reset selection, editing, and any active
  // vertical-child edit (you've navigated to a different parent slide).
  useEffect(() => {
    setSelectedElementIds([])
    setEditingElementId(null)
    editingElementIdRef.current = null
    setVerticalEdit(null)
    if (editor) {
      settingContent.current = true
      editor.commands.setContent('', false)
      settingContent.current = false
    }
  }, [currentSlideIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save with debounce
  useEffect(() => {
    if (!presentation) return
    if (isFirstLoad.current) {
      isFirstLoad.current = false
      return
    }
    schedulePresentationSave(presentation, 1500)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
  }, [presentation, schedulePresentationSave])

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      clearSaveStatusResetTimer()
    },
    [clearSaveStatusResetTimer]
  )

  // Undo history: debounce-push presentation snapshots; skip during undo itself
  useEffect(() => {
    if (!presentation || isFirstLoad.current) return
    if (applyingUndoRef.current) {
      applyingUndoRef.current = false
      return
    }
    const timer = setTimeout(() => {
      historyRef.current = [
        ...historyRef.current.slice(-50),
        JSON.parse(JSON.stringify(presentation)),
      ]
      if (window.__E2E__) window.__NAVSLIDES_E2E_HISTORY_LENGTH = historyRef.current.length
      redoStackRef.current = []
    }, 500)
    return () => clearTimeout(timer)
  }, [presentation])

  const updateCurrentSlide = useCallback(
    (updates) => {
      setPresentation((prev) => mapActive(prev, (s) => ({ ...s, ...updates })))
    },
    [mapActive]
  )

  const updateElement = useCallback((id, updates) => {
    setPresentation((prev) =>
      mapActive(prev, (s) => ({
        ...s,
        elements: (s.elements || []).map((el) =>
          el.id === id ? { ...el, ...invalidatePptxFitMetaForUpdates(el, updates) } : el
        ),
      }))
    )
  }, [mapActive])

  const deleteElement = useCallback(
    (id) => {
      const target = activeSlide?.elements?.find((el) => el.id === id)
      if (target?.locked) return
      setPresentation((prev) =>
        mapActive(prev, (s) => ({
          ...s,
          elements: (s.elements || []).filter((el) => el.id !== id),
        }))
      )
      setSelectedElementIds((prev) => prev.filter((x) => x !== id))
      if (editingElementId === id) setEditingElementId(null)
    },
    [activeSlide, editingElementId, setEditingElementId, setSelectedElementIds, mapActive]
  )

  // ── Unified element creation (extracted to use-element-creation hook) ──
  const {
    pluginTypes,
    addTextElement,
    addImageElement,
    addQrCodeElement,
    addTimelineElement,
    insertEmbedHtml,
    handleInsertFromFileBrowser,
    addDividerElement,
    addGameElement,
    addPluginElement,
    addHtmlElement,
    openHtmlEditor,
    commitHtmlEdit,
    addCodeElement,
    openCodeEditor,
    commitCodeEdit,
    addLatexElement,
    openLatexEditor,
    commitLatexEdit,
    addMarkdownElement,
    addChartElement,
    addCalloutElement,
    addIconElement,
    addShapeElement,
    addVideoElement,
    addAudioElement,
    addTableElement,
    addDrawingElement,
    addLineElement,
    addSvgElement,
  } = useElementCreation({
    mapActiveSlide: mapActive,
    getActiveSlide: () => activeSlideRef.current,
    setPresentation,
    setSelectedElementIds,
    updateElement,
    htmlEditorState,
    setHtmlEditorState,
    codeEditorState,
    setCodeEditorState,
    latexEditorState,
    setLatexEditorState,
  })

  // Pre-process HTML to preserve block-level inline styles for ProseMirror
  // TipTap Color/TextStyle extensions only work on <span>, not block elements
  // Step 1: Propagate color/font-size from <ul>/<ol> → each <li> child
  // Step 2: Wrap block element content in <span> with the extracted styles
  const preserveBlockColors = useCallback((html) => {
    if (!html) return html
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // Step 1: Propagate styles from list containers (ul/ol) to their li children
    doc.body.querySelectorAll('ul, ol').forEach((list) => {
      const color = list.style.color
      const fontSize = list.style.fontSize
      const lineHeight = list.style.lineHeight
      if (!color && !fontSize) return
      list.querySelectorAll(':scope > li').forEach((li) => {
        if (color && !li.style.color) li.style.color = color
        if (fontSize && !li.style.fontSize) li.style.fontSize = fontSize
        if (lineHeight && !li.style.lineHeight) li.style.lineHeight = lineHeight
      })
      if (color) list.style.removeProperty('color')
      if (fontSize) list.style.removeProperty('font-size')
      if (lineHeight) list.style.removeProperty('line-height')
    })

    // Step 2: Move inline styles from block elements to wrapping spans
    const blocks = doc.body.querySelectorAll(
      'h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, div'
    )
    blocks.forEach((el) => {
      const color = el.style.color
      const fontSize = el.style.fontSize
      if (!color && !fontSize) return
      const span = doc.createElement('span')
      if (color) {
        span.style.color = color
        el.style.removeProperty('color')
      }
      if (fontSize) {
        span.style.fontSize = fontSize
        el.style.removeProperty('font-size')
      }
      while (el.firstChild) span.appendChild(el.firstChild)
      el.appendChild(span)
    })

    return doc.body.innerHTML
  }, [])

  const startEditingElement = useCallback(
    (elementId) => {
      const element = getElementForActiveSlideEdit(
        activeSlideRef.current,
        presentation?.slides[currentSlideIndexRef.current],
        elementId
      )
      if (!element) return
      setActiveTab('home')
      setEditingElementId(elementId)
      editingElementIdRef.current = elementId
      setSelectedElementIds([elementId])
      settingContent.current = true
      const processedContent = preserveBlockColors(element.content || '')
      editor?.commands.setContent(processedContent, false)
      settingContent.current = false
      setTimeout(() => editor?.commands.focus(), 10)
    },
    [editor, preserveBlockColors, presentation, setActiveTab, setEditingElementId, setSelectedElementIds]
  )

  const stopEditingElement = useCallback(() => {
    setEditingElementId(null)
    editingElementIdRef.current = null
  }, [setEditingElementId])

  const {
    updateElements,
    deleteSelectedElements,
    groupElements,
    ungroupElements,
    alignElements,
    addSlide,
    deleteSlide,
    duplicateSlide,
    deleteSlides,
    duplicateSlides,
    moveSlide,
    addChildSlide,
  } = useSlideOperations({
    presentation,
    setPresentation,
    currentSlideIndex,
    setCurrentSlideIndex,
    currentSlideIndexRef,
    selectedElementIdsRef,
    editingElementIdRef,
    mapActiveSlide: mapActive,
    getActiveSlide: () => activeSlideRef.current,
  })

  const bringElementForward = useCallback(
    (id) => {
      updateElement(id, {
        zIndex: (activeSlide?.elements?.find((el) => el.id === id)?.zIndex || 1) + 1,
      })
    },
    [activeSlide, updateElement]
  )

  const sendElementBackward = useCallback(
    (id) => {
      updateElement(id, {
        zIndex: Math.max(1, (activeSlide?.elements?.find((el) => el.id === id)?.zIndex || 1) - 1),
      })
    },
    [activeSlide, updateElement]
  )

  const moveElementToStackEdge = useCallback(
    (id, edge) => {
      const elements = activeSlide?.elements || []
      if (!elements.some((el) => el.id === id)) return

      const sorted = [...elements].sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1))
      const selected = sorted.find((el) => el.id === id)
      const others = sorted.filter((el) => el.id !== id)
      const reordered = edge === 'front' ? [...others, selected] : [selected, ...others]

      updateElements(reordered.map((el, index) => ({ id: el.id, zIndex: index + 1 })))
    },
    [activeSlide, updateElements]
  )

  const bringElementToFront = useCallback(
    (id) => moveElementToStackEdge(id, 'front'),
    [moveElementToStackEdge]
  )

  const sendElementToBack = useCallback(
    (id) => moveElementToStackEdge(id, 'back'),
    [moveElementToStackEdge]
  )

  // Undo/Redo handlers (called by QuickAccessToolbar and keyboard shortcuts)
  // Reconcile a restored snapshot against the active vertical edit: drop it if
  // the tracked parent id no longer exists or the child index is out of range
  // (parent-by-id makes reorder free, but undo/redo can remove the slide/child).
  const reconcileVerticalEdit = useCallback((state) => {
    setVerticalEdit((ve) => {
      if (!ve || ve.child == null) return ve
      const parent = state?.slides?.find((s) => s.id === ve.parentId)
      if (!parent || !parent.children || ve.child >= parent.children.length) return null
      return ve
    })
  }, [])

  const handleUndo = useCallback(() => {
    const hist = historyRef.current
    if (hist.length < 2) return
    applyingUndoRef.current = true
    redoStackRef.current = [...redoStackRef.current.slice(-19), hist[hist.length - 1]]
    const newHist = hist.slice(0, -1)
    historyRef.current = newHist
    const prevState = newHist[newHist.length - 1]
    setPresentation(prevState)
    setCurrentSlideIndex((ci) => Math.min(ci, prevState.slides.length - 1))
    reconcileVerticalEdit(prevState)
  }, [setPresentation, setCurrentSlideIndex, reconcileVerticalEdit])

  const handleRedo = useCallback(() => {
    const stack = redoStackRef.current
    if (!stack.length) return
    applyingUndoRef.current = true
    const redoState = stack[stack.length - 1]
    redoStackRef.current = stack.slice(0, -1)
    if (presentation)
      historyRef.current = [
        ...historyRef.current.slice(-49),
        JSON.parse(JSON.stringify(presentation)),
      ]
    setPresentation(redoState)
    setCurrentSlideIndex((ci) => Math.min(ci, redoState.slides.length - 1))
    reconcileVerticalEdit(redoState)
  }, [presentation, setPresentation, setCurrentSlideIndex, reconcileVerticalEdit])

  // Global keyboard shortcuts (find/replace, slide sorter)
  // NOTE: Undo/redo and clipboard shortcuts are now handled by useKeyboard/useClipboard
  useEffect(() => {
    const onKeyDown = (e) => {
      if (editingElementId) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return
      // Slide Sorter toggle: Ctrl+Shift+S
      if (ctrl && e.shiftKey && e.key.toLowerCase() === 's') {
        setViewMode((v) => (v === 'sorter' ? 'normal' : 'sorter'))
        e.preventDefault()
        return
      }
      if (e.key === 'f') {
        setShowFindReplace((v) => !v)
        e.preventDefault()
        return
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [editingElementId, setShowFindReplace, setViewMode])

  // Inject hljs theme CSS into the document head for the editor preview
  useEffect(() => {
    const theme = presentation?.codeTheme || 'monokai'
    let style = document.getElementById('hljs-theme-css')
    if (!style) {
      style = document.createElement('style')
      style.id = 'hljs-theme-css'
      document.head.appendChild(style)
    }
    style.textContent = CODE_THEME_CSS[theme] || CODE_THEME_CSS['monokai']
  }, [presentation?.codeTheme])

  // Inject custom CSS (from template) into editor preview
  useEffect(() => {
    const css = presentation?.customCSS || ''
    let style = document.getElementById('custom-template-css')
    if (!style) {
      style = document.createElement('style')
      style.id = 'custom-template-css'
      document.head.appendChild(style)
    }
    style.textContent = css
    return () => {
      style.textContent = ''
    }
  }, [presentation?.customCSS])

  const selectedElement = activeSlide?.elements?.find((el) => el.id === selectedElementId) || null

  // Bridge selection into the ribbon so the Format tab can show/hide and relabel
  // itself. Depend on primitives (presence + type) rather than the recomputed
  // selectedElement object so this only fires on real selection changes.
  const hasSelectedElement = !!selectedElement
  const selectedElementType = selectedElement?.type ?? null
  useEffect(() => {
    setFormatContext({ hasSelection: hasSelectedElement, elementType: selectedElementType })
  }, [hasSelectedElement, selectedElementType, setFormatContext])

  // Sync slide position into the global StatusBar (which lives outside this
  // tree). total>0 also signals "editor active" so the status cluster shows.
  useEffect(() => {
    setSlidePosition({ current: currentSlideIndex, total: presentation?.slides?.length ?? 0 })
  }, [currentSlideIndex, presentation?.slides?.length, setSlidePosition])

  // Register the Present action for the StatusBar; re-register when the
  // presentation changes, and clear on unmount.
  useEffect(() => {
    setPresentHandler(() => presentInWindow(presentation))
    return () => setPresentHandler(null)
  }, [presentation, setPresentHandler])

  const startSlideshow = useCallback(() => {
    if (presentation) presentInWindow(presentation)
  }, [presentation])

  // Reset slide position when leaving the editor so the cluster hides on Home.
  useEffect(() => {
    return () => setSlidePosition({ current: 0, total: 0 })
  }, [setSlidePosition])

  // ── Command layer (Phase 1: clipboard + keyboard unified via useKeyboard/useClipboard) ──
  const { performCopy, performPaste, performCut } = useClipboard({
    mapActiveSlide: mapActive,
    setPresentation,
  })

  const handleSelectAll = useCallback(() => {
    const els = activeSlide?.elements || []
    setSelectedElementIds(els.map((e) => e.id))
  }, [activeSlide, setSelectedElementIds])

  // Wrappers that pass required context to useClipboard callbacks
  const handleCopy = useCallback(() => {
    performCopy(activeSlide?.elements)
  }, [activeSlide, performCopy])

  const handlePaste = useCallback(() => {
    performPaste(clipboard)
  }, [clipboard, performPaste])

  const handleCut = useCallback(() => {
    performCut(activeSlide?.elements, selectedElementIds)
  }, [activeSlide, selectedElementIds, performCut])

  const handleDuplicate = useCallback(() => {
    // Use createDuplicateOperation directly — reads current selection from store,
    // matching the original SlideCanvas behavior (no clipboard required)
    const { selectedElementIds: liveSelectedIds } = useEditorStore.getState()
    const slideEls = activeSlide?.elements || []
    const { toAdd, clipboardData } = createDuplicateOperation({
      slideElements: slideEls,
      selectedElementIds: liveSelectedIds,
    })
    if (!toAdd.length) return
    if (clipboardData) setClipboard(clipboardData)
    setPresentation((prev) =>
      mapActive(prev, (s) => ({ ...s, elements: [...(s.elements || []), ...toAdd] }))
    )
  }, [activeSlide, setPresentation, setClipboard, mapActive])

  // Media-library insert — routes through mapActive so media lands on the
  // active vertical child when one is being edited (Red Team #1).
  const insertMediaElement = useCallback(
    (item) => {
      const base = {
        id: crypto.randomUUID(),
        x: 100,
        y: 100,
        zIndex: (activeSlide?.elements || []).length + 1,
      }
      let el = null
      if (item.type === 'image') {
        el = { ...base, type: 'image', width: 400, height: 300, src: item.url, objectFit: 'contain' }
      } else if (item.type === 'video') {
        el = { ...base, type: 'video', width: 480, height: 270, src: item.url, controls: true }
      } else if (item.type === 'audio') {
        el = { ...base, type: 'audio', width: 300, height: 60, src: item.url }
      }
      if (!el) return
      setPresentation((prev) => mapActive(prev, (s) => ({ ...s, elements: [...(s.elements || []), el] })))
    },
    [activeSlide, setPresentation, mapActive]
  )

  // Command palette commands
  const commands = [
    { id: 'insertSlide', label: 'Insert Slide', shortcut: 'Ctrl+M', action: () => setShowTemplateModal(true) },
    { id: 'insertLink', label: 'Insert Link', shortcut: '', action: () => { setShowCommandPalette(false); document.querySelector('[title="Add link"]')?.click() } },
    { id: 'group', label: 'Group Elements', shortcut: 'Ctrl+G', action: () => groupElements() },
    { id: 'ungroup', label: 'Ungroup Elements', shortcut: 'Ctrl+Shift+G', action: () => ungroupElements() },
    { id: 'zoomIn', label: 'Zoom In', shortcut: 'Ctrl+=', action: () => zoomIn() },
    { id: 'zoomOut', label: 'Zoom Out', shortcut: 'Ctrl+-', action: () => zoomOut() },
    { id: 'resetZoom', label: 'Reset Zoom', shortcut: 'Ctrl+0', action: () => resetZoom() },
    { id: 'startSlideshow', label: 'Start Slideshow', shortcut: 'F5', action: startSlideshow },
    { id: 'commandPalette', label: 'Command Palette', shortcut: 'Ctrl+K', action: () => setShowCommandPalette(false) },
  ]

  // Detect active game type from the actual editable slide, including vertical children.
  const activeGameElement = getGameElementForActiveSlide(
    activeSlide,
    presentation?.slides?.[currentSlideIndex]
  )
  const currentGameType = activeGameElement?.gameType || null

  const emitGameShortcutAction = useCallback(
    (action, payload = {}) => {
      if (!activeGameElement || typeof window === 'undefined') return
      window.dispatchEvent(new CustomEvent('navslides:game-shortcut', {
        detail: {
          action,
          elementId: activeGameElement.id,
          gameType: currentGameType,
          ...payload,
        },
      }))
    },
    [activeGameElement, currentGameType]
  )

  // Export/import + AI action handlers (extracted to hooks)
  const { onExportPDF, onExportPPTX, onExportHTML, onExportOffline, onExportProject, onOpenProject } =
    useExportActions(presentation)
  const { onCreatePresentation, onAICopywriterApply, onApplyTranslations } = useAiActions({
    presentation,
    setPresentation,
    updateElement,
    selectedElementId,
  })

  useKeyboard({
    onCopy: handleCopy,
    onCut: handleCut,
    onPaste: handlePaste,
    onDuplicate: handleDuplicate,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onDelete: deleteSelectedElements,
    onSelectAll: handleSelectAll,
    onToggleFindReplace: () => setShowFindReplace((v) => !v),
    onEscape: () => {
      if (showCommandPalette) { setShowCommandPalette(false); return }
      if (showGameHud) { setShowGameHud(false); return }
      if (showGameLeaderboard) { setShowGameLeaderboard(false); return }
      setSelectedElementIds([])
      setEditingElementId(null)
    },
    onArrow: (direction, e) => {
      // Text editing exits the handler earlier, so this only runs on the canvas.
      // Selection present → nudge elements (Shift = fine 1px); empty → up/down
      // walks slides like PowerPoint's slide pane.
      const ids = selectedElementIdsRef.current
      if (ids.length > 0) {
        const step = e.shiftKey ? 1 : 10
        const dx = direction === 'left' ? -step : direction === 'right' ? step : 0
        const dy = direction === 'up' ? -step : direction === 'down' ? step : 0
        if (dx === 0 && dy === 0) return
        e.preventDefault()
        const slide = activeSlideRef.current
        ids.forEach((id) => {
          const el = slide?.elements?.find((x) => x.id === id)
          if (!el || el.locked) return
          updateElement(id, { x: (el.x || 0) + dx, y: (el.y || 0) + dy })
        })
        return
      }
      if (direction === 'up' || direction === 'down') {
        const total = presentation?.slides?.length ?? 0
        if (total === 0) return
        e.preventDefault()
        setCurrentSlideIndex((ci) =>
          direction === 'up' ? Math.max(0, ci - 1) : Math.min(total - 1, ci + 1)
        )
      }
    },
    isEditing: !!editingElementId,
    activeGameType: currentGameType,
    onStartSlideshow: startSlideshow,
    onStartSlideshowCurrent: startSlideshow,
    // Game (reachable in-editor when a game element is on the slide)
    onGameHud: () => setShowGameHud((v) => !v),
    onGameTimer: () => {
      const el = activeGameElement
      if (!el || !liveSocket?.connected) return
      const defaultDuration = GAME_SHORTCUT_CONFIG[currentGameType]?.timer?.duration ?? 30
      liveSocket.emit('game-timer-start', { elementId: el.id, duration: defaultDuration })
    },
    onGameNext: () => emitGameShortcutAction('next'),
    onGameReveal: () => {
      setShowGameHud(true)
      emitGameShortcutAction('reveal')
    },
    onGameLeaderboard: () => setShowGameLeaderboard((v) => !v),
    onGamePause: () => {
      const el = activeGameElement
      if (el && liveSocket?.connected) liveSocket.emit('game-timer-pause', { elementId: el.id })
      emitGameShortcutAction('pause')
    },
    onTimerAdd: () => {
      const el = activeGameElement
      if (!el || !liveSocket?.connected) return
      const delta = GAME_SHORTCUT_CONFIG[currentGameType]?.timerAdd?.delta ?? 10
      liveSocket.emit('game-timer-adjust', { elementId: el.id, delta })
    },
    onTimerSub: () => {
      const el = activeGameElement
      if (!el || !liveSocket?.connected) return
      const delta = GAME_SHORTCUT_CONFIG[currentGameType]?.timerSub?.delta ?? -10
      liveSocket.emit('game-timer-adjust', { elementId: el.id, delta })
    },
    onTeamSelect1: () => emitGameShortcutAction('team-select', { teamIndex: 0 }),
    onTeamSelect2: () => emitGameShortcutAction('team-select', { teamIndex: 1 }),
    onTeamSelect3: () => emitGameShortcutAction('team-select', { teamIndex: 2 }),
    onTeamSelect4: () => emitGameShortcutAction('team-select', { teamIndex: 3 }),
    // Editor
    onCommandPalette: () => setShowCommandPalette((v) => !v),
    // Editor shortcuts (260523-1230 cleanup plan)
    onInsertSlide: () => setShowTemplateModal(true),
    onGroup: () => groupElements(),
    onUngroup: () => ungroupElements(),
    onBringForward: () => {
      if (selectedElementIds.length === 1) bringElementForward(selectedElementIds[0])
    },
    onSendBackward: () => {
      if (selectedElementIds.length === 1) sendElementBackward(selectedElementIds[0])
    },
    onResetZoom: () => resetZoom(),
    onZoomIn: () => zoomIn(),
    onZoomOut: () => zoomOut(),
    // Ribbon
  })

  const toggleElementSelection = useCallback(
    (id, multi = false) => {
      if (!id) {
        setSelectedElementIds([])
        return
      }
      if (multi) {
        setSelectedElementIds((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        )
      } else {
        setSelectedElementIds(
          getSelectionIdsForActiveSlideElement(
            activeSlideRef.current,
            presentation?.slides[currentSlideIndexRef.current],
            id
          )
        )
      }
    },
    [presentation, setSelectedElementIds]
  )

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">
        Loading...
      </div>
    )
  }

  if (!presentation) {
    return (
      <div className="flex h-full items-center justify-center text-text-muted">
        Presentation not found.{' '}
        <Button variant="ghost" onClick={onGoHome}>
          Go back
        </Button>
      </div>
    )
  }

  const hasChanges = historyRef.current.length > 1

  return (
    <>
    <div
      data-testid="editor-small-screen-guard"
      className="flex h-full flex-col items-center justify-center gap-3 bg-workspace px-6 text-center md:hidden"
    >
      <div className="text-base font-semibold text-text-primary">Tablet or desktop required</div>
      <p className="max-w-[320px] text-sm leading-6 text-text-secondary">
        Full slide editing needs a wider workspace. Use a tablet, desktop, or larger browser window.
      </p>
      <Button variant="secondary" onClick={onGoHome}>
        Back to presentations
      </Button>
    </div>
    <div className="relative hidden h-full flex-col overflow-hidden md:flex">
      {/* Editor Header */}
      <div className="relative z-[200] flex items-center gap-x-3 px-4 py-1.5 min-h-[44px] bg-secondary border-b border-border shrink-0">
        <Button
          variant="ghost"
          className="flex items-center gap-1.5 text-text-secondary text-[13px] px-2.5 py-1.5 rounded-sm transition-colors hover:bg-hover hover:text-text-primary"
          onClick={onGoHome}
        >
          <ChevronLeft size={16} />
          Back
        </Button>
        {isTemplate && (
          <span className="mr-1 shrink-0 rounded bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-black">
            TEMPLATE
          </span>
        )}
        <Input
          className="w-[150px] sm:w-[200px] shrink-0"
          value={presentation.title || ''}
          onChange={(e) => setPresentation((prev) => ({ ...prev, title: e.target.value }))}
          placeholder={isTemplate ? 'Untitled Template' : 'Untitled Presentation'}
        />
        <QuickAccessToolbar
          onSave={() => schedulePresentationSave(presentation, 100)}
          saving={saving}
          hasChanges={hasChanges}
          saveStatus={saveStatus}
          saveError={lastSaveError}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />
        <RibbonHeaderBar
          onExportPDF={onExportPDF}
          onExportPPTX={onExportPPTX}
          onExportHTML={onExportHTML}
          onExportOffline={onExportOffline}
          onExportProject={onExportProject}
          onOpenProject={onOpenProject}
          onGithub={() => setShowGithubModal(true)}
          onSync={() => setShowSyncModal(true)}
          onHistory={() => setShowHistoryModal(true)}
          onShare={() => setShowShareModal(true)}
          onLive={async () => {
            try {
              const res = await fetch('/api/live/room', { method: 'POST' })
              if (!res.ok) throw new Error('Live room creation failed')
              const data = await res.json()
              if (!data?.roomCode || !data?.presenterToken) {
                throw new Error('Invalid live room response')
              }
              setLiveRoomCode(data.roomCode)
              setLivePresenterToken(data.presenterToken)
              setShowLiveModal(true)
              // eslint-disable-next-line unused-imports/no-unused-vars
            } catch (err) {
              alert('Failed to create live room')
            }
          }}
          onAnalytics={() => setShowAnalytics(true)}
          onAICopywriter={() => {
            if (selectedElement?.type === 'text' && selectedElement.content) {
              setShowAICopywriter(true)
            } else {
              alert('Select a text element first')
            }
          }}
          onAIGenerator={() => setShowAIGenerator(true)}
          onAITranslate={() => setShowAITranslate(true)}
          onPresent={() => presentInWindow(presentation)}
        />
      </div>

      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden">
        {leftPanelOpen && (
          <SlidePanel
            slides={presentation.slides}
            resolution={presentation.resolution}
            currentIndex={currentSlideIndex}
            onSelect={(idx) => {
              // Always clear any active vertical-child edit when selecting a
              // top-level slide — including re-selecting the current index,
              // which the slide-change effect (keyed on currentSlideIndex)
              // would otherwise miss.
              setVerticalEdit(null)
              setCurrentSlideIndex(idx)
            }}
            onAdd={() => setShowTemplateModal(true)}
            onAddFromTemplate={() => setShowTemplateGallery(true)}
            onDelete={deleteSlide}
            onDuplicate={duplicateSlide}
            onDeleteSelected={deleteSlides}
            onDuplicateSelected={duplicateSlides}
            onMove={moveSlide}
            onToggleLock={(idx) =>
              setPresentation((prev) => ({
                ...prev,
                slides: prev.slides.map((s, i) => (i === idx ? { ...s, locked: !s.locked } : s)),
              }))
            }
            onToggleAutoAnimate={(idx) =>
              setPresentation((prev) => ({
                ...prev,
                slides: prev.slides.map((s, i) =>
                  i === idx ? { ...s, autoAnimate: !s.autoAnimate } : s
                ),
              }))
            }
            onAddVerticalSlide={(idx) => addChildSlide(idx)}
            currentVerticalIndex={currentVerticalIndex}
            onSelectVertical={({ parent, child }) => {
              const parentSlide = presentation.slides[parent]
              if (!parentSlide) return
              setSelectedElementIds([])
              setEditingElementId(null)
              editingElementIdRef.current = null
              setVerticalEdit({ parentId: parentSlide.id, child })
            }}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-workspace">
          <RibbonPanel
            editor={editingElementId ? editor : null}
            presentation={presentation}
            slide={currentSlide}
            onUpdateSlide={updateCurrentSlide}
            onUpdatePresentation={(updates) => setPresentation((prev) => (typeof updates === 'function' ? updates(prev) : { ...prev, ...updates }))}
            selectedElement={selectedElement}
            onUpdateElement={(updates) => selectedElementId && updateElement(selectedElementId, updates)}
            onPaste={handlePaste}
            onCut={handleCut}
            onCopy={handleCopy}
            onDuplicate={handleDuplicate}
            selectedCount={selectedElementIds.length}
            onGroup={groupElements}
            onUngroup={ungroupElements}
            onAlignElements={alignElements}
            onBringForward={() => selectedElementId && bringElementForward(selectedElementId)}
            onSendBackward={() => selectedElementId && sendElementBackward(selectedElementId)}
            onBringToFront={() => selectedElementId && bringElementToFront(selectedElementId)}
            onSendToBack={() => selectedElementId && sendElementToBack(selectedElementId)}
            onAddText={addTextElement}
            onAddImage={() => setShowImageUrlPrompt(true)}
            onAddImageUpload={async (file) => {
              const result = await api.uploadFile(file)
              if (result.url) addImageElement(result.url)
            }}
            onAddShape={addShapeElement}
            onAddLine={addLineElement}
            onAddCallout={addCalloutElement}
            onAddIcon={addIconElement}
            onAddChart={addChartElement}
            onAddTable={addTableElement}
            onAddCode={addCodeElement}
            onAddMarkdown={addMarkdownElement}
            onAddLatex={addLatexElement}
            onAddQrCode={addQrCodeElement}
            onAddVideo={addVideoElement}
            onAddAudio={addAudioElement}
            onOpenMediaLibrary={() => setShowMediaLibrary(true)}
            onOpenFileBrowser={() => setShowFileBrowser(true)}
            onAddHtml={addHtmlElement}
            onAddSvg={addSvgElement}
            onAddDrawing={addDrawingElement}
            onAddDivider={addDividerElement}
            onAddKineticText={() => setShowKineticTextModal(true)}
            onAddMathGrid={() => setShowMathGridModal(true)}
            onAddAnime={() => setShowAnimeModal(true)}
            onAddThree={() => setShowThreeModal(true)}
            onAddTimeline={addTimelineElement}
            onAddGame={addGameElement}
            pluginTypes={pluginTypes}
            onAddPluginElement={addPluginElement}
            onCssEditor={() => setShowCssEditor(true)}
            viewMode={viewMode}
            onFindReplace={() => setShowFindReplace((v) => !v)}
            onSpeakerNotes={() => {
              setRightPanelOpen(true)
              requestAnimationFrame(() => {
                document.querySelector('textarea[placeholder="Add speaker notes here..."]')?.focus()
              })
            }}
            onToggleSlideSorter={() => setViewMode((v) => (v === 'sorter' ? 'normal' : 'sorter'))}
            onPreviewAnimation={() => setShowAnimationPreview(true)}
          />
          <div className="flex-1 flex flex-col relative overflow-hidden">
            <SlideCanvas
              editor={editor}
              slide={activeSlide}
              designTokens={presentation.designTokens}
              selectedElementIds={selectedElementIds}
              editingElementId={editingElementId}
              showGrid={showGrid}
              gridSize={gridSize}
              resolution={presentation.resolution}
              showFooter={presentation.showFooter || false}
              showPageNumbers={presentation.showPageNumbers || false}
              pageNumberFormat={presentation.pageNumberFormat || 'c/t'}
              pageNumber={(() => {
                if (!presentation.showPageNumbers) return null
                if (currentSlide?.showPageNumber === false) return null
                // Count only slides with showPageNumber !== false up to current
                let num = 0
                for (let i = 0; i <= currentSlideIndex; i++) {
                  if (presentation.slides[i]?.showPageNumber !== false) num++
                }
                return num
              })()}
              totalSlides={presentation.slides.filter((s) => s.showPageNumber !== false).length}
              sectionName={currentSlide?.section || ''}
              footerFontSize={presentation.footerFontSize || 14}
              footerFontFamily={presentation.footerFontFamily || '-apple-system,sans-serif'}
              footerColor={presentation.footerColor || 'rgba(255,255,255,0.65)'}
              footerInactiveColor={presentation.footerInactiveColor || 'rgba(255,255,255,0.25)'}
              footerMode={presentation.footerMode || 'basic'}
              sequenceSections={presentation.sequenceSections || []}
              activeSection={currentSlide?.activeSection ?? null}
              smartGuidesEnabled={smartGuidesEnabled}
              showRulers={showRulers}
              persistentGuides={guides}
              onAddGuide={(guide) => setGuides((prev) => [...prev, guide])}
              onRemoveGuide={(idx) => setGuides((prev) => prev.filter((_, i) => i !== idx))}
              onToggleSelectElement={toggleElementSelection}
              onStartEdit={startEditingElement}
              onStopEdit={stopEditingElement}
              onUpdateElement={updateElement}
              onUpdateElements={updateElements}
              onDeleteElement={deleteElement}
              onDeleteSelectedElements={deleteSelectedElements}
              onCopy={handleCopy}
              onCut={handleCut}
              onPaste={handlePaste}
              onDuplicate={handleDuplicate}
              onOpenHtmlEditor={openHtmlEditor}
              onOpenCodeEditor={openCodeEditor}
              onOpenLatexEditor={openLatexEditor}
              onAddImage={async (file, dropX, dropY) => {
                const result = await api.uploadFile(file)
                if (result.url) addImageElement(result.url, dropX, dropY)
              }}
            />
          </div>
        </div>

        {rightPanelOpen && (
          <div className="mt-[80px] flex h-[calc(100%-80px)] shrink-0">
            <PropertiesPanel
              slide={activeSlide}
              selectedElement={selectedElement}
              onUpdateSlide={updateCurrentSlide}
              onUpdateElement={(idOrUpdates, maybeUpdates) => {
                if (maybeUpdates) {
                  updateElement(idOrUpdates, maybeUpdates)
                  return
                }
                if (selectedElementId) updateElement(selectedElementId, idOrUpdates)
              }}
              onDeleteElement={() => selectedElementId && deleteElement(selectedElementId)}
              onBringForward={() => selectedElementId && bringElementForward(selectedElementId)}
              onSendBackward={() => selectedElementId && sendElementBackward(selectedElementId)}
              onEditHtml={() => selectedElementId && openHtmlEditor(selectedElementId)}
              onEditCode={() => selectedElementId && openCodeEditor(selectedElementId)}
              onEditLatex={() => selectedElementId && openLatexEditor(selectedElementId)}
              presentation={presentation}
              onUpdatePresentation={(updates) => setPresentation((prev) => (typeof updates === 'function' ? updates(prev) : { ...prev, ...updates }))}
              selectedElementIds={selectedElementIds}
              onSelectElement={toggleElementSelection}
              onUpdateElements={updateElements}
              onDeleteSelectedElements={deleteSelectedElements}
              isTemplate={isTemplate}
            />
          </div>
        )}
        {showDesignIdeas && (
          <div className="mt-[80px] flex h-[calc(100%-80px)] shrink-0">
            <DesignIdeasPanel
              slide={activeSlide}
              presentation={presentation}
              onApplyLayout={(templateId) => {
                const template = SLIDE_TEMPLATES[templateId]
                if (!template) return
                const slots = (template.elements || []).filter((e) => e.type === 'text')
                // Conservative re-fit: keep content, adopt each text slot's geometry
                // in order; non-text and overflow elements stay put. One undo step.
                setPresentation((prev) =>
                  mapActive(prev, (s) => {
                    let slotIdx = 0
                    const elements = (s.elements || []).map((el) => {
                      if (el.type === 'text' && slotIdx < slots.length) {
                        const slot = slots[slotIdx++]
                        return { ...el, x: slot.x, y: slot.y, width: slot.width, height: slot.height, zIndex: slot.zIndex ?? el.zIndex }
                      }
                      return el
                    })
                    return { ...s, elements }
                  })
                )
              }}
              onApplyTheme={({ presetId, tokens }) => {
                const preset = presetId ? getThemePreset(presetId) : null
                setPresentation((prev) => ({
                  ...prev,
                  designTokens: preset ? preset.tokens : tokens || prev.designTokens,
                  theme: preset ? preset.revealTheme : prev.theme,
                }))
              }}
            />
          </div>
        )}
      </div>

      <EditorModals
        presentationId={presentationId}
        presentation={presentation}
        currentSlide={currentSlide}
        currentSlideIndex={currentSlideIndex}
        viewMode={viewMode}
        setViewMode={setViewMode}
        setCurrentSlideIndex={setCurrentSlideIndex}
        setPresentation={setPresentation}
        htmlEditorState={htmlEditorState}
        setHtmlEditorState={setHtmlEditorState}
        commitHtmlEdit={commitHtmlEdit}
        codeEditorState={codeEditorState}
        setCodeEditorState={setCodeEditorState}
        commitCodeEdit={commitCodeEdit}
        latexEditorState={latexEditorState}
        setLatexEditorState={setLatexEditorState}
        commitLatexEdit={commitLatexEdit}
        showFindReplace={showFindReplace}
        setShowFindReplace={setShowFindReplace}
        showTimeline={showTimeline}
        setShowTimeline={setShowTimeline}
        updateElement={updateElement}
        currentGameType={currentGameType}
        showGameHud={showGameHud}
        setShowGameHud={setShowGameHud}
        showGameLeaderboard={showGameLeaderboard}
        setShowGameLeaderboard={setShowGameLeaderboard}
        selectedElementId={selectedElementId}
        commands={commands}
        liveRoomCode={liveRoomCode}
        livePresenterToken={livePresenterToken}
        galleryPreviewTemplate={galleryPreviewTemplate}
        setGalleryPreviewTemplate={setGalleryPreviewTemplate}
        addSlide={addSlide}
        addImageElement={addImageElement}
        insertEmbedHtml={insertEmbedHtml}
        handleInsertFromFileBrowser={handleInsertFromFileBrowser}
        onCreatePresentation={onCreatePresentation}
        onAICopywriterApply={onAICopywriterApply}
        onApplyTranslations={onApplyTranslations}
        onInsertMedia={insertMediaElement}
      />

      <ProductTour />
    </div>
    </>
  )
}
