const express = require('express')
const { readShareTokens, readAnalytics, withAnalytics } = require('../services/storage')

const router = express.Router()

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
      referrer: referrer || '',
    })
    if (events.length > 200) {
      analytics[presentationId].events = events.slice(-200)
    }
  })
}

// GET /api/analytics/:id — get analytics for a presentation
router.get('/:id', async (req, res) => {
  try {
    const token = String(req.query.token || '')
    if (!token) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const shareTokens = await readShareTokens()
    const tokenDataRaw = shareTokens[token]
    const tokenData = typeof tokenDataRaw === 'string' ? { presentationId: tokenDataRaw } : tokenDataRaw
    if (!tokenData || tokenData.presentationId !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const analytics = await readAnalytics()
    const data = analytics[req.params.id] || { totalViews: 0, events: [] }

    // Compute daily views for chart
    const dailyMap = {}
    data.events.forEach((e) => {
      const day = e.timestamp.split('T')[0]
      dailyMap[day] = (dailyMap[day] || 0) + 1
    })
    const dailyViews = Object.entries(dailyMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Per-token breakdown
    const tokenMap = {}
    data.events.forEach((e) => {
      tokenMap[e.token] = (tokenMap[e.token] || 0) + 1
    })

    res.json({
      totalViews: data.totalViews,
      dailyViews,
      byToken: tokenMap,
      recentEvents: data.events.slice(-20).reverse(),
    })
  } catch {
    res.status(500).json({ error: 'Failed to load analytics' })
  }
})

module.exports = router
module.exports.recordView = recordView
