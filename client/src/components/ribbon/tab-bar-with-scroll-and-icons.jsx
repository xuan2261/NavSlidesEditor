import * as Tabs from '@radix-ui/react-tabs'
import { cn } from '../../lib/utils'
import { useUIStore } from '../../stores/ui-store'
import { RIBBON_TABS, formatTabLabel } from './ribbon-tabs-config'

export default function TabBar({ activeTab, onTabChange }) {
  const formatContext = useUIStore((s) => s.formatContext)

  // Format is a contextual tab: hidden with no selection, and relabelled to the
  // selected element's type (Shape Format / Picture Format / ...) when visible.
  const tabs = RIBBON_TABS.filter(
    (tab) => tab.id !== 'format' || formatContext.hasSelection
  )

  return (
    <Tabs.List
      className="flex min-w-0 flex-1 items-center overflow-x-auto bg-secondary"
      aria-label="Ribbon tabs"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        const label =
          tab.id === 'format' ? formatTabLabel(formatContext.elementType) : tab.label
        return (
          <Tabs.Trigger
            key={tab.id}
            value={tab.id}
            id={`ribbon-tab-${tab.id}`}
            data-testid={`ribbon-tab-${tab.id}`}
            aria-label={label}
            aria-controls={`ribbon-panel-${tab.id}`}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
              'border-b-2 -mb-px outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'border-primary text-text-primary bg-background'
                : 'border-transparent text-text-muted hover:text-text-primary hover:bg-hover'
            )}
            onMouseDown={(e) => {
              e.preventDefault()
              onTabChange(tab.id)
            }}
            onClick={() => onTabChange(tab.id)}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
          </Tabs.Trigger>
        )
      })}
    </Tabs.List>
  )
}
