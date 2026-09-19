import { LayoutTemplate, Plus, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui'
import { TEMPLATE_CATEGORIES } from './home-page-presets'
import {
  CATEGORY_PILL_CLASS,
  DASHBOARD_CARD_CLASS,
  getCardBg,
  getPresetTeachingBadge,
  getPresetTextTone,
  handleKeyboardClick,
  isGradientOrImage,
} from './home-page-utils'

export function TemplateGalleryView({ presets, category, onCategoryChange, creating, onCreateFromPreset, onNewPresentation }) {
  return (
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-text-primary">Template Gallery</h2>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <Button
                    variant="ghost"
                    key={cat}
                    className={`template-category-btn ${CATEGORY_PILL_CLASS} ${category === cat ? '!bg-accent !border-accent !text-white' : ''}`}
                    onClick={() => onCategoryChange(cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
                {presets.map((preset) => {
                  const bg = getCardBg(preset.thumbnail)
                  const bgProp = isGradientOrImage(preset.thumbnail)
                    ? { background: bg }
                    : { backgroundColor: bg }
                  const tone = getPresetTextTone(preset.thumbnail)
                  const teachingBadge = getPresetTeachingBadge(preset)
                  return (
                    <div
                      key={preset.id}
                      className={`${DASHBOARD_CARD_CLASS} ${
                        creating ? 'cursor-wait' : 'cursor-pointer'
                      }`}
                      role="button"
                      tabIndex={creating ? -1 : 0}
                      onClick={() => onCreateFromPreset(preset.id)}
                      onKeyDown={(event) =>
                        handleKeyboardClick(event, () => onCreateFromPreset(preset.id))
                      }
                    >
                      <div
                        className="aspect-video flex items-center justify-center relative overflow-hidden"
                        style={bgProp}
                      >
                        <div className="flex flex-col items-center justify-center gap-1 px-4 text-center">
                          <span className={tone.titleClassName}>
                            {preset.title}
                          </span>
                          <span className={tone.metaClassName}>
                            {preset.theme} · {preset.transition}
                          </span>
                        </div>
                        <Sparkles
                          size={16}
                          className="absolute top-2 right-2 opacity-25"
                        />
                        {teachingBadge && (
                          <span className="absolute left-2 top-2 rounded-full border border-white/30 bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white">
                            {teachingBadge}
                          </span>
                        )}
                      </div>
                      <div className="px-4 py-3">
                        <h3 className="text-[14px] font-semibold text-text-primary mb-1 truncate">
                          {preset.title}
                        </h3>
                        <p className="text-[12px] text-text-secondary truncate">
                          {preset.description}
                        </p>
                      </div>
                    </div>
                  )
                })}
                {presets.length === 0 && (
                  <div className="col-span-full text-center py-20 px-5 text-text-muted">
                    <LayoutTemplate size={48} />
                    <p className="text-[17px] font-semibold text-text-secondary mb-2">
                      No built-in templates in this category
                    </p>
                    <p className="text-sm text-text-muted mb-6">
                      Pick another category or start a blank presentation.
                    </p>
                    <Button variant="primary" onClick={onNewPresentation}>
                      <Plus size={14} /> <span>Start blank</span>
                    </Button>
                  </div>
                )}
              </div>
            </>
  )
}

