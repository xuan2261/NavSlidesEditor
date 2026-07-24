---
phase: 2
title: "Server Trust-Boundary and Data Integrity"
status: complete
priority: P1
effort: "2d"
dependencies: []
---

# Phase 2: Server Trust-Boundary and Data Integrity

## Overview
Storage primitive is solid; the defects are routes **bypassing** its atomic
helpers, plus the soft-delete path leaving trashed decks publicly readable. Under
the locked multi-user/behind-proxy model these are real cross-user exposures (P0).

## Findings Covered
- **C2** (Critical, P0) — soft-deleted decks served via share link / readable / forkable. *Lead-verified.*
- **I-R5.1** — non-atomic read+write on share tokens (+ templates, save-as-template, fork, history restore).
- **I-R5.2** — settings PUT shallow-merge wipes AI apiKey.
- **I-R5.3** — history restore overwrites current deck with no pre-restore snapshot.
- **I-R5.4** (escalated P0) — unauth explore fork, no size cap, forks trashed decks.
- **I-R5.5** — SSRF guard TOCTOU / DNS rebinding; allowlist bypasses IP checks.
- **M-R5×6** — unbounded history growth; rclone stderr leak; `raster-elements` DoS; github path interpolation; media.js sync-fs + DELETE key mismatch (orphans); routes echoing raw `err.message`.

## Requirements
- Functional: deleting a deck immediately stops all public serving/forking; share
  revoke is durable under concurrency; settings preserve secrets; restore is recoverable.
- Non-functional: no lost updates under concurrent writes; no secret/stack leak in responses.

## Architecture

### C2 — soft-delete guard (verified)
`DELETE /:id` only sets `deletedAt`; revoke runs only on permanent delete. Add a
`deletedAt` guard at every read/serve/fork path:
- `server/index.js:153-173` `renderShareView` — 404 if `presentation.deletedAt`.
- `server/routes/presentations.js:249-258` `GET /:id` — exclude deleted.
- `server/routes/explore.js:63-66` fork — refuse deleted source.
- **Plus**: on soft-delete, suspend (not just on hard-delete) associated share
  tokens — decision locked: suspend on soft-delete.

### I-R5.1 — atomic mutations
Replace `read`+`write` pairs with the existing `withShareTokens` /
equivalent locked read-modify-write helper at: `share.js:50-92,103-119`,
`templates.js`, `presentations.js:435-453` (save-as-template),
`explore.js` fork, `history.js` restore.

### I-R5.2 — settings deep-merge with secret preservation
`settings.js:24-46`: deep-merge incoming over stored; if `ai.apiKey` omitted,
preserve stored; only overwrite on explicit non-sentinel value. Add Zod schema.
(Decision: deep-merge, not full-replace.)

### I-R5.3 — pre-restore snapshot
`history.js:58-77`: before overwriting current deck, auto-create a snapshot
("before restore") so restore is reversible.

### I-R5.4 — fork hardening
`explore.js:45-82`: require auth (under multi-user model), enforce size cap,
per-token rate limit, refuse trashed source.

### I-R5.5 — SSRF
`ai-endpoint-guard.js:47-84`: resolve-then-pin (connect to the resolved IP, or
re-validate after resolution); do NOT let allowlist skip IP checks; keep
`redirect:'manual'`.

### Mediums
- History cap / prune (M1). Strip rclone stderr before client (M2). Validate +
  cap `raster-elements` payload (M3). Sanitize github path interpolation (M4).
- media.js: async fs + reconcile DELETE key (DB-key vs basename) to kill orphans (M5).
- Route raw `err.message` echo → route through central error-handler (M6).

## Related Code Files
- Modify: `server/index.js`, `server/routes/presentations.js`, `server/routes/explore.js`, `server/routes/share.js`, `server/routes/templates.js`, `server/routes/settings.js`, `server/routes/history.js`, `server/routes/sync.js`, `server/routes/media.js`, `server/routes/github.js`
- Modify: `server/services/ai-endpoint-guard.js`, `server/services/storage.js` (only if helper missing)
- Modify: `server/middleware/error-handler.js` / `validate.js` (Zod)
- Create: `server/routes/soft-delete-share-guard.test.js`, `server/routes/atomic-mutations-concurrency.test.js`, `server/services/ssrf-guard.test.js`
- Reference (read): `server/routes/share.test.js`, `upload-dedup.test.js`

## TDD — Tests First
1. **C2**: soft-delete a deck → GET `/share/:token`, GET `/:id`, POST fork all
   return 404/refuse (red today).
2. **I-R5.1**: fire N concurrent revoke+create on share tokens → final state
   consistent, no lost revoke (red today — race).
3. **I-R5.2**: PUT settings `{ai:{model:'x'}}` without apiKey → stored apiKey intact.
4. **I-R5.3**: restore → a "before restore" snapshot exists.
5. **I-R5.4**: unauth fork rejected; oversized fork rejected.
6. **I-R5.5**: request to internal IP via custom provider blocked; allowlist host
   still IP-checked; rebinding (resolve A then B) blocked.

## Implementation Steps
1. Write failing tests 1–6.
2. C2 guards + share suspend on soft-delete → test 1 green.
3. Swap atomic helpers → test 2 green.
4. Settings deep-merge + Zod → test 3; pre-restore snapshot → test 4.
5. Fork auth/cap → test 5; SSRF pin → test 6.
6. Sweep Mediums (history cap, stderr strip, raster cap, github sanitize, media reconcile, error-handler routing).

## Success Criteria
- [x] Tests 1–6 green.
- [x] No route does raw `read`+`write` on shared JSON (grep clean).
- [x] No response body contains raw `err.message`/stack outside central handler.
- [x] `npm run test` server suite green.

## Red-Team Amendments (2026-06-11)

Several fixes below are incomplete or infeasible as written. Apply these overrides:

- **AUTH DOES NOT EXIST IN-APP (Critical).** Grep `req.session|req.user|passport|
  express-session|authenticate|jwt` across `server/**` = 0 matches. I-R5.4's
  "require auth/session on fork" and test #5 "unauth fork rejected" are
  infeasible — there is no identity layer. **Locked decision #1 "multi-user"
  means auth is enforced AT THE PROXY, not in-app.** Descope I-R5.4 to:
  (a) refuse forking a trashed deck, (b) enforce size cap + per-token rate limit,
  (c) DOCUMENT that write-exposing endpoints assume proxy-level auth for
  multi-user. Drop the in-app "unauth rejected" test; replace with size-cap +
  trashed-source-refused tests. Do NOT build a phantom auth gate.

- **C2 guard list misses 6+ serve paths (Critical).** The 3 paths listed
  (`renderShareView`, `GET /:id`, fork) are incomplete. Trashed deck still serves via:
  `presentations.js:393` `/:id/present`, `:376` `/:id/export`, `:353` `/:id/duplicate`,
  `:434` `save-as-template`, `:459` `/:id/uploads`; `github.js:60` push;
  `share.js:50` mint-new-token-for-trashed-deck. **Required:** centralize a
  `findServeablePresentation(id)` helper that excludes `deletedAt`, and route ALL
  9 sinks through it. Test must assert every sink 404s/refuses for a trashed deck.

- **Soft-delete token suspend → data loss on restore (Critical).** Suspending
  share tokens on soft-delete is fine ONLY if restore reactivates them. I-R5.3
  snapshots the DECK, not the tokens → after restore, share links 404 forever.
  **Required:** restore must reactivate previously-suspended tokens (store a
  `suspendedAt` marker, clear it on restore), OR keep tokens live but have the
  serve-guard check the deck's `deletedAt` (preferred — no token mutation, no
  loss). Prefer the serve-guard approach: do NOT mutate tokens on soft-delete;
  the `findServeablePresentation` guard already blocks serving.

- **Lock helpers for templates/history DON'T EXIST (High).** `storage.js:225-264`
  exports only `withPresentations/withShareTokens/withAnalytics/withMediaDb`.
  I-R5.1 "swap to the locked helper" must instead CREATE `withTemplates` and a
  history-locked helper. Explore fork is a whole-array presentation
  read-modify-write → use `withPresentations` (NOT `withShareTokens`), else it
  clobbers concurrent deck edits. Re-estimate effort upward (net-new helpers).

- **I-R5.1 atomic-swap misses two sinks (High).** Also covers `POST /:id/share`
  (`share.js:56-82`) and top-level `DELETE /api/shares/:token` (`index.js:131-141`).

- **SSRF self-contradiction (High).** "resolve-then-pin OR re-validate after
  resolution" — the "re-validate" alternative IS the current TOCTOU
  (`ai-endpoint-guard.js:47-50,83` returns a URL string; `ai-provider.js:70-77`
  does `fetch(url)` which re-resolves DNS at connect). **Required:** pin the
  connection to the resolved IP via an undici Agent / custom `lookup`; REMOVE the
  "re-validate" option; and IP-check allowlisted hosts too (allowlist currently
  early-returns before IP check at `:66` — that early-return is the bypass).

- **I-R5.2 settings rescope (Medium).** Sentinel-preserve already exists
  (`settings.js:30-32`); GET masks to it (`:12`). The real bug is replacing the
  whole `ai` object. Scope the deep-merge to the `ai` object only; do NOT
  globally deep-merge (changes PUT contract for other nested keys).

- **Phase split (Medium).** This phase is overloaded (C2 P0 + 6 cross-domain
  Mediums, 13 modify targets). Sequence as **2a** (C2 serve-guard +
  share-atomicity + soft-delete handling) shipped FIRST, **2b** (settings,
  history snapshot, SSRF, media, github, error-handler) as fast-follow. Both
  stay in this file; 2a's tests must be green before 2b starts.


  with user — under multi-user, fork-write should require a session; read/preview stays public.
- **Risk:** deep-merge settings mishandles arrays (replace vs merge). *Mitigation:*
  define per-key merge policy in Zod transform; test arrays explicitly.
- **Risk:** SSRF pinning breaks legit custom endpoints behind CDNs. *Mitigation:*
  pin per-connection IP but keep host allowlist for known-good; document.
