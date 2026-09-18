
export function TeamScorePanel({ teams, scores, activeTeam, onSelectTeam }) {
  if (!teams || teams.length === 0) return null
  return (
    <div style={{
      display: 'flex',
      gap: 8,
      flexShrink: 0,
      paddingTop: 8,
      justifyContent: 'center',
      flexWrap: 'wrap',
    }}>
      {teams.map((team, i) => {
        const teamId = team.id || team.name
        const isActive = activeTeam === teamId
        const score = scores[teamId] || 0
        const style = {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: isActive ? `${team.color}30` : 'rgba(255,255,255,0.05)',
          border: `2px solid ${isActive ? team.color : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 8,
          padding: '4px 12px',
          cursor: onSelectTeam ? 'pointer' : 'default',
          transition: 'border-color 0.2s, background 0.2s',
          minWidth: 100,
          color: 'inherit',
          fontFamily: 'inherit',
        }
        const content = (
          <>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: team.color, flexShrink: 0 }} />
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', lineHeight: 1.2 }}>{team.name}</span>
              <span data-testid="game-score" style={{ fontSize: 13, fontWeight: 'bold', color: team.color, lineHeight: 1.2 }}>{score}</span>
            </span>
            {isActive && <span aria-hidden="true" style={{ fontSize: 9, color: team.color }}>▶</span>}
          </>
        )
        return onSelectTeam ? (
          <button
            type="button"
            key={teamId || i}
            onClick={() => onSelectTeam(teamId)}
            aria-label={`Select ${team.name}, score ${score}`}
            aria-pressed={isActive}
            style={style}
          >
            {content}
          </button>
        ) : (
          <div key={teamId || i} style={style}>{content}</div>
        )
      })}
    </div>
  )
}
