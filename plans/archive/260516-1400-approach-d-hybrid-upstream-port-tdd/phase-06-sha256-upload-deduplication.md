# Phase 6: SHA-256 Upload Deduplication

**Priority:** P2
**Status:** pending
**Effort:** 3-4h
**Upstream Commit:** `4e225d27`

---

## Context Links

- [Predict Report](predict-report-5-expert-personas-debate.md) — Persona 2: 100MB hash computation cost
- [Brainstorm Report](../260516-1200-upstream-v2-comprehensive-port-brainstorm/upstream-v2-port-audit-and-brainstorm-report.md) — Section 3.5

## Overview

**TDD: Write tests for upload dedup FIRST.**

Add SHA-256 hash-based deduplication. Local uses flat-file storage (no database), so adapt with a JSON manifest file instead of SQL migration.

## Key Decision (from Predict)

Persona 2 flags 100MB hash computation cost. Mitigation: compute hash on the multer buffer BEFORE writing to disk (buffer is already in memory), not by re-reading the file.

## TDD Approach

### RED Phase: Write failing tests
1. Create `server/tests/upload-dedup.test.js`
2. Test: same file uploaded twice returns same URL
3. Test: different files get different URLs
4. Test: hash manifest persists
5. Run tests — FAIL

### GREEN Phase: Implement
6. Add hash computation to upload route
7. Add hash manifest file
8. Run tests — PASS

## Test File: `server/tests/upload-dedup.test.js`

```js
describe('upload deduplication', () => {
  test('same file uploaded twice returns same URL', async () => {
    const fileBuffer = Buffer.from('test file content')
    const res1 = await uploadFile(fileBuffer, 'test.txt')
    const res2 = await uploadFile(fileBuffer, 'test.txt')
    expect(res1.body.url).toBe(res2.body.url)
  })

  test('different files get different URLs', async () => {
    const res1 = await uploadFile(Buffer.from('content A'), 'a.txt')
    const res2 = await uploadFile(Buffer.from('content B'), 'b.txt')
    expect(res1.body.url).not.toBe(res2.body.url)
  })

  test('hash manifest file is created and contains entries', async () => {
    await uploadFile(Buffer.from('manifest test'), 'm.txt')
    const manifest = JSON.parse(fs.readFileSync('server/data/upload-hashes.json', 'utf8'))
    expect(Object.keys(manifest).length).toBeGreaterThan(0)
  })

  test('hash is SHA-256 hex string', async () => {
    await uploadFile(Buffer.from('hash check'), 'h.txt')
    const manifest = JSON.parse(fs.readFileSync('server/data/upload-hashes.json', 'utf8'))
    const hash = Object.keys(manifest)[0]
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })
})
```

## Implementation Steps

### Step 1: Write test file (RED)
Create `server/tests/upload-dedup.test.js`. Run — FAIL.

### Step 2: Add hash manifest
Create `server/data/upload-hashes.json` with initial `{}` content.

### Step 3: Modify upload route
In `server/routes/upload.js`, add dedup logic before multer save:

```js
const crypto = require('crypto')
const HASH_MANIFEST = path.join(__dirname, '../data/upload-hashes.json')

function loadHashManifest() {
  try { return JSON.parse(fs.readFileSync(HASH_MANIFEST, 'utf8')) }
  catch { return {} }
}

function saveHashManifest(manifest) {
  fs.writeFileSync(HASH_MANIFEST, JSON.stringify(manifest, null, 2))
}

// In the upload handler, BEFORE writing file:
router.post('/api/upload', upload.single('file'), (req, res) => {
  const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex')
  const manifest = loadHashManifest()

  if (manifest[hash]) {
    // Duplicate — return existing URL
    // Delete the temp file multer already wrote
    fs.unlinkSync(req.file.path)
    return res.json({ url: manifest[hash], deduplicated: true })
  }

  // New file — save and record hash
  const fileUrl = `/uploads/${req.file.filename}`
  manifest[hash] = fileUrl
  saveHashManifest(manifest)
  res.json({ url: fileUrl, deduplicated: false })
})
```

**Note:** This requires changing multer from `diskStorage` to `memoryStorage` to get the buffer for hashing, then writing manually. OR compute hash after disk write and delete if duplicate.

### Step 4: Handle large files
For files > 10MB, stream the hash computation to avoid memory spike:
```js
function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('data', data => hash.update(data))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}
```

### Step 5: Run tests (GREEN)
```bash
npx vitest run server/tests/upload-dedup.test.js
npm run test
```

## Todo List

- [ ] Create `server/tests/upload-dedup.test.js` (RED)
- [ ] Verify tests FAIL
- [ ] Create `server/data/upload-hashes.json` manifest
- [ ] Add SHA-256 hash computation to upload route
- [ ] Add dedup check (return existing URL for duplicates)
- [ ] Handle large file hashing (stream-based)
- [ ] Run tests — PASS (GREEN)
- [ ] Run `npm run test` — all pass
- [ ] Manual: upload same file twice → same URL returned
- [ ] Manual: upload different files → different URLs

## Success Criteria

- Duplicate uploads detected via SHA-256 hash
- Duplicate uploads return existing URL without re-saving
- Hash manifest persists across server restarts
- Large files (up to 100MB) handled efficiently
- All tests pass

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| 100MB hash computation blocks event loop | Medium | Stream-based hashing for large files |
| Hash manifest grows unbounded | Low | Periodic cleanup of orphaned entries |
| Race condition on concurrent duplicate uploads | Low | File-based manifest with atomic write |
| Breaking existing upload flow | Medium | Add dedup as enhancement, fall back on error |

## Security Considerations

- Hash computed server-side (not user-supplied)
- Hash manifest not publicly accessible (in server/data/)
- Upload validation (size, type) still applies before dedup
