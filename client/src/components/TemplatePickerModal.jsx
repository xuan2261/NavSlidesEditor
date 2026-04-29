import { useState, useEffect } from 'react'
import {
  X,
  Square,
  Heading1,
  Heading2,
  List,
  Image,
  Columns2,
  Hash,
  Quote,
  Clock,
  Footprints,
  Users,
  BookOpen,
  Scale,
  Columns3,
  LayoutGrid,
  Images,
  Smile,
  Star,
  MessageCircleQuestion,
  FileText,
  LayoutTemplate,
  Film,
  AppWindow,
  PanelLeftClose,
} from 'lucide-react'
import { SLIDE_TEMPLATES } from '../data/slide-templates'
import { Button } from '../components/ui'
import { isBackdropClick } from '../lib/utils'

const iconMap = {
  blank: <Square size={24} />,
  title: <Heading1 size={24} />,
  'section-header': <Heading2 size={24} />,
  agenda: <List size={24} />,
  'image-text': <Image size={24} />,
  comparison: <Columns2 size={24} />,
  'big-number': <Hash size={24} />,
  quote: <Quote size={24} />,
  timeline: <Clock size={24} />,
  steps: <Footprints size={24} />,
  team: <Users size={24} />,
  definition: <BookOpen size={24} />,
  'pro-con': <Scale size={24} />,
  'two-column': <PanelLeftClose size={24} />,
  'three-column': <Columns3 size={24} />,
  'four-grid': <LayoutGrid size={24} />,
  'image-gallery': <Images size={24} />,
  'thank-you': <Smile size={24} />,
  'key-takeaways': <Star size={24} />,
  qa: <MessageCircleQuestion size={24} />,
}

const getCategoryLabel = (category) => {
  switch (category) {
    case 'basic':
      return (
        <span className="flex items-center gap-2">
          <FileText size={16} /> Basic
        </span>
      )
    case 'content':
      return (
        <span className="flex items-center gap-2">
          <AppWindow size={16} /> Content
        </span>
      )
    case 'layout':
      return (
        <span className="flex items-center gap-2">
          <LayoutTemplate size={16} /> Layout
        </span>
      )
    case 'ending':
      return (
        <span className="flex items-center gap-2">
          <Film size={16} /> Ending
        </span>
      )
    default:
      return category
  }
}

export default function TemplatePickerModal({ onSelect, onClose }) {
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

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]"
      onClick={(event) => {
        if (isBackdropClick(event)) handleClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-picker-modal-title"
    >
      <div
        className="bg-panel rounded-xl border border-border shadow-2xl flex flex-col p-6 w-full max-w-[800px] max-h-[90vh] overflow-y-auto animate-zoom-in"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 id="template-picker-modal-title" className="m-0">Add Slide</h2>
          <Button variant="icon" onClick={handleClose} aria-label="Close">
            <X size={20} />
          </Button>
        </div>

        {['basic', 'content', 'layout', 'ending'].map((category) => (
          <div key={category} className="mb-6">
            <h3 className="text-sm text-text-muted mb-3 capitalize">
              {getCategoryLabel(category)}
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {Object.entries(SLIDE_TEMPLATES)
                .filter(([_, tmpl]) => tmpl.category === category)
                .map(([key, tmpl]) => (
                  <Button
                    variant="ghost"
                    key={key}
                    onClick={() => {
                      onSelect(key)
                      handleClose()
                    }}
                    className="bg-card border-2 border-border rounded-lg p-3 cursor-pointer text-center flex flex-col items-center gap-2 transition-all duration-200 hover:border-accent hover:bg-hover hover:-translate-y-0.5"
                  >
                    <div className="w-full aspect-video bg-surface-2 rounded border border-border flex items-center justify-center text-2xl text-accent">
                      {iconMap[key] || tmpl.icon}
                    </div>
                    <div className="text-xs font-medium text-text-primary">
                      {tmpl.label}
                    </div>
                  </Button>
                ))}
            </div>
          </div>
        ))}
        <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
