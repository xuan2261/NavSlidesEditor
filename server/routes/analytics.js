const express = require('express')
const { readShareTokens, readAnalytics, withAnalytics } = require('../services/storage')

const router = express.Router()

function getReferrerHost(value) {
  if (!value) return ''
  try {
    const url = new URL(String(value))
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.hostname : ''
  } catch {
    return ''
  }
}

function getLinkLabel(token, shareTokens) {
  const tokenData = shareTokens[token]
  if (tokenData && typeof tokenData === 'object' && tokenData.name) {
    return String(tokenData.name).slice(0, 200)
  }
  return tokenData ? 'Share link' : 'Revoked share link'
}

// Record a view event (called internally from share route)
async function recordView(presentationId, token, referrer = '') {
  await withAnalytics((analytics) => {
    if (!analytics[presentationId]) {
      analytics[presentationId] = { totalViews: 0, events: [] }
    }
    analytics[presentationId].totalViews++
    const events = analytics[presentationId].events
    events.push({
      timestamp: new Date().toISOString(),
      token,
      referrerHost: getReferrerHost(referrer),
    })
    if (events.length > 200) {
      analytics[presentationId].events = events.slice(-200)
    }
  })
}

// GET /api/analytics/:id — owner/editor surface. Deployment authentication is
// supplied by the operator's reverse proxy; share tokens are never accepted as
// analytics capabilities.
router.get('/:id', async (req, res) => {
  try {
    const [analytics, shareTokens] = await Promise.all([readAnalytics(), readShareTokens()])
    const data = analytics[req.params.id] || { totalViews: 0, events: [] }
    const events = Array.isArray(data.events) ? data.events : []

    const dailyMap = new Map()
    const linkMap = new Map()
    for (const event of events) {
      const day = String(event.timestamp || '').split('T')[0]
      if (day) dailyMap.set(day, (dailyMap.get(day) || 0) + 1)

      const label = getLinkLabel(event.token, shareTokens)
      linkMap.set(label, (linkMap.get(label) || 0) + 1)
    }

    const dailyViews = [...dailyMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((left, right) => left.date.localeCompare(right.date))
    const byLinkLabels = Object.fromEntries(linkMap)
    const recentEvents = events
      .slice(-20)
      .reverse()
      .map((event) => ({
        timestamp: event.timestamp,
        referrerHost: event.referrerHost || getReferrerHost(event.referrer),
      }))

    res.set('Cache-Control', 'no-store')
    res.json({
      totalViews: Number(data.totalViews) || 0,
      dailyViews,
      byLinkLabels,
      recentEvents,
    })
  } catch {
    res.status(500).json({ error: 'Failed to load analytics' })
  }
})

module.exports = router
module.exports.recordView = recordView
