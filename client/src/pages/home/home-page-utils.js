import { Clock, FolderOpen } from 'lucide-react'
import { LIGHT_PRESET_COLORS, THEMES, TRANSITIONS } from './home-page-presets'

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString(navigator.language, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function getCardBg(thumbnail) {
  if (!thumbnail) return '#1e1e28'
  if (thumbnail.type === 'color' && thumbnail.color) return thumbnail.color
  if (thumbnail.type === 'gradient' && thumbnail.gradient) return thumbnail.gradient
  if (thumbnail.type === 'image' && thumbnail.image) return `url(${thumbnail.image})`
  return '#1e1e28'
}

export function isGradientOrImage(thumbnail) {
  return thumbnail && (thumbnail.type === 'gradient' || thumbnail.type === 'image')
}

export function getPresetTextTone(thumbnail) {
  const isLightPreset = LIGHT_PRESET_COLORS.has((thumbnail?.color || '').toLowerCase())
  return isLightPreset
    ? {
        titleClassName: 'text-base font-bold text-[#333] opacity-85',
        metaClassName: 'text-[10px] text-[#666]',
      }
    : {
        titleClassName: 'text-base font-bold text-white opacity-85',
        metaClassName: 'text-[10px] text-white/50',
      }
}

export function getTemplateStartButtonStateClassName(isSelected) {
  return isSelected
    ? '!bg-accent !border-accent !text-white'
    : 'bg-card border-border text-text-primary hover:bg-hover hover:border-border-strong'
}

export function handleKeyboardClick(event, callback) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  callback(event)
}

export function getPresetTeachingBadge(preset) {
  const haystack = `${preset.title || ''} ${preset.description || ''} ${preset.category || ''}`.toLowerCase()
  if (/code|engineering|academic|circuit|điện|kỹ thuật|vi xử lý/.test(haystack)) {
    return 'Teaching starter'
  }
  return null
}

export const DASHBOARD_CARD_CLASS =
  'group bg-card border border-border rounded-lg overflow-hidden transition-[background-color,border-color,box-shadow,opacity] duration-150 hover:border-border-strong hover:shadow-[0_12px_28px_rgba(36,25,21,0.14)] focus-within:ring-2 focus-within:ring-focus/25'

export const DASHBOARD_ACTION_TILE_CLASS =
  'flex items-center gap-2.5 px-5 py-3.5 bg-card border border-border rounded-md text-text-primary text-sm font-medium cursor-pointer transition-[background-color,border-color,box-shadow,color] duration-150 hover:bg-hover hover:border-accent hover:shadow-[0_8px_20px_rgba(36,25,21,0.12)]'

export const CATEGORY_PILL_CLASS =
  'px-3.5 py-1.5 rounded-full text-xs font-medium bg-card border border-border text-text-secondary cursor-pointer transition-[background-color,border-color,color,box-shadow] duration-150 hover:border-border-strong hover:text-text-primary focus-visible:ring-2 focus-visible:ring-focus/30'

// Sidebar navigation items
export const SIDEBAR_VIEWS = [
  { key: 'recent', label: 'Recent', icon: Clock },
  { key: 'all', label: 'All Presentations', icon: FolderOpen },
]

export const FALLBACK_CREATION_DEFAULTS = Object.freeze({ theme: 'black', transition: 'slide' })

export function getCreationDefaults(settings) {
  return {
    theme: THEMES.includes(settings?.defaultTheme)
      ? settings.defaultTheme
      : FALLBACK_CREATION_DEFAULTS.theme,
    transition: TRANSITIONS.includes(settings?.defaultTransition)
      ? settings.defaultTransition
      : FALLBACK_CREATION_DEFAULTS.transition,
  }
}

export function createEmptyForm(defaults = FALLBACK_CREATION_DEFAULTS) {
  return { title: '', theme: defaults.theme, transition: defaults.transition, templateId: null }
}
