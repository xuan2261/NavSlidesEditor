import React from 'react'
export function DailyDoubleWagerModal({ teams, scores, maxWager, onSubmit, onCancel }) {
  const [wagerAmount, setWagerAmount] = React.useState(() => {
    const first = teams[0]
    return first ? Math.min(scores[first.id] || 0, maxWager) : maxWager
  })
  const [selectedTeamId, setSelectedTeamId] = React.useState(teams[0]?.id || null)

  const getMaxWager = (teamId) => {
    const teamScore = scores[teamId] || 0
    return Math.max(teamScore, maxWager)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 20, zIndex: 9999, padding: 16,
    }}>
      <div style={{ fontSize: 36, lineHeight: 1 }}>🎯</div>
      <div style={{ fontSize: 22, fontWeight: 'bold', color: '#fbbf24', fontFamily: 'sans-serif' }}>
        Daily Double!
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: 'sans-serif' }}>
        Select team and enter wager
      </div>

      {/* Team selection */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {teams.map(team => (
          <button
            key={team.id || team.name}
            onClick={() => {
              setSelectedTeamId(team.id || team.name)
              setWagerAmount(Math.min(scores[team.id] || 0, maxWager))
            }}
            style={{
              background: selectedTeamId === (team.id || team.name) ? team.color : 'rgba(255,255,255,0.1)',
              border: `2px solid ${team.color}`,
              borderRadius: 8,
              padding: '8px 16px',
              color: 'white',
              fontSize: 13,
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <span>{team.name}</span>
            <span style={{ fontSize: 11, opacity: 0.7 }}>{scores[team.id] || 0} pts</span>
          </button>
        ))}
      </div>

      {/* Wager input */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'sans-serif' }}>
          Wager (max: {getMaxWager(selectedTeamId)})
        </label>
        <input
          type="number"
          min={0}
          max={getMaxWager(selectedTeamId)}
          value={wagerAmount}
          onChange={e => setWagerAmount(Math.max(0, Math.min(getMaxWager(selectedTeamId), parseInt(e.target.value, 10) || 0)))}
          style={{
            width: 160,
            background: 'rgba(255,255,255,0.1)',
            border: '2px solid #fbbf24',
            borderRadius: 8,
            padding: '8px 16px',
            color: 'white',
            fontSize: 18,
            fontWeight: 'bold',
            textAlign: 'center',
            fontFamily: 'sans-serif',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onCancel}
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '10px 24px', color: 'white', fontSize: 13, cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          onClick={() => selectedTeamId && onSubmit(selectedTeamId, wagerAmount)}
          style={{ background: '#fbbf24', border: 'none', borderRadius: 8, padding: '10px 24px', color: '#1a1a2e', fontSize: 13, fontWeight: 'bold', cursor: 'pointer' }}
        >
          Place Wager
        </button>
      </div>
    </div>
  )
}
