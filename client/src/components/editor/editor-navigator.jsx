import { applyLayout, changeLayout, detachLayout } from 'revealjs-shared'
import SlidePanel from '../SlidePanel'

function withLayoutMaster(presentation, layouts, layoutId) {
  if ((presentation.layoutMasters || []).some((layout) => layout.id === layoutId)) return presentation
  const layout = layouts.find((candidate) => candidate.id === layoutId)
  return layout ? { ...presentation, layoutMasters: [...(presentation.layoutMasters || []), layout] } : presentation
}

export default function EditorNavigator({ visible, overlay, onCloseOverlay, c }) {
  if (!visible) return null

  return (
    <div
      role={overlay ? 'dialog' : undefined}
      aria-label="Slide navigator"
      onKeyDown={(event) => {
        if (!overlay || event.key !== 'Escape') return
        onCloseOverlay()
        event.stopPropagation()
      }}
      className={
        overlay
          ? 'absolute inset-y-0 left-0 z-40 shadow-xl'
          : 'flex h-full min-h-0 shrink-0'
      }
    >
      <SlidePanel
        slides={c.presentation.slides}
        resolution={c.presentation.resolution}
        designTokens={c.presentation.designTokens}
        layoutMasters={c.presentation.layoutMasters}
        currentIndex={c.currentSlideIndex}
        onSelect={c.navigateToSlide}
        onAdd={() => c.setShowTemplateModal(true)}
        onAddFromTemplate={() => c.setShowTemplateGallery(true)}
        layoutOptions={c.availableLayouts}
        onApplyLayout={(layoutId, index) => c.setPresentation((previous) => { const next = withLayoutMaster(previous, c.availableLayouts, layoutId); return { ...next, slides: next.slides.map((slide, candidate) => candidate === index ? applyLayout(slide, next.layoutMasters, layoutId).slide : slide) } })}
        onChangeLayout={(layoutId, index) => c.setPresentation((previous) => { const next = withLayoutMaster(previous, c.availableLayouts, layoutId); return { ...next, slides: next.slides.map((slide, candidate) => candidate === index ? changeLayout(slide, next.layoutMasters, layoutId).slide : slide) } })}
        onDetachLayout={(index) => c.setPresentation((previous) => ({ ...previous, slides: previous.slides.map((slide, candidate) => candidate === index ? detachLayout(slide, c.availableLayouts).slide : slide) }))}
        onDelete={c.deleteSlide}
        onDuplicate={c.duplicateSlide}
        onDeleteSelected={c.deleteSlides}
        onDuplicateSelected={c.duplicateSlides}
        onMove={c.moveSlide}
        onToggleLock={(idx) =>
          c.setPresentation((prev) => ({
            ...prev,
            slides: prev.slides.map((s, i) => (i === idx ? { ...s, locked: !s.locked } : s)),
          }))
        }
        onToggleAutoAnimate={(idx) =>
          c.setPresentation((prev) => ({
            ...prev,
            slides: prev.slides.map((s, i) =>
              i === idx ? { ...s, autoAnimate: !s.autoAnimate } : s
            ),
          }))
        }
        onAddVerticalSlide={c.addChildSlide}
        currentVerticalIndex={c.currentVerticalIndex}
        onSelectVertical={({ parent, child }) => c.navigateToSlide(parent, child)}
      />
    </div>
  )
}
