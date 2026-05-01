---
phase: 4
title: "Fix C6: Remove recursive handleSave"
status: "completed"
priority: P1
effort: "15m"
dependencies: []
---

# Phase 4: Fix C6 — Remove Recursive handleSave

## Overview
Remove the unnecessary `await handleSave()` call from `handleTestConnection` in SettingsPage. `testAIConnection` sends a test payload directly — it does NOT read server-side settings.

## Requirements
- Remove `await handleSave()` from `handleTestConnection`
- Keep `await testAIConnection()`
- Update comment explaining why save is not needed

## Architecture

### Before:
```js
const handleTestConnection = async () => {
  setTestStatus('testing')
  setTestError('')
  try {
    await handleSave()  // ← UNNECESSARY
    await testAIConnection()
    setTestStatus('ok')
  } catch (err) {
    setTestStatus('fail')
    setTestError(err.message)
  }
}
```

### After:
```js
const handleTestConnection = async () => {
  setTestStatus('testing')
  setTestError('')
  try {
    await testAIConnection()
    setTestStatus('ok')
  } catch (err) {
    setTestStatus('fail')
    setTestError(err.message)
  }
}
```

### Evidence
`testAIConnection()` in `client/src/utils/ai.js:60` sends `POST /rewrite` with a hardcoded test payload:
```js
body: JSON.stringify({ text: 'Hello', action: 'improve' })
```
It does NOT read from `/api/settings`. The server handles AI via its own config. No save needed.

## Related Code Files
- Modify: `client/src/pages/SettingsPage.jsx`
- Read: `client/src/utils/ai.js` (to confirm testAIConnection behavior)

## Implementation Steps
1. Read `SettingsPage.jsx` lines 200-220
2. Remove `await handleSave()` line
3. Update comment to explain: "testAIConnection sends test payload directly — no server-side settings read needed"
4. Verify SettingsPage still imports `handleSave` (used elsewhere, don't remove the function)

## Success Criteria
- [ ] "Test Connection" button no longer fires a PUT request
- [ ] Test still works (connects to AI and validates response)
- [ ] No regression in save functionality
