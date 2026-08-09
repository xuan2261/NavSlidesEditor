import { useState, useEffect, useRef, useCallback, useContext } from 'react'
import { useEditorStore } from '../stores/editor-store'
import { useSlideOperations } from '../hooks/use-slide-operations'
import { createExitEditOnEscape } from '../hooks/tiptap-exit-edit-on-escape'
import { useClipboard, createDuplicateOperation } from '../hooks/use-clipboard'
import { useElementCreation } from '../hooks/use-element-creation'
import { api } from '../utils/api'
import { presentInWindow } from '../utils/generateHTML'
import { useExportActions } from '../hooks/use-export-actions'
import { usePptxFidelity } from '../hooks/use-pptx-fidelity'
import { useAiActions } from '../hooks/use-ai-actions'
import { resolveLegacyEditorShortcut } from '../utils/legacy-editor-keydown-resolver'
import { showNotice } from '../utils/app-feedback'
import { getSelectionIdsForActiveSlideElement } from '../utils/active-slide-selection'
import { getBlockedActionNotice } from '../utils/blocked-action-notice'
import { useUIStore } from '../stores/ui-store'
import { Button } from '../components/ui'
import { LiveSocketContext } from '../contexts/live-socket-context-provider.jsx'
import EditorShell from '../components/editor/editor-shell'
import EditorWorkspace from '../components/editor/editor-workspace'
import { EditorPageHeader, EditorPageOverlays } from '../components/editor/editor-page-chrome'
import { useEditorActiveSlideController } from '../hooks/editor-controller/use-editor-active-slide-controller'
import { useEditorRichTextController } from '../hooks/editor-controller/use-editor-rich-text-controller'
import { useEditorInteractionReset } from '../hooks/editor-controller/use-editor-interaction-reset'
import { useEditorCommandModel } from '../hooks/editor-controller/use-editor-command-model'
import { useEditorHistoryController } from '../hooks/editor-controller/use-editor-history-controller'
import { useEditorPersistenceController } from '../hooks/editor-controller/use-editor-persistence-controller'
import { useEditorKeyboardController } from '../hooks/editor-controller/use-editor-keyboard-controller'
import { useEditorElementController } from '../hooks/editor-controller/use-editor-element-controller'
import { useEditorSelectionController } from '../hooks/editor-controller/use-editor-selection-controller'
import { useEditorPreviewStylesController } from '../hooks/editor-controller/use-editor-preview-styles-controller'
import { useEditorGameLeaderboard } from '../hooks/use-editor-game-leaderboard'
import { useEditorLiveSessionController } from '../hooks/editor-controller/use-editor-live-session-controller'
import { getElementForActiveSlideEdit, getGameElementForActiveSlide } from './editor-page-helpers'

export { getSelectionIdsForActiveSlideElement }
export { getElementForActiveSlideEdit, getGameElementForActiveSlide } from './editor-page-helpers'

export default function EditorPage({ presentationId, isTemplate = false, onGoHome }) {
  const [presentation, setPresentation] = useState(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [verticalEdit, setVerticalEdit] = useState(null)

  const liveSocket = useContext(LiveSocketContext)

  const selectedElementIds = useEditorStore((s) => s.selectedElementIds)
  const setSelectedElementIds = useEditorStore((s) => s.setSelectedElementIds)
  const editingElementId = useEditorStore((s) => s.editingElementId)
  const setEditingElementId = useEditorStore((s) => s.setEditingElementId)
  const clipboard = useEditorStore((s) => s.clipboard)
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
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen)
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen)
  const showDesignIdeas = useUIStore((s) => s.showDesignIdeas)
  const setShowDesignIdeas = useUIStore((s) => s.setShowDesignIdeas)
  const [workspaceWidth, setWorkspaceWidth] = useState(1440)
  const [activeWorkspaceOverlay, setActiveWorkspaceOverlay] = useState(null)
  const workspaceRef = useRef(null)
  const setRightPanelOpen = useUIStore((s) => s.setRightPanelOpen)
  const setActiveTab = useUIStore((s) => s.setActiveTab)
  const setFormatContext = useUIStore((s) => s.setFormatContext)
  const setSlidePosition = useUIStore((s) => s.setSlidePosition)
  const setPresentHandler = useUIStore((s) => s.setPresentHandler)
  const zoomIn = useUIStore((s) => s.zoomIn)
  const zoomOut = useUIStore((s) => s.zoomOut)
  const fitZoom = useUIStore((s) => s.fitZoom)

  const selectedElementId = selectedElementIds[selectedElementIds.length - 1] ?? null

  const [htmlEditorState, setHtmlEditorState] = useState(null) // { elementId, content }
  const [codeEditorState, setCodeEditorState] = useState(null) // { elementId, content, language }
  const [latexEditorState, setLatexEditorState] = useState(null) // { elementId, content }
  const [galleryPreviewTemplate, setGalleryPreviewTemplate] = useState(null)
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [shareStatus, setShareStatus] = useState({ shared: false, token: null })
  const setShowTemplateModal = useUIStore((s) => s.setShowTemplateModal)
  const setShowTemplateGallery = useUIStore((s) => s.setShowTemplateGallery)
  const setShowMediaLibrary = useUIStore((s) => s.setShowMediaLibrary)
  const setShowGithubModal = useUIStore((s) => s.setShowGithubModal)
  const setShowAnimationPreview = useUIStore((s) => s.setShowAnimationPreview)
  const setShowTransitionPreview = useUIStore((s) => s.setShowTransitionPreview)
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

  const [showGameHud, setShowGameHud] = useState(false)
  const [showGameLeaderboard, setShowGameLeaderboard] = useState(false)

  const editingElementIdRef = useRef(null)
  const selectedElementIdsRef = useRef([])

  // eslint-disable-next-line react-hooks/refs
  const exitEditOnEscape = createExitEditOnEscape({
    editingElementIdRef,
    setEditingElementId,
  })

  useEffect(() => {
    selectedElementIdsRef.current = selectedElementIds
  }, [selectedElementIds])

  useEffect(() => {
    if (presentationId) {
      api
        .getShareStatus(presentationId)
        .then(setShareStatus)
        .catch(() => {})
    }
  }, [presentationId])

  const currentSlide = presentation?.slides[currentSlideIndex]

  const {
    activeSlide,
    activeSlideRef,
    currentSlideIndexRef,
    currentVerticalIndex,
    mapActive,
    verticalEditRef,
  } = useEditorActiveSlideController({
    presentation,
    currentSlideIndex,
    verticalEdit,
    setVerticalEdit,
  })

  const {
    editor,
    settingContent,
    clearContent: clearRichTextContent,
    startEditingElement,
    stopEditingElement,
  } = useEditorRichTextController({
    presentation,
    setPresentation,
    mapActive,
    activeSlideRef,
    currentSlideIndexRef,
    editingElementId,
    editingElementIdRef,
    setEditingElementId,
    setSelectedElementIds,
    setActiveTab,
    getElement: getElementForActiveSlideEdit,
    exitEditOnEscape,
  })
  const insertLink = useCallback(() => {
    if (!editingElementId || !editor) return showNotice('Enter text edit mode and select a text element before inserting a link.')
    const href = window.prompt('Link URL')?.trim()
    if (href) editor.chain().focus().setLink({ href }).run()
  }, [editor, editingElementId])

  const resetEditorInteraction = useEditorInteractionReset({
    clearRichTextContent, editingElementIdRef, setActiveWorkspaceOverlay, setCodeEditorState,
    setCurrentSlideIndex, setEditingElementId, setHtmlEditorState, setLatexEditorState,
    setSelectedElementIds, setVerticalEdit,
  })
  const { handleRedo, handleUndo, hasChanges, seedHistory } = useEditorHistoryController({
    presentation,
    setPresentation,
    setCurrentSlideIndex,
    setVerticalEdit,
    currentSlideIndexRef,
    verticalEditRef,
    selectedElementIdsRef,
    editingElementIdRef,
    setSelectedElementIds,
    setEditingElementId,
    editor,
    settingContent,
  })
  const {
    adoptGeneration,
    beginExport, clearSaveConflict, deferSaveRecovery, dismissSaveRecovery, endExport, firstLoadRef,
    flushPendingSave, handleManualSave, keepLocalSaveConflict, recoverLocalDraft,
    lastSaveError, loading,
    retryPendingSave,
    saveConflict,
    saveRecovery,
    saveStatus,
    saving,
    useRemoteSaveConflict,
  } = useEditorPersistenceController({
    presentation,
    setPresentation,
    presentationId,
    isTemplate,
    setGridSize,
    seedHistory,
    resetEditorInteraction,
  })

  useEffect(() => {
    const node = workspaceRef.current
    if (!node || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => setWorkspaceWidth(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [loading])

  // When presentation first loads, clear editor content
  useEffect(() => {
    if (editor && presentation && firstLoadRef.current) {
      clearRichTextContent()
      firstLoadRef.current = false
    }
  }, [editor, presentation, clearRichTextContent, firstLoadRef])

  // When currentSlideIndex changes, reset selection, editing, and any active
  // vertical-child edit (you've navigated to a different parent slide).
  useEffect(() => {
    setSelectedElementIds([])
    setEditingElementId(null)
    editingElementIdRef.current = null
    setVerticalEdit(null)
    clearRichTextContent()
  }, [currentSlideIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const { updateCurrentSlide, updateElement, deleteElement } = useEditorElementController({
    setPresentation, mapActive, activeSlide, setSelectedElementIds, editingElementId,
    setEditingElementId, editingElementIdRef,
  })
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
    addMermaidElement,
    addStemSimulationElement,
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
    addTechnicalSymbolElement,
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

  const {
    updateElements,
    replaceElementZOrder,
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

  const notifyBlockedAction = useCallback((reason) => {
    showNotice(getBlockedActionNotice(reason), {
      title: 'Selection locked', testId: 'editor-blocked-action-notice',
    })
  }, [])

  const { stepSelectedZOrder, moveSelectedToStackEdge, updateSelectedElements,
    toggleElementSelection } = useEditorSelectionController({
    selectedElementIdsRef, activeSlideRef, replaceElementZOrder, notifyBlockedAction,
    updateElement, updateElements, setSelectedElementIds, presentation, currentSlideIndexRef,
  })
  // Standalone document keydown listener for editor responsibilities the
  // shortcut registry does not model. The registry (useKeyboard) owns
  // find/replace and the chorded commands; this listener must not double-handle
  // them. Currently only the slide-sorter toggle lives here.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (editingElementId || saveConflict || saveRecovery) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (resolveLegacyEditorShortcut(e) === 'toggle-sorter') {
        setViewMode((v) => (v === 'sorter' ? 'normal' : 'sorter'))
        e.preventDefault()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [editingElementId, saveConflict, saveRecovery, setViewMode])

  useEditorPreviewStylesController({
    codeTheme: presentation?.codeTheme, customCSS: presentation?.customCSS,
  })
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
    if (activeSlide?.locked) return
    performPaste(clipboard)
  }, [activeSlide, clipboard, performPaste])

  const handleCut = useCallback(() => {
    if (activeSlide?.locked) return
    performCut(activeSlide?.elements, selectedElementIds)
  }, [activeSlide, selectedElementIds, performCut])

  const handleDuplicate = useCallback(() => {
    if (activeSlide?.locked) return
    // Use createDuplicateOperation directly — reads current selection from store,
    // matching the original SlideCanvas behavior (no clipboard required).
    // Duplicate intentionally leaves the copy/cut clipboard untouched so a prior
    // Ctrl+C survives a Ctrl+D and the next paste still pastes the copied element.
    const { selectedElementIds: liveSelectedIds } = useEditorStore.getState()
    const slideEls = activeSlide?.elements || []
    const { toAdd } = createDuplicateOperation({
      slideElements: slideEls,
      selectedElementIds: liveSelectedIds,
    })
    if (!toAdd.length) return
    setPresentation((prev) =>
      mapActive(prev, (s) => ({ ...s, elements: [...(s.elements || []), ...toAdd] }))
    )
    // Move selection onto the new copies (matches PowerPoint/Keynote) so the
    // next nudge/format acts on the duplicates, not the originals.
    setSelectedElementIds(toAdd.map((el) => el.id))
  }, [activeSlide, setPresentation, mapActive, setSelectedElementIds])

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
        el = {
          ...base,
          type: 'image',
          width: 400,
          height: 300,
          src: item.url,
          objectFit: 'contain',
        }
      } else if (item.type === 'video') {
        el = { ...base, type: 'video', width: 480, height: 270, src: item.url, controls: true }
      } else if (item.type === 'audio') {
        el = { ...base, type: 'audio', width: 300, height: 60, src: item.url }
      }
      if (!el) return
      setPresentation((prev) =>
        mapActive(prev, (s) => ({ ...s, elements: [...(s.elements || []), el] }))
      )
    },
    [activeSlide, setPresentation, mapActive]
  )

  const commands = useEditorCommandModel({
    openTemplateModal: () => setShowTemplateModal(true),
    closeCommandPalette: () => setShowCommandPalette(false),
    groupElements,
    ungroupElements,
    save: handleManualSave,
    insertLink,
    zoomIn,
    zoomOut,
    fitZoom,
    startSlideshow,
  })
  // Detect active game type from the actual editable slide, including vertical children.
  const activeGameElement = getGameElementForActiveSlide(
    activeSlide,
    presentation?.slides?.[currentSlideIndex],
    selectedElementId
  )
  const currentGameType = activeGameElement?.gameType || null
  const {
    currentLiveRoomCode,
    currentLivePresenterToken,
    emitGameShortcutAction,
    handlePresenterWindowOpened,
    handleStartLive,
    isPresenterPopupActive,
  } = useEditorLiveSessionController({
    presentationId,
    setShowLiveModal,
    activeGameElement,
    currentGameType,
  })
  const gameLeaderboardScores = useEditorGameLeaderboard(activeGameElement)
  // Export/import + AI action handlers (extracted to hooks)
  const {
    onExportPDF,
    onExportPPTX,
    onExportHTML,
    onExportOffline,
    onExportProject,
    onOpenProject,
    onDownloadPptxOriginal,
    onExportValidatedEditedRevision,
    onGenerateReconstructedPPTX,
  } = useExportActions(presentation, { beginExport, endExport, flushPendingSave, onAggregateGeneration: adoptGeneration })
  const {
    contract: pptxFidelity,
    loading: pptxFidelityLoading,
    reload: reloadPptxFidelity,
  } = usePptxFidelity(presentation)
  const { onCreatePresentation, onAICopywriterApply, onApplyTranslations } = useAiActions({
    presentation,
    setPresentation,
    updateElement,
    selectedElementId,
  })

  useEditorKeyboardController({
    disabled: loading || Boolean(saveConflict) || Boolean(saveRecovery),
    handleManualSave, handleCopy, handleCut, handlePaste, handleDuplicate, handleUndo, handleRedo,
    deleteSelectedElements, handleSelectAll, setShowFindReplace, showCommandPalette,
    setShowCommandPalette, showGameHud, setShowGameHud, showGameLeaderboard,
    setShowGameLeaderboard, setSelectedElementIds, setEditingElementId, selectedElementIdsRef,
    activeSlideRef, notifyBlockedAction, presentation, updateElements, setCurrentSlideIndex,
    editingElementId, currentGameType, isPresenterPopupActive, startSlideshow, activeGameElement, liveSocket,
    emitGameShortcutAction, setShowTemplateModal, groupElements, ungroupElements,
    selectedElementIds, stepSelectedZOrder, fitZoom, zoomIn, zoomOut,
  })
  if (loading) {
    return <div className="flex h-full items-center justify-center text-text-muted">Loading...</div>
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

  const workspaceTier =
    workspaceWidth >= 1280 ? 'wide' : workspaceWidth >= 1024 ? 'standard' : 'compact'
  const navigatorDocked = leftPanelOpen && workspaceTier !== 'compact'
  const inspectorRequested = rightPanelOpen || showDesignIdeas
  const inspectorDocked = inspectorRequested && workspaceTier === 'wide'
  const compactOverlay =
    workspaceTier === 'wide' ? null : activeWorkspaceOverlay

  return (
    <EditorShell
      smallScreenGuard={
        <div
          data-testid="editor-small-screen-guard"
          className="flex h-full flex-col items-center justify-center gap-3 bg-workspace px-6 text-center md:hidden"
        >
          <div className="text-base font-semibold text-text-primary">
            Tablet or desktop required
          </div>
          <p className="max-w-[320px] text-sm leading-6 text-text-secondary">
            Full slide editing needs a wider workspace. Use a tablet, desktop, or larger browser
            window.
          </p>
          <Button variant="secondary" onClick={onGoHome}>
            Back to presentations
          </Button>
        </div>
      }
    >
      <EditorPageHeader c={{
        isTemplate, presentation, setPresentation, onGoHome, handleManualSave, retryPendingSave,
        saveConflict, saving, hasChanges, saveStatus, lastSaveError, handleUndo, handleRedo,
        onExportPDF, onExportPPTX, onExportHTML, onExportOffline, onExportProject, onOpenProject,
        setShowGithubModal, setShowSyncModal, setShowHistoryModal, setShowShareModal,
        handleStartLive, setShowAnalytics,
        selectedElement, setShowAICopywriter, setShowAIGenerator, setShowAITranslate,
        pptxFidelity, pptxFidelityLoading, reloadPptxFidelity, onDownloadPptxOriginal,
        onExportValidatedEditedRevision, onGenerateReconstructedPPTX,
      }} />
      <EditorWorkspace
        workspaceRef={workspaceRef}
        workspaceTier={workspaceTier}
        leftPanelOpen={leftPanelOpen}
        inspectorRequested={inspectorRequested}
        navigatorDocked={navigatorDocked}
        inspectorDocked={inspectorDocked}
        compactOverlay={compactOverlay}
        setActiveWorkspaceOverlay={setActiveWorkspaceOverlay}
        c={{
          presentation, setPresentation, currentSlide, currentSlideIndex, setCurrentSlideIndex,
          verticalEdit, setVerticalEdit, currentVerticalIndex, activeSlide, activeSlideRef,
          editingElementId, setEditingElementId,
          clearEditingElementRef: () => { editingElementIdRef.current = null },
          selectedElement,
          selectedElementId, selectedElementIds, setSelectedElementIds, editor, mapActive,
          isTemplate, showDesignIdeas, setShowDesignIdeas, setRightPanelOpen, setShowTemplateModal,
          setShowTemplateGallery, deleteSlide, duplicateSlide, deleteSlides, duplicateSlides,
          moveSlide, addChildSlide, updateCurrentSlide, updateElement, updateElements,
          updateSelectedElements, deleteElement, deleteSelectedElements, replaceElementZOrder,
          toggleElementSelection, stepSelectedZOrder, moveSelectedToStackEdge, groupElements,
          ungroupElements, alignElements, handlePaste, handleCut, handleCopy, handleDuplicate,
          notifyBlockedAction, startEditingElement, stopEditingElement, showGrid, gridSize,
          smartGuidesEnabled, showRulers, guides, setGuides, viewMode, setViewMode,
          setShowFindReplace, setShowImageUrlPrompt, setShowMediaLibrary, setShowFileBrowser,
          setShowKineticTextModal, setShowMathGridModal, setShowAnimeModal, setShowThreeModal,
          setShowCssEditor, setShowAnimationPreview, setShowTransitionPreview, pluginTypes, addTextElement, addImageElement,
          addQrCodeElement, addTimelineElement, addDividerElement, addGameElement, addPluginElement,
          addHtmlElement, addMermaidElement, addStemSimulationElement, addCodeElement,
          addLatexElement, addMarkdownElement, addChartElement, addCalloutElement, addIconElement,
          addShapeElement, addVideoElement, addAudioElement, addTableElement, addDrawingElement,
          addLineElement, addSvgElement, addTechnicalSymbolElement, openHtmlEditor,
          openCodeEditor, openLatexEditor, pageNumber: (() => {
            if (!presentation.showPageNumbers || currentSlide?.showPageNumber === false) return null
            return presentation.slides.slice(0, currentSlideIndex + 1)
              .filter((slide) => slide.showPageNumber !== false).length
          })(),
        }}
      />
      <EditorPageOverlays c={{
        presentationId, presentation, currentSlide, currentSlideIndex, verticalEdit, viewMode, setViewMode,
        setCurrentSlideIndex, setPresentation, htmlEditorState, setHtmlEditorState, commitHtmlEdit,
        codeEditorState, setCodeEditorState, commitCodeEdit, latexEditorState, setLatexEditorState,
        commitLatexEdit, showFindReplace, setShowFindReplace, showTimeline, setShowTimeline,
        updateElement, currentGameType, showGameHud, setShowGameHud, showGameLeaderboard,
        setShowGameLeaderboard, gameLeaderboardScores, selectedElementId, commands,
        liveRoomCode: currentLiveRoomCode, livePresenterToken: currentLivePresenterToken,
        onPresenterWindowOpened: handlePresenterWindowOpened, galleryPreviewTemplate, setGalleryPreviewTemplate, addSlide, addImageElement,
        insertEmbedHtml, handleInsertFromFileBrowser, onCreatePresentation, onAICopywriterApply,
        onApplyTranslations, insertMediaElement, saveConflict, clearSaveConflict,
        useRemoteSaveConflict, keepLocalSaveConflict, saveRecovery, recoverLocalDraft,
        deferSaveRecovery, dismissSaveRecovery,
      }} />    </EditorShell>
  )
}
