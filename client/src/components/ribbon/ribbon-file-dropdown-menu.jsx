import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, FolderOpen, Download, FileDown, History, Github, CloudUpload } from 'lucide-react'
import { Button } from '../ui'
import RibbonFloatingOverlay from './ribbon-floating-overlay'
import { PptxFidelityPanel } from '../PptxFidelityPanel'

const MENU_GROUPS = [
  {
    label: 'File',
    items: [
      { id: 'open', label: 'Open Project', icon: FolderOpen, action: 'onOpenProject' },
      { id: 'save', label: 'Save', icon: FileText, action: 'onSave' },
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
  pptxFidelity,
  pptxActions,
  pptxBusy,
  onReloadPptxFidelity,
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const itemRefs = useRef([])
  const menuItems = MENU_GROUPS.flatMap((group) => group.items)

  const callbacks = {
    onSave, onOpenProject, onExportPDF, onExportPPTX, onExportHTML,
    onExportOffline, onExportProject, onGithub, onSync, onHistory,
  }

  const handleAction = (actionKey) => {
    callbacks[actionKey]?.()
    setOpen(false)
    triggerRef.current?.focus?.()
  }

  const closeMenu = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus?.()
  }, [])

  const handleKeyboardActivation = (event, action) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    if (event.repeat) return
    action()
  }

  useEffect(() => {
    if (!open) return undefined
    itemRefs.current[0]?.focus?.()
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      closeMenu()
    }
    document.addEventListener('keydown', closeOnEscape, true)
    return () => document.removeEventListener('keydown', closeOnEscape, true)
  }, [closeMenu, open])

  const focusMenuItem = (index) => {
    const nextIndex = (index + menuItems.length) % menuItems.length
    itemRefs.current[nextIndex]?.focus?.()
  }

  const handleMenuItemKeyDown = (event, index, action) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusMenuItem(index + 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusMenuItem(index - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusMenuItem(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusMenuItem(menuItems.length - 1)
    } else {
      handleKeyboardActivation(event, action)
    }
  }

  return (
    <div className="relative">
      <Button
        ref={triggerRef}
        data-testid="ribbon-file-menu-trigger"
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
        <RibbonFloatingOverlay
          open={open}
          anchorRef={triggerRef}
          onClose={closeMenu}
          className={`bg-card border border-border rounded-lg shadow-xl py-1 ${
            pptxFidelity ? 'w-[min(520px,calc(100vw-16px))]' : 'w-[220px]'
          }`}
          role="menu"
          ariaLabel="File menu"
          dataRibbonPopup="file-menu"
        >
            {MENU_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-1 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const itemIndex = menuItems.findIndex((menuItem) => menuItem.id === item.id)
                  return (
                    <button
                      key={item.id}
                      ref={(node) => {
                        itemRefs.current[itemIndex] = node
                      }}
                      data-testid={
                        item.id === 'pptx'
                          ? 'ribbon-file-export-pptx'
                          : item.id === 'html'
                            ? 'ribbon-file-export-html'
                            : undefined
                      }
                      className="dropdown-item w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-primary hover:bg-secondary cursor-pointer transition-colors text-left"
                      role="menuitem"
                      tabIndex={-1}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleAction(item.action)
                      }}
                      onKeyDown={(e) =>
                        handleMenuItemKeyDown(e, itemIndex, () => handleAction(item.action))
                      }
                    >
                      <Icon size={14} className="text-text-muted" />
                      {item.label}
                    </button>
                  )
                })}
                <div className="mx-2 my-0.5 border-t border-border" />
              </div>
            ))}
            {pptxFidelity && (
              <div className="p-2">
                <PptxFidelityPanel
                  contract={pptxFidelity}
                  actions={pptxActions}
                  busy={pptxBusy}
                  onReload={onReloadPptxFidelity}
                />
              </div>
            )}
        </RibbonFloatingOverlay>
      )}
    </div>
  )
}
