import { useState } from 'react'
import {
  Square,
  Heading1,
  Heading2,
  List,
  Image as ImageIcon,
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
  Presentation,
  MessageSquareQuote,
  UserRound,
  LayoutDashboard,
  BarChart3,
  CalendarRange,
  Filter,
  TrendingUp,
  Map,
  Brain,
  Server,
  GitBranch,
  GitCompare,
  Table2,
  Rocket,
  Database,
  Network,
} from 'lucide-react'
import { SLIDE_TEMPLATES } from '../data/slide-templates'
import { Button, ModalShell } from '../components/ui'

const iconMap = {
  blank: <Square size={24} />,
  title: <Heading1 size={24} />,
  'section-header': <Heading2 size={24} />,
  agenda: <List size={24} />,
  'cover-hero': <Presentation size={24} />,
  'image-text': <ImageIcon size={24} />,
  comparison: <Columns2 size={24} />,
  'big-number': <Hash size={24} />,
  quote: <Quote size={24} />,
  'big-quote': <MessageSquareQuote size={24} />,
  'quote-with-author': <UserRound size={24} />,
  timeline: <Clock size={24} />,
  steps: <Footprints size={24} />,
  team: <Users size={24} />,
  definition: <BookOpen size={24} />,
  'pro-con': <Scale size={24} />,
  'two-column': <PanelLeftClose size={24} />,
  'three-column': <Columns3 size={24} />,
  'four-grid': <LayoutGrid size={24} />,
  'image-gallery': <Images size={24} />,
  'kpi-grid': <LayoutDashboard size={24} />,
  'bar-chart': <BarChart3 size={24} />,
  gantt: <CalendarRange size={24} />,
  funnel: <Filter size={24} />,
  'stat-callout': <TrendingUp size={24} />,
  roadmap: <Map size={24} />,
  mindmap: <Brain size={24} />,
  'arch-diagram': <Server size={24} />,
  'process-flow': <GitBranch size={24} />,
  'code-diff': <GitCompare size={24} />,
  swot: <Table2 size={24} />,
  'thank-you': <Smile size={24} />,
  'key-takeaways': <Star size={24} />,
  qa: <MessageCircleQuestion size={24} />,
  'closing-cta': <Rocket size={24} />,
}

const CATEGORY_ORDER = ['basic', 'content', 'layout', 'data', 'structure', 'ending']

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
    case 'data':
      return (
        <span className="flex items-center gap-2">
          <Database size={16} /> Data
        </span>
      )
    case 'structure':
      return (
        <span className="flex items-center gap-2">
          <Network size={16} /> Structure
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

  if (!isOpen) return null

  return (
    <ModalShell
      title="Add Slide"
      titleId="template-picker-modal-title"
      size="xl"
      onClose={handleClose}
    >
      {CATEGORY_ORDER.map((category) => (
        <div key={category} className="mb-6">
          <h3 className="text-sm text-text-muted mb-3 capitalize">{getCategoryLabel(category)}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                  className="bg-card border-2 border-border rounded-lg p-3 cursor-pointer text-center flex flex-col items-center gap-2 transition-[border-color,background-color,box-shadow] duration-200 hover:border-accent hover:bg-hover hover:shadow-sm"
                >
                  <div className="w-full aspect-video bg-surface-2 rounded border border-border flex items-center justify-center text-2xl text-accent">
                    {iconMap[key] || tmpl.icon}
                  </div>
                  <div className="text-xs font-medium text-text-primary">{tmpl.label}</div>
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
    </ModalShell>
  )
}
