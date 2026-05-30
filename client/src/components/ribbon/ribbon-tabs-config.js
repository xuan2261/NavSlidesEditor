import {
  Home,
  Plus,
  Palette,
  Paintbrush,
  Replace,
  Sparkles,
  Eye,
} from 'lucide-react'

export const RIBBON_TABS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'insert', label: 'Insert', icon: Plus },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'format', label: 'Format', icon: Paintbrush },
  { id: 'transitions', label: 'Transitions', icon: Replace },
  { id: 'animations', label: 'Animations', icon: Sparkles },
  { id: 'view', label: 'View', icon: Eye },
]

// Contextual Format-tab label, mirroring PowerPoint's type-specific ribbon tabs
// (Shape Format / Picture Format / Table Design / ...). Falls back to "Format"
// for text and any type without a dedicated label.
export function formatTabLabel(type) {
  switch (type) {
    case 'shape':
    case 'line':
      return 'Shape Format'
    case 'image':
      return 'Picture Format'
    case 'table':
      return 'Table Design'
    case 'chart':
      return 'Chart Design'
    case 'code':
      return 'Code'
    case 'video':
    case 'audio':
      return 'Media'
    default:
      return 'Format'
  }
}
