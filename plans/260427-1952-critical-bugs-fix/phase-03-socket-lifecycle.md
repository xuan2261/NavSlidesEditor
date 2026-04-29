---
phase: 3
title: "Fix C4+C5: Socket.IO lifecycle + error handling"
status: "completed"
priority: P0
effort: "45m"
dependencies: []
---

# Phase 3: Fix C4+C5 — Socket.IO Lifecycle + Error Handling

## Overview
Fix the Socket.IO race condition (C4) and missing `connect_error` handler (C5) in `use-live-presentation.js`. Also audit other live pages for the same pattern.

## Requirements
- C4: `setupSocket` async race → use `useRef` + cancellation flag
- C4: `presenterSecret` stale closure → use ref pattern
- C5: Add `connect_error` handler
- Audit: check LiveViewPage.jsx, SpeakerViewPage.jsx, RemoteControlPage.jsx for same issues

## Architecture

### C4 Fix Pattern
**Before:**
```js
useEffect(() => {
  let activeSocket = null
  const setupSocket = async () => {
    activeSocket = io({ path: '/ws' })
    activeSocket.on('connect', () => {
      activeSocket.emit('join-room', {
        presenterToken: role === 'presenter' ? presenterSecret : undefined
      })
    })
    setSocket(activeSocket)
  }
  setupSocket()  // async, not awaited
  return () => {
    if (activeSocket) activeSocket.disconnect()  // activeSocket is null here!
  }
}, [presentationId, role, code, presenterSecret])
```

**After:**
```js
useEffect(() => {
  const socketRef = useRef(null)
  const presenterTokenRef = useRef(presenterToken)
  presenterTokenRef.current = presenterToken

  let cancelled = false

  const setupSocket = async () => {
    const sock = io({ path: '/ws', reconnection: true })

    sock.on('connect_error', (err) => {
      setJoinError(err.message || 'Connection failed')
    })

    sock.on('connect', () => {
      setIsConnected(true)
      sock.emit('join-room', {
        roomId: currentCode,
        role,
        presentationId: role === 'presenter' ? presentationId : undefined,
        presenterToken: role === 'presenter' ? presenterTokenRef.current : undefined,
      })
    })

    sock.on('disconnect', () => {
      setIsConnected(false)
    })

    sock.on('viewer-count', ({ count }) => {
      setViewersCount(count)
    })

    sock.on('join-error', ({ message }) => {
      setJoinError(message || 'Failed to join live room')
    })

    if (cancelled) {
      sock.disconnect()
      return
    }
    socketRef.current = sock
    setSocket(sock)
  }

  setupSocket()

  return () => {
    cancelled = true
    socketRef.current?.disconnect()
    socketRef.current = null
  }
}, [presentationId, role, code])
```

### Key changes:
1. `useRef` for socket — survives re-renders, accessible in cleanup
2. `cancelled` flag — prevents setting state on unmounted component
3. `presenterTokenRef` — always reads current prop value in closures
4. `connect_error` handler — user sees error on network failure
5. `reconnection: true` — socket.io-client auto-reconnects
6. Removed `presenterSecret` from dependency array (use ref instead)
7. Removed `setPresenterSecret` internal state (not needed — use prop directly via ref)

### Additional Cleanup
Remove these dead exports from the hook's return since they're redundant:
- `setPresenterSecret` — internal state not needed
- `setCode` — computed from prop, not needed

Return becomes:
```js
return { code, navigate, socket, isConnected, viewersCount, syncCursor, joinError }
```

## Live Pages Audit
Check these files for the same Socket.IO pattern issues:
- `client/src/pages/LiveViewPage.jsx` — missing cleanup? missing connect_error?
- `client/src/pages/SpeakerViewPage.jsx` — missing connect_error?
- `client/src/pages/RemoteControlPage.jsx` — missing connect_error?

## Related Code Files
- Modify: `client/src/hooks/use-live-presentation.js`
- Read: `client/src/pages/LiveViewPage.jsx`
- Read: `client/src/pages/SpeakerViewPage.jsx`
- Read: `client/src/pages/RemoteControlPage.jsx`

## Implementation Steps

### Step 1: Fix use-live-presentation.js
1. Read the file
2. Add `useRef` import
3. Create `socketRef = useRef(null)`
4. Create `presenterTokenRef = useRef(presenterToken)`, update with `presenterTokenRef.current = presenterToken` at start of effect
5. Add `cancelled` flag at top of effect
6. Restructure `setupSocket`: assign to `socketRef.current`, add `connect_error` handler, use `presenterTokenRef.current` in emit
7. Add cancellation guard: `if (cancelled) { sock.disconnect(); return }` before `setSocket`
8. Update cleanup: `socketRef.current?.disconnect(); socketRef.current = null`
9. Remove `setPresenterSecret` and `setCode` from return (dead internal state)
10. Remove `presenterSecret` from dependency array
11. Verify all existing tests still pass

### Step 2: Audit other live pages
1. Read LiveViewPage.jsx — check Socket.IO cleanup and error handling
2. Read SpeakerViewPage.jsx — check Socket.IO cleanup and error handling
3. Read RemoteControlPage.jsx — check Socket.IO cleanup and error handling
4. Fix any same-pattern issues found (connect_error, cleanup)

## Success Criteria
- [ ] Rapid presenter role toggle: no orphan sockets
- [ ] Server down: user sees error message via `joinError` state
- [ ] `presenterToken` prop change: socket re-emits with correct token
- [ ] Component unmount: socket disconnected cleanly
- [ ] LiveViewPage/SpeakerViewPage/RemoteControlPage have `connect_error` handlers
- [ ] No `connect_error` listener missing in any live page
