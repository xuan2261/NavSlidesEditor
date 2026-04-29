---
phase: 5
title: "Fix C9: Media upload error handling"
status: "completed"
priority: P1
effort: "20m"
dependencies: []
---

# Phase 5: Fix C9 — Media Upload Error Handling

## Overview
Add try-catch error handling to media upload in InsertMenu. Show user feedback on failure instead of silently closing the modal.

## Requirements
- Wrap fetch in try-catch
- Show error message to user on failure
- Modal closes gracefully on both success and failure (already works via finally)

## Architecture

### Before:
```js
onChange={async (e) => {
  const f = e.target.files?.[0]
  if (!f) return
  e.target.value = ''
  const fd = new FormData()
  fd.append('file', f)
  const res = await fetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json())
  if (res.url) {
    if (f.type.startsWith('video/')) onAddVideo?.(res.url)
    else onAddAudio?.(res.url)
  }
  setOpen(false)
  setSubMenu(null)
}}
```

### After:
```js
onChange={async (e) => {
  const f = e.target.files?.[0]
  if (!f) return
  e.target.value = ''
  const fd = new FormData()
  fd.append('file', f)
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok || !data.url) {
      console.error('Upload failed:', data.error || `HTTP ${res.status}`)
      setUploadError?.(data.error || 'Upload failed')
      return
    }
    if (f.type.startsWith('video/')) onAddVideo?.(data.url)
    else onAddAudio?.(data.url)
  } catch (err) {
    console.error('Upload failed:', err)
    setUploadError?.('Upload failed. Check your connection.')
  } finally {
    setOpen(false)
    setSubMenu(null)
  }
}}
```

### Notes:
- `setUploadError` — add a `useState` for upload errors in the parent component if not already present
- Alternatively, use a simple `alert()` for MVP if `setUploadError` pattern is too complex
- The `finally` block ensures modal always closes cleanly

## Related Code Files
- Modify: `client/src/components/InsertMenu.jsx`
- Check: parent component that renders InsertMenu — does it have an error display?

## Implementation Steps
1. Read `InsertMenu.jsx` lines 240-280
2. Check if InsertMenu already has upload error state (search for `uploadError`, `error`, `setError`)
3. If no error state: add `const [uploadError, setUploadError] = useState(null)` near the top of the component
4. Wrap the upload fetch in try-catch-finally
5. Check if parent component has a toast/notification system — if so, use that instead of inline error state
6. Verify the `finally` block closes modal cleanly

## Success Criteria
- [ ] Network error: error logged + user sees feedback (toast or inline)
- [ ] Server 500: error logged + user sees feedback
- [ ] Success: element added, modal closes
- [ ] File too large: user sees error message
- [ ] Modal always closes (finally block)
