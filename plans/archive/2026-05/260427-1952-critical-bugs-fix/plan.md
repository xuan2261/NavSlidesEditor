---
title: "Critical Bugs Fix — Phase 1"
description: "Fix 7 critical bugs: dead store state (C1), addSlide/duplicateSlide (C2/C3), Socket.IO race (C4/C5), recursive save (C6), media upload (C9)"
status: "completed"
priority: P0
effort: "4-6h"
branch: master
tags: [fix, client, state-management, socket, react]
blockedBy: []
blocks: []
created: "2026-04-27"
---

# Critical Bugs Fix Plan — Phase 1

## Overview

Fix 7 critical bugs found during full codebase review. Bugs span state management, Socket.IO lifecycle, and error handling. All fixes are isolated to specific files — no cross-cutting architectural changes.

## Bugs Fixed

| ID | Bug | File | Severity | Type |
|----|-----|------|----------|------|
| C1 | Dead `currentSlideIndex` in store | `presentation-store.js` | Critical | State corruption |
| C2 | `addSlide` ignores insertion point | `use-slide-operations.js` | Critical | UX bug |
| C3 | `duplicateSlide` missing ref in deps | `use-slide-operations.js` | High | React pattern |
| C4 | Socket.IO race + memory leak | `use-live-presentation.js` | Critical | Memory leak |
| C5 | Missing `connect_error` handler | `use-live-presentation.js` | High | Silent failure |
| C6 | Recursive `handleSave` in test | `SettingsPage.jsx` | High | Unnecessary API call |
| C9 | Media upload no error handling | `InsertMenu.jsx` | High | Silent failure |

## Root Cause Summary

- **C1**: Store's `currentSlideIndex` never updated (production code calls `setCurrentSlide` zero times). All 8 CRUD actions target slide 0 unconditionally.
- **C2**: `addSlide` signature has no `afterIndex` param. Always appends. Also reads `presentation.slides.length` from stale closure.
- **C3**: `duplicateSlide` doesn't pass `currentSlideIndexRef` to helper. Not in dependency array.
- **C4**: `setupSocket()` is async but cleanup runs synchronously. `activeSocket` is `null` at cleanup time → socket never disconnected.
- **C5**: `io()` has no `connect_error` listener. Network failures silently fail.
- **C6**: `testAIConnection()` calls `POST /rewrite` directly (doesn't read server settings). `handleSave()` call is unnecessary.
- **C9**: No try-catch on fetch. Modal closes even on failure.

## Key Decisions

1. **C1 Fix (Option B)**: Remove dead store CRUD entirely. Store becomes dumb data holder (`presentation` + `loading` + `setPresentation`). The command layer in `useSlideOperations` + EditorPage owns all mutations.
2. **C6 Fix**: Remove `await handleSave()` from `handleTestConnection`. `testAIConnection` sends test payload directly — no server-side settings read needed.
3. **Test rewrite**: `presentation-store.test.js` must be rewritten — it tests dead CRUD API that will be removed.

## Phases

| Phase | Name | Status | Priority |
|-------|------|--------|----------|
| 0 | [Pre-flight: Verify all affected files](./phase-00-preflight.md) | pending | P0 |
| 1 | [Fix C1: Clean dead presentation-store state](./phase-01-clean-store.md) | pending | P0 |
| 2 | [Fix C2+C3: addSlide/duplicateSlide bugs](./phase-02-slide-operations.md) | pending | P0 |
| 3 | [Fix C4+C5: Socket.IO lifecycle + error handling](./phase-03-socket-lifecycle.md) | pending | P0 |
| 4 | [Fix C6: Remove recursive handleSave](./phase-04-settings-fix.md) | pending | P1 |
| 5 | [Fix C9: Media upload error handling](./phase-05-media-upload-fix.md) | pending | P1 |
| 6 | [Rewrite tests for new store API](./phase-06-rewrite-tests.md) | pending | P0 |
| 7 | [Verify all fixes — lint + test + smoke](./phase-07-verify.md) | completed | P0 |

## Test Strategy

- Unit tests for store API (Phase 6) — rewritten after dead CRUD removal
- Integration: addSlide at specific index, duplicateSlide, Socket.IO reconnection
- Smoke: app loads, slides navigate, elements edit correctly
- No E2E needed — these are isolated unit/integration fixes
