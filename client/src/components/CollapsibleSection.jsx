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
    <div className={`prop-section ${className}`}>
      <div
        className={`prop-section-header ${!isOpen ? 'collapsed' : ''}`}
        onClick={() => setIsOpen((v) => !v)}
      >
        <h3>{title}</h3>
        <ChevronDown size={14} />
      </div>
      {isOpen && <div className="prop-section-body">{children}</div>}
    </div>
  )
}
