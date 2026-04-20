import { useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Reusable dropdown menu component for the editor menu bar.
 * Supports item types: button, separator, checkbox, select, custom.
 */
export default function DropdownMenu({ label, items, isOpen, onToggle, onClose }) {
  const menuRef = useRef(null)

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
    <div className="dropdown-menu-wrapper" ref={menuRef}>
      <button
        className={`menu-trigger ${isOpen ? 'open' : ''}`}
        onClick={onToggle}
      >
        {label} <ChevronDown size={12} style={{ opacity: 0.5, marginLeft: 2 }} />
      </button>
      {isOpen && (
        <div className="dropdown-panel">
          {items.map((item, idx) => {
            if (item.type === 'separator') {
              return <div key={`sep-${idx}`} className="dropdown-separator" />
            }
            if (item.type === 'label') {
              return (
                <div key={`lbl-${idx}`} className="dropdown-item" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', pointerEvents: 'none', paddingTop: 4, paddingBottom: 2 }}>
                  {item.label}
                </div>
              )
            }
            if (item.type === 'checkbox') {
              return (
                <label key={item.label} className="dropdown-item dropdown-checkbox">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => item.onChange(e.target.checked)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span>{item.label}</span>
                </label>
              )
            }
            if (item.type === 'select') {
              return (
                <div key={item.label} className="dropdown-item dropdown-select-row">
                  <span>{item.label}</span>
                  <select
                    className="select-sm"
                    value={item.value}
                    onChange={(e) => item.onChange(e.target.value)}
                    style={{ maxWidth: 120 }}
                  >
                    {item.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )
            }
            if (item.type === 'custom') {
              return <div key={`custom-${idx}`} className="dropdown-custom">{item.render()}</div>
            }
            // Default: button
            return (
              <button
                key={item.label}
                className="dropdown-item"
                onClick={() => {
                  item.onClick?.()
                  if (!item.keepOpen) onClose()
                }}
                disabled={item.disabled}
                style={item.danger ? { color: 'var(--danger)' } : undefined}
              >
                {item.icon && <item.icon size={15} />}
                <span>{item.label}</span>
                {item.shortcut && <span className="shortcut">{item.shortcut}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
