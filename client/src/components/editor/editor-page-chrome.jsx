import RibbonHeaderBar from '../ribbon/ribbon-header-bar'
import QuickAccessToolbar from '../QuickAccessToolbar'
import EditorModals from '../EditorModals'
import ProductTour from '../ProductTour'
import PptxImportReportPanel from '../pptx-import-report-panel'
import EditorHeader from './editor-header'
import SaveConflictDialog from './save-conflict-dialog'
import SaveRecoveryDialog from './save-recovery-dialog'
import { presentInWindow } from '../../utils/generateHTML'
import { showError, showNotice } from '../../utils/app-feedback'

export function EditorPageHeader({ c }) {
  return (
    <>
      <EditorHeader
        isTemplate={c.isTemplate}
        title={c.presentation.title || ''}
        onTitleChange={(e) => c.setPresentation((prev) => ({ ...prev, title: e.target.value }))}
        onGoHome={c.onGoHome}
        quickAccessToolbar={
          <QuickAccessToolbar
            onSave={c.handleManualSave}
            onRetry={c.retryPendingSave}
            retryAvailable={!c.saveConflict}
            saving={c.saving}
            hasChanges={c.hasChanges}
            saveStatus={c.saveStatus}
            saveError={c.lastSaveError}
            onUndo={c.handleUndo}
            onRedo={c.handleRedo}
          />
        }
        ribbonHeader={
          <RibbonHeaderBar
            onSave={c.handleManualSave}
            onExportPDF={c.onExportPDF}
            onExportPPTX={c.onExportPPTX}
            onExportHTML={c.onExportHTML}
            onExportOffline={c.onExportOffline}
            onExportProject={c.onExportProject}
            onOpenProject={c.onOpenProject}
            onGithub={() => c.setShowGithubModal(true)}
            onSync={() => c.setShowSyncModal(true)}
            onHistory={() => c.setShowHistoryModal(true)}
            onShare={() => c.setShowShareModal(true)}
            onLive={async () => {
              try {
                const response = await fetch('/api/live/room', { method: 'POST' })
                if (!response.ok) throw new Error('Live room creation failed')
                const data = await response.json()
                if (!data?.roomCode || !data?.presenterToken) throw new Error('Invalid response')
                c.setLiveRoomCode(data.roomCode)
                c.setLivePresenterToken(data.presenterToken)
                c.setShowLiveModal(true)
              } catch {
                showError('Failed to create live room')
              }
            }}
            onAnalytics={() => c.setShowAnalytics(true)}
            onAICopywriter={() => {
              if (c.selectedElement?.type === 'text' && c.selectedElement.content) {
                c.setShowAICopywriter(true)
              } else showNotice('Select a text element first')
            }}
            onAIGenerator={() => c.setShowAIGenerator(true)}
            onAITranslate={() => c.setShowAITranslate(true)}
            onPresent={() => presentInWindow(c.presentation)}
            pptxFidelity={c.pptxFidelity}
            pptxBusy={c.pptxFidelityLoading}
            onReloadPptxFidelity={c.reloadPptxFidelity}
            pptxActions={{
              downloadOriginal: c.onDownloadPptxOriginal,
              exportValidatedRevision: c.onExportValidatedEditedRevision,
              generateReconstructed: c.onGenerateReconstructedPPTX,
            }}
          />
        }
      />
      {c.presentation?._pptxImportReport || c.presentation?.pptxSourceAvailable ? (
        <PptxImportReportPanel
          presentation={c.presentation}
          className="max-h-32 shrink-0 overflow-auto border-b border-border bg-card px-4 py-2"
        />
      ) : null}
    </>
  )
}

export function EditorPageOverlays({ c }) {
  return (
    <>
      <EditorModals
        presentationId={c.presentationId}
        presentation={c.presentation}
        currentSlide={c.currentSlide}
        currentSlideIndex={c.currentSlideIndex}
        viewMode={c.viewMode}
        setViewMode={c.setViewMode}
        setCurrentSlideIndex={c.setCurrentSlideIndex}
        setPresentation={c.setPresentation}
        htmlEditorState={c.htmlEditorState}
        setHtmlEditorState={c.setHtmlEditorState}
        commitHtmlEdit={c.commitHtmlEdit}
        codeEditorState={c.codeEditorState}
        setCodeEditorState={c.setCodeEditorState}
        commitCodeEdit={c.commitCodeEdit}
        latexEditorState={c.latexEditorState}
        setLatexEditorState={c.setLatexEditorState}
        commitLatexEdit={c.commitLatexEdit}
        showFindReplace={c.showFindReplace}
        setShowFindReplace={c.setShowFindReplace}
        showTimeline={c.showTimeline}
        setShowTimeline={c.setShowTimeline}
        updateElement={c.updateElement}
        currentGameType={c.currentGameType}
        showGameHud={c.showGameHud}
        setShowGameHud={c.setShowGameHud}
        showGameLeaderboard={c.showGameLeaderboard}
        setShowGameLeaderboard={c.setShowGameLeaderboard}
        selectedElementId={c.selectedElementId}
        commands={c.commands}
        liveRoomCode={c.liveRoomCode}
        livePresenterToken={c.livePresenterToken}
        galleryPreviewTemplate={c.galleryPreviewTemplate}
        setGalleryPreviewTemplate={c.setGalleryPreviewTemplate}
        addSlide={c.addSlide}
        addImageElement={c.addImageElement}
        insertEmbedHtml={c.insertEmbedHtml}
        handleInsertFromFileBrowser={c.handleInsertFromFileBrowser}
        onCreatePresentation={c.onCreatePresentation}
        onAICopywriterApply={c.onAICopywriterApply}
        onApplyTranslations={c.onApplyTranslations}
        onInsertMedia={c.insertMediaElement}
      />
      <SaveConflictDialog
        conflict={c.saveConflict}
        onClose={c.clearSaveConflict}
        onUseRemote={c.useRemoteSaveConflict}
        onKeepLocal={c.keepLocalSaveConflict}
      />
      <SaveRecoveryDialog
        draft={c.saveRecovery}
        onUseLocal={c.recoverLocalDraft}
        onUseRemote={c.dismissSaveRecovery}
        onDefer={c.deferSaveRecovery}
      />
      <ProductTour />
    </>
  )
}
