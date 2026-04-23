import { useState, useEffect, useMemo } from 'react'
import { Button } from '../../components/ui'
import { isBackdropClick, useEscapeClose } from '../../lib/utils'

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

const badgeCls = 'inline-flex items-center gap-0.5 px-[7px] py-0.5 rounded-[10px] text-[10px] font-semibold backdrop-blur-sm'
const galleryFilterButtonClassName =
  'mx-auto flex w-[90%] items-center justify-between px-2.5 py-[7px] text-[13px]'
const galleryCategoryButtonClassName =
  'mx-auto flex w-[90%] items-center gap-1.5 px-2.5 py-1.5 text-xs'
const difficultyBadgeClassName = {
  basic: 'bg-[#00ff87]/10 text-[#00ff87]',
  intermediate: 'bg-[#ffd700]/10 text-[#ffd700]',
  advanced: 'bg-[#ff4757]/10 text-[#ff4757]',
}

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

  useEscapeClose(onClose)

  const filteredTemplates = useMemo(() => {
    let items = [...data.templates]
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

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]"
      onClick={(event) => {
        if (isBackdropClick(event)) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-gallery-title"
    >
      <div
        className="flex max-h-[88vh] w-[960px] flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-2xl animate-zoom-in"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 id="template-gallery-title" className="m-0 text-xl">🎓 Template Gallery</h2>
          <div className="relative w-[240px]">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              placeholder="Tìm template..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-[7px] pl-[30px] pr-2.5 border border-border rounded-md bg-secondary text-text-primary text-[13px] outline-none focus:border-accent"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="py-1.5 px-3 border border-border rounded-md bg-secondary text-text-primary text-[13px] outline-none ml-3"
          >
            <option value="newest">Mới nhất</option>
            <option value="difficulty">Độ khó</option>
            <option value="slideCount">Số lượng slide</option>
          </select>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-[210px] border-r border-border overflow-y-auto py-3 shrink-0">
            <Button
              variant={!activeCategory ? 'primary' : 'secondary'}
              className={`${galleryFilterButtonClassName} mb-1.5`}
              onClick={() => setActiveCategory(null)}
            >
              <span>Tất cả</span>
              <span className="text-[10px] opacity-70 bg-hover px-1.5 py-px rounded-lg">
                {data.templates.length}
              </span>
            </Button>
            <Button
              variant={activeCategory === 'favorites' ? 'primary' : 'secondary'}
              className={`${galleryFilterButtonClassName} mb-3`}
              onClick={() => setActiveCategory('favorites')}
            >
              <div className="flex items-center gap-1.5">
                <Star
                  size={14}
                  color="#fbbf24"
                  fill={activeCategory === 'favorites' ? '#fbbf24' : 'none'}
                />
                <span>Yêu thích</span>
              </div>
              <span className="text-[10px] opacity-70 bg-hover px-1.5 py-px rounded-lg">
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
                  <div className="text-[10px] font-bold text-text-muted px-4 pt-2.5 pb-1 uppercase tracking-wider">
                    {group.label}
                  </div>
                  {groupCats.map((cat) => {
                    const Icon = ICON_MAP[cat.icon] || Book
                    const count = catCount[cat.id] || 0
                    return (
                      <Button
                        variant={activeCategory === cat.id ? 'primary' : 'secondary'}
                        key={cat.id}
                        className={`${galleryCategoryButtonClassName} mb-[3px]`}
                        onClick={() => setActiveCategory(cat.id)}
                      >
                        <Icon size={14} />
                        <span className="flex-1 text-left">{cat.name}</span>
                        {count > 0 && (
                          <span className="text-[10px] bg-hover px-[5px] py-px rounded-lg text-text-muted">
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
          <div className="flex-1 p-4 overflow-y-auto">
            {loading ? (
              <div className="text-center p-10 text-text-muted">
                Loading...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center p-10 text-text-muted">
                {searchQuery ? `Không tìm thấy "${searchQuery}"` : 'Không có template nào.'}
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
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
                      className="border border-border rounded-lg overflow-hidden cursor-pointer bg-card transition-all hover:border-accent hover:-translate-y-0.5 hover:shadow-lg"
                      onClick={() => onSelectTemplate(template)}
                    >
                      <div className="h-[110px] relative" style={bgStyle}>
                        {/* Badges overlay */}
                        <div className="absolute bottom-1.5 left-1.5 flex gap-1">
                          {(template.tags || []).includes('interactive') && (
                            <span className={`${badgeCls} bg-[rgba(0,212,255,0.25)] text-[#00d4ff]`}>
                              ⚡ Tương tác
                            </span>
                          )}
                          {(template.tags || []).includes('dark') && (
                            <span className={`${badgeCls} bg-white/15 text-[#e2e8f0]`}>
                              🌙 Dark
                            </span>
                          )}
                          {(template.tags || []).includes('minimal') && (
                            <span className={`${badgeCls} bg-[rgba(200,200,200,0.2)] text-[#f8fafc]`}>
                              ✨ Minimal
                            </span>
                          )}
                          {(template.tags || []).includes('chart-heavy') && (
                            <span className={`${badgeCls} bg-[rgba(52,211,153,0.2)] text-[#34d399]`}>
                              📊 Biểu đồ
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded-[10px] text-[10px] bg-black/50 text-white/60 backdrop-blur-sm">
                            {template.slides?.length || 0} slides
                          </span>
                        </div>
                        <Button
                          variant="icon"
                          onClick={(e) => toggleFavorite(e, template.id)}
                          className={`absolute right-1.5 top-1.5 z-10 ${
                            favorites.includes(template.id) ? 'text-amber-400' : 'text-white/50'
                          }`}
                          aria-label={
                            favorites.includes(template.id)
                              ? 'Remove from favorites'
                              : 'Add to favorites'
                          }
                        >
                          <Star
                            size={16}
                            fill={favorites.includes(template.id) ? '#fbbf24' : 'none'}
                          />
                        </Button>
                      </div>
                      <div className="p-2.5">
                        <h4 className="m-0 mb-1 text-[13px] leading-snug">
                          {template.title}
                        </h4>
                        <p className="m-0 mb-1.5 text-[11px] text-text-muted line-clamp-2">
                          {template.description}
                        </p>
                        <div className="flex gap-1 flex-wrap">
                          {template.difficulty && (
                            <span
                              className={`px-1.5 py-px rounded-lg text-[10px] font-semibold ${
                                difficultyBadgeClassName[template.difficulty] || 'bg-hover text-text-muted'
                              }`}
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

        <div className="p-2.5 border-t border-border flex justify-between items-center">
          <span className="text-xs text-text-muted">
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
