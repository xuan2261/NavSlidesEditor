# Research Report: 4 Critical Bugs in NavSlides Editor

**Analyst:** researcher
**Date:** 2026-04-27
**Files reviewed:** use-live-presentation.js, SettingsPage.jsx, InsertMenu.jsx, LiveViewPage.jsx, SpeakerViewPage.jsx, RemoteControlPage.jsx

---

## Bug 1: use-live-presentation.js — Socket Race + Memory Leak (lines 17-76)

**Root cause (3 issues):**

1. **Race condition:** `setupSocket()` is `async` but called without `await` (line 69). The cleanup function (lines 71-75) runs synchronously before `activeSocket` is assigned (line 42). `activeSocket` is still `null` at cleanup time → socket never disconnected.
2. **Stale presenterSecret:** The `join-room` emit (line 50) captures `presenterSecret` from the closure at effect creation time. When `presenterSecret` changes (dependency at line 76), a new effect runs, but the `connect` handler still emits the OLD token. The `presenterToken` param in the emit will be stale.
3. **Missing `connect_error`:** `io({ path: '/ws' })` at line 42 has no error handler — network failures fail silently.

**Impact:** Every presenter join leaks a Socket.IO connection. After 2-3 presenter role changes, multiple orphaned connections accumulate on the server.

**Fix:** Wrap socket in a `useRef`, assign ref inside `setupSocket`, and call `ref.current?.disconnect()` in cleanup. Add `connect_error` handler. For stale closure, emit `presenterToken` via a ref too, or emit on a separate event after the token is set.

```js
// sketch
const socketRef = useRef(null)
const presenterTokenRef = useRef(presenterSecret)
presenterTokenRef.current = presenterSecret

const setupSocket = () => {
  socketRef.current = io({ path: '/ws', reconnection: true })
  socketRef.current.on('connect_error', (err) => setJoinError(err.message))
  socketRef.current.on('connect', () => {
    socketRef.current.emit('join-room', { ..., presenterToken: presenterTokenRef.current })
  })
  // ...
}
setupSocket()
return () => { socketRef.current?.disconnect(); socketRef.current = null }
```

---

## Bug 2: use-live-presentation.js — Missing connect_error Handler

**Root cause:** `io({ path: '/ws' })` at line 42 has no `connect_error` listener. The server may be down, the path wrong, or CORS blocking — user sees nothing.

**Impact:** Users get a blank live view with no indication why the connection failed. `joinError` state is never set from a connection failure.

**Fix:** Add `activeSocket.on('connect_error', (err) => { setJoinError(err.message || 'Connection failed') })`. Same fix as Bug 1 above covers this.

---

## Bug 3: SettingsPage.jsx — Recursive API Call (lines 206-218)

**Root cause:** `handleTestConnection` unconditionally calls `await handleSave()` before `testAIConnection()`. Every "Test Connection" click hits `/api/settings` PUT twice if the user already clicked Save.

**Impact:** Wastes an API round-trip. If the server is slow, the test takes twice as long. If the user just saved and clicks "Test Connection", it saves again unnecessarily.

**Fix:** Two options:
- **Option A (minimal):** `testAIConnection()` should accept the settings object directly so `handleSave` is not needed. Check if `testAIConnection` reads from `/api/settings` server-side — if so, save is required. 
- **Option B (UX):** Show a spinner and add a comment explaining that saving is required for the server to have the latest credentials.

**Test:** Verify that `testAIConnection` calls the server with credentials — if it reads from `/api/settings`, save IS required. Check `client/src/utils/ai.js` for the implementation.

---

## Bug 4: InsertMenu.jsx — Media Upload No Error Handling (lines 251-267)

**Root cause:** No `try-catch`, no `.catch()`, no error state. `fetch` failure (network error, server 500, invalid file type) causes the promise to reject silently. `setOpen(false)` always runs regardless.

**Impact:** Upload fails → user sees the modal close with no feedback. They don't know the file wasn't added.

**Fix:**
```js
try {
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  const data = await res.json()
  if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed')
  if (f.type.startsWith('video/')) onAddVideo?.(data.url)
  else onAddAudio?.(data.url)
} catch (err) {
  console.error('Upload failed:', err)
  // setUploadError(err.message) — add error state
} finally {
  setOpen(false)
  setSubMenu(null)
}
```

---

## Cross-Codebase Socket.IO Pattern Audit

All 3 live pages (`LiveViewPage`, `SpeakerViewPage`, `RemoteControlPage`) + the hook use `io({ path: '/ws' })`. Pattern analysis:

| File | Uses ref | Has connect_error | Cleanup on unmount |
|---|---|---|---|
| LiveViewPage.jsx:23 | No (socket in effect scope) | No | No (BUG) |
| SpeakerViewPage.jsx:93 | Yes (`socketRef`) | No | Yes |
| RemoteControlPage.jsx:51 | Yes (`socketRef`) | No | Yes |
| use-live-presentation.js:42 | No (local var + race) | No | No (BUG) |

**Systemic issues:**
1. `connect_error` is missing everywhere — add once to a shared Socket.IO factory or a `useSocket` hook.
2. `LiveViewPage` leaks the socket on unmount — missing cleanup `return () => socket.disconnect()`.
3. `use-live-presentation` has the most severe bug (race + stale closure + no error handling).

---

## Test Scenarios to Catch Regression

| Bug | Test Scenario |
|---|---|
| Bug 1 (race) | Rapid presenter role toggle 5x → check server socket count vs client connections |
| Bug 1 (stale secret) | Generate room → change presenterToken prop → emit join-room → verify token matches |
| Bug 2 | Disconnect server → open live view → assert joinError is set |
| Bug 3 | Mock `/api/settings` PUT to 500 → click Test Connection → assert no double call |
| Bug 4 | Mock `/api/upload` to 500 → trigger upload → assert modal stays open + error shown |

---

## Unresolved Questions

1. **Bug 3:** Does `testAIConnection()` read from server-side settings or send credentials directly? If it reads server-side, save IS required and the comment "Must save first" in the code is intentional but poorly explained. Need to check `client/src/utils/ai.js`.
2. **Bug 1 stale closure:** Does `presenterSecret` actually change after initial creation? If `presenterToken` is always set once on room creation and never changes, the stale closure may never trigger — but the code structure is still wrong.
3. **Socket.IO path:** All pages use `io({ path: '/ws' })` — is `/ws` the correct path matching the server's Socket.IO mount?
