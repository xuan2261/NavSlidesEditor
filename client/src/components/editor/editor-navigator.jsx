import SlidePanel from '../SlidePanel'

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
        currentIndex={c.currentSlideIndex}
        onSelect={(idx) => {
          c.setVerticalEdit(null)
          c.setCurrentSlideIndex(idx)
        }}
        onAdd={() => c.setShowTemplateModal(true)}
        onAddFromTemplate={() => c.setShowTemplateGallery(true)}
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
        onSelectVertical={({ parent, child }) => {
          const parentSlide = c.presentation.slides[parent]
          if (!parentSlide) return
          c.setSelectedElementIds([])
          c.setEditingElementId(null)
          c.clearEditingElementRef()
          c.setVerticalEdit({ parentId: parentSlide.id, child })
        }}
      />
    </div>
  )
}
