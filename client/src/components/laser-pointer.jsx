import React from 'react'

export function LaserPointer({ position, visible }) {
  if (!visible || !position) return null
  return (
    <div
      className="laser-pointer"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        pointerEvents: 'none',
        zIndex: 99998,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          backgroundColor: '#FF0000',
          borderRadius: '50%',
          boxShadow: '0 0 8px #FF0000, 0 0 16px #FF0000',
        }}
      />
    </div>
  )
}
