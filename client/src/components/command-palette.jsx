import React, { useState, useEffect, useRef, startTransition } from 'react'

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

export function CommandPalette({ open, onClose, commands = [] }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement
      startTransition(() => { setQuery(''); setSelectedIndex(0) })
      setTimeout(() => inputRef.current?.focus(), 10)
    }
    return () => {
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus?.()
    }
  }, [open])

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  )

  const closeAndRestoreFocus = () => {
    onClose()
    const previousFocus = previousFocusRef.current
    setTimeout(() => {
      if (previousFocus?.isConnected) previousFocus.focus?.()
    }, 0)
  }

  useEffect(() => {
    startTransition(() => setSelectedIndex(0))
  }, [query])

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action()
        closeAndRestoreFocus()
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      closeAndRestoreFocus()
    }
  }

  const handleDialogKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeAndRestoreFocus()
      return
    }
    if (e.key === 'Tab') {
      const focusable = Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || [])
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-start justify-center bg-black/50 pt-[100px]"
      onClick={closeAndRestoreFocus}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        className="w-[min(500px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-card shadow-[0_8px_32px_rgba(0,0,0,0.36)]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
      >
        <h2 id="command-palette-title" className="sr-only">
          Command palette
        </h2>
        <input
          ref={inputRef}
          aria-label="Search commands"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command..."
          className="box-border w-full border-0 bg-card p-4 text-base text-text-primary outline-none placeholder:text-text-muted"
        />
        <ul
          className="m-0 max-h-[300px] list-none overflow-y-auto p-0"
        >
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-text-muted">
              No commands found
            </li>
          )}
          {filtered.map((cmd, i) => (
            <li key={cmd.id}>
              <button
                type="button"
                onClick={() => {
                  cmd.action()
                  closeAndRestoreFocus()
                }}
                className={`flex w-full cursor-pointer items-center justify-between border-0 px-4 py-2.5 text-left ${
                  i === selectedIndex ? 'bg-hover' : 'bg-transparent'
                }`}
              >
                <span className="text-text-primary">{cmd.label}</span>
                {cmd.shortcut && (
                  <kbd className="rounded bg-secondary px-2 py-0.5 text-xs text-text-secondary">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
