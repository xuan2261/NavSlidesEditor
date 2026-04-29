# Scope Analysis

## Summary
- Mode: `--hard`, user requested detailed plan.
- Selected scope: hold scope, not expansion.
- Key constraint: preserve HTML embed as trusted programmable content.

## What Already Exists
- File locks exist in `server/services/storage.js`; extend/reuse.
- Zod validation exists in server middleware; reuse for AI output validation.
- Live room abstraction exists in `server/services/live-rooms.js`; extend with presenter token.
- Playwright/Vitest/k6 infrastructure exists; repair tests rather than add new stack.
- DOMPurify exists server-side, but not used as blanket solution because project policy rejects generic sanitization for HTML embed.

## Minimum Change Set
- Must fix: share token cascade, analytics/media locks, analytics access, Explore trash, live hijack, AI SSRF/schema/errors, client null/API/NaN guardrails, import/export reliability, test harness.
- Defer: auth system, DB, full sanitizer rewrite, Electron sandbox if packaging not verified, broad UI refactor.

## Complexity Check
- Touches >8 files because issues span server/client/tests.
- New services justified:
  - AI endpoint guard.
  - number/url/content safety helpers.
- 9 phases because each has different risk/test gates.

## Unresolved Questions
- Analytics access rule: share-token gate now vs future owner/auth model?
- Local LLM custom endpoint: should localhost be blocked always or allowlisted by env?
