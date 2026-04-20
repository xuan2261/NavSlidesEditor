import { Radio, Play, X } from 'lucide-react'

export default function LivePresentationModal({ presentationId, roomCode, onClose }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg-card, #1e1e2e)', borderRadius: 12, padding: 24, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}><Radio size={18} /> Present Live</h3>
          <button onClick={onClose} className="btn-icon" style={{ padding: 4 }}><X size={16} /></button>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Room Code</div>
          <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'monospace', letterSpacing: 4, color: 'var(--text)', padding: '12px 0' }}>{roomCode}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Share these links:</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={`${window.location.origin}/live/${roomCode}`} style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 12 }} onClick={e => { e.target.select(); navigator.clipboard.writeText(e.target.value) }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>Viewer</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input readOnly value={`${window.location.origin}/remote/${roomCode}`} style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text)', fontSize: 12 }} onClick={e => { e.target.select(); navigator.clipboard.writeText(e.target.value) }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>Remote</span>
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { window.open(`/api/presentations/${presentationId}/present?live=${roomCode}`, '_blank'); onClose() }}
          style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
        >
          <Play size={14} /> Start Presenting
        </button>
      </div>
    </div>
  )
}
