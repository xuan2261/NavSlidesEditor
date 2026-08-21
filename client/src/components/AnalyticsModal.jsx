import { useState, useEffect } from 'react'
import { Eye, TrendingUp, Clock, Loader2 } from 'lucide-react'
import { ModalShell } from '../components/ui'

export default function AnalyticsModal({ presentationId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        setLoading(true)
        setError('')
        const analyticsRes = await fetch(`/api/analytics/${presentationId}`)
        if (!analyticsRes.ok) throw new Error('Failed to load analytics')
        const analyticsData = await analyticsRes.json()
        if (mounted) setData(analyticsData)
      } catch (err) {
        if (mounted) {
          setData(null)
          setError(err.message || 'Failed to load analytics')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [presentationId])

  const maxDaily = data?.dailyViews?.reduce((m, d) => Math.max(m, d.count), 0) || 1

  const [isOpen, setIsOpen] = useState(true)

  const handleClose = () => {
    setIsOpen(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <ModalShell
      titleId="analytics-modal-title"
      title="Analytics"
      onClose={handleClose}
      size="lg"
      bodyClassName="max-h-[75vh]"
    >
      {loading ? (
        <div className="text-center p-10 text-text-muted">
          <Loader2 size={20} className="animate-spin" /> Loading...
        </div>
      ) : error ? (
        <p className="text-text-muted text-center">{error}</p>
      ) : !data ? (
        <p className="text-text-muted text-center">No analytics data yet.</p>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-secondary rounded-lg px-4 py-3.5 flex items-center gap-3">
              <Eye size={20} color="var(--accent, #6366f1)" />
              <div>
                <div className="text-2xl font-bold text-text-primary">{data.totalViews}</div>
                <div className="text-xs text-text-muted">Total Views</div>
              </div>
            </div>
            <div className="bg-secondary rounded-lg px-4 py-3.5 flex items-center gap-3">
              <TrendingUp size={20} color="#22c55e" />
              <div>
                <div className="text-2xl font-bold text-text-primary">
                  {data.dailyViews?.length || 0}
                </div>
                <div className="text-xs text-text-muted">Active Days</div>
              </div>
            </div>
          </div>

          {/* Daily views bar chart */}
          {data.dailyViews?.length > 0 && (
            <div className="mb-5">
              <h4 className="m-0 mb-2.5 text-[13px] text-text-muted font-medium">
                Views Over Time
              </h4>
              <div className="flex items-end gap-0.5 h-20 px-1 bg-secondary rounded-lg">
                {data.dailyViews.slice(-30).map((d, i) => (
                  <div
                    key={i}
                    title={`${d.date}: ${d.count} views`}
                    className="flex-1 min-w-[4px] rounded-t-sm cursor-pointer transition-opacity"
                    style={{
                      height: `${Math.max(4, (d.count / maxDaily) * 100)}%`,
                      background: 'var(--accent, #6366f1)',
                      opacity: 0.7 + (d.count / maxDaily) * 0.3,
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
              <div className="flex justify-between text-[10px] text-text-muted mt-1 px-1">
                <span>{data.dailyViews[0]?.date}</span>
                <span>{data.dailyViews[data.dailyViews.length - 1]?.date}</span>
              </div>
            </div>
          )}

          {/* Per-link breakdown */}
          {Object.keys(data.byLinkLabels || {}).length > 0 && (
            <div className="mb-5">
              <h4 className="m-0 mb-2.5 text-[13px] text-text-muted font-medium">Views by Link</h4>
              <div className="flex flex-col gap-1.5">
                {Object.entries(data.byLinkLabels)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([label, count]) => (
                    <div
                      key={label}
                      className="flex justify-between items-center px-2.5 py-1.5 bg-secondary rounded-md text-[13px]"
                    >
                      <span className="text-text-muted text-[11px]">{label}</span>
                      <span className="font-semibold text-text-primary">{count} views</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Recent events */}
          {data.recentEvents?.length > 0 && (
            <div>
              <h4 className="m-0 mb-2.5 text-[13px] text-text-muted font-medium">
                <Clock size={12} className="inline-block align-middle mr-1" />
                Recent Views
              </h4>
              <div className="max-h-[140px] overflow-y-auto">
                {data.recentEvents.slice(0, 10).map((e, i) => (
                  <div key={i} className="flex justify-between py-1 text-xs border-b border-border">
                    <span className="text-text-muted">
                      {new Date(e.timestamp).toLocaleString()}
                    </span>
                    <span className="text-text-muted text-[11px]">
                      {e.referrerHost || 'Direct / unknown'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </ModalShell>
  )
}
