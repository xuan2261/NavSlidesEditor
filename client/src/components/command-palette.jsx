import React, { useState, useEffect, useRef, startTransition } from 'react'

export function CommandPalette({ open, onClose, commands = [] }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      startTransition(() => { setQuery(''); setSelectedIndex(0) })
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    startTransition(() => setSelectedIndex(0))
  }, [query])

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action()
        onClose()
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-start justify-center bg-black/50 pt-[100px]"
      onClick={onClose}
    >
      <div
        className="w-[min(500px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-card shadow-[0_8px_32px_rgba(0,0,0,0.36)]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
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
            <li
              key={cmd.id}
              onClick={() => {
                cmd.action()
                onClose()
              }}
              className={`flex cursor-pointer items-center justify-between px-4 py-2.5 ${
                i === selectedIndex ? 'bg-hover' : 'bg-transparent'
              }`}
            >
              <span className="text-text-primary">{cmd.label}</span>
              {cmd.shortcut && (
                <kbd className="rounded bg-secondary px-2 py-0.5 text-xs text-text-secondary">
                  {cmd.shortcut}
                </kbd>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
