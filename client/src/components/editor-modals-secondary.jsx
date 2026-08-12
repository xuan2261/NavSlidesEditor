import AICopywriterModal from './AICopywriterModal'
import AIGeneratorModal from './AIGeneratorModal'
import AITranslateModal from './AITranslateModal'
import LivePresentationModal from './LivePresentationModal'
import TemplatePickerModal from './TemplatePickerModal'
import CSSEditorModal from './CSSEditorModal'
import MediaLibraryModal from './MediaLibraryModal'
import { CommandPalette } from './command-palette'
import KineticTextAnimationTemplateSelectorModal from './kinetic-text-animation-template-selector-modal'
import ParametricMathGridSurfacePlotterModal from './parametric-math-grid-surface-plotter-modal'
import AnimeJsAnimationTemplateSelectorModal from './anime-js-animation-template-selector-modal'
import ThreeJs3DSceneTemplateSelectorModal from './three-js-3d-scene-template-selector-modal'
import FileBrowserModal from './file-browser-modal-to-select-and-insert-media'
import PromptPopover from './PromptPopover'
import TemplateGallery from './dashboard/TemplateGallery'
import TemplatePreview from './dashboard/TemplatePreview'
import { useUIStore } from '../stores/ui-store'

const imageUrlPromptPopoverStyle = {
  position: 'fixed',
  top: 100,
  left: '50%',
  transform: 'translateX(-50%)',
}

/**
 * Second half of the editor's modal-mount JSX (AI, template, media, embeds,
 * popovers). Reads boolean visibility flags directly from ui-store; receives
 * data + behavior callbacks via props. Pure presentational mounting — no
 * behavior change vs the inline EditorPage version it replaces.
 */
export default function EditorModalsSecondary({
  presentationId,
  presentation,
  currentSlide,
  currentSlideIndex,
  selectedElementId,
  commands,
  liveRoomCode,
  livePresenterToken,
  liveRemoteToken,
  liveSpeakerToken,
  onPresenterWindowOpened,
  galleryPreviewTemplate,
  setGalleryPreviewTemplate,
  setPresentation,
  setCurrentSlideIndex,
  addSlide,
  addImageElement,
  insertEmbedHtml,
  handleInsertFromFileBrowser,
  onInsertMedia,
  onCreatePresentation,
  onAICopywriterApply,
  onApplyTranslations,
}) {
  const showAICopywriter = useUIStore((s) => s.showAICopywriter)
  const setShowAICopywriter = useUIStore((s) => s.setShowAICopywriter)
  const showAIGenerator = useUIStore((s) => s.showAIGenerator)
  const setShowAIGenerator = useUIStore((s) => s.setShowAIGenerator)
  const showAITranslate = useUIStore((s) => s.showAITranslate)
  const setShowAITranslate = useUIStore((s) => s.setShowAITranslate)
  const showLiveModal = useUIStore((s) => s.showLiveModal)
  const setShowLiveModal = useUIStore((s) => s.setShowLiveModal)
  const showTemplateModal = useUIStore((s) => s.showTemplateModal)
  const setShowTemplateModal = useUIStore((s) => s.setShowTemplateModal)
  const showCssEditor = useUIStore((s) => s.showCssEditor)
  const setShowCssEditor = useUIStore((s) => s.setShowCssEditor)
  const showMediaLibrary = useUIStore((s) => s.showMediaLibrary)
  const setShowMediaLibrary = useUIStore((s) => s.setShowMediaLibrary)
  const showCommandPalette = useUIStore((s) => s.showCommandPalette)
  const setShowCommandPalette = useUIStore((s) => s.setShowCommandPalette)
  const showKineticTextModal = useUIStore((s) => s.showKineticTextModal)
  const setShowKineticTextModal = useUIStore((s) => s.setShowKineticTextModal)
  const showMathGridModal = useUIStore((s) => s.showMathGridModal)
  const setShowMathGridModal = useUIStore((s) => s.setShowMathGridModal)
  const showAnimeModal = useUIStore((s) => s.showAnimeModal)
  const setShowAnimeModal = useUIStore((s) => s.setShowAnimeModal)
  const showThreeModal = useUIStore((s) => s.showThreeModal)
  const setShowThreeModal = useUIStore((s) => s.setShowThreeModal)
  const showFileBrowser = useUIStore((s) => s.showFileBrowser)
  const setShowFileBrowser = useUIStore((s) => s.setShowFileBrowser)
  const showImageUrlPrompt = useUIStore((s) => s.showImageUrlPrompt)
  const setShowImageUrlPrompt = useUIStore((s) => s.setShowImageUrlPrompt)
  const showTemplateGallery = useUIStore((s) => s.showTemplateGallery)
  const setShowTemplateGallery = useUIStore((s) => s.setShowTemplateGallery)

  return (
    <>
      {showAICopywriter &&
        (() => {
          const el = currentSlide?.elements?.find((e) => e.id === selectedElementId)
          const textContent = el?.content?.replace(/<[^>]*>/g, '') || ''
          return (
            <AICopywriterModal
              text={textContent}
              onApply={onAICopywriterApply}
              onClose={() => setShowAICopywriter(false)}
            />
          )
        })()}

      {showAIGenerator && (
        <AIGeneratorModal
          onCreatePresentation={onCreatePresentation}
          onClose={() => setShowAIGenerator(false)}
        />
      )}

      {showAITranslate && (
        <AITranslateModal
          slides={presentation?.slides}
          onApplyTranslations={onApplyTranslations}
          onClose={() => setShowAITranslate(false)}
        />
      )}

      {showLiveModal && liveRoomCode && (
        <LivePresentationModal
          presentationId={presentationId}
          roomCode={liveRoomCode}
          presenterToken={livePresenterToken}
          remoteToken={liveRemoteToken}
          speakerToken={liveSpeakerToken}
          onPresenterWindowOpened={onPresenterWindowOpened}
          onClose={() => setShowLiveModal(false)}
        />
      )}

      {showTemplateModal && (
        <TemplatePickerModal
          onSelect={(key) => addSlide(key)}
          onClose={() => setShowTemplateModal(false)}
        />
      )}

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
          onInsert={onInsertMedia}
        />
      )}

      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        commands={commands}
      />

      {showKineticTextModal && (
        <KineticTextAnimationTemplateSelectorModal
          onInsert={insertEmbedHtml}
          onClose={() => setShowKineticTextModal(false)}
        />
      )}
      {showMathGridModal && (
        <ParametricMathGridSurfacePlotterModal
          onInsert={insertEmbedHtml}
          onClose={() => setShowMathGridModal(false)}
        />
      )}
      {showAnimeModal && (
        <AnimeJsAnimationTemplateSelectorModal
          onInsert={insertEmbedHtml}
          onClose={() => setShowAnimeModal(false)}
        />
      )}
      {showThreeModal && (
        <ThreeJs3DSceneTemplateSelectorModal
          onInsert={insertEmbedHtml}
          onClose={() => setShowThreeModal(false)}
        />
      )}
      {showFileBrowser && (
        <FileBrowserModal
          presentationId={presentationId}
          onInsert={handleInsertFromFileBrowser}
          onClose={() => setShowFileBrowser(false)}
        />
      )}

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
            const newSlides = slidesToInsert.map((s) => ({
              ...s,
              id: crypto.randomUUID(),
              elements: (s.elements || []).map((el) => ({ ...el, id: crypto.randomUUID() })),
            }))
            setPresentation((prev) => {
              const currentSlides = [...prev.slides]
              const insertIndex = position === 'after' ? currentSlideIndex + 1 : currentSlides.length
              currentSlides.splice(insertIndex, 0, ...newSlides)
              return { ...prev, slides: currentSlides }
            })
            setGalleryPreviewTemplate(null)
            setShowTemplateGallery(false)
          }}
        />
      )}
    </>
  )
}
