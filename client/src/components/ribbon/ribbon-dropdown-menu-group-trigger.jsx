import { useState, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '../ui'
import RibbonFloatingOverlay from './ribbon-floating-overlay'

export default function RibbonDropdownMenuGroup({
  icon: Icon,
  label,
  items,
  className = '',
  menuClassName = '',
  itemsClassName = '',
  triggerRef: externalTriggerRef,
  triggerVariant = 'ribbon',
  triggerClassName = '',
  triggerTestId,
}) {
  const [open, setOpen] = useState(false)
  const localTriggerRef = useRef(null)
  const triggerRef = externalTriggerRef || localTriggerRef
  const toggleOpen = () => setOpen((v) => !v)
  const closeMenu = () => {
    triggerRef.current?.focus()
    setOpen(false)
  }
  const runItem = (item) => {
    item.onAction?.()
    closeMenu()
  }

  return (
    <div className={className}>
      <Button
        ref={triggerRef}
        data-testid={triggerTestId}
        variant={triggerVariant}
        className={triggerClassName}
        aria-expanded={open}
        aria-haspopup="menu"
        onMouseDown={(e) => {
          e.preventDefault()
          toggleOpen()
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          toggleOpen()
        }}
        title={label}
        aria-label={label}
      >
        <Icon size={14} />
        {triggerVariant !== 'icon' && (
          <span className="hidden 2xl:inline">{label}</span>
        )}
        <ChevronDown size={10} className="ml-0.5 opacity-60" />
      </Button>

      {open && (
        <RibbonFloatingOverlay
          open={open}
          anchorRef={triggerRef}
          onClose={() => setOpen(false)}
          role="menu"
          dataRibbonPopup={label}
          className={`bg-card border border-border rounded-lg p-1.5 shadow-xl min-w-[140px] ${menuClassName}`}
        >
          <div className={itemsClassName}>
            {items.map((item) => {
              const ItemIcon = item.icon
              return (
                <button
                  key={item.id}
                  role="menuitem"
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-[11px] text-left cursor-pointer transition-colors hover:bg-secondary text-text-primary"
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
                  <ItemIcon size={14} className="shrink-0" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </RibbonFloatingOverlay>
      )}
    </div>
  )
}
