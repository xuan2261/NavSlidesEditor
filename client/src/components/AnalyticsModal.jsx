import { useState, useEffect } from 'react'
import { BarChart3, X, Eye, TrendingUp, Clock, Loader2 } from 'lucide-react'
import { Button } from '../components/ui'

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 10000,
}
const modal = {
  background: 'var(--bg-card)',
  borderRadius: 12,
  padding: 24,
  width: 560,
  maxHeight: '85vh',
  overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  border: '1px solid var(--border)',
}

export default function AnalyticsModal({ presentationId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/analytics/${presentationId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [presentationId])

  const maxDaily = data?.dailyViews?.reduce((m, d) => Math.max(m, d.count), 0) || 1

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
            <BarChart3 size={18} /> Analytics
          </h3>
          <Button variant="icon" onClick={onClose} style={{ padding: 4 }}>
            <X size={16} />
          </Button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <Loader2 size={20} className="spin" /> Loading...
          </div>
        ) : !data ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No analytics data yet.</p>
        ) : (
          <>
            {/* Stats row */}
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}
            >
              <div
                style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: 8,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Eye size={20} color="var(--accent, #6366f1)" />
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
                    {data.totalViews}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Views</div>
                </div>
              </div>
              <div
                style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: 8,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <TrendingUp size={20} color="#22c55e" />
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
                    {data.dailyViews?.length || 0}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Active Days</div>
                </div>
              </div>
            </div>

            {/* Daily views bar chart */}
            {data.dailyViews?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4
                  style={{
                    margin: '0 0 10px',
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                  }}
                >
                  Views Over Time
                </h4>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 2,
                    height: 80,
                    padding: '0 4px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 8,
                  }}
                >
                  {data.dailyViews.slice(-30).map((d, i) => (
                    <div
                      key={i}
                      title={`${d.date}: ${d.count} views`}
                      style={{
                        flex: 1,
                        minWidth: 4,
                        height: `${Math.max(4, (d.count / maxDaily) * 100)}%`,
                        background: 'var(--accent, #6366f1)',
                        borderRadius: '3px 3px 0 0',
                        opacity: 0.7 + (d.count / maxDaily) * 0.3,
                        cursor: 'pointer',
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = `${0.7 + (d.count / maxDaily) * 0.3}`
                      }}
                    />
                  ))}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    marginTop: 4,
                    padding: '0 4px',
                  }}
                >
                  <span>{data.dailyViews[0]?.date}</span>
                  <span>{data.dailyViews[data.dailyViews.length - 1]?.date}</span>
                </div>
              </div>
            )}

            {/* Per-token breakdown */}
            {Object.keys(data.byToken || {}).length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4
                  style={{
                    margin: '0 0 10px',
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                  }}
                >
                  Views by Link
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(data.byToken)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([token, count]) => (
                      <div
                        key={token}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 10px',
                          background: 'var(--bg-secondary)',
                          borderRadius: 6,
                          fontSize: 13,
                        }}
                      >
                        <span
                          style={{
                            color: 'var(--text-muted)',
                            fontFamily: 'monospace',
                            fontSize: 11,
                          }}
                        >
                          ...{token.slice(-8)}
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{count} views</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Recent events */}
            {data.recentEvents?.length > 0 && (
              <div>
                <h4
                  style={{
                    margin: '0 0 10px',
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                  }}
                >
                  <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Recent Views
                </h4>
                <div style={{ maxHeight: 140, overflowY: 'auto' }}>
                  {data.recentEvents.slice(0, 10).map((e, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '4px 0',
                        fontSize: 12,
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <span style={{ color: 'var(--text-muted)' }}>
                        {new Date(e.timestamp).toLocaleString()}
                      </span>
                      <span
                        style={{
                          color: 'var(--text-muted)',
                          fontFamily: 'monospace',
                          fontSize: 11,
                        }}
                      >
                        ...{e.token.slice(-6)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
