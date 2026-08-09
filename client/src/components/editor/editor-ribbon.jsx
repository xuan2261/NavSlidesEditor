import RibbonPanel from '../ribbon/ribbon-panel'
import { api } from '../../utils/api'

export default function EditorRibbon({ c }) {
  const assertUploadTarget = (targetSlideId) => {
    const currentSlideId = c.activeSlideRef?.current?.id ?? c.activeSlide?.id
    if (targetSlideId && targetSlideId !== currentSlideId) {
      throw new Error('Upload canceled because the active slide changed')
    }
  }

  return (
    <RibbonPanel
      editor={c.editingElementId ? c.editor : null}
      presentation={c.presentation}
      activeSlideId={c.activeSlide?.id}
      slide={c.activeSlide}
      onUpdateSlide={c.updateCurrentSlide}
      onUpdatePresentation={(updates) =>
        c.setPresentation((prev) =>
          typeof updates === 'function' ? updates(prev) : { ...prev, ...updates }
        )
      }
      selectedElement={c.selectedElement}
      selectedElementIds={c.selectedElementIds}
      elements={c.activeSlide?.elements || []}
      onUpdateElement={c.updateSelectedElements}
      onPaste={c.handlePaste}
      onCut={c.handleCut}
      onCopy={c.handleCopy}
      onDuplicate={c.handleDuplicate}
      selectedCount={c.selectedElementIds.length}
      onGroup={c.groupElements}
      onUngroup={c.ungroupElements}
      onAlignElements={c.alignElements}
      onBringForward={() => c.stepSelectedZOrder('forward')}
      onSendBackward={() => c.stepSelectedZOrder('backward')}
      onBringToFront={() => c.moveSelectedToStackEdge('front')}
      onSendToBack={() => c.moveSelectedToStackEdge('back')}
      onAddText={c.addTextElement}
      onAddImage={() => c.setShowImageUrlPrompt(true)}
      onAddImageUpload={async (file, targetSlideId) => {
        const result = await api.uploadFile(file)
        if (!result?.url) throw new Error(result?.error || 'Upload failed')
        assertUploadTarget(targetSlideId)
        c.addImageElement(result.url)
      }}
      onAddShape={c.addShapeElement}
      onAddLine={c.addLineElement}
      onAddCallout={c.addCalloutElement}
      onAddIcon={c.addIconElement}
      onAddChart={c.addChartElement}
      onAddTable={c.addTableElement}
      onAddCode={c.addCodeElement}
      onAddMarkdown={c.addMarkdownElement}
      onAddLatex={c.addLatexElement}
      onAddQrCode={c.addQrCodeElement}
      onAddVideo={(url, targetSlideId) => {
        assertUploadTarget(targetSlideId)
        c.addVideoElement(url)
      }}
      onAddAudio={(url, targetSlideId) => {
        assertUploadTarget(targetSlideId)
        c.addAudioElement(url)
      }}
      onOpenMediaLibrary={() => c.setShowMediaLibrary(true)}
      onOpenFileBrowser={() => c.setShowFileBrowser(true)}
      onAddHtml={c.addHtmlElement}
      onAddMermaid={c.addMermaidElement}
      onAddStemSimulation={c.addStemSimulationElement}
      onAddSvg={(svg, targetSlideId) => {
        assertUploadTarget(targetSlideId)
        c.addSvgElement(svg)
      }}
      onAddDrawing={c.addDrawingElement}
      onAddDivider={c.addDividerElement}
      onAddTechnicalSymbol={c.addTechnicalSymbolElement}
      onAddKineticText={() => c.setShowKineticTextModal(true)}
      onAddMathGrid={() => c.setShowMathGridModal(true)}
      onAddAnime={() => c.setShowAnimeModal(true)}
      onAddThree={() => c.setShowThreeModal(true)}
      onAddTimeline={c.addTimelineElement}
      onAddGame={c.addGameElement}
      pluginTypes={c.pluginTypes}
      onAddPluginElement={c.addPluginElement}
      onCssEditor={() => c.setShowCssEditor(true)}
      viewMode={c.viewMode}
      onFindReplace={() => c.setShowFindReplace((value) => !value)}
      onSpeakerNotes={() => {
        c.setRightPanelOpen(true)
        requestAnimationFrame(() =>
          document.querySelector('textarea[placeholder="Add speaker notes here..."]')?.focus()
        )
      }}
      onToggleSlideSorter={() => c.setViewMode((value) => (value === 'sorter' ? 'normal' : 'sorter'))}
      onPreviewAnimation={() => c.setShowAnimationPreview(true)}
      onPreviewTransition={() => c.setShowTransitionPreview(true)}
    />
  )
}
