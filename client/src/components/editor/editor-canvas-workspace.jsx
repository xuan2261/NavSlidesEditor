import { resolveEffectiveSlide } from 'revealjs-shared'
import SlideCanvas from '../SlideCanvas'
import { api } from '../../utils/api'
import { showError } from '../../utils/app-feedback'
import { useEditorStore } from '../../stores/editor-store'

export default function EditorCanvasWorkspace({ overlayOpen, c }) {
  const smartGuidesEnabled = useEditorStore((state) => state.smartGuidesEnabled)
  const showRulers = useEditorStore((state) => state.showRulers)
  const guides = useEditorStore((state) => state.guides)
  const setGuides = useEditorStore((state) => state.setGuides)
  const ownerSlide = c.masterEdit
    ? { id: `master:${c.masterEdit.id}`, elements: c.masterEdit.fixedElements, background: c.masterEdit.background }
    : c.activeSlide
  const slide = c.masterEdit
    ? ownerSlide
    : resolveEffectiveSlide(ownerSlide, c.presentation.layoutMasters).slide
  return (
    <div
      inert={overlayOpen ? '' : undefined}
      className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-workspace"
    >
      <div className="flex-1 flex flex-col relative overflow-hidden">
      {c.masterEdit && <div className="flex items-center justify-between border-b border-accent bg-primary-light px-3 py-1 text-xs text-text-primary"><span>Editing master: {c.masterEdit.name}</span><button type="button" className="underline" onClick={c.onExitMasterEdit}>Exit master edit</button></div>}
        <SlideCanvas
          editor={c.editor}
          designTokens={c.presentation.designTokens}
          slide={slide}
          selectedElementIds={c.selectedElementIds}
          editingElementId={c.editingElementId}
          showGrid={c.showGrid}
          gridSize={c.gridSize}
          resolution={c.presentation.resolution}
          showFooter={c.presentation.showFooter || false}
          showPageNumbers={c.presentation.showPageNumbers || false}
          pageNumberFormat={c.presentation.pageNumberFormat || 'c/t'}
          pageNumber={c.pageNumber}
          totalSlides={c.presentation.slides.filter((s) => s.showPageNumber !== false).length}
          sectionName={c.currentSlide?.section || ''}
          footerFontSize={c.presentation.footerFontSize || 14}
          footerFontFamily={c.presentation.footerFontFamily || '-apple-system,sans-serif'}
          footerColor={c.presentation.footerColor || 'rgba(255,255,255,0.65)'}
          footerInactiveColor={c.presentation.footerInactiveColor || 'rgba(255,255,255,0.25)'}
          footerMode={c.presentation.footerMode || 'basic'}
          sequenceSections={c.presentation.sequenceSections || []}
          activeSection={c.currentSlide?.activeSection ?? null}
          smartGuidesEnabled={smartGuidesEnabled}
          showRulers={showRulers}
          persistentGuides={guides}
          onAddGuide={(guide) => setGuides((previous) => [...previous, guide])}
          onRemoveGuide={(index) => setGuides((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}
          onToggleSelectElement={c.toggleElementSelection}
          onStartEdit={c.startEditingElement}
          onStopEdit={c.stopEditingElement}
          onUpdateElement={c.updateElement}
          onUpdateElements={c.updateElements}
          onDeleteElement={c.deleteElement}
          onDeleteSelectedElements={c.deleteSelectedElements}
          onCopy={c.handleCopy}
          onCut={c.handleCut}
          onPaste={c.handlePaste}
          onDuplicate={c.handleDuplicate}
          onBlockedAction={c.notifyBlockedAction}
          safeArea={c.masterEdit?.safeArea}
          onOpenHtmlEditor={c.openHtmlEditor}
          onOpenCodeEditor={c.openCodeEditor}
          onOpenLatexEditor={c.openLatexEditor}
          masterEdit={Boolean(c.masterEdit)}
          onAddMedia={async (file, dropX, dropY, targetSlideId) => {
            const targetId = targetSlideId ?? c.authoringSlideRef?.current?.id ?? c.activeSlideRef?.current?.id
            try {
              const result = await api.uploadFile(file)
              if (!result?.url) throw new Error(result?.error || 'Upload failed')
              const currentSlideId = c.authoringSlideRef?.current?.id ?? c.activeSlideRef?.current?.id
              if (targetId && targetId !== currentSlideId) {
                throw new Error('Upload canceled because the active slide changed')
              }
              if (file.type.startsWith('video/')) c.addVideoElement(result.url, dropX, dropY)
              else if (file.type.startsWith('audio/')) c.addAudioElement(result.url, dropX, dropY)
              else c.addImageElement(result.url, dropX, dropY)
            } catch (err) {
              console.error('Canvas upload failed:', err)
              showError(err.message || 'Upload failed. Check your connection.')
            }
          }}
        />
      </div>
    </div>
  )
}
