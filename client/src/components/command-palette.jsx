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
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '100px',
        zIndex: 100000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '500px',
          backgroundColor: '#1e1e2e',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command..."
          style={{
            width: '100%',
            padding: '16px',
            border: 'none',
            backgroundColor: '#1e1e2e',
            color: '#fff',
            fontSize: '16px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          {filtered.length === 0 && (
            <li
              style={{
                padding: '12px 16px',
                color: 'rgba(255,255,255,0.4)',
              }}
            >
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
              style={{
                padding: '10px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: i === selectedIndex ? 'rgba(255,255,255,0.1)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <span style={{ color: '#fff' }}>{cmd.label}</span>
              {cmd.shortcut && (
                <kbd
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.7)',
                  }}
                >
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
