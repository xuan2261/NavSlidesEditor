const express = require('express')
const path = require('path')
const fs = require('fs')
const { normalizeBuiltInTemplates } = require('../services/template-normalization')

const router = express.Router()

const BUILT_IN_PATH = path.join(__dirname, '..', 'data', 'built-in-templates.json')

// Cache with TTL for large template files
let cachedTemplates = null
let cacheTimestamp = 0
const CACHE_TTL = 60000 // 60s

function loadBuiltInTemplates() {
  const now = Date.now()
  if (cachedTemplates && now - cacheTimestamp < CACHE_TTL) return cachedTemplates
  try {
    cachedTemplates = normalizeBuiltInTemplates(JSON.parse(fs.readFileSync(BUILT_IN_PATH, 'utf-8')))
    cacheTimestamp = now
  } catch (err) {
    console.error('Failed to load built-in templates:', err)
    cachedTemplates = []
  }
  return cachedTemplates
}

function parseTagsQuery(tags) {
  if (!tags) return []
  const values = Array.isArray(tags) ? tags : [tags]
  return values
    .flatMap((value) => String(value).split(','))
    .map((tag) => tag.trim())
    .filter(Boolean)
}

// Category metadata — existing + 11 engineering subjects
const CATEGORIES = [
  // Existing
  { id: 'military', name: 'Quân sự', nameEn: 'Military', icon: 'shield' },
  { id: 'engineering', name: 'Kỹ thuật', nameEn: 'Engineering', icon: 'cog' },
  { id: 'tactical', name: 'Chiến thuật', nameEn: 'Tactical', icon: 'target' },
  { id: 'academic', name: 'Học thuật', nameEn: 'Academic', icon: 'book' },
  { id: 'corporate', name: 'Doanh nghiệp', nameEn: 'Corporate', icon: 'briefcase' },
  { id: 'creative', name: 'Sáng tạo', nameEn: 'Creative', icon: 'palette' },
  // Engineering subjects
  { id: 'digital-electronics', name: 'Kỹ thuật số', nameEn: 'Digital Electronics', icon: 'cpu' },
  { id: 'microprocessor', name: 'Vi xử lý', nameEn: 'Microprocessor', icon: 'chip' },
  { id: 'circuit-theory', name: 'Lý thuyết mạch', nameEn: 'Circuit Theory', icon: 'git-branch' },
  { id: 'electronics', name: 'Kỹ thuật điện tử', nameEn: 'Electronics', icon: 'radio' },
  { id: 'automation', name: 'Tự động hoá', nameEn: 'Automation', icon: 'bot' },
  { id: 'electrical', name: 'Điện', nameEn: 'Electrical', icon: 'zap' },
  { id: 'measurement', name: 'Đo lường điện', nameEn: 'Measurement', icon: 'gauge' },
  {
    id: 'power-electronics',
    name: 'Điện tử công suất',
    nameEn: 'Power Electronics',
    icon: 'plug-zap',
  },
  { id: 'mechanical', name: 'Cơ khí', nameEn: 'Mechanical', icon: 'wrench' },
  {
    id: 'technical-drawing',
    name: 'Hình hoạ - VKT',
    nameEn: 'Technical Drawing',
    icon: 'pen-tool',
  },
  { id: 'fluid-mechanics', name: 'Thuỷ khí', nameEn: 'Fluid Mechanics', icon: 'droplets' },
  { id: 'computer-science', name: 'Tin học', nameEn: 'Computer Science', icon: 'code' },
  { id: 'physics', name: 'Vật lý', nameEn: 'Physics', icon: 'atom' },
  { id: 'mathematics', name: 'Toán học', nameEn: 'Mathematics', icon: 'sigma' },
  {
    id: 'signal-processing',
    name: 'Xử lý tín hiệu',
    nameEn: 'Signal Processing',
    icon: 'activity',
  },
  { id: 'quiz', name: 'Trắc nghiệm', nameEn: 'Quiz', icon: 'check-circle' },

  // New Diverse Categories (Phase 1 Expansion)
  { id: 'education', name: 'Giáo dục', nameEn: 'Education', icon: 'graduation-cap' },
  { id: 'business', name: 'Kinh doanh', nameEn: 'Business', icon: 'briefcase' },
  { id: 'hr', name: 'Nhân sự', nameEn: 'Human Resources', icon: 'users' },
  { id: 'marketing', name: 'Marketing', nameEn: 'Marketing', icon: 'megaphone' },

  { id: 'dark', name: 'Dark Mode', nameEn: 'Dark Mode', icon: 'moon' },
  { id: 'minimal', name: 'Tối giản', nameEn: 'Minimal', icon: 'layout' },

  { id: 'interactive', name: 'Tương tác', nameEn: 'Interactive', icon: 'mouse-pointer-click' },
  { id: 'chart-heavy', name: 'Biểu đồ', nameEn: 'Chart-heavy', icon: 'bar-chart' },
]

// GET /api/marketplace/templates?category=X&search=Y&tags=a,b
router.get('/templates', (req, res) => {
  try {
    const templates = loadBuiltInTemplates()
    const { category, search, tags } = req.query

    let result = templates

    if (category) {
      result = result.filter((t) => t.category === category || (t.tags || []).includes(category))
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) =>
          (t.title || '').toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          (t.tags || []).some((tag) => tag.toLowerCase().includes(q))
      )
    }

    if (tags) {
      const tagList = parseTagsQuery(tags)
      result = result.filter((t) => tagList.every((tag) => (t.tags || []).includes(tag)))
    }

    res.json({
      categories: CATEGORIES,
      templates: result,
    })
    // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (err) {
    res.status(500).json({ error: 'Failed to load marketplace templates' })
  }
})

// GET /api/marketplace/templates/:id
router.get('/templates/:id', (req, res) => {
  try {
    const templates = loadBuiltInTemplates()
    const template = templates.find((t) => t.id === req.params.id)
    if (!template) return res.status(404).json({ error: 'Template not found' })
    res.json(template)
    // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (err) {
    res.status(500).json({ error: 'Failed to load template' })
  }
})

module.exports = router
