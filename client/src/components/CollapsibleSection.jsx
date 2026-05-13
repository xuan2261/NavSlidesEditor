import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * A collapsible section for the properties panel.
 * Click the header to toggle visibility.
 */
export default function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={`border-b border-border p-4 ${className}`}>
      <button
        type="button"
        className="mb-3 flex w-full items-center justify-between rounded-md text-left transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/30"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
      >
        <h3 className="mb-0 text-[12px] font-semibold capitalize text-text-secondary">{title}</h3>
        <ChevronDown
          size={18}
          className={`text-text-muted transition-transform duration-200 ${!isOpen ? '-rotate-90' : ''}`}
        />
      </button>
      {isOpen && <div className="overflow-hidden">{children}</div>}
    </div>
  )
}
