const CROP_HANDLES = [
  { id: 'nw', px: 0, py: 0, cursor: 'nw-resize' },
  { id: 'n', px: 0.5, py: 0, cursor: 'n-resize' },
  { id: 'ne', px: 1, py: 0, cursor: 'ne-resize' },
  { id: 'e', px: 1, py: 0.5, cursor: 'e-resize' },
  { id: 'se', px: 1, py: 1, cursor: 'se-resize' },
  { id: 's', px: 0.5, py: 1, cursor: 's-resize' },
  { id: 'sw', px: 0, py: 1, cursor: 'sw-resize' },
  { id: 'w', px: 0, py: 0.5, cursor: 'w-resize' },
]

export function CropOverlay({ crop, elW: _elW, elH: _elH, onHandleDown, onCommit }) {
  const { x, y, w, h } = crop
  const dimStyle = { position: 'absolute', background: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }

  const handleMouseDown = (e, handle) => {
    e.stopPropagation()
    e.preventDefault()
    onHandleDown(handle, e.clientX, e.clientY)
  }

  const cropOverlayStyle = {
    position: 'absolute',
    inset: 0,
    zIndex: 50,
  }
  const cropTopDimStyle = { ...dimStyle, top: 0, left: 0, right: 0, height: `${y * 100}%` }
  const cropBottomDimStyle = {
    ...dimStyle,
    bottom: 0,
    left: 0,
    right: 0,
    height: `${(1 - y - h) * 100}%`,
  }
  const cropLeftDimStyle = {
    ...dimStyle,
    top: `${y * 100}%`,
    left: 0,
    width: `${x * 100}%`,
    height: `${h * 100}%`,
  }
  const cropRightDimStyle = {
    ...dimStyle,
    top: `${y * 100}%`,
    right: 0,
    width: `${(1 - x - w) * 100}%`,
    height: `${h * 100}%`,
  }
  const cropBorderStyle = {
    position: 'absolute',
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    width: `${w * 100}%`,
    height: `${h * 100}%`,
    border: '2px solid white',
    boxSizing: 'border-box',
    pointerEvents: 'none',
    boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
  }
  const getCropVerticalGuideStyle = (fraction) => ({
    position: 'absolute',
    left: `${(x + fraction * w) * 100}%`,
    top: `${y * 100}%`,
    width: 1,
    height: `${h * 100}%`,
    background: 'rgba(255,255,255,0.3)',
    pointerEvents: 'none',
  })
  const getCropHorizontalGuideStyle = (fraction) => ({
    position: 'absolute',
    top: `${(y + fraction * h) * 100}%`,
    left: `${x * 100}%`,
    height: 1,
    width: `${w * 100}%`,
    background: 'rgba(255,255,255,0.3)',
    pointerEvents: 'none',
  })
  const getCropHandleStyle = (handle) => ({
    position: 'absolute',
    left: `calc(${(x + handle.px * w) * 100}% - 5px)`,
    top: `calc(${(y + handle.py * h) * 100}% - 5px)`,
    width: 10,
    height: 10,
    background: 'white',
    border: '1px solid rgba(0,0,0,0.5)',
    borderRadius: 2,
    cursor: handle.cursor,
    zIndex: 51,
  })
  const cropCommitStyle = {
    position: 'absolute',
    left: `${(x + w) * 100}%`,
    top: `${y * 100}%`,
    transform: 'translate(6px, -28px)',
    background: '#f59e0b',
    color: 'white',
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    fontFamily: 'sans-serif',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    zIndex: 52,
  }

  return (
    <div style={cropOverlayStyle} onDoubleClick={onCommit}>
      <div style={cropTopDimStyle} />
      <div style={cropBottomDimStyle} />
      <div style={cropLeftDimStyle} />
      <div style={cropRightDimStyle} />
      <div style={cropBorderStyle} />
      {[1 / 3, 2 / 3].map((f) => (
        <div key={`v${f}`} style={getCropVerticalGuideStyle(f)} />
      ))}
      {[1 / 3, 2 / 3].map((f) => (
        <div key={`hz${f}`} style={getCropHorizontalGuideStyle(f)} />
      ))}
      {CROP_HANDLES.map((ch) => (
        <div
          key={ch.id}
          style={getCropHandleStyle(ch)}
          onMouseDown={(e) => handleMouseDown(e, ch.id)}
        />
      ))}
      <div
        style={cropCommitStyle}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onCommit}
      >
        Apply ↵
      </div>
    </div>
  )
}

export { CROP_HANDLES }
