# Live Poll Game Subtype Completion

**Date**: 2026-06-18 12:00
**Severity**: Medium
**Component**: `game` element, live Socket.IO game flow, static export
**Status**: Resolved

## What Happened

Phase 04 shipped `poll` as a subtype of the existing `game` element instead of adding a twentieth canonical element. The canonical element count stays 19, which matters because `client/src/data/element-defaults.js` is the source of truth and README/count drift has bitten this repo before. Authoring now exposes poll prompt editing plus 2-6 options, and the runtime supports host-created rooms with start/reveal controls.

## The Brutal Truth

This was the right design, but it was not painless. The exhausting part is that a "simple poll" is never just a poll once it enters live presentation state: identity, reconnects, room boundaries, vote mutation, reveal timing, and export privacy all become ways to embarrass ourselves. The relief is that we did not fake it as another element type and inflate the system taxonomy just to make the UI easier.

## Technical Details

The Socket.IO flow now rejects votes before start, rejects host-only and cross-room actions, treats repeat votes as last-write-wins updates, preserves reconnect identity, and updates aggregates on explicit leave. Static export includes only the public prompt/options/placeholder and deliberately excludes raw participant data and vote records.

Validators ended in a practical green state: focused poll/frontend/export/socket tests pass; ESLint reports 0 errors with existing warnings; matrix gate passes with a stale evidence warning; client build passes. Full Vitest timed out, but the scoped failures uncovered during the work were fixed rather than waved away.

## What We Tried

The key decision was to model `poll` as `game` subtype, not a new element type. The rejected alternative was adding a standalone poll element, which would have made authoring/rendering look superficially cleaner while corrupting the canonical count and creating another export/live special case.

Code-reviewer and tester subagents both passed after fixes, which is the part that matters: the implementation survived adversarial review instead of only passing the happy path.

## Root Cause Analysis

The complexity came from treating polls as live multiplayer state, not static slide content. The fundamental risk was privacy and authority leakage: accepting pre-start votes, cross-room messages, or exporting participant data would have made the feature technically functional but operationally unsafe.

## Lessons Learned

- Keep taxonomy stable when a subtype fits. The 19-element contract is a governance boundary, not trivia.
- Live features need hostile-path tests from the start: pre-start, wrong host, wrong room, reconnect, duplicate vote, and leave.
- Export must be public-by-construction. If raw votes are never serialized into static HTML, they cannot leak there.

## Next Steps

No immediate blocker. Owner: next developer touching game sockets should rerun the focused poll socket/export/frontend tests plus the matrix gate before changing poll semantics.
