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
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]"
      onClick={onClose}
    >
      <div
        className="bg-panel rounded-xl border border-border shadow-2xl flex flex-col p-6 w-full animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 800, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0 }}>Add Slide</h2>
          <Button variant="icon" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        {['basic', 'content', 'layout', 'ending'].map((category) => (
          <div key={category} style={{ marginBottom: 24 }}>
            <h3
              style={{
                fontSize: 14,
                color: 'var(--text-muted)',
                marginBottom: 12,
                textTransform: 'capitalize',
              }}
            >
              {getCategoryLabel(category)}
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
              }}
            >
              {Object.entries(SLIDE_TEMPLATES)
                .filter(([_, tmpl]) => tmpl.category === category)
                .map(([key, tmpl]) => (
                  <Button
                    variant="ghost"
                    key={key}
                    onClick={() => {
                      onSelect(key)
                      onClose()
                    }}
                    style={{
                      background: 'var(--bg-card)',
                      border: '2px solid var(--border)',
                      borderRadius: 8,
                      padding: 12,
                      cursor: 'pointer',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)'
                      e.currentTarget.style.background = 'var(--bg-hover)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.background = 'var(--bg-card)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '16/9',
                        background: '#1e1e2e',
                        borderRadius: 4,
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 24,
                        color: 'var(--accent)',
                      }}
                    >
                      {iconMap[key] || tmpl.icon}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {tmpl.label}
                    </div>
                  </Button>
                ))}
            </div>
          </div>
        ))}
        <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
