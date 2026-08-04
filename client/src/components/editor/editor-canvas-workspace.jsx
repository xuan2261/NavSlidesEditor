import SlideCanvas from '../SlideCanvas'
import { api } from '../../utils/api'
import { showError } from '../../utils/app-feedback'

export default function EditorCanvasWorkspace({ overlayOpen, c }) {
  return (
    <div
      inert={overlayOpen ? '' : undefined}
      className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-workspace"
    >
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <SlideCanvas
          editor={c.editor}
          slide={c.activeSlide}
          designTokens={c.presentation.designTokens}
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
          smartGuidesEnabled={c.smartGuidesEnabled}
          showRulers={c.showRulers}
          persistentGuides={c.guides}
          onAddGuide={(guide) => c.setGuides((prev) => [...prev, guide])}
          onRemoveGuide={(idx) => c.setGuides((prev) => prev.filter((_, i) => i !== idx))}
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
          onOpenHtmlEditor={c.openHtmlEditor}
          onOpenCodeEditor={c.openCodeEditor}
          onOpenLatexEditor={c.openLatexEditor}
          onAddMedia={async (file, dropX, dropY, targetSlideId) => {
            const targetId = targetSlideId ?? c.activeSlideRef?.current?.id ?? c.activeSlide?.id
            try {
              const result = await api.uploadFile(file)
              if (!result?.url) throw new Error(result?.error || 'Upload failed')
              const currentSlideId = c.activeSlideRef?.current?.id ?? c.activeSlide?.id
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
