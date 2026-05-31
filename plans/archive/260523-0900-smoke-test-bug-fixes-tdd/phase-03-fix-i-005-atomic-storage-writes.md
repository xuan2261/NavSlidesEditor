---
phase: 3
title: "Fix I-005 Atomic Storage Writes"
status: pending
priority: P0
effort: "3-4h"
dependencies: [1]
---

# Phase 3: Fix I-005 — Atomic Storage Writes (GREEN + REFACTOR)

## Overview

Replace direct `fs.writeJson` calls with a write-temp-then-rename atomic pattern. Without this, a server crash, node-watch restart, or even concurrent reads during a long write can observe truncated or empty JSON — which is exactly what corrupted the smoke-test deck (I-005).

## Severity & Scope

- **Severity:** Medium (data-loss vector — entire presentation may disappear)
- **Affects:** every state-mutating call to `writePresentations` and the read-modify-write paths in `withPresentations` / `withShareTokens` / `withAnalytics` / `withMediaDb`
- **Root cause:** `server/services/storage.js:73-84` — `fs.writeJson(file, data)` is not atomic. POSIX guarantees `rename` of files in the same directory is atomic; that's the standard fix.

## Requirements

### Functional
- Every JSON file write in `storage.js` is atomic: either the old content is fully visible, or the new content is fully visible. Never partial.
- Behavior is unchanged for the happy path — same `read → fn(data) → write` contract.
- Works on Windows (which is the dev target — agent ran on Windows 10).
- Existing in-process locks (`withFileLock`) remain in place — atomic write is in addition to, not instead of.

### Non-functional
- No new runtime dependency.
- Pattern is reused for all 6 file types (presentations, share, templates, github-config, settings, analytics, media), not bespoke per file.
- Cleanup: orphaned `.tmp` files from a previous crash are tolerated (overwritten by next write, not failed open).

## Architecture

```
writeJsonAtomic(file, data, options):
  tmpFile = file + '.tmp.' + process.pid + '.' + counter
  await fs.writeJson(tmpFile, data, options)
  await fs.rename(tmpFile, file)   // atomic on same filesystem
  (on error: await fs.remove(tmpFile).catch(() => {}))
```

Replace every `fs.writeJson(file, data, ...)` inside `storage.js` with `writeJsonAtomic(file, data, ...)`. No call sites outside `storage.js` are affected because they consume `writePresentations` / `withPresentations` etc.

### Windows note

`fs.rename` on Windows requires the source and target be on the same volume. Both `.tmp` and target live in `DATA_DIR`, so this holds. Windows EPERM on rename when target is open by another process is the failure mode to test for — see Risk Assessment.

## Related Code Files

- Modify: `server/services/storage.js` (add `writeJsonAtomic` + `renameWithRetry` helpers + replace every non-sync `fs.writeJson` call site — count verified via grep at edit time)
- Read for context: existing `withFileLock`, `server/services/storage.test.js` (test from Phase 1)
- Tests verifying this fix: `server/services/storage.test.js` (the atomic-write `it` block from Phase 1.2)

## Implementation Steps

### Step 3.1 — Add atomic write helper (with Windows rename retry per Red Team Finding 3)

In `server/services/storage.js`, after the `withFileLock` block (around line 41), add:

```js
let atomicCounter = 0

async function renameWithRetry(src, dest, attempts = 5) {
  // Windows can fail rename with EPERM/EBUSY when antivirus or another
  // reader holds the target briefly. Retry with bounded backoff.
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      await fs.rename(src, dest)
      return
    } catch (err) {
      lastErr = err
      const retriable = ['EPERM', 'EBUSY', 'EACCES', 'EEXIST'].includes(err.code)
      if (!retriable || i === attempts - 1) throw err
      await new Promise((r) => setTimeout(r, 25 * (i + 1))) // 25, 50, 75, 100 ms
    }
  }
  throw lastErr
}

async function writeJsonAtomic(filePath, data, options) {
  const tmpPath = `${filePath}.tmp.${process.pid}.${++atomicCounter}`
  try {
    await fs.writeJson(tmpPath, data, options)
    await renameWithRetry(tmpPath, filePath)
  } catch (err) {
    await fs.remove(tmpPath).catch(() => {})
    throw err
  }
}
```

Counter is monotonic in-process; combined with `pid` it is unique across the lifetime of a host (Phase 3.5 cleans up stale ones from prior crashes).

### Step 3.2 — Verify and replace every `fs.writeJson` call site

**First, verify the actual call sites — the table below was scout-time only and Red Team Validation Q2 flagged it as unverified.** Run:

```powershell
grep -n "fs\.writeJson\b" server/services/storage.js
```

Then replace each non-sync (`fs.writeJson`, NOT `fs.writeJsonSync`) occurrence with `writeJsonAtomic(...)`. Expected call sites (verify against grep output, edit if drift):

| Function | Original | Replacement |
|---|---|---|
| `writePresentations` | `fs.writeJson(DATA_FILE, data, { spaces: 2 })` | `writeJsonAtomic(DATA_FILE, data, { spaces: 2 })` |
| `withPresentations` inner write | same | same |
| `writeTemplates` | same on `TEMPLATES_FILE` | same |
| `writeShareTokens` | same on `SHARE_FILE` | same |
| `withShareTokens` inner write | same | same |
| `writeGithubConfig` | same on `GITHUB_CONFIG_FILE` | same |
| `writeSettings` | same on `SETTINGS_FILE` | same |
| `writeAnalytics` | same on `ANALYTICS_FILE` | same |
| `withAnalytics` inner write | same | same |
| `writeMediaDb` | same on `MEDIA_DB_FILE` | same |
| `withMediaDb` inner write | same | same |

If grep reveals additional call sites (e.g. helpers added since scout time), replace those too. If grep shows fewer, update the success criteria to match the verified count.

Sync writes in `initDataFiles` (line 49–63) intentionally remain `writeJsonSync` — they only execute when the file does not exist (single-shot creates that crash recovery naturally retries).

### Step 3.3 — Run Phase 1 RED test → GREEN

```powershell
npx vitest run server/services/storage.test.js
```

Expected: no concurrent read observes a truncated state. Save green output to `reports/phase-03-green-evidence.md`.

### Step 3.4 — Smoke test on Windows under node --watch

Manual procedure:

1. Start dev server: `npm run dev`
2. In a second shell, write a small script that POSTs many presentations rapidly:
   ```powershell
   for ($i = 0; $i -lt 50; $i++) {
     curl -X POST "http://localhost:3002/api/presentations" -H "Content-Type: application/json" -d "{\"title\":\"atomic-$i\"}" | Out-Null
   }
   ```
3. Confirm `server/data/presentations.json` parses as valid JSON at every observation.
4. Stop the dev server abruptly with Ctrl+C mid-loop. Confirm the file is still valid JSON afterward.
5. Confirm any stray `.tmp.<pid>.*` files from the crash are tolerated by next startup (they will be overwritten or remain harmless).

Capture the test output in `reports/phase-03-green-evidence.md`.

### Step 3.5 — Cleanup orphaned tmp files at startup (async per Red Team Finding 7)

Original draft used `readdirSync`/`removeSync` which blocks the event loop on startup — especially bad on slow disks or large data dirs. Move to async, fire-and-forget via `setImmediate` so startup is not delayed:

Append to `initDataFiles()` after the `ensureDirSync` calls:

```js
// Clean up stale .tmp files from prior crashes. Async + non-blocking so
// startup is not delayed by directory scans on slow disks.
setImmediate(async () => {
  try {
    const names = await fs.readdir(DATA_DIR)
    const stale = names.filter((n) => /\.tmp\.\d+\.\d+$/.test(n))
    await Promise.all(
      stale.map((n) => fs.remove(path.join(DATA_DIR, n)).catch(() => {}))
    )
  } catch {
    /* non-fatal */
  }
})
```

### Step 3.6 — Commit

```text
fix(storage): atomic writes via temp+rename for all data files (I-005)

server/data/*.json writes now go through writeJsonAtomic: write to
a unique .tmp file, then rename onto the target. Renames within the
same directory are atomic, so a crash leaves either old or new
content — never partial. Stale .tmp files from prior crashes are
cleaned up at startup.
```

## Success Criteria

- [ ] `writeJsonAtomic` + `renameWithRetry` helpers added to `storage.js`
- [ ] All non-sync `fs.writeJson` call sites inside `storage.js` replaced — count verified via grep before edit
- [ ] Sync init writes left untouched (only run when file absent)
- [ ] Phase 1.2 RED test (both race + SIGKILL cases) passes
- [ ] Manual Windows + node --watch smoke procedure passes
- [ ] Stale `.tmp` cleanup runs at startup via `setImmediate` (does not block event loop)
- [ ] No new dependency added to `package.json`
- [ ] Green evidence in `reports/phase-03-green-evidence.md`

## Risk Assessment

| Risk | Mitigation |
|---|---|
| `fs.rename` on Windows fails with EPERM if target file is locked by another process (rare; e.g. antivirus) | Add retry loop: 3 attempts with 50ms backoff. If all fail, bubble up the error (matches current write-failure behavior) |
| `tmpCounter` collision across multiple Node workers | Counter is in-process; combined with `pid` it is unique per worker. Cluster mode is not in use |
| Crash leaves a `.tmp` orphan visible in `data/` listing | Phase 3.5 sweep on startup; also harmless because never read |
| Two writes interleave so `.tmp` from A is renamed after B's `.tmp` is renamed | `withFileLock` already serializes writes to the same path; atomic write is in addition, not replacement |

## Security Considerations

- `.tmp` files inherit `DATA_DIR` permissions — no broader exposure than current files.
- No new external I/O.

## Red Team Adjustment

### Session 2 — 2026-05-23 (post-draft review)

| Finding | Severity | Disposition | Applied |
|---|---|---|---|
| 3. Windows rename retry was mentioned in Risk table but absent from code | High | Accept | Step 3.1 now ships `renameWithRetry` with bounded 25/50/75/100ms backoff for EPERM/EBUSY/EACCES/EEXIST |
| 7. Startup `.tmp` sweep used `readdirSync`/`removeSync` — blocks event loop on slow disks | Medium | Accept | Step 3.5 rewritten to `setImmediate` + async `readdir`/`Promise.all(remove)` |
| Q2 (validation). 11-call-sites table never verified against current source | High | Accept | Step 3.2 now mandates a `grep` verification pass before editing and treats the table as expected-but-confirm |

Additional pre-emptive considerations (kept):
- If reviewer flags "what about fsync" — for strict crash-on-power-loss durability, `fs.fsync(fd)` before rename would be required. Deferred: threat model is process kill / node --watch restart, not power loss.
- If reviewer flags "what if rename fails halfway" — `rename` is one syscall, atomic; no halfway state. The retry loop addresses *whole-syscall* failure modes, not partial state.

## Next Steps

Phase 7 verifies this fix in the full regression sweep.
