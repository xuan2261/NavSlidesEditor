import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, CheckSquare, Square, Plus } from 'lucide-react'
import { Button } from '../../components/ui'
import { isBackdropClick } from '../../lib/utils'
import TemplateSlideThumbnail from './TemplateSlideThumbnail'

export default function TemplatePreview({
  template,
  onUseAsNew,
  onInsertSlides,
  onClose,
  isFavorite,
  onToggleFavorite,
}) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [insertMode, setInsertMode] = useState(false)
  const [selectedSlides, setSelectedSlides] = useState([])
  const [insertPosition, setInsertPosition] = useState('after') // 'after' or 'end'

  const slides = template?.slides || []
  const [isOpen, setIsOpen] = useState(true)

  const handleClose = () => {
    setIsOpen(false)
    onClose()
  }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null

  if (!template) return null

  // Initialize selected slides to all when entering insert mode
  const handleStartInsert = () => {
    setSelectedSlides(slides.map((_, i) => i))
    setInsertMode(true)
  }

  const toggleSlideSelection = (index) => {
    setSelectedSlides((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    )
  }

  const handleInsertConfirm = () => {
    const slidesToInsert = [...selectedSlides].sort((a, b) => a - b).map((i) => slides[i])
    onInsertSlides(slidesToInsert, insertPosition)
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]"
      onClick={(event) => {
        if (isBackdropClick(event)) handleClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-preview-title"
    >
      <div
        className="bg-panel rounded-xl border border-border shadow-2xl flex flex-col overflow-hidden animate-zoom-in w-[1000px] h-[90vh]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3">
              <h2 id="template-preview-title" className="m-0 text-xl">{template.titleVi || template.title}</h2>
              {onToggleFavorite && (
                <Button
                  variant="icon"
                  onClick={() => onToggleFavorite(template.id)}
                  className={isFavorite ? 'text-amber-400' : 'text-text-muted'}
                  title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <span className="text-lg">{isFavorite ? '★' : '☆'}</span>
                </Button>
              )}
            </div>
            <p className="mt-1 mb-0 text-[13px] text-text-muted">
              {slides.length} slides • {template.category} • {template.description}
            </p>
          </div>
          <Button variant="icon" onClick={handleClose} aria-label="Close">
            <X size={20} />
          </Button>
        </div>

        <div className="flex-1 bg-surface-0 relative flex flex-col overflow-hidden">
          {!insertMode ? (
            <div className="flex-1 flex items-center justify-center relative">
              {slides.length > 0 ? (
                <div
                  className="w-[960px] h-[540px] scale-75 origin-center relative"
                >
                  <TemplateSlideThumbnail slide={slides[currentSlide]} />
                </div>
              ) : (
                <div className="text-white">No slides available</div>
              )}

              {slides.length > 1 && (
                <>
                  <Button
                    variant="icon"
                    className="absolute left-5 top-1/2 -translate-y-1/2 bg-black/50 w-11 h-11 rounded-full"
                    onClick={() => setCurrentSlide((s) => Math.max(0, s - 1))}
                    disabled={currentSlide === 0}
                    aria-label="Previous slide"
                  >
                    <ChevronLeft size={24} className="text-white" />
                  </Button>
                  <Button
                    variant="icon"
                    className="absolute right-5 top-1/2 -translate-y-1/2 bg-black/50 w-11 h-11 rounded-full"
                    onClick={() => setCurrentSlide((s) => Math.min(slides.length - 1, s + 1))}
                    disabled={currentSlide === slides.length - 1}
                    aria-label="Next slide"
                  >
                    <ChevronRight size={24} className="text-white" />
                  </Button>
                  <div
                    className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-xl text-xs"
                  >
                    {currentSlide + 1} / {slides.length}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="flex justify-between mb-5">
                <h3 className="text-white m-0">Select Slides to Insert</h3>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedSlides(slides.map((_, i) => i))}
                  >
                    Select All
                  </Button>
                  <Button variant="secondary" onClick={() => setSelectedSlides([])}>
                    Deselect All
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                {slides.map((s, i) => {
                  const isSelected = selectedSlides.includes(i)
                  return (
                    <button
                      type="button"
                      key={i}
                      className={`rounded-lg overflow-hidden cursor-pointer bg-white/5 text-left ${isSelected ? 'border-2 border-indigo-500' : 'border-2 border-transparent'}`}
                      onClick={() => toggleSlideSelection(i)}
                      aria-label={`Slide ${i + 1}`}
                      aria-pressed={isSelected}
                    >
                      <div className="w-full aspect-video relative pointer-events-none overflow-hidden">
                        <div className="scale-[0.22] origin-top-left w-[960px] h-[540px]">
                          <TemplateSlideThumbnail slide={s} />
                        </div>
                      </div>
                      <div className="p-2 flex justify-between items-center bg-black/50">
                        <span className="text-white text-xs">Slide {i + 1}</span>
                        {isSelected ? (
                          <CheckSquare size={16} className="text-primary" />
                        ) : (
                          <Square size={16} className="text-slate-400" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-between items-center">
          {insertMode ? (
            <>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="radio"
                    checked={insertPosition === 'after'}
                    onChange={() => setInsertPosition('after')}
                  />
                  After current slide
                </label>
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="radio"
                    checked={insertPosition === 'end'}
                    onChange={() => setInsertPosition('end')}
                  />
                  At the end
                </label>
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setInsertMode(false)}>
                  Back
                </Button>
                <Button
                  variant="primary"
                  disabled={selectedSlides.length === 0}
                  onClick={handleInsertConfirm}
                >
                  <Plus size={16} />
                  Insert {selectedSlides.length} Slide{selectedSlides.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                {template.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="bg-secondary px-2 py-1 rounded-xl text-[11px] text-text-secondary"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleClose}>
                  Cancel
                </Button>
                {onInsertSlides && (
                  <Button variant="secondary" onClick={handleStartInsert}>
                    Insert into Current
                  </Button>
                )}
                {onUseAsNew && (
                  <Button variant="primary" onClick={() => onUseAsNew(template)}>
                    Use as New
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
