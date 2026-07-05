import { useEffect, useState } from 'react'
import { Search, Star, Book } from 'lucide-react'
import { Button } from '../../components/ui'
import { isBackdropClick } from '../../lib/utils'
import {
  useFilteredTemplates,
  useTemplateCategoryCounts,
  useTemplateFavorites,
  useTemplateGalleryData,
} from './use-template-gallery'
import { CATEGORY_GROUPS, ICON_MAP } from './template-gallery-config'

const badgeCls =
  'inline-flex items-center gap-0.5 px-[7px] py-0.5 rounded-[10px] text-[10px] font-semibold backdrop-blur-sm'
const filterButtonClass = 'mx-auto flex w-[90%] items-center justify-between px-2.5 py-[7px] text-[13px]'
const categoryButtonClass = 'mx-auto flex w-[90%] items-center gap-1.5 px-2.5 py-1.5 text-xs'
const difficultyBadgeClass = {
  basic: 'bg-[#00ff87]/10 text-[#00ff87]',
  intermediate: 'bg-[#ffd700]/10 text-[#ffd700]',
  advanced: 'bg-[#ff4757]/10 text-[#ff4757]',
}

function difficultyLabel(difficulty) {
  return { basic: 'Cơ bản', intermediate: 'Trung cấp', advanced: 'Nâng cao' }[difficulty] || difficulty
}

function TemplateGalleryHeader({ searchQuery, setSearchQuery, sortBy, setSortBy }) {
  return (
    <div className="px-5 py-4 border-b border-border flex items-center justify-between">
      <h2 id="template-gallery-title" className="m-0 text-xl">Template Gallery</h2>
      <div className="relative w-[240px]">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Tìm template..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full py-[7px] pl-[30px] pr-16 border border-border rounded-md bg-secondary text-text-primary text-[13px] outline-none focus:border-accent"
        />
        {searchQuery && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text-primary"
            onClick={() => setSearchQuery('')}
          >
            Clear
          </button>
        )}
      </div>
      <select
        value={sortBy}
        onChange={(event) => setSortBy(event.target.value)}
        className="py-1.5 px-3 border border-border rounded-md bg-secondary text-text-primary text-[13px] outline-none ml-3"
      >
        <option value="newest">Mới nhất</option>
        <option value="difficulty">Độ khó</option>
        <option value="slideCount">Số lượng slide</option>
      </select>
    </div>
  )
}

function TemplateGallerySidebar({ data, activeCategory, setActiveCategory, counts, favorites }) {
  return (
    <div className="w-[210px] border-r border-border overflow-y-auto py-3 shrink-0">
      <Button variant={!activeCategory ? 'primary' : 'secondary'} className={`${filterButtonClass} mb-1.5`} onClick={() => setActiveCategory(null)}>
        <span>Tất cả</span>
        <span className="text-[10px] opacity-70 bg-hover px-1.5 py-px rounded-lg">{data.templates.length}</span>
      </Button>
      <Button variant={activeCategory === 'favorites' ? 'primary' : 'secondary'} className={`${filterButtonClass} mb-3`} onClick={() => setActiveCategory('favorites')}>
        <div className="flex items-center gap-1.5">
          <Star size={14} color="#fbbf24" fill={activeCategory === 'favorites' ? '#fbbf24' : 'none'} />
          <span>Yêu thích</span>
        </div>
        <span className="text-[10px] opacity-70 bg-hover px-1.5 py-px rounded-lg">{favorites.length}</span>
      </Button>
      {CATEGORY_GROUPS.map((group) => {
        const groupCategories = group.categories.map((id) => data.categories.find((cat) => cat.id === id)).filter(Boolean)
        if (!groupCategories.length) return null
        return (
          <div key={group.label}>
            <div className="text-[10px] font-bold text-text-muted px-4 pt-2.5 pb-1 uppercase tracking-wider">{group.label}</div>
            {groupCategories.map((category) => {
              const Icon = ICON_MAP[category.icon] || Book
              return (
                <Button
                  variant={activeCategory === category.id ? 'primary' : 'secondary'}
                  key={category.id}
                  className={`${categoryButtonClass} mb-[3px]`}
                  onClick={() => setActiveCategory(category.id)}
                >
                  <Icon size={14} />
                  <span className="flex-1 text-left">{category.name}</span>
                  {(counts[category.id] || 0) > 0 && (
                    <span className="text-[10px] bg-hover px-[5px] py-px rounded-lg text-text-muted">{counts[category.id]}</span>
                  )}
                </Button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function TemplateCard({ template, isFavorite, onToggleFavorite, onSelectTemplate }) {
  const bgStyle = template.colorScheme
    ? { background: `linear-gradient(135deg, ${template.colorScheme.background}, ${template.colorScheme.primary}25)` }
    : template.thumbnail?.gradient
      ? { background: template.thumbnail.gradient }
      : { backgroundColor: '#2d3748' }

  return (
    <div className="border border-border rounded-lg overflow-hidden cursor-pointer bg-card transition-all hover:border-accent hover:-translate-y-0.5 hover:shadow-lg" onClick={() => onSelectTemplate(template)}>
      <div className="h-[110px] relative" style={bgStyle}>
        <div className="absolute bottom-1.5 left-1.5 flex gap-1">
          {template.tags.includes('interactive') && <span className={`${badgeCls} bg-[rgba(0,212,255,0.25)] text-[#00d4ff]`}>⚡ Tương tác</span>}
          {template.tags.includes('dark') && <span className={`${badgeCls} bg-white/15 text-[#e2e8f0]`}>🌙 Dark</span>}
          {template.tags.includes('minimal') && <span className={`${badgeCls} bg-[rgba(200,200,200,0.2)] text-[#f8fafc]`}>✨ Minimal</span>}
          {template.tags.includes('chart-heavy') && <span className={`${badgeCls} bg-[rgba(52,211,153,0.2)] text-[#34d399]`}>📊 Biểu đồ</span>}
          <span className="px-1.5 py-0.5 rounded-[10px] text-[10px] bg-black/50 text-white/60 backdrop-blur-sm">{template.slideCount} slides</span>
        </div>
        <Button
          variant="icon"
          onClick={(event) => {
            event.stopPropagation()
            onToggleFavorite(template.id)
          }}
          className={`absolute right-1.5 top-1.5 z-10 ${isFavorite ? 'text-amber-400' : 'text-white/50'}`}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star size={16} fill={isFavorite ? '#fbbf24' : 'none'} />
        </Button>
      </div>
      <div className="p-2.5">
        <h4 className="m-0 mb-1 text-[13px] leading-snug">{template.title}</h4>
        <p className="m-0 mb-1.5 text-[11px] text-text-muted line-clamp-2">{template.description}</p>
        {template.difficulty && (
          <span className={`px-1.5 py-px rounded-lg text-[10px] font-semibold ${difficultyBadgeClass[template.difficulty] || 'bg-hover text-text-muted'}`}>
            {difficultyLabel(template.difficulty)}
          </span>
        )}
      </div>
    </div>
  )
}

function TemplateGrid({ loading, error, templates, searchQuery, activeCategory, favorites, toggleFavorite, onSelectTemplate }) {
  if (loading) return <div className="text-center p-10 text-text-muted">Loading...</div>
  if (error) return <div className="text-center p-10 text-text-muted">{error}</div>
  if (templates.length === 0) {
    const message = activeCategory === 'favorites' && !searchQuery
      ? 'No favorite templates yet.'
      : searchQuery
        ? `Không tìm thấy "${searchQuery}"`
        : 'Không có template nào.'
    return <div className="text-center p-10 text-text-muted">{message}</div>
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          isFavorite={favorites.includes(template.id)}
          onToggleFavorite={toggleFavorite}
          onSelectTemplate={onSelectTemplate}
        />
      ))}
    </div>
  )
}

export default function TemplateGalleryPolished({ onSelectTemplate, onClose }) {
  const { data, loading, error } = useTemplateGalleryData()
  const { favorites, toggleFavorite } = useTemplateFavorites()
  const [activeCategory, setActiveCategory] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [isOpen, setIsOpen] = useState(true)
  const counts = useTemplateCategoryCounts(data.templates)
  const filteredTemplates = useFilteredTemplates({ templates: data.templates, activeCategory, searchQuery, favorites, sortBy })

  const handleClose = () => {
    setIsOpen(false)
    onClose()
  }

  useEffect(() => {
    const handler = (event) => { if (event.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]" onClick={(event) => { if (isBackdropClick(event)) handleClose() }} role="dialog" aria-modal="true" aria-labelledby="template-gallery-title">
      <div className="flex max-h-[88vh] w-[960px] flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-2xl animate-zoom-in" onClick={(event) => event.stopPropagation()}>
        <TemplateGalleryHeader searchQuery={searchQuery} setSearchQuery={setSearchQuery} sortBy={sortBy} setSortBy={setSortBy} />
        <div className="flex flex-1 overflow-hidden">
          <TemplateGallerySidebar data={data} activeCategory={activeCategory} setActiveCategory={setActiveCategory} counts={counts} favorites={favorites} />
          <div className="flex-1 p-4 overflow-y-auto">
            <TemplateGrid loading={loading} error={error} templates={filteredTemplates} searchQuery={searchQuery} activeCategory={activeCategory} favorites={favorites} toggleFavorite={toggleFavorite} onSelectTemplate={onSelectTemplate} />
          </div>
        </div>
        <div className="p-2.5 border-t border-border flex justify-between items-center">
          <span className="text-xs text-text-muted">{filteredTemplates.length} / {data.templates.length} templates</span>
          <Button variant="secondary" onClick={handleClose}>Đóng</Button>
        </div>
      </div>
    </div>
  )
}
