/**
 * Placeholder renderer for game elements.
 * Full interactive game canvas rendering will be implemented in Phase 3.
 *
 * Accepts two prop patterns:
 *  - Flat:  { type, gameType, gameStatus, ... }
 *  - Nested: { element: { type, gameType, gameStatus, ... } }
 */
export function GameElementRenderer(props) {
  // Support both flat and nested element prop patterns.
  const el = props.element ?? props

  const gameTypeLabels = {
    'name-picker': 'Name Picker',
    'hot-potato': 'Hot Potato Quiz',
    'jeopardy': 'Jeopardy',
    'four-corners': 'Four Corners',
    'relay-race': 'Relay Race',
    'trivia-champ': 'Trivia Championship',
    'scattergories': 'Scattergories',
  }

  const label = gameTypeLabels[el.gameType] || el.gameType || 'Game'

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: el.backgroundColor || '#1a1a2e',
        borderRadius: 8,
        color: '#ffffff',
        fontFamily: 'sans-serif',
        gap: 12,
        userSelect: 'none',
      }}
    >
      <div style={{ fontSize: 48, lineHeight: 1 }}>
        {el.gameType === 'name-picker' && '🎡'}
        {el.gameType === 'hot-potato' && '🔥'}
        {el.gameType === 'jeopardy' && '🏆'}
        {el.gameType === 'four-corners' && '🧭'}
        {el.gameType === 'relay-race' && '🏃'}
        {el.gameType === 'trivia-champ' && '💡'}
        {el.gameType === 'scattergories' && '📝'}
      </div>
      <div style={{
        fontSize: 14,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: el.accentColor || '#6366f1',
      }}>
        Game: {label}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
        {el.gameStatus === 'setup' ? 'Configure in properties panel' : el.gameStatus}
      </div>
    </div>
  )
}
