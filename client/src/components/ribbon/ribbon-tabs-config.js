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

export const FORMAT_RIBBON_ELEMENT_POLICY = {
  text: { label: 'Format', status: 'accepted-limit', alternateSurface: 'direct canvas editing and Home typography controls' },
  image: { label: 'Picture Format', status: 'contextual-controls', alternateSurface: 'PropertiesPanel' },
  shape: { label: 'Shape Format', status: 'contextual-controls', alternateSurface: 'PropertiesPanel' },
  code: { label: 'Code', status: 'contextual-controls', alternateSurface: 'PropertiesPanel' },
  latex: { label: 'Format', status: 'accepted-limit', alternateSurface: 'PropertiesPanel' },
  html: { label: 'Format', status: 'accepted-limit', alternateSurface: 'PropertiesPanel' },
  markdown: { label: 'Format', status: 'accepted-limit', alternateSurface: 'PropertiesPanel' },
  chart: { label: 'Chart Design', status: 'contextual-controls', alternateSurface: 'PropertiesPanel' },
  video: { label: 'Media', status: 'contextual-controls', alternateSurface: 'PropertiesPanel' },
  audio: { label: 'Media', status: 'contextual-controls', alternateSurface: 'PropertiesPanel' },
  table: { label: 'Table Design', status: 'contextual-controls', alternateSurface: 'PropertiesPanel' },
  icon: { label: 'Format', status: 'accepted-limit', alternateSurface: 'PropertiesPanel' },
  callout: { label: 'Format', status: 'accepted-limit', alternateSurface: 'PropertiesPanel' },
  qrcode: { label: 'Format', status: 'accepted-limit', alternateSurface: 'PropertiesPanel' },
  drawing: { label: 'Format', status: 'accepted-limit', alternateSurface: 'direct canvas editing and PropertiesPanel' },
  line: { label: 'Shape Format', status: 'contextual-controls', alternateSurface: 'PropertiesPanel' },
  svg: { label: 'Format', status: 'accepted-limit', alternateSurface: 'PropertiesPanel' },
  timeline: { label: 'Format', status: 'accepted-limit', alternateSurface: 'PropertiesPanel' },
  game: { label: 'Format', status: 'accepted-limit', alternateSurface: 'game PropertiesPanel' },
}

export const FORMAT_RIBBON_CONTEXTUAL_TYPES = Object.entries(FORMAT_RIBBON_ELEMENT_POLICY)
  .filter(([, policy]) => policy.status === 'contextual-controls')
  .map(([type]) => type)

// Contextual Format-tab label, mirroring PowerPoint's type-specific ribbon tabs
// (Shape Format / Picture Format / Table Design / ...). Falls back to "Format"
// for text and any type without a dedicated label.
export function formatTabLabel(type) {
  return FORMAT_RIBBON_ELEMENT_POLICY[type]?.label || 'Format'
}
