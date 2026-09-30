import * as Tabs from '@radix-ui/react-tabs'
import { BarChart3, Bot, FileText, Languages, Play, Radio, Share2, Sparkles } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { resolveRibbonActiveTab, useUIStore } from '../../stores/ui-store'
import { Button } from '../ui'
import FileDropdown from './ribbon-file-dropdown-menu'
import RibbonFloatingOverlay from './ribbon-floating-overlay'
import TabBar from './tab-bar-with-scroll-and-icons'

function RibbonActionDropdown({ label, icon: Icon, items }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const entryFocusRef = useRef(null)
  const itemRefs = useRef([])
  const toggleOpen = () => setOpen((v) => !v)
  const runItem = (item) => {
    setOpen(false)
    triggerRef.current?.focus({ preventScroll: true })
    item.onClick?.()
  }
  const closeMenu = useCallback(() => setOpen(false), [])

  useLayoutEffect(() => {
    if (!open || entryFocusRef.current === null) return
    itemRefs.current[entryFocusRef.current]?.focus({ preventScroll: true })
    entryFocusRef.current = null
  }, [open])

  return (
    <div className="relative">
      <Button
        ref={triggerRef}
        variant="ribbon"
        className="menu-trigger h-8"
        title={label}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          entryFocusRef.current = 0
          toggleOpen()
        }}
        onKeyDown={(e) => {
          if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return
          e.preventDefault()
          entryFocusRef.current = e.key === 'ArrowUp' ? items.length - 1 : 0
          if (open) {
            itemRefs.current[entryFocusRef.current]?.focus()
            entryFocusRef.current = null
          } else setOpen(true)
        }}
      >
        <Icon size={14} />
        <span className="text-[11px] hidden lg:inline">{label}</span>
      </Button>
      {open && (
        <RibbonFloatingOverlay
          open={open}
          anchorRef={triggerRef}
          onClose={closeMenu}
          align="right"
          className="w-[190px] rounded-lg border border-border bg-card py-1 shadow-xl"
          role="menu"
          ariaLabel={`${label} menu`}
          dataRibbonPopup={`${label.toLowerCase()}-menu`}
        >
            {items.map((item, index) => {
              const ItemIcon = item.icon
              return (
                <button
                  key={item.label}
                  ref={(node) => { itemRefs.current[index] = node }}
                  className="ui-coarse-target dropdown-item flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-[11px] text-text-primary transition-colors hover:bg-secondary"
                  role="menuitem"
                  onClick={() => runItem(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab') {
                      setOpen(false)
                      triggerRef.current?.focus()
                      return
                    }
                    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
                    e.preventDefault()
                    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
                      : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
                    itemRefs.current[next]?.focus({ preventScroll: true })
                  }}
                >
                  <ItemIcon size={14} className="text-text-muted" />
                  {item.label}
                </button>
              )
            })}
        </RibbonFloatingOverlay>
      )}
    </div>
  )
}

export default function RibbonHeaderBar({
  onSave,
  onOpenProject,
  onExportPDF,
  onExportPPTX,
  onExportHTML,
  onExportOffline,
  onExportProject,
  onGithub,
  onSync,
  onHistory,
  onAICopywriter,
  onAIGenerator,
  onAITranslate,
  onShare,
  onLive,
  onAnalytics,
  onPresent,
  onPresentCurrent,
  pptxFidelity,
  pptxActions,
  pptxBusy,
  onReloadPptxFidelity,
}) {
  const activeTab = useUIStore((s) => s.activeTab)
  const setActiveTab = useUIStore((s) => s.setActiveTab)
  const formatContext = useUIStore((s) => s.formatContext)
  const lastNonContextualTab = useUIStore((s) => s.lastNonContextualTab)

  const effectiveTab = resolveRibbonActiveTab(
    activeTab,
    formatContext,
    lastNonContextualTab
  )

  return (
    <Tabs.Root value={effectiveTab} onValueChange={setActiveTab} className="flex min-w-0 flex-1 overflow-hidden">
      <div className="flex w-full min-w-0 flex-1 items-center overflow-hidden border-b border-border bg-secondary">
        <FileDropdown
          onSave={onSave}
          onOpenProject={onOpenProject}
          onExportPDF={onExportPDF}
          onExportPPTX={onExportPPTX}
          onExportHTML={onExportHTML}
          onExportOffline={onExportOffline}
          onExportProject={onExportProject}
          onGithub={onGithub}
          onSync={onSync}
          onHistory={onHistory}
          pptxFidelity={pptxFidelity}
          pptxActions={pptxActions}
          pptxBusy={pptxBusy}
          onReloadPptxFidelity={onReloadPptxFidelity}
        />
        <TabBar activeTab={effectiveTab} />
        <div className="ml-auto flex shrink-0 items-center gap-1 px-1">
          <RibbonActionDropdown
            label="AI"
            icon={Bot}
            items={[
              { label: 'AI Copywriter', icon: Sparkles, onClick: onAICopywriter },
              { label: 'AI Slide Generator', icon: FileText, onClick: onAIGenerator },
              { label: 'Translate', icon: Languages, onClick: onAITranslate },
            ]}
          />
          <RibbonActionDropdown
            label="Share"
            icon={Share2}
            items={[
              { label: 'Share Link', icon: Share2, onClick: onShare },
              { label: 'Present Live', icon: Radio, onClick: onLive },
              { label: 'View Analytics', icon: BarChart3, onClick: onAnalytics },
            ]}
          />
          <RibbonActionDropdown
            label="Present"
            icon={Play}
            items={[
              { label: 'From beginning (F5)', icon: Play, onClick: onPresent },
              { label: 'From current slide (Shift+F5)', icon: Play, onClick: onPresentCurrent },
            ]}
          />
        </div>
      </div>
    </Tabs.Root>
  )
}
