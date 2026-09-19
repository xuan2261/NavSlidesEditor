
export function GameControls({ element }) {
  const isRunning = element.gameStatus === 'running'

  return (
    <div style={{
      position: 'absolute',
      bottom: 12,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
    }}>
      <button
        disabled={isRunning}
        style={{
          background: element.accentColor || '#6366f1',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          padding: '6px 24px',
          fontSize: 13,
          fontWeight: 'bold',
          fontFamily: 'sans-serif',
          cursor: isRunning ? 'default' : 'pointer',
          opacity: isRunning ? 0.5 : 1,
          pointerEvents: isRunning ? 'none' : 'auto',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {isRunning ? 'Running…' : element.gameType === 'hot-potato' ? 'START' : 'SPIN'}
      </button>
    </div>
  )
}
