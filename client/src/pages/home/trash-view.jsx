import { RotateCcw, Trash, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui'
import { DASHBOARD_CARD_CLASS, formatDate, getCardBg, isGradientOrImage } from './home-page-utils'

export function TrashView({ trashItems, onRestore, onPermanentDelete, onEmptyTrash }) {
  return (
            <>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-text-primary">Trash</h2>
                {trashItems.length > 0 && (
                  <Button variant="danger" onClick={onEmptyTrash} className="text-xs">
                    <Trash2 size={14} /> Empty Trash
                  </Button>
                )}
              </div>
              {trashItems.length === 0 ? (
                <div className="col-span-full text-center py-20 px-5 text-text-muted animate-fade-in">
                  <Trash size={48} />
                  <p className="text-[17px] font-semibold text-text-secondary mb-2">
                    Trash is empty
                  </p>
                  <p className="text-sm text-text-muted mb-6">
                    Deleted presentations will appear here
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5 animate-fade-in">
                  {trashItems.map((pres) => {
                    const bg = getCardBg(pres.thumbnail)
                    const bgProp = isGradientOrImage(pres.thumbnail)
                      ? { background: bg }
                      : { backgroundColor: bg }
                    return (
                      <div key={pres.id} className={`${DASHBOARD_CARD_CLASS} cursor-default opacity-70`}>
                        <div
                          className="aspect-video flex items-center justify-center bg-surface-2 relative overflow-hidden text-[32px] text-text-muted"
                          style={bgProp}
                        >
                          <Trash size={24} className="opacity-30" />
                        </div>
                        <div className="px-4 py-3">
                          <h3 className="text-[14px] font-semibold text-text-primary mb-1 truncate">
                            {pres.title || 'Untitled'}
                          </h3>
                          <p className="text-[12px] text-text-secondary truncate">
                            {pres.slideCount} slide{pres.slideCount !== 1 ? 's' : ''} · Deleted{' '}
                            {formatDate(pres.deletedAt)}
                          </p>
                        </div>
                        <div
                          className="flex justify-end gap-1 px-3 py-2 border-t border-border"
                        >
                          <Button
                            variant="icon"
                            aria-label="Restore"
                            title="Restore"
                            onClick={(e) => onRestore(e, pres.id)}
                          >
                            <RotateCcw size={14} />
                          </Button>
                          <Button
                            variant="icon"
                            aria-label="Delete permanently"
                            title="Delete permanently"
                            onClick={(e) => onPermanentDelete(e, pres.id)}
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
  )
}

