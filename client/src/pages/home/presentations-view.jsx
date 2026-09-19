import { Copy, Grid3x3, LayoutTemplate, List, Pencil, Plus, Rocket, Search, Trash2 } from 'lucide-react'
import { Button, Select } from '../../components/ui'
import SlideThumbnail from '../../components/SlideThumbnail'
import {
  DASHBOARD_ACTION_TILE_CLASS,
  DASHBOARD_CARD_CLASS,
  formatDate,
  getCardBg,
  handleKeyboardClick,
  isGradientOrImage,
} from './home-page-utils'

export function PresentationsView({
  showWelcome,
  searchQuery,
  sidebarView,
  sortBy,
  onSortByChange,
  viewMode,
  onViewModeChange,
  items,
  onOpen,
  onDuplicate,
  onDelete,
  onNewPresentation,
  onBrowseTemplates,
}) {
  return (
            <>
              {/* Welcome screen for empty state */}
              {showWelcome ? (
                <div className="flex flex-col items-center justify-center py-20 px-10 text-center animate-fade-in">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand/25 bg-brand-muted text-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
                    <Rocket size={28} />
                  </div>
                  <h1 className="text-2xl font-bold mb-2 tracking-tight text-text-primary">
                    Welcome to NavSlides Editor
                  </h1>
                  <p className="text-[15px] text-text-secondary mb-8 max-w-[420px]">
                    Create stunning presentations with WYSIWYG editing, LaTeX, charts, and more.
                  </p>
                  <div className="flex gap-3 flex-wrap justify-center">
                    <Button
                      variant="ghost"
                      data-testid="home-new-presentation-btn"
                      className={DASHBOARD_ACTION_TILE_CLASS}
                      onClick={onNewPresentation}
                    >
                      <Plus size={18} />
                      <span>Create your first presentation</span>
                    </Button>
                    <Button
                      variant="ghost"
                      className={DASHBOARD_ACTION_TILE_CLASS}
                      onClick={() => onBrowseTemplates()}
                    >
                      <LayoutTemplate size={18} />
                      <span>Browse templates</span>
                    </Button>
                  </div>
                  <p className="mt-10 text-[13px] text-text-muted">
                    WYSIWYG · LaTeX · Charts · Code · Export HTML / PDF / PPTX
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-text-primary">
                      {sidebarView === 'recent' ? 'Recent Presentations' : 'All Presentations'}
                    </h2>
                    <div className="flex items-center gap-2">
                      <Select
                        className="bg-card border border-border text-text-secondary py-1.5 px-2.5 rounded text-xs cursor-pointer focus:outline-none focus:border-accent"
                        value={sortBy}
                        onChange={(e) => onSortByChange(e.target.value)}
                      >
                        <option value="updatedAt">Last modified</option>
                        <option value="createdAt">Date created</option>
                        <option value="title">Name</option>
                        <option value="slides">Slide count</option>
                      </Select>
                      <div className="flex shrink-0 bg-card border border-border rounded overflow-hidden">
                        <Button
                          variant="ghost"
                          className={`h-7 w-8 shrink-0 rounded-none border-none bg-transparent !px-0 !py-0 text-text-muted transition-colors hover:text-text-primary ${viewMode === 'grid' ? 'bg-accent text-white' : ''}`}
                          onClick={() => onViewModeChange('grid')}
                          title="Grid view"
                          aria-label="Grid view"
                        >
                          <Grid3x3 size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          className={`h-7 w-8 shrink-0 rounded-none border-none bg-transparent !px-0 !py-0 text-text-muted transition-colors hover:text-text-primary ${viewMode === 'list' ? 'bg-accent text-white' : ''}`}
                          onClick={() => onViewModeChange('list')}
                          title="List view"
                          aria-label="List view"
                        >
                          <List size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {items.length === 0 && searchQuery ? (
                    <div className="col-span-full text-center py-20 px-5 text-text-muted animate-fade-in">
                      <Search size={48} />
                      <p className="text-[17px] font-semibold text-text-secondary mb-2">
                        No matches found
                      </p>
                      <p className="text-sm text-text-muted mb-6">Try a different search term</p>
                    </div>
                  ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5 animate-fade-in">
                      <div
                        data-testid="home-new-presentation-btn"
                        className="border-dashed border-2 border-border flex flex-col items-center justify-center gap-3 min-h-[200px] text-text-muted cursor-pointer transition-[background-color,border-color,color,box-shadow] duration-150 rounded-lg hover:border-accent hover:text-accent hover:bg-hover focus-visible:ring-2 focus-visible:ring-focus/30"
                        role="button"
                        tabIndex={0}
                        onClick={onNewPresentation}
                        onKeyDown={(event) => handleKeyboardClick(event, onNewPresentation)}
                      >
                        <Plus size={28} />
                        <span>New Presentation</span>
                      </div>
                      {items.map((pres) => {
                        const bg = getCardBg(pres.thumbnail)
                        const bgProp = isGradientOrImage(pres.thumbnail)
                          ? { background: bg }
                          : { backgroundColor: bg }
                        return (
                          <article
                            key={pres.id}
                            className={`${DASHBOARD_CARD_CLASS} flex h-full flex-col overflow-hidden`}
                          >
                            <button
                              type="button"
                              className="flex flex-1 cursor-pointer flex-col border-0 bg-transparent p-0 text-left"
                              aria-label={`Open ${pres.title || 'Untitled'}`}
                              onClick={() => onOpen(pres.id)}
                            >
                              <SlideThumbnail
                                id={pres.id}
                                bgProp={bgProp}
                                fallback={!pres.thumbnail || pres.thumbnail.type === 'none'}
                                className="aspect-video"
                              />
                              <div className="px-4 py-3 flex-1">
                                <h3 className="text-[14px] font-semibold text-text-primary mb-1 truncate">
                                  {pres.title || 'Untitled'}
                                </h3>
                                <p className="text-[12px] text-text-secondary truncate">
                                  {pres.slideCount} slide{pres.slideCount !== 1 ? 's' : ''} &middot;{' '}
                                  {formatDate(pres.updatedAt)}
                                </p>
                              </div>
                            </button>
                            <div className="flex justify-end gap-1 px-3 py-2 border-t border-border">
                              <Button
                                variant="icon"
                                aria-label="Edit"
                                title="Edit"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onOpen(pres.id)
                                }}
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                variant="icon"
                                aria-label="Duplicate"
                                title="Duplicate"
                                onClick={(e) => onDuplicate(e, pres.id)}
                              >
                                <Copy size={14} />
                              </Button>
                              <Button
                                variant="icon"
                                aria-label="Delete"
                                title="Delete"
                                onClick={(e) => onDelete(e, pres.id)}
                                className="text-danger"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  ) : (
                    /* List View */
                    <div className="flex flex-col gap-0.5 animate-fade-in">
                      {items.map((pres) => {
                        const bg = getCardBg(pres.thumbnail)
                        const bgProp = isGradientOrImage(pres.thumbnail)
                          ? { background: bg }
                          : { backgroundColor: bg }
                        return (
                          <div
                            key={pres.id}
                            className="group flex items-center gap-4 px-4 py-3 rounded transition-colors hover:bg-hover"
                          >
                            <div className="w-20 h-[45px] rounded flex-shrink-0 overflow-hidden relative">
                              <SlideThumbnail
                                id={pres.id}
                                bgProp={bgProp}
                                fallback={!pres.thumbnail || pres.thumbnail.type === 'none'}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3
                                className="mb-1 cursor-pointer truncate rounded text-[14px] font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/30"
                                role="button"
                                tabIndex={0}
                                onClick={() => onOpen(pres.id)}
                                onKeyDown={(event) =>
                                  handleKeyboardClick(event, () => onOpen(pres.id))
                                }
                              >
                                {pres.title || 'Untitled'}
                              </h3>
                              <p className="text-[12px] text-text-secondary truncate">
                                {pres.slideCount} slide{pres.slideCount !== 1 ? 's' : ''} &middot;{' '}
                                {formatDate(pres.updatedAt)}
                              </p>
                            </div>
                            <div className="flex justify-end gap-1 px-3 py-2 border-t border-border">
                              <Button
                                variant="icon"
                                aria-label="Edit"
                                title="Edit"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onOpen(pres.id)
                                }}
                              >
                                <Pencil size={14} />
                              </Button>
                              <Button
                                variant="icon"
                                aria-label="Duplicate"
                                title="Duplicate"
                                onClick={(e) => onDuplicate(e, pres.id)}
                              >
                                <Copy size={14} />
                              </Button>
                              <Button
                                variant="icon"
                                aria-label="Delete"
                                title="Delete"
                                onClick={(e) => onDelete(e, pres.id)}
                                className="text-danger"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </>
  )
}

