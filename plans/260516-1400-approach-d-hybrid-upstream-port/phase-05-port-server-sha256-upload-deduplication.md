# Phase 5: Server Improvements — SHA-256 Upload Deduplication

**Priority:** P2
**Status:** pending
**Effort:** 3-4h
**Upstream Commit:** `4e225d27`

---

## Context Links

- [Brainstorm Report](../260516-1200-upstream-v2-comprehensive-port-brainstorm/upstream-v2-port-audit-and-brainstorm-report.md) — Section 3.5
- [Overview Plan](hybrid-upstream-port-overview-plan.md)

## Overview

Add SHA-256 hash-based upload deduplication. When a file is uploaded, compute its hash. If an identical file already exists for the same presentation, return the existing URL without re-uploading.

## Key Insights

- Local uses `server/routes/upload.js` with multer disk storage and UUID filenames
- Upstream uses `server/services/upload-service.js` with a database — local uses flat file storage
- Need to adapt: local stores uploads in `server/uploads/` with no database, so dedup must work with filesystem
- Upstream adds a migration `005_upload_hash.sql` — local has no database, so hash tracking must be file-based or in-memory

## Related Code Files

### Files to modify:
- `server/routes/upload.js` — add hash computation and dedup check before multer upload

### Files to read for context:
- `server/routes/upload.js` lines 1-77 (full file)
- `server/index.js` — how uploads are referenced

## Implementation Steps

### Step 1: Read current upload route
Understand the full upload flow: multer config, file naming, response format.

### Step 2: Add SHA-256 hash computation
Before multer processes the file, compute hash from the buffer:
```js
const crypto = require('crypto')
const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex')
```

### Step 3: Check for existing file with same hash
Scan `server/uploads/` for a file with matching hash (store hash in a JSON manifest or filename-based lookup).

### Step 4: Return existing URL or save new file
If match found → delete temp file, return existing URL.
If no match → proceed with normal save, record hash.

### Step 5: Hash manifest approach
Since local has no database, use a `server/data/upload-hashes.json` file to track `{ hash: filePath }` mappings.

## Todo List

- [ ] Read and understand current upload route
- [ ] Add SHA-256 hash computation on upload
- [ ] Create hash manifest file (`server/data/upload-hashes.json`)
- [ ] Implement dedup check before saving
- [ ] Return existing URL for duplicate uploads
- [ ] Run `npm run test` — all pass
- [ ] Manual: upload same file twice → verify second returns existing URL
- [ ] Manual: upload different files → verify both saved correctly

## Success Criteria

- Duplicate file uploads are detected via SHA-256 hash
- Duplicate uploads return the existing file URL without re-saving
- Non-duplicate uploads work normally
- Hash manifest persists across server restarts
- All tests pass

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Hash manifest grows unbounded | Low | Periodic cleanup of orphaned entries |
| Hash collision (theoretical) | Very Low | SHA-256 collision probability is negligible |
| Race condition on concurrent uploads | Low | Use file locking or atomic writes |
| Breaking existing upload flow | Medium | Add dedup as enhancement, fall back to normal save on error |

## Security Considerations

- Hash computation must use crypto module (not user-supplied hash)
- Hash manifest must not be publicly accessible
- Upload validation (size, type) must still apply before dedup check

## Verification Commands

```bash
npm run test 2>&1 | tail -10
# Manual tests:
# 1. Upload file A → get URL1
# 2. Upload file A again → should get same URL1 (dedup)
# 3. Upload file B → get URL2 (different from URL1)
# 4. Check server/data/upload-hashes.json has both entries
```
