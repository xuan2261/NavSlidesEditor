
export function PresenterControls({ teams, activeTeam, onSelectTeam, _onReveal, _onReturn, _accentColor, showFinalJeopardy }) {
  return (
    <div style={{
      display: 'flex',
      gap: 8,
      flexShrink: 0,
      paddingTop: 8,
      justifyContent: 'center',
      flexWrap: 'wrap',
      alignItems: 'center',
    }}>
      {/* Team selection */}
      {teams.map((team, i) => (
        <button
          key={team.id || i}
          type="button"
          aria-pressed={activeTeam === (team.id || team.name)}
          onClick={() => onSelectTeam && onSelectTeam(team.id || team.name)}
          style={{
            background: activeTeam === (team.id || team.name) ? team.color : 'rgba(255,255,255,0.1)',
            border: `2px solid ${team.color}`,
            borderRadius: 6,
            padding: '3px 10px',
            color: 'white',
            fontSize: 10,
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          {team.name}
        </button>
      ))}

      {showFinalJeopardy && (
        <button
          type="button"
          onClick={showFinalJeopardy}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            padding: '3px 10px',
            color: 'rgba(255,255,255,0.7)',
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          Final Jeopardy
        </button>
      )}
    </div>
  )
}
