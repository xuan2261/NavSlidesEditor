import { useMemo, useRef, useState } from 'react'
import { listEducationPresets, PRESET_CATEGORIES } from 'revealjs-shared'
import { Button, useModalFocusTrap } from '../ui'
import { isBackdropClick, useEscapeClose } from '../../lib/utils'

const TEXT = {
  en: {
    title: 'Education Library',
    search: 'Search',
    category: 'Category',
    all: 'All activities',
    language: 'Language',
    preview: 'Preview',
    empty: 'No matching activities.',
    insert: 'Insert',
    close: 'Close',
    inert: 'Static preview: scripts, scoring and live connections do not run here.',
    local: 'Local activity available',
    noLocal: 'Local activity unavailable',
    offline: 'Works offline',
    live: 'Live room available',
    noLive: 'Live room unavailable',
    inserted: 'Inserted',
    locked: 'The authoring target is locked or unavailable.',
    warnings: 'References need repair',
    elements: 'Elements',
    config: 'Configuration',
  },
  vi: {
    title: 'Thư viện giáo dục',
    search: 'Tìm kiếm',
    category: 'Danh mục',
    all: 'Tất cả hoạt động',
    language: 'Ngôn ngữ',
    preview: 'Xem trước',
    empty: 'Không tìm thấy hoạt động phù hợp.',
    insert: 'Chèn',
    close: 'Đóng',
    inert: 'Xem trước tĩnh: không chạy mã, chấm điểm hoặc kết nối trực tiếp.',
    local: 'Có thể dùng tại chỗ',
    noLocal: 'Chưa hỗ trợ tại chỗ',
    offline: 'Dùng được ngoại tuyến',
    live: 'Có hỗ trợ phòng trực tiếp',
    noLive: 'Không hỗ trợ phòng trực tiếp',
    inserted: 'Đã chèn',
    locked: 'Trang đang chỉnh sửa bị khóa hoặc không còn khả dụng.',
    warnings: 'Cần sửa tham chiếu',
    elements: 'Phần tử',
    config: 'Cấu hình',
  },
}

export default function BlockLibraryDialog({ onInsert, onClose, locale: initialLocale }) {
  const [locale, setLocale] = useState(() =>
    initialLocale === 'vi' || (!initialLocale && navigator.language?.startsWith('vi')) ? 'vi' : 'en'
  )
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [selectedId, setSelectedId] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [error, setError] = useState('')
  const searchRef = useRef(null)
  const { dialogRef, handleFocusTrapKeyDown } = useModalFocusTrap({ initialFocusRef: searchRef })
  useEscapeClose(onClose)
  const text = TEXT[locale]
  const presets = useMemo(
    () => listEducationPresets({ search, category, locale }),
    [search, category, locale]
  )
  const selected = presets.find((preset) => preset.id === selectedId) || presets[0]
  const selectedGame = selected?.elements.find((element) => element.type === 'game')
  const config = selectedGame?.[selectedGame.gameType]
  const capabilities = selected?.capabilities || {}

  const handleInsert = () => {
    if (!selected) return
    try {
      const inserted = onInsert(selected.id)
      if (!inserted) throw new Error(text.locked)
      setFeedback({
        label: selected.labels[locale],
        count: inserted.elements.length,
        warnings: inserted.warnings,
      })
      setError('')
    } catch (cause) {
      setFeedback(null)
      setError(cause.message || text.locked)
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="block-library-title"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-4"
      onClick={(event) => {
        if (isBackdropClick(event)) onClose()
      }}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        } else handleFocusTrapKeyDown(event)
      }}
    >
      <div
        className="flex max-h-[90vh] w-[920px] max-w-full flex-col rounded-xl border border-border bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-border px-5 py-4">
          <h2 id="block-library-title" className="text-base font-semibold text-text-primary">
            {text.title}
          </h2>
        </header>
        <div className="min-h-0 overflow-y-auto p-4">
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="text-xs text-text-secondary">
              {text.search}
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-hover px-3 py-2 text-sm text-text-primary"
              />
            </label>
            <label className="text-xs text-text-secondary">
              {text.category}
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-hover px-3 py-2 text-sm text-text-primary"
              >
                <option value="all">{text.all}</option>
                {PRESET_CATEGORIES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.labels[locale]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-text-secondary">
              {text.language}
              <select
                value={locale}
                onChange={(event) => setLocale(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-hover px-3 py-2 text-sm text-text-primary"
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid max-h-[42vh] grid-cols-2 content-start gap-2 overflow-y-auto">
              {presets.map((preset) => (
                <Button
                  key={preset.id}
                  variant="secondary"
                  data-testid="education-preset-card"
                  data-preset-id={preset.id}
                  aria-pressed={selected?.id === preset.id}
                  aria-label={preset.labels[locale]}
                  onClick={() => setSelectedId(preset.id)}
                  className={`h-auto min-h-16 whitespace-normal p-3 text-left text-xs ${selected?.id === preset.id ? 'ring-2 ring-accent' : ''}`}
                >
                  {preset.labels[locale]}
                </Button>
              ))}
              {!presets.length && (
                <p className="col-span-2 text-sm text-text-muted">{text.empty}</p>
              )}
            </div>
            <section
              role="region"
              aria-label={text.preview}
              className="rounded-lg border border-border bg-secondary p-4"
            >
              <h3 className="text-xs font-medium text-text-secondary">{text.preview}</h3>
              <p className="mt-1 text-xs text-text-muted">{text.inert}</p>
              {selected && (
                <>
                  <h4 className="mt-4 text-base font-semibold text-text-primary">
                    {selected.labels[locale]}
                  </h4>
                  <p className="mt-1 text-sm text-text-secondary">{selected.preview.summary}</p>
                  <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-text-primary">
                    {selected.preview.items.filter(Boolean).map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-secondary">
                    <span className="rounded border border-border px-2 py-1">
                      {capabilities.local ? text.local : text.noLocal}
                    </span>
                    {capabilities.offline && (
                      <span className="rounded border border-border px-2 py-1">{text.offline}</span>
                    )}
                    <span className="rounded border border-border px-2 py-1">
                      {capabilities.live ? text.live : text.noLive}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-text-muted">
                    {text.elements}: {selected.elements.length}
                  </p>
                  {config && (
                    <details className="mt-3 text-xs text-text-secondary">
                      <summary className="cursor-pointer">{text.config}</summary>
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(config, null, 2)}
                      </pre>
                    </details>
                  )}
                </>
              )}
            </section>
          </div>
          {error && (
            <p role="alert" className="mt-3 rounded border border-danger bg-danger/10 p-3 text-sm">
              {error}
            </p>
          )}
          {feedback && (
            <p role="status" className="mt-3 text-sm text-text-secondary">
              {text.inserted}: {feedback.label} ({feedback.count})
            </p>
          )}
          {!!feedback?.warnings.length && (
            <div
              role="alert"
              className="mt-3 rounded border border-warning bg-warning/10 p-3 text-xs text-text-primary"
            >
              <p className="font-semibold">{text.warnings}</p>
              <ul className="mt-1 list-disc pl-4">
                {feedback.warnings.map((warning, index) => (
                  <li key={index}>
                    {warning.sourceElementId} → {warning.targetElementId}: {warning.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="secondary" onClick={onClose}>
            {text.close}
          </Button>
          <Button variant="primary" disabled={!selected} onClick={handleInsert}>
            {text.insert}
          </Button>
        </footer>
      </div>
    </div>
  )
}
