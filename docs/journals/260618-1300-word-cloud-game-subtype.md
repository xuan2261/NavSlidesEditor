# Word Cloud Game Subtype Completion

**Date**: 2026-06-18 13:00
**Severity**: Medium
**Component**: `game` element, Socket.IO live game flow, static export
**Status**: Resolved

## What Happened

Phase 05 landed `word-cloud` as a subtype of the existing `game` element. The canonical element count stays 19, which is the right boundary because `client/src/data/element-defaults.js` remains the taxonomy source of truth. We added authoring prompt controls, Insert gallery/defaults/shortcuts, presenter rendering, and the player submission UI without inventing a twentieth element.

## The Brutal Truth

This feature looked small and then immediately turned into live-state plumbing. The maddening part is that a word cloud can leak garbage, identity mistakes, and private text faster than a chart or shape ever could. The relief is that review caught the ugly parts before they became user-visible behavior.

## Technical Details

The server reducer is aggregate-only: NFKC normalization, trim/space collapse, deterministic lowercase and sorting, a final 40-character bound, 5 submissions per player per prompt, top 50 aggregate entries, and an explicit clear action. Socket.IO now handles `game-word-cloud-submit`, `game-word-cloud-start`, `game-word-cloud-reveal`, and `game-word-cloud-clear`, rejecting pre-start, non-host, cross-room, stale, and rate-limit cases. Static export includes only title, prompt, and placeholder text by default, not raw submissions or aggregate output.

Verification finished green: focused word-cloud tests pass, full Vitest passes, lint passes with existing warnings, matrix gate passes with a stale evidence warning, and client build passes.

## What We Tried

We kept `word-cloud` inside the `game` subtype model and rejected the tempting standalone element path because it would have polluted the canonical 19-element contract. Code-reviewer initially found a leave/rejoin rate-limit bypass plus locale/determinism risks; those were fixed and passed final review.

## Root Cause Analysis

The core risk was assuming “anonymous text input” is harmless. It is not. Without stable per-player limits, deterministic normalization, room authority checks, and privacy-safe export defaults, this would have been an abuse and data-leak feature wearing a cute UI.

## Lessons Learned

- Treat every live game subtype as hostile input plus authority boundaries from day one.
- Use deterministic string normalization for aggregate displays; locale surprises are not acceptable in tests or production.
- Export public placeholders by default. If raw submissions are never serialized, they cannot leak.

## Next Steps

No blocker. Owner: next developer changing word-cloud sockets or export should rerun focused word-cloud tests, full Vitest, lint, matrix gate, and client build before merging.
