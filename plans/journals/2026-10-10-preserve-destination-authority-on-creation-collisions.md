---
title: Preserve destination authority on creation collisions
date: 2026-10-10
summary: Finding 6 repaired and verified
---

# Preserve destination authority on creation collisions

## Cause
Unfenced compensation removed colliding authority; duplicate mutation lacked destination admission.

## Decision
Reject destination collisions; compensate only the exact head created by the attempt, including errors after root commit. Preserve successors and return explicit rollback failure.

## Verification
Behavioral RED before repair; final 139 tests passed across 12 suites. Isolated HTTP confirms 409 with unchanged winner and successful create/open with immutable Original bytes.

## Limits
No commit, push or release qualification. Full reliability gates remain open.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
