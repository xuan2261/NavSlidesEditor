import React from 'react'
import { PEN_COLORS, HIGHLIGHTER_COLORS } from '../utils/annotation-colors.js'

export function AnnotationToolbar({
  tool,
  color,
  onToolChange,
  onColorChange,
  onClear,
  visible,
}) {
  if (!visible) return null

  const tools = [
    { id: 'none', label: 'Select', title: 'Select (Esc)' },
    { id: 'pen', label: 'Pen', title: 'Pen (Ctrl+Shift+O)' },
    { id: 'laser', label: 'Laser', title: 'Laser Pointer (Ctrl+I)' },
    { id: 'highlighter', label: 'Highlight', title: 'Highlighter (Y)' },
    { id: 'eraser', label: 'Eraser', title: 'Eraser (E)' },
  ]

  return (
    <div
      className="annotation-toolbar"
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderRadius: '8px',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        zIndex: 99995,
      }}
    >
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={() => onToolChange(t.id)}
          title={t.title}
          aria-label={t.label}
          aria-pressed={tool === t.id}
          style={{
            backgroundColor: tool === t.id ? 'rgba(255,255,255,0.2)' : 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            borderRadius: '4px',
            padding: '6px 10px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          {t.label}
        </button>
      ))}

      {(tool === 'pen' || tool === 'highlighter') && (
        <>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'rgba(255,255,255,0.2)' }} />
          <div style={{ display: 'flex', gap: '4px' }}>
            {(tool === 'highlighter' ? HIGHLIGHTER_COLORS : PEN_COLORS).slice(0, 6).map((c) => (
              <button
                key={c}
                onClick={() => onColorChange(c)}
                aria-label={`Use ${c} annotation color`}
                aria-pressed={color === c}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: c,
                  border: color === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </>
      )}

      <div style={{ width: '1px', height: '24px', backgroundColor: 'rgba(255,255,255,0.2)' }} />
      <button
        onClick={onClear}
        title="Clear All (E)"
        style={{
          backgroundColor: 'transparent',
          border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff',
          borderRadius: '4px',
          padding: '6px 10px',
          cursor: 'pointer',
          fontSize: '12px',
        }}
      >
        Clear
      </button>
    </div>
  )
}
