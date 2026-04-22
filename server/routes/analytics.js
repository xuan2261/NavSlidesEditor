const express = require('express')
const path = require('path')
const fs = require('fs-extra')

const router = express.Router()

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json')

async function readAnalytics() {
  try {
    await fs.ensureFile(ANALYTICS_FILE)
    const raw = await fs.readFile(ANALYTICS_FILE, 'utf-8')
    return raw.trim() ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

async function writeAnalytics(data) {
  await fs.writeJson(ANALYTICS_FILE, data, { spaces: 2 })
}

// Record a view event (called internally from share route)
async function recordView(presentationId, token, referrer = '') {
  const analytics = await readAnalytics()
  if (!analytics[presentationId]) {
    analytics[presentationId] = { totalViews: 0, events: [] }
  }
  analytics[presentationId].totalViews++
  // Keep last 200 events per presentation
  const events = analytics[presentationId].events
  events.push({
    timestamp: new Date().toISOString(),
    token,
    referrer: referrer || '',
  })
  if (events.length > 200) {
    analytics[presentationId].events = events.slice(-200)
  }
  await writeAnalytics(analytics)
}

// GET /api/analytics/:id — get analytics for a presentation
router.get('/:id', async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
module.exports.recordView = recordView
