import { useState, useEffect, useMemo } from 'react'
import { Button } from '../../components/ui'

import {
  Shield,
  Cog,
  Target,
  Book,
  Briefcase,
  Palette,
  Cpu,
  Radio,
  Bot,
  Zap,
  Gauge,
  Wrench,
  PenTool,
  Droplets,
  GitBranch,
  PlugZap,
  Search,
  Star,
  GraduationCap,
  Users,
  Megaphone,
  Moon,
  Layout,
  MousePointerClick,
  BarChart,
  Code,
  Atom,
  Sigma,
  Activity,
  CheckCircle,
} from 'lucide-react'

const ICON_MAP = {
  shield: Shield,
  cog: Cog,
  target: Target,
  book: Book,
  briefcase: Briefcase,
  palette: Palette,
  cpu: Cpu,
  chip: Cpu,
  'git-branch': GitBranch,
  radio: Radio,
  bot: Bot,
  zap: Zap,
  gauge: Gauge,
  'plug-zap': PlugZap,
  wrench: Wrench,
  'pen-tool': PenTool,
  droplets: Droplets,
  code: Code,
  atom: Atom,
  sigma: Sigma,
  activity: Activity,
  'check-circle': CheckCircle,
  'graduation-cap': GraduationCap,
  users: Users,
  megaphone: Megaphone,
  moon: Moon,
  layout: Layout,
  'mouse-pointer-click': MousePointerClick,
  'bar-chart': BarChart,
}

const CATEGORY_GROUPS = [
  {
    label: 'Kỹ thuật',
    categories: [
      'digital-electronics',
      'microprocessor',
      'circuit-theory',
      'electronics',
      'automation',
      'electrical',
      'measurement',
      'power-electronics',
      'mechanical',
      'technical-drawing',
      'fluid-mechanics',
      'computer-science',
      'physics',
      'mathematics',
      'signal-processing',
    ],
  },
  {
    label: 'Mục đích sử dụng',
    categories: [
      'academic',
      'education',
      'corporate',
      'business',
      'hr',
      'marketing',
      'military',
      'tactical',
      'quiz',
    ],
  },
  {
    label: 'Phong cách',
    categories: ['dark', 'minimal', 'creative'],
  },
  {
    label: 'Thành phần',
    categories: ['interactive', 'chart-heavy'],
  },
]

export default function TemplateGallery({ onSelectTemplate, onClose }) {
  const [data, setData] = useState({ categories: [], templates: [] })
  const [activeCategory, setActiveCategory] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest') // newest, difficulty, slideCount
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('navslides-favorite-templates') || '[]')
    } catch {
      return []
    }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    localStorage.setItem('navslides-favorite-templates', JSON.stringify(favorites))
  }, [favorites])

  const toggleFavorite = (e, id) => {
    e.stopPropagation()
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]))
  }
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch('/api/marketplace/templates')
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch (err) {
        console.error('Failed to load templates:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchTemplates()
  }, [])

  const filteredTemplates = useMemo(() => {
    let items = data.templates
    if (activeCategory === 'favorites') {
      items = items.filter((t) => favorites.includes(t.id))
    } else if (activeCategory) {
      items = items.filter(
        (t) => t.category === activeCategory || (t.tags && t.tags.includes(activeCategory))
      )
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.tags || []).some((tag) => tag.includes(q))
      )
    }

    // Sort
    const difficultyScore = { basic: 1, intermediate: 2, advanced: 3 }
    items.sort((a, b) => {
      if (sortBy === 'difficulty') {
        const da = difficultyScore[a.difficulty] || 0
        const db = difficultyScore[b.difficulty] || 0
        if (da !== db) return da - db
      }
      if (sortBy === 'slideCount') {
        const ca = a.slides?.length || 0
        const cb = b.slides?.length || 0
        if (ca !== cb) return cb - ca
      }
      // Newest first (assuming order in JSON or id string)
      return b.id > a.id ? 1 : -1
    })

    return items
  }, [data.templates, activeCategory, searchQuery, favorites, sortBy])

  const catCount = useMemo(() => {
    const m = {}
    data.templates.forEach((t) => {
      m[t.category] = (m[t.category] || 0) + 1
      if (t.tags) {
        t.tags.forEach((tag) => {
          if (tag !== t.category) {
            m[tag] = (m[tag] || 0) + 1
          }
        })
      }
    })
    return m
  }, [data.templates])

  const difficultyLabel = (d) =>
    ({
      basic: 'Cơ bản',
      intermediate: 'Trung cấp',
      advanced: 'Nâng cao',
    })[d] || d

  const difficultyColor = (d) =>
    ({
      basic: '#00ff87',
      intermediate: '#ffd700',
      advanced: '#ff4757',
    })[d] || 'var(--text-muted)'

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]"
      onClick={onClose}
    >
      <div
        className="bg-panel rounded-xl border border-border shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ width: 960, maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 20 }}>🎓 Template Gallery</h2>
          <div style={{ position: 'relative', width: 240 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Tìm template..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 30px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--bg-secondary)',
                color: 'var(--text)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--bg-secondary)',
              color: 'var(--text)',
              fontSize: 13,
              outline: 'none',
              marginLeft: 12,
            }}
          >
            <option value="newest">Mới nhất</option>
            <option value="difficulty">Độ khó</option>
            <option value="slideCount">Số lượng slide</option>
          </select>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar */}
          <div
            style={{
              width: 210,
              borderRight: '1px solid var(--border)',
              overflowY: 'auto',
              padding: '12px 0',
              flexShrink: 0,
            }}
          >
            <Button
              variant={!activeCategory ? 'primary' : 'secondary'}
              style={{
                width: '90%',
                margin: '0 auto 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 10px',
                fontSize: 13,
              }}
              onClick={() => setActiveCategory(null)}
            >
              <span>Tất cả</span>
              <span
                style={{
                  fontSize: 10,
                  opacity: 0.7,
                  background: 'var(--bg-hover)',
                  padding: '1px 6px',
                  borderRadius: 8,
                }}
              >
                {data.templates.length}
              </span>
            </Button>
            <Button
              variant={activeCategory === 'favorites' ? 'primary' : 'secondary'}
              style={{
                width: '90%',
                margin: '0 auto 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 10px',
                fontSize: 13,
              }}
              onClick={() => setActiveCategory('favorites')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Star
                  size={14}
                  color="#fbbf24"
                  fill={activeCategory === 'favorites' ? '#fbbf24' : 'none'}
                />
                <span>Yêu thích</span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  opacity: 0.7,
                  background: 'var(--bg-hover)',
                  padding: '1px 6px',
                  borderRadius: 8,
                }}
              >
                {favorites.length}
              </span>
            </Button>

            {CATEGORY_GROUPS.map((group) => {
              const groupCats = group.categories
                .map((id) => data.categories.find((c) => c.id === id))
                .filter(Boolean)
              if (!groupCats.length) return null
              return (
                <div key={group.label}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      padding: '10px 16px 4px',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    {group.label}
                  </div>
                  {groupCats.map((cat) => {
                    const Icon = ICON_MAP[cat.icon] || Book
                    const count = catCount[cat.id] || 0
                    return (
                      <Button
                        variant={activeCategory === cat.id ? 'primary' : 'secondary'}
                        key={cat.id}
                        style={{
                          width: '90%',
                          margin: '0 auto 3px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 10px',
                          fontSize: 12,
                        }}
                        onClick={() => setActiveCategory(cat.id)}
                      >
                        <Icon size={14} />
                        <span style={{ flex: 1, textAlign: 'left' }}>{cat.name}</span>
                        {count > 0 && (
                          <span
                            style={{
                              fontSize: 10,
                              background: 'var(--bg-hover)',
                              padding: '1px 5px',
                              borderRadius: 8,
                              color: 'var(--text-muted)',
                            }}
                          >
                            {count}
                          </span>
                        )}
                      </Button>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Grid */}
          <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                Loading...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                {searchQuery ? `Không tìm thấy "${searchQuery}"` : 'Không có template nào.'}
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 16,
                }}
              >
                {filteredTemplates.map((template) => {
                  const bgStyle = template.colorScheme
                    ? {
                        background: `linear-gradient(135deg, ${template.colorScheme.background}, ${template.colorScheme.primary}25)`,
                      }
                    : template.thumbnail?.gradient
                      ? { background: template.thumbnail.gradient }
                      : { backgroundColor: '#2d3748' }

                  return (
                    <div
                      key={template.id}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        background: 'var(--bg-card)',
                        transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)'
                        e.currentTarget.style.transform = 'none'
                      }}
                      onClick={() => onSelectTemplate(template)}
                    >
                      <div style={{ height: 110, position: 'relative', ...bgStyle }}>
                        {/* Badges overlay */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 6,
                            left: 6,
                            display: 'flex',
                            gap: 4,
                          }}
                        >
                          {(template.tags || []).includes('interactive') && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 2,
                                padding: '2px 7px',
                                borderRadius: 10,
                                fontSize: 10,
                                fontWeight: 600,
                                background: 'rgba(0,212,255,0.25)',
                                color: '#00d4ff',
                                backdropFilter: 'blur(4px)',
                              }}
                            >
                              ⚡ Tương tác
                            </span>
                          )}
                          {(template.tags || []).includes('dark') && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 2,
                                padding: '2px 7px',
                                borderRadius: 10,
                                fontSize: 10,
                                fontWeight: 600,
                                background: 'rgba(255,255,255,0.15)',
                                color: '#e2e8f0',
                                backdropFilter: 'blur(4px)',
                              }}
                            >
                              🌙 Dark
                            </span>
                          )}
                          {(template.tags || []).includes('minimal') && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 2,
                                padding: '2px 7px',
                                borderRadius: 10,
                                fontSize: 10,
                                fontWeight: 600,
                                background: 'rgba(200,200,200,0.2)',
                                color: '#f8fafc',
                                backdropFilter: 'blur(4px)',
                              }}
                            >
                              ✨ Minimal
                            </span>
                          )}
                          {(template.tags || []).includes('chart-heavy') && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 2,
                                padding: '2px 7px',
                                borderRadius: 10,
                                fontSize: 10,
                                fontWeight: 600,
                                background: 'rgba(52,211,153,0.2)',
                                color: '#34d399',
                                backdropFilter: 'blur(4px)',
                              }}
                            >
                              📊 Biểu đồ
                            </span>
                          )}
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: 10,
                              fontSize: 10,
                              background: 'rgba(0,0,0,0.5)',
                              color: '#ffffff90',
                              backdropFilter: 'blur(4px)',
                            }}
                          >
                            {template.slides?.length || 0} slides
                          </span>
                        </div>
                        <Button
                          variant="icon"
                          onClick={(e) => toggleFavorite(e, template.id)}
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            color: favorites.includes(template.id)
                              ? '#fbbf24'
                              : 'rgba(255,255,255,0.5)',
                            zIndex: 10,
                          }}
                        >
                          <Star
                            size={16}
                            fill={favorites.includes(template.id) ? '#fbbf24' : 'none'}
                          />
                        </Button>
                      </div>
                      <div style={{ padding: 10 }}>
                        <h4 style={{ margin: '0 0 4px', fontSize: 13, lineHeight: 1.3 }}>
                          {template.title}
                        </h4>
                        <p
                          style={{
                            margin: '0 0 6px',
                            fontSize: 11,
                            color: 'var(--text-muted)',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {template.description}
                        </p>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {template.difficulty && (
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: 8,
                                fontSize: 10,
                                fontWeight: 600,
                                background: `${difficultyColor(template.difficulty)}18`,
                                color: difficultyColor(template.difficulty),
                              }}
                            >
                              {difficultyLabel(template.difficulty)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            padding: 10,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {filteredTemplates.length} / {data.templates.length} templates
          </span>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </div>
  )
}
