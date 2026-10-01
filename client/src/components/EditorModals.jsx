import { useLayoutEffect, useRef } from 'react'
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
import { applySorterSlideOperation, getSorterCurrentDestination } from '../utils/slide-sorter-operations'

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
    verticalEdit,
    viewMode,
    setViewMode,
    setCurrentSlideIndex,
    navigateToSlide,
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
    gameLeaderboardScores = [],
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
  const previousSorterState = useRef({ slides: presentation?.slides, index: currentSlideIndex })
  useLayoutEffect(() => {
    const previous = previousSorterState.current
    const slides = presentation?.slides
    previousSorterState.current = { slides, index: currentSlideIndex }
    if (viewMode !== 'sorter' || !slides?.length || !previous.slides || previous.slides === slides) return
    const destination = getSorterCurrentDestination(previous.slides, previous.index, slides, verticalEdit)
    if (destination.index !== currentSlideIndex || destination.identityChanged) {
      navigateToSlide(destination.index, destination.child)
    }
  }, [presentation?.slides, currentSlideIndex, verticalEdit, viewMode, navigateToSlide])

  const changeSorterSlide = (operation, index, toIndex) => {
    const slideId = presentation.slides[index]?.id
    if (!slideId) return
    setPresentation((prev) => {
      const slides = applySorterSlideOperation(prev.slides, operation, slideId, toIndex)
      return slides === prev.slides ? prev : { ...prev, slides }
    })
  }

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
          designTokens={presentation.designTokens}
          layoutMasters={presentation.layoutMasters}
          resolution={presentation.resolution}
          currentIndex={currentSlideIndex}
          onSelect={(idx) => {
            navigateToSlide(idx)
            setViewMode('normal')
          }}
          onMove={(fromIdx, toIdx) => changeSorterSlide('move', fromIdx, toIdx)}
          onDelete={(idx) => changeSorterSlide('delete', idx)}
          onDuplicate={(idx) => changeSorterSlide('duplicate', idx)}
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
          onNavigateToSlide={navigateToSlide}
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
          presentation={{ ...presentation, slides: [currentSlide] }}
          slideIndex={0}
          slideLabel={currentSlide.id?.startsWith('master:') ? 'Master' : `${currentSlideIndex + 1}${verticalEdit ? `.${verticalEdit.child + 1}` : ''}`}
          onClose={() => setShowAnimationPreview(false)}
        />
      )}

      {showTransitionPreview && (
        <TransitionPreview
          presentation={presentation}
          fromIndex={currentSlideIndex}
          verticalEdit={verticalEdit}
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
        scores={gameLeaderboardScores}
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
        liveRemoteToken={props.liveRemoteToken}
        liveSpeakerToken={props.liveSpeakerToken}
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
