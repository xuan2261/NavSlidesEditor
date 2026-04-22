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
    <div className={`p-4 border-b border-border ${className}`}>
      <div
        className={`flex items-center justify-between cursor-pointer select-none mb-3`}
        onClick={() => setIsOpen((v) => !v)}
      >
        <h3 className="text-[12px] font-medium text-text-secondary capitalize mb-0">{title}</h3>
        <ChevronDown
          size={18}
          className={`text-text-muted transition-transform duration-200 ${!isOpen ? '-rotate-90' : ''}`}
        />
      </div>
      {isOpen && <div className="overflow-hidden">{children}</div>}
    </div>
  )
}
