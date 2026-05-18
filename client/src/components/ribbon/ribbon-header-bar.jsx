import * as Tabs from '@radix-ui/react-tabs'
import { BarChart3, Bot, FileText, Languages, Play, Radio, Share2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useUIStore } from '../../stores/ui-store'
import { Button } from '../ui'
import FileDropdown from './ribbon-file-dropdown-menu'
import TabBar from './tab-bar-with-scroll-and-icons'

function RibbonActionDropdown({ label, icon: Icon, items }) {
  const [open, setOpen] = useState(false)
  const toggleOpen = () => setOpen((v) => !v)
  const runItem = (item) => {
    item.onClick?.()
    setOpen(false)
  }

  return (
    <div className="relative">
      <Button
        variant="ribbon"
        className="menu-trigger h-8"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onMouseDown={(e) => {
          e.preventDefault()
          toggleOpen()
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          toggleOpen()
        }}
      >
        <Icon size={14} />
        <span className="text-[11px] hidden md:inline">{label}</span>
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-[999]" onMouseDown={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-[1000] mt-1 w-[190px] rounded-lg border border-border bg-card py-1 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {items.map((item) => {
              const ItemIcon = item.icon
              return (
                <button
                  key={item.label}
                  className="dropdown-item flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-[11px] text-text-primary transition-colors hover:bg-secondary"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    runItem(item)
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    e.preventDefault()
                    runItem(item)
                  }}
                >
                  <ItemIcon size={14} className="text-text-muted" />
                  {item.label}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function RibbonHeaderBar({
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
}) {
  const activeTab = useUIStore((s) => s.activeTab)
  const setActiveTab = useUIStore((s) => s.setActiveTab)

  return (
    <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 items-center border-b border-border bg-secondary">
        <FileDropdown
          onOpenProject={onOpenProject}
          onExportPDF={onExportPDF}
          onExportPPTX={onExportPPTX}
          onExportHTML={onExportHTML}
          onExportOffline={onExportOffline}
          onExportProject={onExportProject}
          onGithub={onGithub}
          onSync={onSync}
          onHistory={onHistory}
        />
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
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
          <Button variant="icon" title="Present" aria-label="Present" onClick={onPresent}>
            <Play size={14} />
          </Button>
        </div>
      </div>
    </Tabs.Root>
  )
}
