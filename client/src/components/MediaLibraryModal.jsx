import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Trash2, Upload, Image as ImageIcon, Film, Music, Download } from 'lucide-react'
import { api } from '../utils/api'
import { searchUnsplash } from '../services/unsplash'
import { searchGiphy } from '../services/giphy'
import { Button, ModalShell } from '../components/ui'

const TYPE_FILTERS = [
  { key: '', label: 'All', icon: null },
  { key: 'image', label: 'Images', icon: ImageIcon },
  { key: 'video', label: 'Videos', icon: Film },
  { key: 'audio', label: 'Audio', icon: Music },
]

const INITIAL_MEDIA_LIMIT = 100
const MEDIA_PAGE_SIZE = 100

function formatSize(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function MediaLibraryModal({ onClose, onInsert }) {
  const [activeTab, setActiveTab] = useState('local') // local, unsplash, giphy
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_MEDIA_LIMIT)
  const closeTimerRef = useRef(null)

  const loadMedia = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (activeTab === 'local') {
        const params = {}
        if (typeFilter) params.type = typeFilter
        if (search.trim()) params.search = search.trim()
        const data = await api.getMedia(params)
        setMedia(Array.isArray(data) ? data : [])
      } else if (activeTab === 'unsplash') {
        const data = await searchUnsplash(search.trim() || 'nature')
        setMedia(data)
      } else if (activeTab === 'giphy') {
        const data = await searchGiphy(search.trim() || 'trending')
        setMedia(data)
      }
    } catch (err) {
      setError(err.message || 'Failed to load media')
      setMedia([])
    } finally {
      setLoading(false)
    }
  }, [activeTab, typeFilter, search])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadMedia()
    }, 400)
    return () => clearTimeout(delayDebounceFn)
  }, [loadMedia])

  useEffect(() => {
    setVisibleLimit(INITIAL_MEDIA_LIMIT)
  }, [activeTab, search, typeFilter])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  async function handleUpload(e) {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    setError('')
    setStatusMessage('')
    try {
      for (const file of files) {
        await api.uploadFile(file)
      }
      setActiveTab('local')
      await loadMedia()
      setStatusMessage(files.length === 1 ? 'File uploaded.' : `${files.length} files uploaded.`)
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleDelete(filename) {
    if (activeTab !== 'local') return
    if (!confirm('Delete this file?')) return
    setError('')
    setStatusMessage('')
    try {
      await api.deleteMedia(filename)
      setMedia((prev) => prev.filter((m) => m.filename !== filename))
      setStatusMessage('File deleted.')
    } catch (err) {
      setError(err.message || 'Delete failed')
    }
  }

  async function handleInsert(item) {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    if (activeTab === 'local') {
      if (onInsert) onInsert(item)
      onClose()
    } else {
      // For Unsplash/Giphy, download to local server first
      try {
        setUploading(true)
        setError('')
        setStatusMessage('')
        // Here we'd ideally fetch the blob and upload to api.uploadFile
        // For simplicity in this demo without proxy, we just return the remote URL
        // OR we can fetch it via browser and upload.
        const res = await fetch(item.downloadUrl)
        const blob = await res.blob()
        const file = new File([blob], `${item.id}.${blob.type.split('/')[1] || 'jpg'}`, {
          type: blob.type,
        })
        const uploaded = await api.uploadFile(file)
        if (onInsert) {
          // Fake item object matching local structure
          onInsert({ url: uploaded.url || item.url, type: 'image' })
        }
        onClose()
      } catch {
        setStatusMessage('Could not save remote media locally. Inserted remote URL instead.')
        // fallback to just inserting url directly
        if (onInsert) {
          onInsert({ url: item.downloadUrl, type: 'image' })
        }
        closeTimerRef.current = window.setTimeout(onClose, 1800)
      } finally {
        setUploading(false)
      }
    }
  }

  const [isOpen, setIsOpen] = useState(true)

  const handleClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    setIsOpen(false)
    onClose()
  }

  if (!isOpen) return null

  const visibleMedia = media.slice(0, visibleLimit)
  const hasMoreMedia = visibleMedia.length < media.length

  return (
    <ModalShell
      title="Media Library"
      titleId="media-library-modal-title"
      size="2xl"
      onClose={handleClose}
      bodyClassName="p-0 flex min-h-[70vh] flex-col"
    >
      {(error || statusMessage) && (
        <div
          className={`mx-6 mb-3 rounded-md border px-3 py-2 text-[13px] ${
            error
              ? 'border-danger/30 bg-danger/10 text-danger'
              : 'border-accent/30 bg-accent/10 text-text-primary'
          }`}
          role={error ? 'alert' : 'status'}
        >
          {error || statusMessage}
        </div>
      )}
      {/* Tabs */}
      <div className="flex gap-3 border-b border-border px-6 pb-3 mb-4">
        {['local', 'unsplash', 'giphy'].map((tab) => (
          <Button
            variant="ghost"
            key={tab}
            className={`capitalize px-4 py-1.5 text-[13px] rounded-md transition-colors ${activeTab === tab ? 'bg-accent/15 text-accent font-medium' : 'text-text-muted hover:bg-hover'}`}
            onClick={() => {
              setActiveTab(tab)
              setSearch('')
            }}
          >
            {tab === 'local' ? 'My Media' : tab}
          </Button>
        ))}
      </div>

      {/* Toolbar: Search + Filter + Upload */}
      <div className="flex gap-2 items-center px-6 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="w-full pl-9 pr-3 py-1.5 rounded-md border border-border bg-secondary text-text-primary text-sm focus:border-accent focus:outline-none transition-colors"
            type="text"
            placeholder={`Search ${activeTab === 'local' ? 'files' : activeTab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {activeTab === 'local' && (
          <div className="flex gap-1">
            {TYPE_FILTERS.map((f) => (
              <Button
                variant="ghost"
                key={f.key}
                className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ${typeFilter === f.key ? 'bg-accent text-white' : 'bg-secondary text-text-muted hover:bg-hover border border-border'}`}
                onClick={() => setTypeFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        )}
        <label className="flex items-center justify-center gap-1.5 px-4 py-1.5 text-[13px] bg-accent hover:bg-accent-hover text-white rounded-md cursor-pointer transition-colors font-medium ml-2">
          <Upload size={14} />
          {uploading ? 'Uploading...' : 'Upload'}
          <input
            type="file"
            multiple
            accept="image/*,video/*,audio/*,.svg"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto min-h-[300px] px-6 pb-6">
        {loading ? (
          <div className="text-center py-16 text-text-muted text-[13px]" role="status">
            Loading...
          </div>
        ) : media.length === 0 ? (
          <div className="text-center py-16 text-text-muted flex flex-col items-center">
            <ImageIcon size={48} className="mb-3 opacity-30" />
            <p className="text-[13px] font-medium text-text-primary">No media files found</p>
            {activeTab === 'local' && (
              <p className="text-xs mt-1">Upload images, videos, or audio to get started</p>
            )}
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between text-[12px] text-text-muted">
              <span>
                Showing {visibleMedia.length} of {media.length} media files
              </span>
              {hasMoreMedia && (
                <Button
                  variant="secondary"
                  className="h-7 px-3 text-[12px]"
                  onClick={() => setVisibleLimit((limit) => limit + MEDIA_PAGE_SIZE)}
                >
                  Load more media
                </Button>
              )}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
              {visibleMedia.map((item) => (
                <div
                  key={item.id || item.filename}
                  data-testid="media-library-item"
                  className="border border-border rounded-lg overflow-hidden cursor-pointer bg-card transition-colors hover:border-accent relative flex flex-col"
                  onClick={() => handleInsert(item)}
                >
                  {/* Preview */}
                  <div className="h-[120px] bg-[#111] flex items-center justify-center overflow-hidden">
                    {item.type === 'video' ? (
                      <Film size={28} className="text-white/30" />
                    ) : item.type === 'audio' ? (
                      <Music size={28} className="text-white/30" />
                    ) : (
                      <img
                        src={item.url}
                        alt={item.originalName || item.author}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-2 flex flex-col flex-1">
                    <div className="text-xs text-text-primary overflow-hidden text-ellipsis whitespace-nowrap">
                      {item.originalName || item.author || 'Image'}
                    </div>
                    <div className="mt-auto">
                      {activeTab === 'local' && (
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-[11px] text-text-muted">{formatSize(item.size)}</span>
                          <Button
                            variant="icon"
                            className="w-[22px] h-[22px] text-text-muted hover:text-danger hover:bg-danger/10 p-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(item.filename)
                            }}
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      )}
                      {activeTab !== 'local' && (
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-[11px] text-text-muted">From {activeTab}</span>
                          <Download size={13} className="text-text-muted" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </ModalShell>
  )
}
