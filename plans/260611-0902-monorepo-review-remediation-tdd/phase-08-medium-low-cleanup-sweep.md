---
phase: 8
title: "Medium and Low Cleanup Sweep"
status: complete
priority: P3
effort: "1d"
dependencies: [1, 2, 3, 4, 5, 6, 7]
---

# Phase 8: Medium & Low Cleanup Sweep

## Overview
Final sweep for the 25 Low findings plus any Medium deferred from earlier phases.
Runs last so Lows touching files already changed are batched, and to verify zero
residual after the P0/P1 work. Triage: fix cheap ones, log won't-fix with reason.

## Findings Covered (Low, by domain)
- **R1 Low:** `renderSvg` over-broad fill replace (if not done in P4); gradient
  `stop.offset` mismatch; dead `color:white`; line marker id collision. *(Most
  folded into Phase 4 — verify here, don't double-fix.)*
- **R2 Low (M1–M8):** any not closed in Phase 7.
- **R3 Low:** line up/left negative w/h (both paths); offline inline CSS replaces
  only first occurrence (`offlineExport.js:222,233`); cache key SHA1 whole-slide each call.
- **R4 Low:** (residual after Phase 1/6) — confirm no leftover.
- **R5 Low:** `POST /share/:token` 500 when token has no password but `pwd` posted
  (bcrypt throws on undefined hash); SVG uploads skip magic-byte; upload-hashes.json
  not atomic-written; duplicate hash-index writers for same file.
- **R6 Low:** base64 inline decode not capped before sniff; Electron
  `setWindowOpenHandler` default-allows odd schemes (`file:`/`data:`) + missing
  `will-navigate` guard.

## Requirements
- Functional: no Low becomes a real defect under normal use; security-adjacent
  Lows (bcrypt 500, SVG magic-byte, Electron navigation) fixed.
- Non-functional: each Low either fixed-with-test or logged won't-fix + reason.

## Architecture
Group by file already touched in P1–P7 to minimize churn. Security-adjacent Lows
get tests; cosmetic Lows (dead code, cache key) get a fix + lint pass, no test.

Priority within sweep:
1. Security-adjacent: bcrypt undefined-hash guard (`share.js`), SVG magic-byte,
   Electron `will-navigate` + scheme allowlist, base64 cap.
2. Correctness: line negative w/h, offline CSS replace-all, upload-hash atomic write + dedupe writers.
3. Cosmetic: cache key, residual dead code.

## Related Code Files
- Modify (security): `server/routes/share.js`, `server/routes/upload.js`, `electron/main.js`, `server/services/pptx-import/media.js`
- Modify (correctness): `shared/src/element-renderers.js` (line), client `offlineExport.js`, `server/routes/upload.js` (hash atomic)
- Modify (cosmetic): raster cache key site, residual dead code
- Create: `server/routes/share-no-password-bcrypt.test.js`, `electron/window-navigation-guard.test.js` (if testable headless)

## TDD — Tests First (security-adjacent only)
1. **bcrypt 500**: POST `/share/:token` with `pwd` to a no-password token → 200/401,
   not 500 (red today).
2. **SVG magic-byte**: upload a non-SVG renamed `.svg` → rejected.
3. **Electron navigation**: `will-navigate` to external/file scheme → blocked.

## Implementation Steps
1. Re-read all 6 stream reports; list every Low not already fixed in P1–P7.
2. Write tests 1–3 (security-adjacent).
3. Fix security-adjacent → tests green.
4. Fix correctness Lows.
5. Fix/triage cosmetic Lows; log any won't-fix in this file with reason.
6. **Whole-plan consistency sweep**: confirm no finding double-fixed, none missed.

## Success Criteria
- [x] Security-adjacent tests green.
- [x] Every Low fixed or logged won't-fix with reason.
- [x] Full `npm run lint && npm run build && npm run test` green.
- [x] No file exceeds 200 LOC without justification.

## Red-Team Amendments (2026-06-11)

- **bcrypt-500 cite is WRONG (Medium).** The defect is NOT in `share.js` (which
  only HASHES, never compares). The undefined-hash compare is at `index.js:275`
  and `explore.js:59`. Fixing `share.js` per the literal plan leaves the defect
  live. Retarget test 1 + fix to `index.js:275` and `explore.js:59`.
- **Security Lows should move to their domain phases, not sit in P3.** bcrypt-500,
  SVG magic-byte, Electron nav-guard are security-adjacent but buried behind all
  fidelity work here. If schedule allows, fold them into Phase 2/3 respectively;
  otherwise this sweep MUST run them first (already ordered). Avoid double-claiming
  R1 Lows already fixed in Phase 4 — verify-don't-refix.



## Risk Assessment
- **Risk:** "cleanup" scope-creeps into refactors. *Mitigation:* fix only the
  cited line/behavior; no opportunistic rewrites (YAGNI).
- **Risk:** a Low interacts with a P1–P7 fix already shipped. *Mitigation:* sweep
  runs last (dependency on all phases); re-run full suite.
