import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, FolderOpen, Download, FileDown, History, Github, CloudUpload } from 'lucide-react'
import { Button } from '../ui'

const MENU_GROUPS = [
  {
    label: 'File',
    items: [
      { id: 'open', label: 'Open Project', icon: FolderOpen, action: 'onOpenProject' },
    ],
  },
  {
    label: 'Export',
    items: [
      { id: 'pdf', label: 'Export PDF', icon: Download, action: 'onExportPDF' },
      { id: 'pptx', label: 'Export PPTX', icon: Download, action: 'onExportPPTX' },
      { id: 'html', label: 'Export HTML', icon: Download, action: 'onExportHTML' },
      { id: 'offline', label: 'Export Offline HTML', icon: FileDown, action: 'onExportOffline' },
      { id: 'project', label: 'Export Project', icon: FileDown, action: 'onExportProject' },
    ],
  },
  {
    label: 'Publish',
    items: [
      { id: 'github', label: 'Save to GitHub', icon: Github, action: 'onGithub' },
      { id: 'sync', label: 'Sync to Cloud', icon: CloudUpload, action: 'onSync' },
    ],
  },
  {
    label: 'History',
    items: [
      { id: 'history', label: 'Version History', icon: History, action: 'onHistory' },
    ],
  },
]

export default function FileDropdown({
  onOpenProject,
  onExportPDF,
  onExportPPTX,
  onExportHTML,
  onExportOffline,
  onExportProject,
  onGithub,
  onSync,
  onHistory,
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)

  const callbacks = {
    onOpenProject, onExportPDF, onExportPPTX, onExportHTML,
    onExportOffline, onExportProject, onGithub, onSync, onHistory,
  }

  const handleAction = (actionKey) => {
    callbacks[actionKey]?.()
    setOpen(false)
  }

  const closeMenu = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  const handleKeyboardActivation = (event, action) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    action()
  }

  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      closeMenu()
    }
    document.addEventListener('keydown', closeOnEscape, true)
    return () => document.removeEventListener('keydown', closeOnEscape, true)
  }, [closeMenu, open])

  return (
    <div className="relative">
      <Button
        ref={triggerRef}
        variant="icon"
        className="menu-trigger h-7 px-2 flex items-center gap-1"
        title="File"
        aria-label="File menu"
        aria-expanded={open}
        onMouseDown={(e) => {
          e.preventDefault()
          setOpen((v) => !v)
        }}
        onKeyDown={(e) => handleKeyboardActivation(e, () => setOpen((v) => !v))}
      >
        <FileText size={14} />
        <span className="text-[11px] hidden sm:inline">File</span>
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-[999]" onMouseDown={() => setOpen(false)} />
          <div
            className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-[1000] w-[220px] py-1"
            role="menu"
            aria-label="File menu"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {MENU_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-1 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      className="dropdown-item w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-primary hover:bg-secondary cursor-pointer transition-colors text-left"
                      role="menuitem"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleAction(item.action)
                      }}
                      onKeyDown={(e) => handleKeyboardActivation(e, () => handleAction(item.action))}
                    >
                      <Icon size={14} className="text-text-muted" />
                      {item.label}
                    </button>
                  )
                })}
                <div className="mx-2 my-0.5 border-t border-border" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
