import { AlertCircle, Search, Sparkles, X } from 'lucide-react'
import { Button, Input } from '../../components/ui'
import SlideThumbnail from '../../components/SlideThumbnail'
import {
  CATEGORY_PILL_CLASS,
  DASHBOARD_CARD_CLASS,
  getCardBg,
  handleKeyboardClick,
  isGradientOrImage,
} from './home-page-utils'

export function MarketplaceView({
  categories,
  totalCount,
  status,
  error,
  search,
  onSearchChange,
  category,
  onCategoryChange,
  templates,
  onPreview,
  onRetry,
  onClearFilters,
}) {
  return (
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-text-primary">Template Marketplace</h2>
                <div className="relative flex-[0_1_360px] max-w-[260px]">
                  <Search
                    size={15}
                    className="absolute left-[11px] top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                  />
                  <Input
                    className="w-full pl-9 pr-8"
                    type="text"
                    placeholder="Search templates..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                  />
                  {search && (
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors p-0.5 rounded"
                      onClick={() => onSearchChange('')}
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-5">
                <Button
                  variant="ghost"
                  className={`${CATEGORY_PILL_CLASS} ${!category ? '!bg-accent !border-accent !text-white' : ''}`}
                  onClick={() => onCategoryChange('')}
                >
                  All
                </Button>
                {categories.map((cat) => (
                  <Button
                    variant="ghost"
                    key={cat.id}
                    className={`${CATEGORY_PILL_CLASS} ${category === cat.id ? '!bg-accent !border-accent !text-white' : ''}`}
                    onClick={() => onCategoryChange(cat.id)}
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
                {status === 'success' && templates.map((tmpl) => {
                    const bg = getCardBg(tmpl.thumbnail)
                    const bgProp = isGradientOrImage(tmpl.thumbnail)
                      ? { background: bg }
                      : { backgroundColor: bg }
                    return (
                      <div
                        key={tmpl.id}
                        className={`${DASHBOARD_CARD_CLASS} cursor-pointer`}
                        role="button"
                        tabIndex={0}
                        onClick={() => onPreview(tmpl)}
                        onKeyDown={(event) =>
                          handleKeyboardClick(event, () => onPreview(tmpl))
                        }
                      >
                        <SlideThumbnail id={tmpl.id} bgProp={bgProp} />
                        <div className="px-4 py-3">
                          <h3 className="text-[14px] font-semibold text-text-primary mb-1 truncate">
                            {tmpl.titleVi || tmpl.title}
                          </h3>
                          <p className="text-[12px] text-text-secondary truncate">
                            {tmpl.description}
                          </p>
                          <p className="text-[10px] text-text-muted mt-0.5">
                            {tmpl.slides?.length || 0} slides · {tmpl.category}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                {(status === 'idle' || status === 'loading') && (
                  <div className="col-span-full text-center py-20 px-5 text-text-muted">
                    <Sparkles size={48} />
                    <p className="text-[17px] font-semibold text-text-secondary mb-2">
                      Loading templates...
                    </p>
                  </div>
                )}
                {status === 'error' && (
                  <div className="col-span-full text-center py-20 px-5 text-text-muted" role="alert">
                    <AlertCircle size={48} />
                    <p className="text-[17px] font-semibold text-text-secondary mb-2">
                      Could not load marketplace templates.
                    </p>
                    <p className="text-sm text-text-muted mb-6">{error}</p>
                    <Button variant="secondary" onClick={onRetry}>
                      Retry loading marketplace
                    </Button>
                  </div>
                )}
                {status === 'success' && totalCount === 0 && (
                  <div className="col-span-full text-center py-20 px-5 text-text-muted">
                    <Sparkles size={48} />
                    <p className="text-[17px] font-semibold text-text-secondary mb-2">
                      No marketplace templates available.
                    </p>
                  </div>
                )}
                {status === 'success' && totalCount > 0 && templates.length === 0 && (
                  <div className="col-span-full text-center py-20 px-5 text-text-muted">
                    <Search size={48} />
                    <p className="text-[17px] font-semibold text-text-secondary mb-2">
                      No marketplace templates match
                    </p>
                    <p className="text-sm text-text-muted mb-6">
                      Clear the search or choose another category.
                    </p>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        onClearFilters()
                      }}
                    >
                      <X size={14} /> <span>Clear filters</span>
                    </Button>
                  </div>
                )}
              </div>
            </>
  )
}

