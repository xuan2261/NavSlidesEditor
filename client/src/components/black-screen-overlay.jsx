import React from 'react'

export function BlackScreenOverlay({ visible, color = 'black', onDismiss }) {
  if (!visible) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: color === 'black' ? '#000' : '#fff',
        cursor: 'pointer',
      }}
      onClick={onDismiss}
    />
  )
}
