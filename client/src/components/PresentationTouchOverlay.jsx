import React from 'react'

export function PresentationTouchOverlay({
  visible,
  onPrev,
  onNext,
  onToggleControls,
  onBlackScreen,
}) {
  if (!visible) return null

  return (
    <div
      className="presentation-touch-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        pointerEvents: 'all',
        zIndex: 1,
      }}
    >
      <div
        className="touch-zone zone-prev"
        onClick={onPrev}
        style={{ flex: 1, cursor: 'w-resize' }}
        title="Previous slide"
      />
      <div
        className="touch-zone zone-center"
        onClick={onToggleControls}
        style={{ flex: 1, cursor: 'pointer' }}
        title="Toggle controls"
      />
      <div
        className="touch-zone zone-next"
        onClick={onNext}
        style={{ flex: 1, cursor: 'e-resize' }}
        title="Next slide"
      />
    </div>
  )
}
