import { useState, useEffect, useCallback } from 'react'
import { Search, Trash2, X, Upload, Image, Film, Music, Download } from 'lucide-react'
import { api } from '../utils/api'
import { searchUnsplash } from '../services/unsplash'
import { searchGiphy } from '../services/giphy'

const TYPE_FILTERS = [
  { key: '', label: 'All', icon: null },
  { key: 'image', label: 'Images', icon: Image },
  { key: 'video', label: 'Videos', icon: Film },
  { key: 'audio', label: 'Audio', icon: Music },
]

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

  const loadMedia = useCallback(async () => {
    setLoading(true)
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
      console.error('Failed to load media:', err)
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

  async function handleUpload(e) {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of files) {
        await api.uploadFile(file)
      }
      setActiveTab('local')
      await loadMedia()
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleDelete(filename) {
    if (activeTab !== 'local') return
    if (!confirm('Delete this file?')) return
    try {
      await api.deleteMedia(filename)
      setMedia((prev) => prev.filter((m) => m.filename !== filename))
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  async function handleInsert(item) {
    if (activeTab === 'local') {
      if (onInsert) onInsert(item)
      onClose()
    } else {
      // For Unsplash/Giphy, download to local server first
      try {
        setUploading(true)
        // Here we'd ideally fetch the blob and upload to api.uploadFile
        // For simplicity in this demo without proxy, we just return the remote URL 
        // OR we can fetch it via browser and upload.
        const res = await fetch(item.downloadUrl)
        const blob = await res.blob()
        const file = new File([blob], `${item.id}.${blob.type.split('/')[1] || 'jpg'}`, { type: blob.type })
        const uploaded = await api.uploadFile(file)
        if (onInsert) {
          // Fake item object matching local structure
          onInsert({ url: uploaded.url || item.url, type: 'image' }) 
        }
        onClose()
      } catch (err) {
        console.error('Failed to download from external source:', err)
        // fallback to just inserting url directly
        if (onInsert) {
          onInsert({ url: item.downloadUrl, type: 'image' })
        }
        onClose()
      } finally {
        setUploading(false)
      }
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ width: 850, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>Media Library</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 12 }}>
          {['local', 'unsplash', 'giphy'].map(tab => (
            <button
              key={tab}
              className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
              style={{ textTransform: 'capitalize', padding: '6px 16px', fontSize: 13 }}
              onClick={() => { setActiveTab(tab); setSearch(''); }}
            >
              {tab === 'local' ? 'My Media' : tab}
            </button>
          ))}
        </div>

        {/* Toolbar: Search + Filter + Upload */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="prop-input"
              type="text"
              placeholder={`Search ${activeTab === 'local' ? 'files' : activeTab}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 28, width: '100%' }}
            />
          </div>
          {activeTab === 'local' && (
            <div style={{ display: 'flex', gap: 2 }}>
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f.key}
                  className={`btn btn-secondary ${typeFilter === f.key ? 'active' : ''}`}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    background: typeFilter === f.key ? 'var(--accent)' : undefined,
                    color: typeFilter === f.key ? '#fff' : undefined,
                  }}
                  onClick={() => setTypeFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
          <label
            className="btn btn-primary"
            style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Upload size={14} />
            {uploading ? 'Uploading...' : 'Upload'}
            <input
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.svg"
              style={{ display: 'none' }}
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 300, paddingRight: 8 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading...</div>
          ) : media.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <Image size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p>No media files found</p>
              {activeTab === 'local' && <p style={{ fontSize: 13 }}>Upload images, videos, or audio to get started</p>}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {media.map((item) => (
                <div
                  key={item.id || item.filename}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    background: 'var(--bg-card)',
                    transition: 'border-color 0.15s',
                    position: 'relative'
                  }}
                  onClick={() => handleInsert(item)}
                  onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  {/* Preview */}
                  <div style={{ height: 120, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {item.type === 'video' ? (
                      <Film size={28} style={{ color: 'rgba(255,255,255,0.3)' }} />
                    ) : item.type === 'audio' ? (
                      <Music size={28} style={{ color: 'rgba(255,255,255,0.3)' }} />
                    ) : (
                      <img
                        src={item.url}
                        alt={item.originalName || item.author}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                      />
                    )}
                  </div>
                  {/* Info */}
                  <div style={{ padding: '8px' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.originalName || item.author || 'Image'}
                    </div>
                    {activeTab === 'local' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatSize(item.size)}</span>
                        <button
                          className="btn-icon"
                          style={{ width: 22, height: 22 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(item.filename)
                          }}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                    {activeTab !== 'local' && (
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                       <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>From {activeTab}</span>
                       <Download size={14} style={{ color: 'var(--text-muted)' }} />
                     </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
