import GitHubPushModal from './GitHubPushModal'
import SyncModal from './SyncModal'
import HistoryModal from './HistoryModal'
import SlideSorterView from './SlideSorterView'
import HtmlEditorModal from './HtmlEditorModal'
import CodeEditorModal from './CodeEditorModal'
import LatexEditorModal from './LatexEditorModal'
import FindReplaceBar from './FindReplaceBar'
import AnimationTimeline from './AnimationTimeline'
import AnimationPreviewModal from './AnimationPreviewModal'
import TransitionPreview from './TransitionPreview'
import ShareModal from './ShareModal'
import AnalyticsModal from './AnalyticsModal'
import { GameHudOverlay } from './game-hud-overlay'
import { GameLeaderboardOverlay } from './game-leaderboard-overlay'
import EditorModalsSecondary from './editor-modals-secondary'
import { useUIStore } from '../stores/ui-store'

/**
 * Presentational mount point for the editor's modal/overlay JSX, lifted out of
 * EditorPage. Boolean visibility flags are read directly from ui-store; data +
 * behavior arrive via props. The editor BODY (SlidePanel/RibbonPanel/
 * SlideCanvas/PropertiesPanel) intentionally stays inline in EditorPage and is
 * NOT mounted here. All overlays are fixed-position, so mounting them together
 * after the body is behavior-neutral vs the prior interleaved placement.
 */
export default function EditorModals(props) {
  const {
    presentationId,
    presentation,
    currentSlide,
    currentSlideIndex,
    viewMode,
    setViewMode,
    setCurrentSlideIndex,
    setPresentation,
    htmlEditorState,
    setHtmlEditorState,
    commitHtmlEdit,
    codeEditorState,
    setCodeEditorState,
    commitCodeEdit,
    latexEditorState,
    setLatexEditorState,
    commitLatexEdit,
    showFindReplace,
    setShowFindReplace,
    showTimeline,
    setShowTimeline,
    updateElement,
    currentGameType,
    showGameHud,
    setShowGameHud,
    showGameLeaderboard,
    setShowGameLeaderboard,
  } = props

  const showGithubModal = useUIStore((s) => s.showGithubModal)
  const setShowGithubModal = useUIStore((s) => s.setShowGithubModal)
  const showSyncModal = useUIStore((s) => s.showSyncModal)
  const setShowSyncModal = useUIStore((s) => s.setShowSyncModal)
  const showHistoryModal = useUIStore((s) => s.showHistoryModal)
  const setShowHistoryModal = useUIStore((s) => s.setShowHistoryModal)
  const showAnimationPreview = useUIStore((s) => s.showAnimationPreview)
  const setShowAnimationPreview = useUIStore((s) => s.setShowAnimationPreview)
  const showTransitionPreview = useUIStore((s) => s.showTransitionPreview)
  const setShowTransitionPreview = useUIStore((s) => s.setShowTransitionPreview)
  const showShareModal = useUIStore((s) => s.showShareModal)
  const setShowShareModal = useUIStore((s) => s.setShowShareModal)
  const showAnalytics = useUIStore((s) => s.showAnalytics)
  const setShowAnalytics = useUIStore((s) => s.setShowAnalytics)

  return (
    <>
      {showGithubModal && (
        <GitHubPushModal
          presentationId={presentationId}
          presentationTitle={presentation?.title}
          onClose={() => setShowGithubModal(false)}
        />
      )}

      {showSyncModal && (
        <SyncModal presentationId={presentationId} onClose={() => setShowSyncModal(false)} />
      )}

      {showHistoryModal && (
        <HistoryModal
          presentationId={presentationId}
          onRestore={(restored) =>
            setPresentation({ ...restored, slides: (restored.slides || []).map((s) => s) })
          }
          onClose={() => setShowHistoryModal(false)}
        />
      )}

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

      {htmlEditorState && (
        <HtmlEditorModal
          state={htmlEditorState}
          onChange={setHtmlEditorState}
          onApply={commitHtmlEdit}
          onCancel={() => setHtmlEditorState(null)}
        />
      )}

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

      {latexEditorState && (
        <LatexEditorModal
          state={latexEditorState}
          onChange={setLatexEditorState}
          onApply={commitLatexEdit}
          onCancel={() => setLatexEditorState(null)}
        />
      )}

      {showFindReplace && (
        <FindReplaceBar
          presentation={presentation}
          onUpdatePresentation={(updates) => setPresentation((prev) => ({ ...prev, ...updates }))}
          currentSlideIndex={currentSlideIndex}
          onNavigateToSlide={setCurrentSlideIndex}
          onClose={() => setShowFindReplace(false)}
        />
      )}

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

      {showTransitionPreview && (
        <TransitionPreview
          presentation={presentation}
          fromIndex={currentSlideIndex}
          onClose={() => setShowTransitionPreview(false)}
        />
      )}

      {showShareModal && (
        <ShareModal presentationId={presentationId} onClose={() => setShowShareModal(false)} />
      )}

      {showAnalytics && (
        <AnalyticsModal presentationId={presentationId} onClose={() => setShowAnalytics(false)} />
      )}

      {currentGameType && (
        <div
          data-testid="game-active-indicator"
          className="pointer-events-none fixed bottom-3 left-1/2 z-[9000] -translate-x-1/2 rounded-md border border-border bg-panel/90 px-3 py-1 text-xs text-text-secondary shadow-lg"
        >
          Game: {currentGameType}
        </div>
      )}

      <GameHudOverlay
        visible={showGameHud}
        gameType={currentGameType}
        onClose={() => setShowGameHud(false)}
      />

      <GameLeaderboardOverlay
        visible={showGameLeaderboard}
        scores={[]}
        onClose={() => setShowGameLeaderboard(false)}
      />

      <EditorModalsSecondary
        presentationId={presentationId}
        presentation={presentation}
        currentSlide={currentSlide}
        currentSlideIndex={currentSlideIndex}
        selectedElementId={props.selectedElementId}
        commands={props.commands}
        liveRoomCode={props.liveRoomCode}
        livePresenterToken={props.livePresenterToken}
        galleryPreviewTemplate={props.galleryPreviewTemplate}
        setGalleryPreviewTemplate={props.setGalleryPreviewTemplate}
        setPresentation={setPresentation}
        setCurrentSlideIndex={setCurrentSlideIndex}
        updateElement={updateElement}
        addSlide={props.addSlide}
        addImageElement={props.addImageElement}
        insertEmbedHtml={props.insertEmbedHtml}
        handleInsertFromFileBrowser={props.handleInsertFromFileBrowser}
        onInsertMedia={props.onInsertMedia}
        onCreatePresentation={props.onCreatePresentation}
        onAICopywriterApply={props.onAICopywriterApply}
        onApplyTranslations={props.onApplyTranslations}
      />
    </>
  )
}
