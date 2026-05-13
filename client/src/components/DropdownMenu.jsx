import { useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Reusable dropdown menu component for the editor menu bar.
 * Supports item types: button, separator, checkbox, select, custom.
 */
export default function DropdownMenu({ label, items, isOpen, onToggle, onClose, align = 'left' }) {
  const menuRef = useRef(null)
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : []

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        className={`menu-trigger flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/30 ${
          isOpen ? 'bg-active text-accent' : 'text-text-secondary'
        }`}
        onClick={onToggle}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {label} <ChevronDown size={14} className="opacity-60 ml-1" />
      </button>
      {isOpen && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full z-[9999] mt-1 flex w-56 flex-col rounded-md border border-border bg-panel py-1 text-text-primary shadow-[0_16px_44px_rgba(0,0,0,0.28)]`}
        >
          {safeItems.map((item, idx) => {
            if (item.type === 'separator') {
              return <div key={`sep-${idx}`} className="h-px bg-border my-1 w-full" />
            }
            if (item.type === 'label') {
              return (
                <div
                  key={`lbl-${idx}`}
                  className="px-3 py-1 mt-1 text-[11px] font-semibold text-text-muted uppercase tracking-wider pointer-events-none"
                >
                  {item.label}
                </div>
              )
            }
            if (item.type === 'checkbox') {
              return (
                <label
                  key={item.label}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-hover"
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => item.onChange(e.target.checked)}
                    className="accent-accent"
                  />
                  <span>{item.label}</span>
                </label>
              )
            }
            if (item.type === 'select') {
              return (
                <div
                  key={item.label}
                  className="flex items-center justify-between px-3 py-1.5 text-sm text-text-primary hover:bg-hover transition-colors w-full"
                >
                  <span>{item.label}</span>
                  <select
                    className="bg-secondary border border-border rounded px-1 py-0.5 text-xs text-text-primary focus:outline-none focus:border-accent max-w-[120px]"
                    value={item.value}
                    onChange={(e) => item.onChange(e.target.value)}
                  >
                    {item.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )
            }
            if (item.type === 'custom') {
              return (
                <div key={`custom-${idx}`} className="px-3 py-1.5 w-full">
                  {item.render()}
                </div>
              )
            }
            // Default: button
            return (
              <button
                key={item.label}
                className={`dropdown-item flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-[background-color,color,opacity] duration-150 focus:outline-none ${item.disabled ? 'cursor-not-allowed text-text-muted opacity-50' : 'hover:bg-hover focus:bg-hover'} ${item.danger ? 'text-danger hover:bg-danger/10 hover:text-danger focus:bg-danger/10' : 'text-text-primary'}`}
                onClick={() => {
                  item.onClick?.()
                  if (!item.keepOpen) onClose()
                }}
                disabled={item.disabled}
              >
                {item.icon && <item.icon size={15} />}
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <span className="text-xs text-text-muted opacity-70 ml-2">{item.shortcut}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
