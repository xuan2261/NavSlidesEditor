import { Copy, Layout, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui'
import SlideThumbnail from '../../components/SlideThumbnail'
import { DASHBOARD_CARD_CLASS, formatDate, getCardBg, isGradientOrImage } from './home-page-utils'

export function MyTemplatesView({ templates, onOpen, onCreateTemplate, onUseTemplate, onDeleteTemplate }) {
  return (
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-text-primary">My Templates</h2>
                <Button variant="secondary" onClick={onCreateTemplate}>
                  <Plus size={14} /> <span>New Template</span>
                </Button>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
                {templates.length === 0 ? (
                  <div className="col-span-full text-center py-20 px-5 text-text-muted">
                    <Layout size={48} />
                    <p className="text-[17px] font-semibold text-text-secondary mb-2">
                      No custom templates yet
                    </p>
                    <p className="text-sm text-text-muted mb-6">
                      Create a template to reuse across presentations
                    </p>
                    <Button variant="primary" onClick={onCreateTemplate}>
                      <Plus size={14} /> <span>Create Template</span>
                    </Button>
                  </div>
                ) : (
                  templates.map((tmpl) => {
                    const bg = getCardBg(tmpl.thumbnail)
                    const bgProp = isGradientOrImage(tmpl.thumbnail)
                      ? { background: bg }
                      : { backgroundColor: bg }
                    return (
                      <article
                        key={tmpl.id}
                        className={`${DASHBOARD_CARD_CLASS} overflow-hidden`}
                      >
                        <button
                          type="button"
                          className="flex w-full cursor-pointer flex-col border-0 bg-transparent p-0 text-left"
                          aria-label={`Open template ${tmpl.title || 'Untitled Template'}`}
                          onClick={() => onOpen(tmpl.id, true)}
                        >
                          <SlideThumbnail id={tmpl.id} bgProp={bgProp} />
                          <div className="px-4 py-3">
                            <h3 className="text-[14px] font-semibold text-text-primary mb-1 truncate">
                              {tmpl.title || 'Untitled Template'}
                            </h3>
                            <p className="text-[12px] text-text-secondary truncate">
                              {tmpl.slideCount} slide{tmpl.slideCount !== 1 ? 's' : ''} &middot;{' '}
                              {formatDate(tmpl.updatedAt)}
                            </p>
                          </div>
                        </button>
                        <div className="flex justify-end gap-1 px-3 py-2 border-t border-border">
                          <Button
                            variant="icon"
                            aria-label="Edit template"
                            title="Edit template"
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpen(tmpl.id, true)
                            }}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="icon"
                            aria-label="Use template"
                            title="Use template"
                            onClick={(e) => {
                              e.stopPropagation()
                              onUseTemplate(tmpl.id)
                            }}
                          >
                            <Copy size={14} />
                          </Button>
                          <Button
                            variant="icon"
                            aria-label="Delete template"
                            title="Delete template"
                            onClick={(e) => onDeleteTemplate(e, tmpl.id)}
                            className="text-danger"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </article>
                    )
                  })
                )}
              </div>
            </>
  )
}

