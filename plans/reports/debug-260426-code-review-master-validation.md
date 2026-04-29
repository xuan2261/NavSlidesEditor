# Code Review Master Validation - Debug Report

## Executive Summary
- **Issue:** Validate `plans/reports/code-review-master-260426-full-codebase.md`.
- **Impact:** Report useful for security triage, but not safe to execute verbatim.
- **Root cause:** Parallel review aggregation without dedupe/current-code verification. Several paths stale, severity inflated, false positives mixed with real P0s.
- **Status:** Reviewed statically against current worktree on 2026-04-26.
- **Fix:** Use corrected priority list below before planning implementation.

## Evidence Base
- Read project `README.md`.
- Read `ck:debug` systematic debugging/reporting guidance.
- Checked current code in `client/`, `server/`, `shared/`, `electron/`, `tests/`.
- No code changes. No tests run; static validation only.

## Confirmed Critical / P0

| Finding | Status | Evidence |
|---|---:|---|
| SVG XSS in editor canvas | Confirmed | `client/src/components/SlideCanvas.jsx:2653-2673` renders `modifiedContent` via `dangerouslySetInnerHTML`. |
| Markdown XSS in editor canvas | Confirmed | `SlideCanvas.jsx:2007-2071` custom parser injects raw output. Link href also unvalidated. |
| Text preview XSS in slide panel | Confirmed | `client/src/components/SlidePanel.jsx:244-248` renders text HTML directly. |
| HTML preview iframe with scripts | Confirmed, wrong location in master | Actual risky code is `SlidePanel.jsx:259-266`, not `SlideSorterView.jsx:263`. |
| Transition preview XSS | Confirmed | `TransitionPreview.jsx:25-30` interpolates `el.content`; iframe at `:110-113` lacks sandbox. |
| Shared export iframes lack sandbox | Confirmed | `shared/src/element-renderers.js:124,133,183,229,354`. |
| LaTeX/TikZ `</script>` break-out | Confirmed | `element-renderers.js:212,224,226-229`; `escapeSrcdoc` does not prevent script-token parsing after srcdoc decode. |
| Share token cascade broken | Confirmed | `server/routes/presentations.js:276-277` compares token data object to `presId`; new object tokens survive permanent delete. |
| Share view counter lost updates | Confirmed | `server/index.js:211-241` reads before locked write; concurrent increments can overwrite. |
| Analytics public | Confirmed | `server/routes/analytics.js:45-71` returns stats without ownership/auth/token check. |
| Live presenter hijack | Confirmed | `server/services/live-rooms.js:33-42`; any presenter role can replace existing presenter for known room. |
| AI custom endpoint SSRF | Confirmed | `server/services/ai-provider.js:65-74`; custom URL not restricted before server-side fetch. |
| CSS sanitizer bypassable | Confirmed | `server/index.js:163-168`; regex denylist is incomplete. |
| Electron sandbox disabled | Confirmed | `electron/main.js:2,8`. |
| Load tests wrong endpoint | Confirmed | `tests/load/api-load.js:13`, `tests/load/websocket-load.js:11`; websocket also uses wrong path/event protocol for current server. |
| Explore tautological assertion | Confirmed | `tests/e2e/explore.spec.js:21-25`. |

## Confirmed High / P1

| Finding | Status | Evidence |
|---|---:|---|
| Missing `res.ok` on live room creation/check | Confirmed | `EditorPage.jsx:1033-1035`, `LiveViewPage.jsx:69-71`. |
| Settings can render with `settings === null` after load failure | Confirmed | `SettingsPage.jsx:52-59`, `:97-98`. |
| Numeric inputs can persist `NaN` | Confirmed | `common-element-controls.jsx:25,34,44,54,63` and more property files. |
| Custom CSS raw injection in exports | Confirmed | `shared/src/htmlGenerator.js:170,464`. |
| Client-side HTML export/render lacks sanitizer | Confirmed | `shared/src/element-renderers.js:109-124`. |
| AI JSON lacks output schema validation | Confirmed | `server/routes/ai.js:94-95`; error handled as 500, but malformed shape can leak downstream. |
| AI internal error messages exposed | Confirmed | `server/routes/ai.js:56,97`. |
| Analytics/media JSON writes lack shared file lock | Confirmed | `server/routes/analytics.js:20-41`, `server/routes/media.js:21-22`. |
| Explore returns trashed decks | Confirmed | `server/routes/explore.js:29-31`; no `!deletedAt` filter. |
| Export raster caches unbounded | Confirmed | `client/src/utils/export-pptx-raster.js:13-14,76-102`. |
| PDF/import media failures swallowed | Confirmed | `pdf-import.js:44-67`, `import-project.js:88-95`. |
| Markdown import link href injection | Confirmed | `markdown-import.js:100-104`. |

## False / Stale / Severity Corrections

| Report claim | Verdict | Correction |
|---|---:|---|
| `SlideSorterView.jsx:263` has `srcDoc` with `allow-scripts` | False path | `SlideSorterView` only tag-strips mini text at `:49-50`. Risky iframe is in `SlidePanel`. |
| `export-pptx-renderers.js` fallback calls are not awaited | False | Current file awaits both calls at `:60` and `:65`. |
| `offlineExport` cache never clears | Mostly false | It clears on success at `offlineExport.js:458-459`; leak risk only on thrown error before clear. |
| `SlideThumbnail` ResizeObserver leak | False | Observer has cleanup at `SlideThumbnail.jsx:17`; no re-init deps. |
| `Socket.IO CORS allows any origin in production` | False | `server/index.js:308` uses `{ origin: false }` in production, `'*'` only outside production. |
| Share E2E uses wrong origin `4173 -> 3002` | False for current config | Vite proxies `/share` to server in `client/vite.config.js`; test URL via `4173` should work. |
| `openPresenter` page.goto not awaited | False | `tests/e2e/live.spec.js:38` awaits `page.goto`. |
| Live modal input checked against URL regex but input is code | False | Modal values are full URLs in `LivePresentationModal.jsx:43,57,71`; tests expect `/live/`, `/remote/`, `/speaker/`. |
| `use-history.js` is P0 app risk | Overstated | Hook is unused in current code. Main editor uses its own history in `client/src/pages/EditorPage.jsx`. Keep as cleanup/test debt, not week-1 P0. |
| `use-reveal-preview-frame` interval leak is critical | Overstated | Cleanup clears interval at `:64-69`; untracked timeout remains polish/robustness issue. |
| `use-clipboard` 50 ms timeout is critical | Overstated | Real ordering fragility at `use-clipboard.js:60-70`, but not security/P0. |
| `DropdownMenu items.map` is high | Overstated | Crash only if caller passes invalid `items`; add guard, but not urgent. |
| `DOMParser per render` is high | Overstated | Performance polish unless proven with profiling. |
| `SlideThumbnail id undefined` is high | Overstated | Bad URL/fallback issue, not high severity unless user-visible broken state proven. |

## Corrected Priority Order

### P0 - Fix First
1. Add shared sanitization strategy for presentation content:
   - Client editor previews: text, markdown, svg.
   - Slide thumbnails/panels/transition preview.
   - Shared export/render paths.
2. Sandbox generated iframes and decide explicit allowlist:
   - Avoid `allow-scripts` for previews unless required.
   - For interactive HTML embeds, require isolated sandbox policy.
3. Fix share/live security:
   - Cascade delete object share tokens.
   - Lock share-token view increments.
   - Protect analytics or require signed token/owner check.
   - Add live room presenter token; prevent role takeover.
4. Harden server-side outbound/request input:
   - Restrict AI custom endpoint host/IP/scheme.
   - Replace CSS regex denylist with allowlist or remove custom CSS from shared/public exports by default.
5. Remove Electron global `no-sandbox` or gate it behind explicit dev/CI flag.

### P1 - Fix After Security
1. Live room fetch `res.ok` handling and response validation.
2. Settings null guard after failed settings load.
3. Numeric input parser utility to reject empty/NaN/Infinity.
4. AI output Zod schema validation and generic client errors.
5. File-lock analytics/media writes.
6. Filter trashed decks in Explore.
7. Fix load tests: port, Socket.IO path `/ws`, current event names.
8. Replace tautological/weak E2E assertions.

### P2 - Cleanup / Tech Debt
1. Dead/unused hooks (`use-history`, `use-keyboard`) or add tests before using.
2. Export cache lifecycle and cleanup on thrown errors.
3. PDF/import partial failure reporting.
4. Dropdown null guards, memoization/perf cleanup.
5. Dedupe constants and stale UI classes.

## Root Cause of Report Noise
- Master report mixes current findings with stale file paths.
- It duplicates issues across groups and consolidated list.
- It treats test-quality and micro-performance issues as critical.
- It does not distinguish exposed/public surfaces from author-only local editor surfaces.

## Recommended Next Step
- Do not create a 164-issue mega-plan.
- Create a focused security remediation plan with 5 phases:
  1. sanitization/sandbox abstraction,
  2. client preview surfaces,
  3. shared export surfaces,
  4. share/live/server security,
  5. tests/regression harness.

## Unresolved Questions
- Should user-auth/ownership exist, or is this app intentionally unauthenticated self-hosted?
- Should custom HTML embeds remain script-capable in editor/export?
- Should custom CSS be supported for public share/export, or editor-only?
- Is Electron `no-sandbox` required for a known packaging/runtime issue?
