import React from 'react'
import { GAME_SHORTCUT_CONFIG } from '../utils/game-shortcut-config'

export function GameHudOverlay({ visible, gameType, onClose }) {
  if (!visible || !gameType) return null
  // Normalize gameType to kebab-case to match GAME_SHORTCUT_CONFIG keys
  const toKebab = (str) => str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
  const config = GAME_SHORTCUT_CONFIG[toKebab(gameType)]
  if (!config) return null

  return (
    <div
      data-testid="game-hud"
      className="game-hud-overlay"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'rgba(0,0,0,0.85)',
        color: '#fff',
        padding: '24px',
        borderRadius: '12px',
        zIndex: 99998,
        minWidth: '300px',
        maxWidth: '500px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          paddingBottom: '12px',
        }}
      >
        <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
          {gameType} — Game Controls
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: '24px',
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Object.entries(config)
          .filter(([, v]) => v !== null)
          .map(([action, cfg]) => (
            <div
              key={action}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <kbd
                style={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  minWidth: '40px',
                  textAlign: 'center',
                }}
              >
                {Array.isArray(cfg.keys) ? cfg.keys.join(',') : cfg.key}
              </kbd>
              <span style={{ fontSize: '14px' }}>{cfg.label}</span>
            </div>
          ))}
      </div>
      <p
        style={{
          marginTop: '16px',
          fontSize: '12px',
          color: 'rgba(255,255,255,0.6)',
          textAlign: 'center',
        }}
      >
        Press G or click outside to close
      </p>
    </div>
  )
}
