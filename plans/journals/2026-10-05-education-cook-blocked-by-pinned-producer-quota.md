---
title: Education cook blocked by pinned producer quota
date: 2026-10-05
summary: Producer429 terminals preserved; ordered acceptance and qualification remain open
---

# Education cook blocked by pinned producer quota

## What happened

Pinned pending/puzzle producers bg_62 and bg_63 ended with HTTP429 quota exhaustion and stopReason:error. Both preserved source pairs exactly match their prior rejected snapshots; neither new result report exists. Complete original scoring and simulation review payloads were recovered from attempted-write arguments because reviewer filesystem writes were unavailable.

## Decision

Keep local8045/gemini-3.8-flash-high; no fallback, timeout/retry increase, unverified archive deletion, incomplete-source admission, merge/push/deploy or qualification claim. Record the native automatic-retry/prompt inconsistency as unresolved. Production startup and configuration-load evidence are preparation only; the newly owned idle runtime was stopped.

## Next steps

Apply counsel-backed corrections to coordinator-only harness constraints, reconcile effective retry policy read-only, resume Gap4 when the pinned provider is available, and close every ordered native acceptance before fresh complete-input build and qualification.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
