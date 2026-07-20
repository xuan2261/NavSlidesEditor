import { useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import RibbonFloatingOverlay from './ribbon-floating-overlay'

export default function RibbonOverflowGroupMenu({ label, children }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  useLayoutEffect(() => {
    if (!open) return
    menuRef.current?.querySelector('button,[href],input,select')?.focus()
  }, [open])

  const toggleFromKeyboard = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    setOpen((value) => !value)
  }

  return (
    <div className="flex h-full shrink-0 items-center px-1">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        className="flex min-h-11 items-center gap-1 rounded-md px-2 text-xs text-text-primary hover:bg-secondary"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={toggleFromKeyboard}
      >
        {label}
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      <RibbonFloatingOverlay
        open={open}
        anchorRef={triggerRef}
        onClose={() => setOpen(false)}
        role="group"
        ariaLabel={label}
        dataRibbonPopup={`overflow-${label.toLowerCase().replaceAll(' ', '-')}`}
        className="rounded-lg border border-border bg-card p-1 shadow-xl"
      >
        <div
          ref={menuRef}
          className="flex min-h-[64px] items-stretch"
          onClick={(event) => {
            if (event.target.closest('button,a[href]')) setOpen(false)
          }}
        >
          {children}
        </div>
      </RibbonFloatingOverlay>
    </div>
  )
}
