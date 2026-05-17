# Phase 08: Upload Deduplication + File Browser

**Priority:** P2 | **Effort:** Medium | **Status:** Pending

---

## Context

- Source: parallax commits `4e225d2` (SHA-256 dedup), `916a63d` (file browser)
- NavSlidesEditor has file upload via multer but no dedup or browser
- Server stores uploads in `server/uploads/` directory

---

## Requirements

### SHA-256 Upload Deduplication
- Before writing uploaded file, compute SHA-256 hash
- Check if hash already exists in uploads for the same presentation
- If exists, return existing URL instead of storing duplicate
- Saves disk space for repeated uploads of same file

### File Browser
- UI panel to browse all uploaded files for a presentation
- Shows file name, size, type, thumbnail (for images)
- Allows inserting file into slide from browser
- Allows deleting unused files
- Search/filter by file type

---

## Files to Modify

| File | Change |
|------|--------|
| `server/routes/upload.js` | Add SHA-256 hash check before writing file |
| `server/index.js` | Add `GET /api/presentations/:id/uploads` endpoint |
| `client/src/components/FileBrowserModal.jsx` (new) | File browser UI component |
| `client/src/pages/EditorPage.jsx` | Add `handleOpenFileBrowser` handler |
| `client/src/components/Toolbar.jsx` | Add "File Browser" button |

---

## Implementation Steps

### Step 1: Server-side deduplication
```js
// server/routes/upload.js
const crypto = require('crypto')
const fs = require('fs')

async function handleUpload(filePath, originalFilename, presentationId) {
  const fileBuffer = fs.readFileSync(filePath)
  const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex')

  // Check for existing file with same hash
  const existing = await db.query(
    'SELECT filename FROM uploads WHERE presentation_id = $1 AND file_hash = $2',
    [presentationId, fileHash]
  )
  if (existing.rows.length > 0) {
    fs.unlinkSync(filePath) // Remove temp file
    return { url: `/uploads/${existing.rows[0].filename}`, deduped: true }
  }

  // Store new file with hash
  const filename = `${uuid()}${path.extname(originalFilename)}`
  const destPath = path.join(UPLOADS_DIR, presentationId, filename)
  fs.renameSync(filePath, destPath)

  // Record in tracking (JSON file or DB)
  await recordUpload(presentationId, filename, fileHash, fileBuffer.length)

  return { url: `/uploads/${presentationId}/${filename}`, deduped: false }
}
```

Since NavSlidesEditor uses file-based storage (no PostgreSQL), implement dedup tracking in JSON:
```js
// server/data/upload-hashes.json
{
  "presentation-id": {
    "abc123hash": { "filename": "uuid.jpg", "size": 102400 },
    ...
  }
}
```

### Step 2: Server GET /api/presentations/:id/uploads
```js
// server/routes/presentations.js — add route
router.get('/:id/uploads', (req, res) => {
  const uploadDir = path.join(UPLOADS_DIR, req.params.id)
  if (!fs.existsSync(uploadDir)) return res.json([])

  const files = fs.readdirSync(uploadDir).map(filename => {
    const stats = fs.statSync(path.join(uploadDir, filename))
    return {
      filename,
      url: `/uploads/${req.params.id}/${filename}`,
      size: stats.size,
      type: mime.getType(filename),
      uploadedAt: stats.mtime,
    }
  })
  res.json(files)
})
```

### Step 3: Create FileBrowserModal.jsx
```jsx
// client/src/components/FileBrowserModal.jsx
export default function FileBrowserModal({ presentationId, onInsert, onClose }) {
  const [files, setFiles] = useState([])
  const [filter, setFilter] = useState('all') // all, image, video, audio

  useEffect(() => {
    fetch(`/api/presentations/${presentationId}/uploads`)
      .then(r => r.json())
      .then(setFiles)
  }, [presentationId])

  const filtered = filter === 'all' ? files : files.filter(f => f.type?.startsWith(filter))

  return (
    <div className="modal">
      <div className="modal-header">
        <h3>File Browser</h3>
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All Files</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
          <option value="audio">Audio</option>
        </select>
        <button onClick={onClose}>X</button>
      </div>
      <div className="file-grid">
        {filtered.map(file => (
          <div key={file.filename} className="file-card" onClick={() => onInsert(file)}>
            {file.type?.startsWith('image') ? (
              <img src={file.url} alt={file.filename} />
            ) : (
              <div className="file-icon">{file.type}</div>
            )}
            <span>{file.filename}</span>
            <span>{formatSize(file.size)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Step 4: Toolbar integration
Add "Files" button in insert menu:
```jsx
<button className="btn-icon" title="File Browser" onClick={onOpenFileBrowser}>
  <FolderOpen size={14} /> Files
</button>
```

### Step 5: EditorPage handler
```js
const handleInsertFromFileBrowser = (file) => {
  if (file.type?.startsWith('image')) {
    handleAddImage(file.url)
  } else if (file.type?.startsWith('video')) {
    handleAddVideo(file.url)
  } else if (file.type?.startsWith('audio')) {
    handleAddAudio(file.url)
  }
  setShowFileBrowser(false)
}
```

---

## Tests

### Unit Tests
```js
// server/routes/upload-dedup.test.js
import { describe, it, expect, vi } from 'vitest'
import { handleUpload } from './upload'

describe('Upload deduplication', () => {
  it('detects duplicate files by hash', async () => {
    const result1 = await handleUpload('/tmp/test.jpg', 'test.jpg', 'pres-1')
    const result2 = await handleUpload('/tmp/test.jpg', 'test.jpg', 'pres-1')
    expect(result1.deduped).toBe(false)
    expect(result2.deduped).toBe(true)
    expect(result2.url).toBe(result1.url)
  })

  it('stores different files separately', async () => {
    const result1 = await handleUpload('/tmp/a.jpg', 'a.jpg', 'pres-1')
    const result2 = await handleUpload('/tmp/b.jpg', 'b.jpg', 'pres-1')
    expect(result1.url).not.toBe(result2.url)
  })
})
```

```js
// client/src/components/FileBrowserModal.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import FileBrowserModal from './FileBrowserModal'

describe('FileBrowserModal', () => {
  it('renders file list', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve([
        { filename: 'test.jpg', url: '/uploads/test.jpg', size: 1024, type: 'image/jpeg' }
      ])
    })
    render(<FileBrowserModal presentationId="pres-1" onInsert={vi.fn()} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('test.jpg')).toBeTruthy())
  })
})
```

### Integration Test
1. Upload same image twice → verify second upload is deduped (check server logs)
2. Open file browser → verify uploaded files listed
3. Filter by "Images" → verify only images shown
4. Click image in browser → verify it inserts into slide
5. Upload different file types → verify all appear in browser

---

## Success Criteria

- [ ] SHA-256 deduplication implemented in upload route
- [ ] `GET /api/presentations/:id/uploads` endpoint works
- [ ] `FileBrowserModal.jsx` created with file grid, filters, insert action
- [ ] "Files" button in Toolbar insert menu
- [ ] File browser opens, lists files, allows insert
- [ ] Unit tests pass
- [ ] `npm run build` succeeds
