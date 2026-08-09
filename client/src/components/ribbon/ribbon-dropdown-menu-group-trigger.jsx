import { useLayoutEffect, useRef, useState } from 'react'
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
  triggerDescribedBy,
}) {
  const [open, setOpen] = useState(false)
  const localTriggerRef = useRef(null)
  const menuRef = useRef(null)
  const triggerRef = externalTriggerRef || localTriggerRef
  const toggleOpen = () => setOpen((v) => !v)
  const closeMenu = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }
  const runItem = (item) => {
    item.onAction?.()
    closeMenu()
  }

  useLayoutEffect(() => {
    if (!open) return
    menuRef.current?.querySelector('[role="menuitem"]')?.focus()
  }, [open])

  const handleMenuKeyDown = (event, index) => {
    const lastIndex = items.length - 1
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      runItem(items[index])
      return
    }
    const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight'
      ? 1
      : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
        ? -1
        : 0
    if (direction) {
      event.preventDefault()
      const nextIndex = (index + direction + items.length) % items.length
      menuRef.current?.querySelectorAll('[role="menuitem"]')[nextIndex]?.focus()
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const nextIndex = event.key === 'Home' ? 0 : lastIndex
      menuRef.current?.querySelectorAll('[role="menuitem"]')[nextIndex]?.focus()
    }
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
        aria-describedby={triggerDescribedBy}
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
          onClose={closeMenu}
          role="menu"
          dataRibbonPopup={label}
          className={`bg-card border border-border rounded-lg p-1.5 shadow-xl min-w-[140px] ${menuClassName}`}
        >
          <div ref={menuRef} className={itemsClassName}>
            {items.map((item, index) => {
              const ItemIcon = item.icon
              return (
                <button
                  key={item.id}
                  role="menuitem"
                  tabIndex={index === 0 ? 0 : -1}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-[11px] text-left cursor-pointer transition-colors hover:bg-secondary text-text-primary"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    runItem(item)
                  }}
                  onKeyDown={(e) => handleMenuKeyDown(e, index)}
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
