import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '../ui'

export default function RibbonDropdownMenuGroup({
  icon: Icon,
  label,
  items,
  className = '',
  menuClassName = '',
  itemsClassName = '',
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const toggleOpen = () => setOpen((v) => !v)
  const runItem = (item) => {
    item.onAction?.()
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleEscape = (e) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <Button
        ref={triggerRef}
        variant="ribbon"
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
        <span className="hidden 2xl:inline">{label}</span>
        <ChevronDown size={10} className="ml-0.5 opacity-60" />
      </Button>

      {open && (
        <div
          role="menu"
          className={`absolute top-full left-0 mt-1 bg-card border border-border rounded-lg p-1.5 shadow-xl z-[1000] min-w-[140px] ${menuClassName}`}
          onMouseDown={(e) => e.stopPropagation()}
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
        </div>
      )}
    </div>
  )
}
