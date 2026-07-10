import { useState, useEffect } from 'react'
import { confirmUser } from '../utils/app-feedback'
import { Button, ModalShell } from './ui'

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FileBrowserModal({ presentationId, onInsert, onClose }) {
  const [files, setFiles] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!presentationId) return
    let cancelled = false
    fetch(`/api/presentations/${presentationId}/uploads`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setFiles(Array.isArray(data) ? data : [])
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [presentationId])

  const filtered = filter === 'all' ? files : files.filter((f) => f.type?.startsWith(filter))

  const handleInsert = (file) => {
    if (file.type?.startsWith('image')) {
      onInsert({ type: 'image', src: file.url })
    } else if (file.type?.startsWith('video')) {
      onInsert({ type: 'video', src: file.url })
    } else if (file.type?.startsWith('audio')) {
      onInsert({ type: 'audio', src: file.url })
    }
    onClose()
  }

  const handleDelete = async (event, file) => {
    event.stopPropagation()
    if (!presentationId || !file.filename) return
    confirmUser(
      `Delete ${file.filename}?`,
      async () => {
        const res = await fetch(
          `/api/presentations/${presentationId}/uploads/${encodeURIComponent(file.filename)}`,
          { method: 'DELETE' }
        )
        if (!res.ok) return
        setFiles((current) => current.filter((item) => item.filename !== file.filename))
      },
      { title: 'Delete uploaded file', confirmLabel: 'Delete', destructive: true }
    )
  }

  return (
    <ModalShell
      title="File Browser"
      titleId="file-browser-modal-title"
      size="xl"
      className="w-[640px] max-h-[70vh]"
      bodyClassName="flex-1 p-0"
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" className="px-4 py-1.5 text-sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="border-b border-border p-4">
        <label className="flex items-center gap-2 text-xs text-text-muted">
          File type
          <select
            className="bg-card border border-border text-text-primary text-xs px-2 py-1 rounded"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Files</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="audio">Audio</option>
          </select>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center text-text-muted py-8 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-text-muted py-8 text-sm">No files found</div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {filtered.map((file) => (
              <div
                key={file.filename}
                role="button"
                tabIndex={0}
                className="border border-border rounded-lg p-2 hover:border-accent cursor-pointer text-left transition-colors"
                onClick={() => handleInsert(file)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') handleInsert(file)
                }}
              >
                {file.type?.startsWith('image') ? (
                  <div className="w-full h-24 bg-hover rounded overflow-hidden mb-2 flex items-center justify-center">
                    <img
                      src={file.url}
                      alt={file.filename}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-full h-24 bg-hover rounded mb-2 flex items-center justify-center text-text-muted text-2xl">
                    {file.type?.startsWith('video')
                      ? '🎬'
                      : file.type?.startsWith('audio')
                        ? '🎵'
                        : '📄'}
                  </div>
                )}
                <div className="text-xs text-text-primary truncate" title={file.filename}>
                  {file.filename}
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-text-muted">{formatSize(file.size)}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="text-[10px] text-danger hover:underline"
                    onClick={(event) => handleDelete(event, file)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') handleDelete(event, file)
                    }}
                  >
                    Delete
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  )
}
