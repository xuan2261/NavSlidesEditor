import { useState, useEffect, useRef, useCallback } from 'react'
import { useEditorStore } from '../stores/editor-store'
import { createElement } from '../utils/element-factory'
import { useSlideOperations } from '../hooks/use-slide-operations'
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
import { presentInWindow, exportPDF, generateRevealHTML, downloadHTML } from '../utils/generateHTML'
import { exportToPptx } from '../utils/exportPptx'
import { generateOfflineHTML } from '../utils/offlineExport'
import { exportProject } from '../utils/export-project'
import { parseProjectFile, rehydrateImportedPresentation, validateProjectFile } from '../utils/import-project'
import Toolbar from '../components/Toolbar'
import SlidePanel from '../components/SlidePanel'
import SlideCanvas from '../components/SlideCanvas'
import PropertiesPanel from '../components/PropertiesPanel'
import FindReplaceBar from '../components/FindReplaceBar'
import TransitionPreview from '../components/TransitionPreview'
import SlideSorterView from '../components/SlideSorterView'
import AnimationTimeline from '../components/AnimationTimeline'
import AnimationPreviewModal from '../components/AnimationPreviewModal'
import MediaLibraryModal from '../components/MediaLibraryModal'
import AICopywriterModal from '../components/AICopywriterModal'
import AIGeneratorModal from '../components/AIGeneratorModal'
import AITranslateModal from '../components/AITranslateModal'
import ShareModal from '../components/ShareModal'
import AnalyticsModal from '../components/AnalyticsModal'
import GitHubPushModal from '../components/GitHubPushModal'
import HistoryModal from '../components/HistoryModal'
import SyncModal from '../components/SyncModal'
import LivePresentationModal from '../components/LivePresentationModal'
import CSSEditorModal from '../components/CSSEditorModal'
import EditorMenuBar from '../components/EditorMenuBar'
import TemplateGallery from '../components/dashboard/TemplateGallery'
import TemplatePreview from '../components/dashboard/TemplatePreview'
import QuickAccessToolbar from '../components/QuickAccessToolbar'
import HtmlEditorModal from '../components/HtmlEditorModal'
import CodeEditorModal from '../components/CodeEditorModal'
import LatexEditorModal from '../components/LatexEditorModal'
import TemplatePickerModal from '../components/TemplatePickerModal'
import ProductTour from '../components/ProductTour'
import PromptPopover from '../components/PromptPopover'
import { MathNode } from '../extensions/MathExtension'
import { FontSize } from '../extensions/FontSize'
import { FontFamily } from '../extensions/FontFamily'
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
import {
  applyTranslatedNotes,
  getSlideNotesTranslationKey,
  normalizePresentationNotes,
} from '../utils/slide-notes'

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
const imageUrlPromptPopoverStyle = {
  position: 'fixed',
  top: 100,
  left: '50%',
  transform: 'translateX(-50%)',
}

const migrateSlide = (slide) => {
  if (!slide.elements) {
    return {
      ...slide,
      elements: slide.html
        ? [
            {
              id: crypto.randomUUID(),
              type: 'text',
              x: 80,
              y: 100,
              width: 800,
              height: 340,
              zIndex: 1,
              content: slide.html,
            },
          ]
        : [],
    }
  }
  return slide
}

export default function EditorPage({ presentationId, isTemplate = false, onGoHome }) {
  const [presentation, setPresentation] = useState(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState('') // '', 'saving', 'saved'
  const [loading, setLoading] = useState(true)

  // ─── Zustand store (UI state) ───────────────────────────────────────────────
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds)
  const setSelectedElementIds = useEditorStore((s) => s.setSelectedElementIds)
  const editingElementId = useEditorStore((s) => s.editingElementId)
  const setEditingElementId = useEditorStore((s) => s.setEditingElementId)
  // eslint-disable-next-line unused-imports/no-unused-vars
  const clipboard = useEditorStore((s) => s.clipboard)
  // eslint-disable-next-line unused-imports/no-unused-vars
  const setClipboard = useEditorStore((s) => s.setClipboard)
  const showGrid = useEditorStore((s) => s.showGrid)
  const setShowGrid = useEditorStore((s) => s.setShowGrid)
  const gridSize = useEditorStore((s) => s.gridSize)
  const setGridSize = useEditorStore((s) => s.setGridSize)
  const smartGuidesEnabled = useEditorStore((s) => s.smartGuidesEnabled)
  const setSmartGuidesEnabled = useEditorStore((s) => s.setSmartGuidesEnabled)
  const showRulers = useEditorStore((s) => s.showRulers)
  const setShowRulers = useEditorStore((s) => s.setShowRulers)
  const guides = useEditorStore((s) => s.guides)
  const setGuides = useEditorStore((s) => s.setGuides)
  const showTimeline = useEditorStore((s) => s.showTimeline)
  const setShowTimeline = useEditorStore((s) => s.setShowTimeline)
  const showFindReplace = useEditorStore((s) => s.showFindReplace)
  const setShowFindReplace = useEditorStore((s) => s.setShowFindReplace)
  const viewMode = useEditorStore((s) => s.viewMode)
  const setViewMode = useEditorStore((s) => s.setViewMode)

  // Derived from selectedElementIds — must be declared before any useEffect that references it
  const selectedElementId = selectedElementIds[selectedElementIds.length - 1] ?? null

  // ─── Editor-only modal state (not worth putting in store) ──────────────────
  const [htmlEditorState, setHtmlEditorState] = useState(null) // { elementId, content }
  const [codeEditorState, setCodeEditorState] = useState(null) // { elementId, content, language }
  const [latexEditorState, setLatexEditorState] = useState(null) // { elementId, content }
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showTemplateGallery, setShowTemplateGallery] = useState(false)
  const [galleryPreviewTemplate, setGalleryPreviewTemplate] = useState(null)
  const [showMediaLibrary, setShowMediaLibrary] = useState(false)
  const [showGithubModal, setShowGithubModal] = useState(false)
  const [showTransitionPreview, setShowTransitionPreview] = useState(false)
  const [showAnimationPreview, setShowAnimationPreview] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [shareStatus, setShareStatus] = useState({ shared: false, token: null })
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [showMasterPanel, setShowMasterPanel] = useState(false)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [showCssEditor, setShowCssEditor] = useState(false)
  const [showAICopywriter, setShowAICopywriter] = useState(false)
  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [showAITranslate, setShowAITranslate] = useState(false)
  const [showLiveModal, setShowLiveModal] = useState(false)
  const [liveRoomCode, setLiveRoomCode] = useState(null)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showImageUrlPrompt, setShowImageUrlPrompt] = useState(false)

  // Track if we're programmatically setting editor content (to avoid loops)
  const settingContent = useRef(false)
  const saveTimerRef = useRef(null)
  const isFirstLoad = useRef(true)
  const historyRef = useRef([]) // undo history: array of presentation snapshots
  const applyingUndoRef = useRef(false)
  const editingElementIdRef = useRef(null)
  const currentSlideIndexRef = useRef(0)
  const selectedElementIdsRef = useRef([])
  const redoStackRef = useRef([])

  // Keep refs in sync with state
  useEffect(() => {
    editingElementIdRef.current = editingElementId
  }, [editingElementId])

  useEffect(() => {
    currentSlideIndexRef.current = currentSlideIndex
  }, [currentSlideIndex])

  useEffect(() => {
    selectedElementIdsRef.current = selectedElementIds
  }, [selectedElementIds])

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
      const slideIdx = currentSlideIndexRef.current
      if (!elemId) return
      const html = editor.getHTML()
      setPresentation((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          slides: prev.slides.map((s, i) =>
            i === slideIdx
              ? {
                  ...s,
                  elements: s.elements.map((el) =>
                    el.id === elemId ? { ...el, content: html } : el
                  ),
                }
              : s
          ),
        }
      })
    },
  })

  // When presentation first loads, clear editor content
  useEffect(() => {
    if (editor && presentation && isFirstLoad.current) {
      isFirstLoad.current = false
      settingContent.current = true
      editor.commands.setContent('', false)
      settingContent.current = false
    }
  }, [editor, presentation])

  // When currentSlideIndex changes, reset selection and editing
  useEffect(() => {
    setSelectedElementIds([])
    setEditingElementId(null)
    editingElementIdRef.current = null
    if (editor) {
      settingContent.current = true
      editor.commands.setContent('', false)
      settingContent.current = false
    }
  }, [currentSlideIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save with debounce
  useEffect(() => {
    if (!presentation || isFirstLoad.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    setSaveStatus('saving')
    saveTimerRef.current = setTimeout(async () => {
      try {
        const saveFn = isTemplate ? api.updateTemplate : api.updatePresentation
        await saveFn(presentation.id, normalizePresentationNotes(presentation))
        setSaveStatus('saved')
        setLastSavedAt(new Date())
        setTimeout(() => setSaveStatus(''), 2000)
      } catch (err) {
        console.error('Auto-save failed', err)
        setSaveStatus('')
      }
    }, 1500)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [isTemplate, presentation])

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
      redoStackRef.current = []
    }, 500)
    return () => clearTimeout(timer)
  }, [presentation])

  const updateCurrentSlide = useCallback(
    (updates) => {
      setPresentation((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          slides: prev.slides.map((s, i) => (i === currentSlideIndex ? { ...s, ...updates } : s)),
        }
      })
    },
    [currentSlideIndex]
  )

  const updateElement = useCallback((id, updates) => {
    setPresentation((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current
            ? {
                ...s,
                elements: s.elements.map((el) => (el.id === id ? { ...el, ...updates } : el)),
              }
            : s
        ),
      }
    })
  }, [])

  const deleteElement = useCallback(
    (id) => {
      setPresentation((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          slides: prev.slides.map((s, i) =>
            i === currentSlideIndexRef.current
              ? {
                  ...s,
                  elements: s.elements.filter((el) => el.id !== id),
                }
              : s
          ),
        }
      })
      setSelectedElementIds((prev) => prev.filter((x) => x !== id))
      if (editingElementId === id) setEditingElementId(null)
    },
    [editingElementId, setEditingElementId, setSelectedElementIds]
  )

  // ── Unified element creation (replaces 17 individual addXxxElement callbacks) ──
  const addElement = useCallback((type, overrides = {}) => {
    const newEl = createElement(type, overrides)
    setPresentation((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current
            ? { ...s, elements: [...(s.elements || []), newEl] }
            : s
        ),
      }
    })
    setSelectedElementIds([newEl.id])
    return newEl
  }, [setSelectedElementIds])

  // Thin wrappers for call-site compatibility
  const addTextElement = useCallback(() => addElement('text'), [addElement])

  const addImageElement = useCallback(
    (src, dropX, dropY) => {
      const posOverrides = { src }
      if (dropX !== undefined) posOverrides.x = Math.max(0, Math.min(560, dropX - 200))
      if (dropY !== undefined) posOverrides.y = Math.max(0, Math.min(240, dropY - 150))
      return addElement('image', posOverrides)
    },
    [addElement]
  )

  // Add a batch of new elements (used by clipboard paste/duplicate)
  const addElements = useCallback((newElements) => {
    if (!newElements || newElements.length === 0) return
    // Generate IDs before setState so selection works
    const withIds = newElements.map((el) => ({
      ...el,
      id: el.id || crypto.randomUUID(),
    }))
    setPresentation((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current
            ? { ...s, elements: [...(s.elements || []), ...withIds] }
            : s
        ),
      }
    })
    setSelectedElementIds(withIds.map((el) => el.id))
  }, [setSelectedElementIds])

  const DEFAULT_HTML = `<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
<style>* { box-sizing: border-box; margin: 0; } body { background: transparent; overflow: hidden; }</style>
<svg id="viz" width="100%" height="100%" style="display:block;"></svg>
<script>
const W = window.innerWidth, H = window.innerHeight;
const svg = d3.select('#viz').attr('viewBox', \`0 0 \${W} \${H}\`);
const data = Array.from({length: 30}, () => ({ x: Math.random()*W, y: Math.random()*H, r: 8+Math.random()*20 }));
svg.selectAll('circle').data(data).join('circle')
  .attr('cx', d => d.x).attr('cy', d => d.y).attr('r', d => d.r)
  .attr('fill', (d,i) => d3.schemeTableau10[i%10]).attr('opacity', 0.8);
</script>`

  const addQrCodeElement = useCallback(() => addElement('qrcode'), [addElement])

  const addDividerElement = useCallback(() => {
    return addElement('line', {
      x: 96,
      y: 270,
      width: 768,
      height: 40,
      x1: 0,
      y1: 20,
      x2: 768,
      y2: 20,
      stroke: 'rgba(255,255,255,0.3)',
      arrowStart: 'none',
      arrowEnd: 'none',
    })
  }, [addElement])

  const addHtmlElement = useCallback(() => {
    const newEl = addElement('html', { content: DEFAULT_HTML })
    setHtmlEditorState({ elementId: newEl.id, content: DEFAULT_HTML })
  }, [addElement, DEFAULT_HTML])

  const openHtmlEditor = useCallback(
    (elementId) => {
      const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(
        (el) => el.id === elementId
      )
      if (!element || element.type !== 'html') return
      setHtmlEditorState({ elementId, content: element.content || '' })
    },
    [presentation]
  )

  const commitHtmlEdit = useCallback(() => {
    if (!htmlEditorState) return
    updateElement(htmlEditorState.elementId, { content: htmlEditorState.content })
    setHtmlEditorState(null)
  }, [htmlEditorState, updateElement])

  const addCodeElement = useCallback(() => {
    const newEl = addElement('code')
    setCodeEditorState({ elementId: newEl.id, content: newEl.content, language: newEl.language })
  }, [addElement])

  const openCodeEditor = useCallback(
    (elementId) => {
      const slide = presentation?.slides[currentSlideIndexRef.current]
      const element = slide?.elements?.find((el) => el.id === elementId)
      if (!element || element.type !== 'code') return
      setCodeEditorState({
        elementId,
        content: element.content || '',
        language: element.language || 'javascript',
      })
    },
    [presentation]
  )

  const commitCodeEdit = useCallback(() => {
    if (!codeEditorState) return
    updateElement(codeEditorState.elementId, {
      content: codeEditorState.content,
      language: codeEditorState.language,
    })
    setCodeEditorState(null)
  }, [codeEditorState, updateElement])

  const addLatexElement = useCallback(() => {
    const newEl = addElement('latex')
    setLatexEditorState({ elementId: newEl.id, content: newEl.content })
  }, [addElement])

  const openLatexEditor = useCallback(
    (elementId) => {
      const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(
        (el) => el.id === elementId
      )
      if (!element || element.type !== 'latex') return
      setLatexEditorState({ elementId, content: element.content || '' })
    },
    [presentation]
  )

  const commitLatexEdit = useCallback(() => {
    if (!latexEditorState) return
    updateElement(latexEditorState.elementId, { content: latexEditorState.content })
    setLatexEditorState(null)
  }, [latexEditorState, updateElement])

  const addMarkdownElement = useCallback(() => addElement('markdown'), [addElement])

  const addChartElement = useCallback(() => addElement('chart'), [addElement])

  const addCalloutElement = useCallback(
    (number) => {
      const num =
        number || (currentSlide?.elements || []).filter((el) => el.type === 'callout').length + 1
      return addElement('callout', { calloutNumber: num })
    },
    [currentSlide, addElement]
  )

  const addIconElement = useCallback(
    (iconName) => {
      return addElement('icon', iconName ? { iconName } : {})
    },
    [addElement]
  )

  const addShapeElement = useCallback(
    (shape) => {
      const dims = { line: { width: 300, height: 40 }, circle: { width: 200, height: 200 } }
      const dim = dims[shape] || { width: 200, height: 150 }
      return addElement('shape', {
        shape,
        x: (960 - dim.width) / 2,
        y: (540 - dim.height) / 2,
        width: dim.width,
        height: dim.height,
      })
    },
    [addElement]
  )

  const addVideoElement = useCallback((src) => addElement('video', { src }), [addElement])

  const addAudioElement = useCallback((src) => addElement('audio', { src }), [addElement])

  const addTableElement = useCallback(
    (rows = 3, cols = 3) => {
      const data = Array.from({ length: rows }, (_, ri) =>
        Array.from({ length: cols }, (_, ci) => (ri === 0 ? `Header ${ci + 1}` : ''))
      )
      return addElement('table', { data })
    },
    [addElement]
  )

  const addDrawingElement = useCallback(() => addElement('drawing'), [addElement])

  const addLineElement = useCallback(
    (overrides = {}) => addElement('line', overrides),
    [addElement]
  )

  const addSvgElement = useCallback(
    (svgContent) => {
      return addElement('svg', svgContent ? { content: svgContent } : {})
    },
    [addElement]
  )

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
      const element = presentation?.slides[currentSlideIndexRef.current]?.elements?.find(
        (el) => el.id === elementId
      )
      if (!element || element.type !== 'text') return
      setEditingElementId(elementId)
      editingElementIdRef.current = elementId
      setSelectedElementIds([elementId])
      settingContent.current = true
      const processedContent = preserveBlockColors(element.content || '')
      editor?.commands.setContent(processedContent, false)
      settingContent.current = false
      setTimeout(() => editor?.commands.focus(), 10)
    },
    [editor, preserveBlockColors, presentation, setEditingElementId, setSelectedElementIds]
  )

  const stopEditingElement = useCallback(() => {
    setEditingElementId(null)
    editingElementIdRef.current = null
  }, [setEditingElementId])

  const bringElementForward = useCallback(
    (id) => {
      updateElement(id, {
        zIndex: (currentSlide?.elements?.find((el) => el.id === id)?.zIndex || 1) + 1,
      })
    },
    [currentSlide, updateElement]
  )

  const sendElementBackward = useCallback(
    (id) => {
      updateElement(id, {
        zIndex: Math.max(1, (currentSlide?.elements?.find((el) => el.id === id)?.zIndex || 1) - 1),
      })
    },
    [currentSlide, updateElement]
  )

  // Undo/Redo handlers (called by QuickAccessToolbar and keyboard shortcuts)
  const handleUndo = () => {
    const hist = historyRef.current
    if (hist.length < 2) return
    applyingUndoRef.current = true
    redoStackRef.current = [...redoStackRef.current.slice(-19), hist[hist.length - 1]]
    const newHist = hist.slice(0, -1)
    historyRef.current = newHist
    const prevState = newHist[newHist.length - 1]
    setPresentation(prevState)
    setCurrentSlideIndex((ci) => Math.min(ci, prevState.slides.length - 1))
  }

  const handleRedo = () => {
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
  }

  // Global keyboard shortcuts (undo/redo, find/replace, slide sorter)
  // NOTE: Clipboard (Ctrl+C/X/V/D) is handled by SlideCanvas via Zustand store
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
      if (e.key === 'z' && !e.shiftKey) {
        handleUndo()
        e.preventDefault()
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        handleRedo()
        e.preventDefault()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [currentSlideIndex, editingElementId, presentation, setShowFindReplace, setViewMode, handleUndo, handleRedo])

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

  const selectedElement = currentSlide?.elements?.find((el) => el.id === selectedElementId) || null

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
  } = useSlideOperations({
    presentation,
    setPresentation,
    currentSlideIndex,
    setCurrentSlideIndex,
    currentSlideIndexRef,
    selectedElementIdsRef,
    editingElementIdRef,
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
        // If element is in a group, select all group members
        const slide = presentation?.slides[currentSlideIndexRef.current]
        const el = slide?.elements?.find((e) => e.id === id)
        if (el?.groupId) {
          const groupIds = (slide?.elements || [])
            .filter((e) => e.groupId === el.groupId)
            .map((e) => e.id)
          setSelectedElementIds(groupIds)
        } else {
          setSelectedElementIds([id])
        }
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

  // eslint-disable-next-line
  const hasChanges = historyRef.current.length > 1

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
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
          onSave={() => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
            setSaveStatus('saving')
            saveTimerRef.current = setTimeout(async () => {
              try {
                const saveFn = isTemplate ? api.updateTemplate : api.updatePresentation
                await saveFn(presentation.id, normalizePresentationNotes(presentation))
                setSaveStatus('saved')
                setLastSavedAt(new Date())
                setTimeout(() => setSaveStatus(''), 2000)
              } catch (err) {
                console.error('Auto-save failed', err)
                setSaveStatus('')
              }
            }, 100)
          }}
          saving={saving}
          hasChanges={hasChanges}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />
        <EditorMenuBar
          presentation={presentation}
          setPresentation={setPresentation}
          presentationId={presentationId}
          saveStatus={saveStatus}
          lastSavedAt={lastSavedAt}
          onExportPDF={() => exportPDF(presentation)}
          onExportPPTX={async () => {
            try {
              const warnings = await exportToPptx(presentation)
              if (warnings.length) alert(`PPTX export completed with warnings:\n\n${warnings.join('\n')}`)
            } catch (err) {
              console.error('PPTX export failed:', err)
              alert('PPTX export failed: ' + err.message)
            }
          }}
          onExportHTML={async () => {
            try {
              downloadHTML(presentation)
            } catch (err) {
              console.error('HTML export failed:', err)
              alert('HTML export failed: ' + err.message)
            }
          }}
          onExportOffline={async () => {
            try {
              const html = generateRevealHTML(presentation)
              const offline = await generateOfflineHTML(html)
              const blob = new Blob([offline], { type: 'text/html' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `${(presentation.title || 'presentation').replace(/[^a-z0-9]/gi, '_')}_offline.html`
              a.click()
              URL.revokeObjectURL(url)
            } catch (err) {
              console.error('Offline export failed:', err)
              alert('Offline export failed: ' + err.message)
            }
          }}
          onExportProject={async () => {
            try {
              await exportProject(presentation)
            } catch (err) {
              console.error('Project export failed:', err)
              alert('Project export failed: ' + err.message)
            }
          }}
          onOpenProject={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.navslides,.json'
            input.onchange = async (e) => {
              const file = e.target.files[0]
              if (!file) return
              try {
                const parsed = await parseProjectFile(file)
                const { valid, errors, warnings } = validateProjectFile(parsed)
                if (!valid) {
                  alert('Invalid project file: ' + errors.join(', '))
                  return
                }
                if (warnings.length) console.warn('Import warnings:', warnings)
                let finalPres = await rehydrateImportedPresentation(api, parsed)
                finalPres.title = (finalPres.title || 'Imported') + ' (Imported)'
                const newPres = await api.createPresentation({
                  ...finalPres,
                  slides: finalPres.slides,
                })
                window.location.href = `/editor/${newPres.id}`
              } catch (err) {
                console.error('Import failed:', err)
                alert('Import failed: ' + err.message)
              }
            }
            input.click()
          }}
          onGithub={() => setShowGithubModal(true)}
          onSync={() => setShowSyncModal(true)}
          onHistory={() => setShowHistoryModal(true)}
          onFindReplace={() => setShowFindReplace((v) => !v)}
          onTimeline={() => setShowTimeline((v) => !v)}
          onCssEditor={() => setShowCssEditor(true)}
          onSpeaker={() => {
            const notesSection = document.querySelector('[data-section="speaker-notes"]') 
              || document.querySelector('textarea[placeholder*="speaker" i]')
              || document.querySelector('textarea[placeholder*="notes" i]')
            if (notesSection) {
              notesSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
              notesSection.focus()
            }
          }}
          onSlideSorter={() => setViewMode((v) => (v === 'sorter' ? 'normal' : 'sorter'))}
          showTimeline={showTimeline}
          showFindReplace={showFindReplace}
          onShare={() => setShowShareModal(true)}
          onLive={async () => {
            try {
              const res = await fetch('/api/live/room', { method: 'POST' })
              const data = await res.json()
              setLiveRoomCode(data.roomCode)
              setShowLiveModal(true)
              // eslint-disable-next-line unused-imports/no-unused-vars
            } catch (err) {
              alert('Failed to create live room')
            }
          }}
          onAnalytics={() => setShowAnalytics(true)}
          onAICopywriter={() => {
            const el = currentSlide?.elements?.find((e) => e.id === selectedElementId)
            if (el?.type === 'text' && el.content) {
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

      {/* GitHub Modal */}
      {showGithubModal && (
        <GitHubPushModal
          presentationId={presentationId}
          presentationTitle={presentation?.title}
          onClose={() => setShowGithubModal(false)}
        />
      )}

      {/* Sync / Proton Drive Modal */}
      {showSyncModal && (
        <SyncModal presentationId={presentationId} onClose={() => setShowSyncModal(false)} />
      )}

      {/* Version History Modal */}
      {showHistoryModal && (
        <HistoryModal
          presentationId={presentationId}
          onRestore={(restored) =>
            setPresentation({ ...restored, slides: (restored.slides || []).map((s) => s) })
          }
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {/* Slide Sorter View */}
      {viewMode === 'sorter' && (
        <SlideSorterView
          slides={presentation.slides}
          currentIndex={currentSlideIndex}
          onSelect={(idx) => {
            setCurrentSlideIndex(idx)
            setViewMode('normal')
          }}
          onMove={(fromIdx, toIdx) => {
            const newSlides = [...presentation.slides]
            const [moved] = newSlides.splice(fromIdx, 1)
            newSlides.splice(toIdx, 0, moved)
            setPresentation((prev) => ({ ...prev, slides: newSlides }))
          }}
          onDelete={(idx) => {
            if (presentation.slides.length <= 1) return
            const newSlides = presentation.slides.filter((_, i) => i !== idx)
            setPresentation((prev) => ({ ...prev, slides: newSlides }))
            if (currentSlideIndex >= newSlides.length) {
              setCurrentSlideIndex(Math.max(0, newSlides.length - 1))
            }
          }}
          onDuplicate={(idx) => {
            const slide = presentation.slides[idx]
            const dup = {
              ...slide,
              id: crypto.randomUUID(),
              elements: JSON.parse(JSON.stringify(slide.elements || [])),
            }
            const newSlides = [...presentation.slides]
            newSlides.splice(idx + 1, 0, dup)
            setPresentation((prev) => ({ ...prev, slides: newSlides }))
          }}
          onClose={() => setViewMode('normal')}
        />
      )}

      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden">
        <SlidePanel
          slides={presentation.slides}
          resolution={presentation.resolution}
          currentIndex={currentSlideIndex}
          onSelect={setCurrentSlideIndex}
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
          onAddVerticalSlide={(idx) => {
            const newChild = {
              id: crypto.randomUUID(),
              elements: [],
              background: { type: 'color', color: '#1e1e2e' },
              notes: '',
            }
            setPresentation((prev) => ({
              ...prev,
              slides: prev.slides.map((s, i) =>
                i === idx ? { ...s, children: [...(s.children || []), newChild] } : s
              ),
            }))
          }}
        />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-workspace">
          <Toolbar
            editor={editingElementId ? editor : null}
            editingElementId={editingElementId}
            showGrid={showGrid}
            onToggleGrid={() => setShowGrid((v) => !v)}
            gridSize={gridSize}
            onGridSizeChange={(v) => {
              setGridSize(v)
              setPresentation((prev) => (prev ? { ...prev, gridSize: v } : prev))
            }}
            onAddText={addTextElement}
            onAddImage={() => setShowImageUrlPrompt(true)}
            onAddImageUpload={async (file) => {
              const result = await api.uploadFile(file)
              if (result.url) addImageElement(result.url)
            }}
            onAddShape={addShapeElement}
            onAddHtml={addHtmlElement}
            onAddCode={addCodeElement}
            onAddLatex={addLatexElement}
            onAddMarkdown={addMarkdownElement}
            onAddChart={addChartElement}
            onAddCallout={addCalloutElement}
            onAddIcon={addIconElement}
            onAddVideo={addVideoElement}
            onAddAudio={addAudioElement}
            onAddTable={addTableElement}
            onAddDrawing={addDrawingElement}
            onAddLine={addLineElement}
            onAddSvg={addSvgElement}
            onAddQrCode={addQrCodeElement}
            onAddDivider={addDividerElement}
            onOpenMediaLibrary={() => setShowMediaLibrary(true)}
            selectedCount={selectedElementIds.length}
            onAlignElements={alignElements}
            smartGuidesEnabled={smartGuidesEnabled}
            onToggleSmartGuides={() => setSmartGuidesEnabled((v) => !v)}
            slide={currentSlide}
            onUpdateSlide={updateCurrentSlide}
            onGroupElements={groupElements}
            onUngroupElements={ungroupElements}
            showRulers={showRulers}
            onToggleRulers={() => setShowRulers((v) => !v)}
          />
          <div className="flex-1 flex flex-col relative overflow-hidden">
            <SlideCanvas
              editor={editor}
              slide={currentSlide}
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
              onAddElements={addElements}
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

        <PropertiesPanel
          slide={currentSlide}
          selectedElement={selectedElement}
          onUpdateSlide={updateCurrentSlide}
          onUpdateElement={(updates) =>
            selectedElementId && updateElement(selectedElementId, updates)
          }
          onDeleteElement={() => selectedElementId && deleteElement(selectedElementId)}
          onBringForward={() => selectedElementId && bringElementForward(selectedElementId)}
          onSendBackward={() => selectedElementId && sendElementBackward(selectedElementId)}
          onEditHtml={() => selectedElementId && openHtmlEditor(selectedElementId)}
          onEditCode={() => selectedElementId && openCodeEditor(selectedElementId)}
          onEditLatex={() => selectedElementId && openLatexEditor(selectedElementId)}
          presentation={presentation}
          onUpdatePresentation={(updates) => setPresentation((prev) => ({ ...prev, ...updates }))}
          selectedElementIds={selectedElementIds}
          onSelectElement={toggleElementSelection}
          onUpdateElements={updateElements}
          onDeleteSelectedElements={deleteSelectedElements}
          isTemplate={isTemplate}
        />

        {/* HTML / D3 Code Editor Modal */}
        {htmlEditorState && (
          <HtmlEditorModal
            state={htmlEditorState}
            onChange={setHtmlEditorState}
            onApply={commitHtmlEdit}
            onCancel={() => setHtmlEditorState(null)}
          />
        )}

        {/* Code Editor Modal */}
        {codeEditorState && (
          <CodeEditorModal
            state={codeEditorState}
            onChange={setCodeEditorState}
            onApply={commitCodeEdit}
            onCancel={() => setCodeEditorState(null)}
            codeTheme={presentation.codeTheme}
            onChangeTheme={(theme) => setPresentation((prev) => ({ ...prev, codeTheme: theme }))}
          />
        )}
        {/* LaTeX / TikZ Editor Modal */}
        {latexEditorState && (
          <LatexEditorModal
            state={latexEditorState}
            onChange={setLatexEditorState}
            onApply={commitLatexEdit}
            onCancel={() => setLatexEditorState(null)}
          />
        )}

        {/* Find & Replace */}
        {showFindReplace && (
          <FindReplaceBar
            presentation={presentation}
            onUpdatePresentation={(updates) => setPresentation((prev) => ({ ...prev, ...updates }))}
            currentSlideIndex={currentSlideIndex}
            onNavigateToSlide={setCurrentSlideIndex}
            onClose={() => setShowFindReplace(false)}
          />
        )}

        {/* Animation Timeline */}
        {showTimeline && (
          <AnimationTimeline
            slide={currentSlide}
            onUpdateElement={(id, updates) => updateElement(id, updates)}
            onClose={() => setShowTimeline(false)}
            onPreview={() => setShowAnimationPreview(true)}
          />
        )}

        {showAnimationPreview && presentation && currentSlide && (
          <AnimationPreviewModal
            key={`${presentation.id || 'preview'}-${currentSlide.id || currentSlideIndex}`}
            presentation={presentation}
            slideIndex={currentSlideIndex}
            onClose={() => setShowAnimationPreview(false)}
          />
        )}

        {/* Transition Preview */}
        {showTransitionPreview && (
          <TransitionPreview
            presentation={presentation}
            fromIndex={currentSlideIndex}
            onClose={() => setShowTransitionPreview(false)}
          />
        )}

        {/* Share Modal */}
        {showShareModal && (
          <ShareModal presentationId={presentationId} onClose={() => setShowShareModal(false)} />
        )}

        {/* Analytics Modal */}
        {showAnalytics && (
          <AnalyticsModal presentationId={presentationId} onClose={() => setShowAnalytics(false)} />
        )}

        {/* AI Copywriter Modal */}
        {showAICopywriter &&
          (() => {
            const el = currentSlide?.elements?.find((e) => e.id === selectedElementId)
            const textContent = el?.content?.replace(/<[^>]*>/g, '') || ''
            return (
              <AICopywriterModal
                text={textContent}
                onApply={(newText) => {
                  if (selectedElementId) {
                    updateElement(selectedElementId, { content: `<p>${newText}</p>` })
                  }
                }}
                onClose={() => setShowAICopywriter(false)}
              />
            )
          })()}

        {/* AI Generator Modal */}
        {showAIGenerator && (
          <AIGeneratorModal
            onCreatePresentation={async (outline) => {
              try {
                const res = await fetch('/api/ai/generate-slides', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ outline }),
                })
                const data = await res.json()
                if (data.slides) {
                  // Create new slides from outline
                  // eslint-disable-next-line unused-imports/no-unused-vars
                  const newSlides = outline.map((item, idx) => ({
                    id: crypto.randomUUID(),
                    elements: [
                      {
                        id: crypto.randomUUID(),
                        type: 'text',
                        x: 40,
                        y: 40,
                        width: 880,
                        height: 460,
                        zIndex: 1,
                        content:
                          item.layout === 'title'
                            ? `<h1 style="text-align:center">${item.title}</h1>${item.bulletPoints?.length ? `<p style="text-align:center">${item.bulletPoints.join(' | ')}</p>` : ''}`
                            : `<h2>${item.title}</h2><ul>${(item.bulletPoints || []).map((bp) => `<li>${bp}</li>`).join('')}</ul>`,
                      },
                    ],
                    notes: item.notes || item.speakerNotes || '',
                  }))
                  setPresentation((prev) => ({
                    ...prev,
                    slides: [...(prev.slides || []), ...newSlides],
                  }))
                }
              } catch (err) {
                alert('Failed to generate slides: ' + err.message)
              }
            }}
            onClose={() => setShowAIGenerator(false)}
          />
        )}

        {/* AI Translate Modal */}
        {showAITranslate && (
          <AITranslateModal
            slides={presentation?.slides}
            onApplyTranslations={(translationMap, keepOriginal) => {
              setPresentation((prev) => {
                const newSlides = prev.slides.map((slide, si) => {
                  let updatedSlide = { ...slide }
                  if (slide.elements) {
                    updatedSlide.elements = slide.elements.map((el, ei) => {
                      const key = `${si}-${ei}-content`
                      const t = translationMap[key]
                      if (t) return { ...el, content: t.translatedHtml }
                      return el
                    })
                  }
                  const notesKey = getSlideNotesTranslationKey(si)
                  const notesT = translationMap[notesKey]
                  if (notesT) {
                    updatedSlide = applyTranslatedNotes(
                      updatedSlide,
                      notesT.translatedHtml,
                      keepOriginal
                    )
                  }
                  return updatedSlide
                })
                return { ...prev, slides: newSlides }
              })
            }}
            onClose={() => setShowAITranslate(false)}
          />
        )}

        {/* Live Present Modal */}
        {showLiveModal && liveRoomCode && (
          <LivePresentationModal
            presentationId={presentationId}
            roomCode={liveRoomCode}
            onClose={() => setShowLiveModal(false)}
          />
        )}

        {showTemplateModal && (
          <TemplatePickerModal
            onSelect={(key) => addSlide(key)}
            onClose={() => setShowTemplateModal(false)}
          />
        )}

        {/* Custom CSS Editor Modal */}
        {showCssEditor && (
          <CSSEditorModal
            customCSS={presentation.customCSS}
            onUpdate={(css) => setPresentation((prev) => ({ ...prev, customCSS: css }))}
            onClose={() => setShowCssEditor(false)}
          />
        )}

        {showMediaLibrary && (
          <MediaLibraryModal
            onClose={() => setShowMediaLibrary(false)}
            onInsert={(item) => {
              if (!currentSlide) return
              const base = {
                id: crypto.randomUUID(),
                x: 100,
                y: 100,
                zIndex: (currentSlide.elements || []).length + 1,
              }
              let el = null
              if (item.type === 'image') {
                el = {
                  ...base,
                  type: 'image',
                  width: 400,
                  height: 300,
                  src: item.url,
                  objectFit: 'contain',
                }
              } else if (item.type === 'video') {
                el = {
                  ...base,
                  type: 'video',
                  width: 480,
                  height: 270,
                  src: item.url,
                  controls: true,
                }
              } else if (item.type === 'audio') {
                el = { ...base, type: 'audio', width: 300, height: 60, src: item.url }
              }
              if (el) {
                setPresentation((prev) => ({
                  ...prev,
                  slides: prev.slides.map((s, i) =>
                    i === currentSlideIndex ? { ...s, elements: [...(s.elements || []), el] } : s
                  ),
                }))
              }
            }}
          />
        )}
      </div>

      {/* Image URL Prompt Popover */}
      {showImageUrlPrompt && (
        <PromptPopover
          title="Image URL"
          defaultValue=""
          placeholder="https://..."
          onSubmit={(url) => {
            addImageElement(url)
            setShowImageUrlPrompt(false)
          }}
          onCancel={() => setShowImageUrlPrompt(false)}
          style={imageUrlPromptPopoverStyle}
        />
      )}

      {/* Template Gallery for Inserting Slides */}
      {showTemplateGallery && (
        <TemplateGallery
          onSelectTemplate={setGalleryPreviewTemplate}
          onClose={() => setShowTemplateGallery(false)}
        />
      )}

      {galleryPreviewTemplate && (
        <TemplatePreview
          template={galleryPreviewTemplate}
          onClose={() => setGalleryPreviewTemplate(null)}
          onUseAsNew={(tmpl) => {
            // Replace current presentation slides with template slides
            const newSlides = (tmpl.slides || []).map((s) => ({
              ...s,
              id: crypto.randomUUID(),
              elements: (s.elements || []).map((el) => ({ ...el, id: crypto.randomUUID() })),
            }))
            setPresentation((prev) => ({
              ...prev,
              slides: newSlides,
              theme: tmpl.theme || prev.theme,
              transition: tmpl.transition || prev.transition,
            }))
            setCurrentSlideIndex(0)
            setGalleryPreviewTemplate(null)
            setShowTemplateGallery(false)
          }}
          onInsertSlides={(slidesToInsert, position) => {
            // Re-assign IDs for all slides and elements to avoid duplicates
            const newSlides = slidesToInsert.map((s) => ({
              ...s,
              id: crypto.randomUUID(),
              elements: (s.elements || []).map((el) => ({ ...el, id: crypto.randomUUID() })),
            }))

            setPresentation((prev) => {
              const currentSlides = [...prev.slides]
              let insertIndex
              if (position === 'after') {
                insertIndex = currentSlideIndex + 1
              } else {
                insertIndex = currentSlides.length
              }
              currentSlides.splice(insertIndex, 0, ...newSlides)
              return { ...prev, slides: currentSlides }
            })

            // Close modals
            setGalleryPreviewTemplate(null)
            setShowTemplateGallery(false)
          }}
        />
      )}

      <ProductTour />
    </div>
  )
}
