# Red-Team Plan Review — Assumption Destroyer / Scope Auditor

- Reviewer: code-reviewer (hostile)
- Date: 2026-06-11
- Plan: `plans/260611-0902-monorepo-review-remediation-tdd`
- Method: grep/glob every cited file:line; verify assumed prior-plan helpers exist and are reusable.

## Verification Verdict (cited symbols/paths)

VERIFIED present & accurate (no waste):
- `withShareTokens` — `storage.js:160`, exported `:253`, already used `presentations.js:330`, `index.js:184`. Reusable. ✅
- `resolveColorField` — `shared/src/design-tokens.js:82`, exported `:176`; already used by shape/table renderers + shared export. ✅
- `computeMixedValues` — `client/src/utils/selection-mixed-values.js:12`; ribbon geometry control at `ribbon-format-tab-element-position-size-rotation-controls.jsx:237` uses it for `['opacity']` ONLY. ✅ Plan's I-R2.4 premise exact.
- C1: `use-game-socket.js:27` `io({ path:'/ws' })`, `:33` `{roomId, playerName, role}`; `game-socket-handler.js:9` `io.of('/games')`, `:15` reads `{gameId,...}`. ✅
- C2: `server/index.js:153-173` `renderShareView` no `deletedAt` guard; `explore.js` fork no deleted guard. ✅
- C3: `markdown-import.js:110-116` interpolates href unescaped; `url-safety.js:3-7` returns `true` for `/ # ./ ..` prefixes blindly. ✅
- C4: `pptx-guards.js:19-21` `getUncompressedSize` trusts `_data.uncompressedSize`; `:67-70` budget from declared sizes. ✅
- I-R1.1: canvas `shape-element-renderer.jsx:90-165` handles rect/rounded-rect/circle/triangle/diamond/arrow-right/star (+default rect); `shapeUtils.js:126-187` adds hexagon/pentagon/cloud/cylinder/parallelogram/trapezoid/bracket. The 7-missing claim is exact. ✅
- I-R1.2 raw-color sites: `icon-element-renderer.jsx:5`, `line-element-renderer.jsx:69`, `timeline-element.jsx:15-17` all confirmed using raw `||` fallback, not `resolveColorField`. ✅
- I-R1.4: `RENDERERS` (`element-renderers.js:654-673`) has 18 entries; `game` is canonical 19th type (`element-defaults.js:224`) and is absent. Parity test coherent. ✅
- I-R2.2: `EditorPage.jsx:1450-1453` ribbon arrange wired to `bringElementForward(selectedElementId)` (single id). ✅
- I-R2.3: `EditorPage.jsx:935` `slice(-19)` for redo; `:632`/`:953` undo `slice(-49)`. ✅
- I-R5.1: `share.js:50-92` and `:103-119` do raw `readShareTokens()`+`writeShareTokens()`. ✅
- I-R3.4: `pptx-exporter.js` client engine confirmed worse — `canPassThroughRequest:34`, `installVendorRoute:61` `if(!baseUrl) return`, `startsWith` origin check `:38-40`; resilient `getServerRasters` at `server-raster.js:146`. ✅

---

## Finding 1: Phase 2 I-R5.4 assumes an auth/session system that DOES NOT EXIST

- Severity: **Critical**
- Location: `phase-02-...md:22,57-60,84,107` ("require auth (under multi-user model)", "unauth fork rejected", "fork-write should require a session")
- Flaw: The plan repeatedly prescribes "require auth"/"require a session"/"per-token rate limit" for the explore fork, and TDD test 5 asserts "unauth fork rejected". But the server has NO authentication infrastructure: grep for `req.session|req.user|passport|express-session|requireAuth|isAuthenticated` → **zero matches** across `server/**`. The only bearer-token mechanism is the live-presentation presenter token (`live.js:6-8`), scoped to live rooms, not a user session. There is no login, no cookie, no user identity.
- Failure scenario: Implementer writes test 5 ("unauth fork rejected") and then discovers there is no concept of "authed" vs "unauth" to gate on. They must either (a) invent a whole auth system (massive scope creep, not in any finding), or (b) silently redefine the fix to something else (size cap + rate limit only), leaving the locked user decision #1 ("escalate I-R5.4 to P0 real cross-user exposure") unaddressed. Either way the phase stalls or the acceptance criterion is quietly dropped.
- Evidence: `grep req.session|req.user|passport... server/**` = no matches; `grep cookie|jwt|login server/**` returns only AI/github API keys and live presenter token (`live.js:6-8`). `explore.js:45-82` fork takes only `:token` + optional password; no identity.
- Suggested fix: Either (a) add a Phase-0 / Unresolved-Question explicitly resolving "what does 'auth' mean in a system with no user accounts?" before Phase 2 starts; or (b) rewrite I-R5.4 to the only enforceable controls in this architecture — refuse deleted source, size cap, per-IP/per-token rate limit, and drop all "require session/auth" language and test 5's "unauth rejected" assertion. The plan's own risk note ("confirm with user") acknowledges this but the TDD test and locked decision #1 treat auth as a given. This contradiction must be resolved in the plan, not deferred to the implementer.

## Finding 2: Phase 2 I-R5.1 — "existing `withShareTokens`/equivalent" helper exists for share tokens, but NOT for templates/presentations-as-template/explore-fork/history

- Severity: **High**
- Location: `phase-02-...md:42-46` ("Replace `read`+`write` pairs with the existing `withShareTokens` / equivalent locked read-modify-write helper at: `share.js`, `templates.js`, `presentations.js:435-453` (save-as-template), `explore.js` fork, `history.js` restore")
- Flaw: The plan asserts an "equivalent locked read-modify-write helper" exists for ALL these paths. Storage exports only `withFileLock`, `withPresentations`, `withShareTokens`, `withAnalytics`, `withMediaDb` (`storage.js:243-263`). There is **no `withTemplates` and no `withHistory`**. `save-as-template` (`presentations.js:435-453`) reads templates and pushes to a DIFFERENT file (templates) than it reads the presentation from — a cross-file read-modify-write that `withShareTokens` cannot express. Explore fork (`explore.js:63-76`) reads share-tokens AND presentations, then writes presentations — again cross-file.
- Failure scenario: Implementer greps for a template/history lock helper, finds none, and must either write new `withTemplates`/`withHistory` wrappers (unstated work, the plan says "only if helper missing" for storage.js but lists it as an afterthought) or use the generic `withFileLock` directly. The "swap atomic helpers" step (Implementation Step 3) is underspecified for 3 of its 5 listed sites.
- Evidence: `storage.js:243-263` export list — no `withTemplates`/`withHistory`. `presentations.js:437` inlines `require('../services/storage')` for `readTemplates`/`writeTemplates` (no lock wrapper). `explore.js:3` imports raw `readShareTokens, readPresentations, writePresentations`.
- Suggested fix: Enumerate exactly which new lock helpers must be created (`withTemplates`, `withHistory`) and note that cross-file mutations (save-as-template, fork) need either nested locks or a documented lock-ordering to avoid deadlock. Change "existing helper" to "extend the `withX` family".

## Finding 3: Phase 5 I-R3.2 cites a CLIENT line number for a SERVER bug; the "fix model" line is in the wrong file

- Severity: **Medium**
- Location: `phase-05-...md:43-46` ("`server/utils/server-basic-renderers.js:42-98` `addImageElement` ignores opacity; client applies `transparency` at `export-pptx-basic-renderers.js:52-54`. Add the same transparency mapping server-side.")
- Flaw: The underlying bug is REAL (server `addImageElement` at `server-basic-renderers.js:42-86` does NOT map opacity → transparency; confirmed it only handles flip/alt/crop/sizing). But the cited "client reference" `export-pptx-basic-renderers.js:52-54` is the wrong location: that file's lines 52-54 ARE the image opacity mapping (`if (element.opacity != null && element.opacity !== 1) imageOptions.transparency = ...`) — i.e. the client DOES it there. The plan presents `:52-54` as evidence of where the client applies it, which is coincidentally correct, but the server function the plan says spans `:42-98` actually ends ~`:86` and the shape path (not image) already maps opacity at `server-basic-renderers.js:104-107`. So the server partially handles opacity (shapes) but not images — the plan's blanket "server drops image opacity" is right for images only.
- Failure scenario: Minor — implementer copying the client `:52-54` pattern to the server image path will succeed, but the `:42-98` span is off and may cause confusion about whether shapes also need the fix (they don't — already done at `:104-107`).
- Evidence: `server-basic-renderers.js:42` `addImageElement` start, no opacity in body through `:86`; shape opacity already at `:104-107`. Client `export-pptx-basic-renderers.js:52-54` = the opacity→transparency block.
- Suggested fix: Narrow the claim to "image elements only"; correct the server span to `:42-86`; note shape opacity is already handled to prevent double-fix.

## Finding 4: Phase 3 I-R6.3 worker-runner premise is partly stale — `ELECTRON_RUN_AS_NODE` is already gated

- Severity: **Medium**
- Location: `phase-03-...md:56-59` ("`worker-runner.js:17-34`: scope NODE_PATH; gate `ELECTRON_RUN_AS_NODE` (only when actually under Electron)") and report C/I-R6.3 phrasing "unconditional `ELECTRON_RUN_AS_NODE`".
- Flaw: The plan/report imply `ELECTRON_RUN_AS_NODE` is set unconditionally. The actual code at `worker-runner.js:29-31` already gates it: `if (isElectron ?? Boolean(process.versions.electron)) env.ELECTRON_RUN_AS_NODE = '1'`. It is NOT unconditional. NODE_PATH is also already de-duplicated via `uniquePathEntries` (`:13-23`). The only legitimately-loose part is that NODE_PATH appends server+root node_modules broadly.
- Failure scenario: Implementer writes a "red today" test asserting `ELECTRON_RUN_AS_NODE` is set when not under Electron — that test will be GREEN today (already gated), wasting time hunting a non-bug. The plan itself rates this "lower urgency" but the premise wording overstates the defect.
- Evidence: `worker-runner.js:29` `if (isElectron ?? Boolean(process.versions.electron))` — conditional. `:13-23` `uniquePathEntries` dedupes NODE_PATH.
- Suggested fix: Restate I-R6.3 as "NODE_PATH scope is broad" only; drop the "unconditional ELECTRON_RUN_AS_NODE" claim (already conditional). Do not write a test premised on it being unconditional.

## Finding 5: Phase 1 renderer emit-shape claim is imprecise — answer payload is NOT sent from the cited renderer

- Severity: **Medium**
- Location: `phase-01-...md:40-42` ("Renderer emit path: `name-picker-interactive-game-renderer.jsx:405` (and sibling game renderers) send `{roomId, answer, timeSpent}`")
- Flaw: Line `:405` emits `game-random` with `{roomId, gameType, mode, winner, allItems}` — NOT `{roomId, answer, timeSpent}`. The `{roomId, answer, timeSpent}` payload is actually sent from `use-game-player.js:50-54` (the player hook), not the renderer. The server `game-answer` handler reads `{gameId, answerIndex, timeSpentMs}` (`game-socket-handler.js:38`). So the field mismatch is real and worse than stated: client sends `roomId/answer/timeSpent`, server reads `gameId/answerIndex/timeSpentMs` — ALL THREE field names differ, across the hook, not the renderer.
- Failure scenario: Implementer following the plan greps the renderer for the answer payload, finds only `game-random`, and may miss `use-game-player.js` as the real answer-emit site — leaving the `game-answer` field mismatch half-fixed. The plan's "grep all `emit('game-` sites" mitigation helps, but the cited example points at the wrong event.
- Evidence: `name-picker-...renderer.jsx:405` = `emit('game-random', {roomId, gameType, mode, winner, allItems})`. `use-game-player.js:50-54` = `emit('game-answer', {roomId, answer:answerIndex, timeSpent})`. `game-socket-handler.js:38` reads `{gameId, answerIndex, timeSpentMs}`.
- Suggested fix: Correct the cite — answer payload originates in `use-game-player.js:50-54`; renderer `:405` is the `game-random` path. List all three field renames (roomId→gameId, answer→answerIndex, timeSpent→timeSpentMs) explicitly.

## Finding 6: Phase 2 settings I-R5.2 premise is stale — apiKey IS already preserved (via sentinel), the real bug is narrower

- Severity: **Medium**
- Location: `phase-02-...md:48-50` and report I-R5.2 ("settings PUT shallow-merge wipes AI apiKey")
- Flaw: `settings.js:24-34` already preserves apiKey when the client echoes the masked sentinel `'***configured***'` (`:30-32`). The blanket "shallow-merge wipes AI apiKey" is only true when the client sends an `ai` object that OMITS apiKey entirely (then `{...existing, ...req.body}` replaces the whole `ai` sub-object, dropping the key). So the bug is real but narrower than "wipes apiKey": it's "shallow top-level merge replaces the entire `ai` object when partial `ai` sent without the sentinel". TDD test 3 (`PUT {ai:{model:'x'}}` without apiKey → key intact) correctly targets THIS narrow case and will be red today — good. But the architecture description "deep-merge incoming over stored; if `ai.apiKey` omitted, preserve stored" must coexist with the existing sentinel logic at `:30-32`, which the plan doesn't mention.
- Failure scenario: Implementer adds deep-merge but doesn't reconcile with the existing `'***configured***'` sentinel branch, risking double-handling (sentinel + omitted both preserve) or a regression where an explicit empty-string apiKey can't clear the key.
- Evidence: `settings.js:27` `{...existing, ...req.body}` (shallow); `:30-32` sentinel preservation already present.
- Suggested fix: Note the existing sentinel branch; define interaction between deep-merge and `'***configured***'`; clarify how to explicitly CLEAR the key (since both sentinel and omission now preserve).

## Finding 7: Phase 5 dependency on Phase 4 is real but the "static renderer" handoff is underspecified for the throw-site

- Severity: **Medium**
- Location: `phase-05-...md:48-51` (I-R3.3 "timeline/game now have shared renderers (Phase 4). Route them to raster (or the static renderer) instead of throwing") + `server-fallback.js:63-70`
- Flaw: The throw is at `server-fallback.js:63-64` (`strictRaster && !allowFallback` → throw) and `:69-70`. Phase 4 adds a `game` entry to the SHARED `RENDERERS` (htmlGenerator path), but `server-fallback.js` is a separate PPTX-raster fallback path — having a shared HTML renderer for `game` does NOT automatically make `server-fallback` stop throwing; the raster capture still needs the element to be rasterizable (rendered in a browser page) OR explicitly routed to placeholder. The plan assumes Phase 4 "ships their renderers" resolves the throw, but Phase 4 ships HTML-string renderers, while Phase 5's throw is in the raster/screenshot path. The link between "shared HTML renderer exists" and "raster path no longer throws" is asserted, not demonstrated.
- Failure scenario: Phase 5 implementer confirms Phase 4 landed, expects the throw to be safe to remove, but the raster path still can't screenshot a `game`/`timeline` that isn't in the rasterizable switch — removing the throw yields a broken/empty image rather than the intended static block, unless they explicitly route to the static HTML renderer (different subsystem).
- Evidence: `server-fallback.js:63-64,69-70` throw sites are in the raster fallback, gated by `strictRaster`. Phase 4 modifies `shared/src/element-renderers.js` `RENDERERS` (HTML-string), a different code path from raster screenshot capture.
- Suggested fix: Phase 5 must specify HOW timeline/game route to the static representation in the raster pipeline (e.g., add them to the rasterizable switch so the shared HTML renderer's output gets screenshotted, OR bypass raster and emit the static HTML directly). "Route to raster (or the static renderer)" is two different fixes; pick one and wire it concretely.

## Finding 8: Plan defect-count "71" is internally inconsistent with the phase finding tallies

- Severity: **Medium**
- Location: `plan.md:16` ("Fix the 71 defects"), `:45` ("4 Critical + 25 Important ... 17 Medium ... 25 Low"), consolidated report `:19` totals.
- Flaw: 4 + 25 + 17 + 25 = 71 ✅ (count is arithmetically right). BUT the phase table allocation does not cover them cleanly: Phase 6 lists "I-R4.1, I-R4.2, M(R4)×2" yet the report gives R4 = 1 Critical + 5 Important + 3 Medium + 3 Low. Phase 1 takes C1 + I-R4.3/4.4/4.5 (3 Important) + "M(game)". That accounts for 4 of R4's 5 Importants; I-R4.1, I-R4.2 go to Phase 6 = 5 Importants total ✅. But R4 has 3 Mediums; Phase 1 "M(game)" + Phase 6 "M(R4)×2" = 3 ✅. R4 Low ×3 → Phase 8. This particular domain reconciles, but the plan never shows the per-phase Medium/Low math, so the "17 Medium folded / 25 Low in Phase 8" claim is unverifiable from the document. Phase 8 lists Lows for R1(4)+R2(8)+R3(3)+R5(4)+R6(3) = 22, plus "R4 residual" — but report R4 Low = 3 and R2 Low = 8; R2 Low ×8 are folded into Phase 7 as "M-R2×8" (mislabeled Medium vs Low?). The report says R2 has 0 Medium, 8 Low — but Phase 7 calls them "M-R2×8" (Medium). Mislabel.
- Failure scenario: Phase 7 treats 8 R2 items as Medium (in-phase, must-fix) while Phase 8 also claims R2 Lows; double-counting or gap. The "M-R2×8" in Phase 7 vs report's "R2 Low ×8" means the same 8 items are labeled both Medium (Phase 7) and Low (Phase 8 scope) — ambiguity over which phase owns them.
- Evidence: report `:14` R2 = 0 Medium / 8 Low; `phase-07-...md:23` "M-R2×8"; `phase-08-...md:22` "R2 Low (M1–M8): any not closed in Phase 7".
- Suggested fix: Reconcile R2's 8 items as Low (per report) consistently; clarify Phase 7 owns them and Phase 8 only verifies. Add a per-phase finding-count appendix so the 71 total is auditable.

---

## Summary by Severity

**Critical (1)**
- F1: Phase 2 I-R5.4 prescribes "require auth/session" + TDD asserts "unauth fork rejected", but server has ZERO auth infrastructure (`grep req.session|req.user|passport` = none). Locked decision #1 treats auth as given; unresolvable by implementer. (`phase-02:22,57-60,84`)

**High (1)**
- F2: Phase 2 I-R5.1 assumes a lock helper exists for templates/history/cross-file fork; storage exports only `withPresentations/ShareTokens/Analytics/MediaDb` — no `withTemplates`/`withHistory`; save-as-template & fork are cross-file. (`phase-02:42-46`, `storage.js:243-263`)

**Medium (6)**
- F3: I-R3.2 server-image-opacity bug real but span `:42-98` wrong (ends ~`:86`); shapes already map opacity at `:104-107` — narrow to images. (`phase-05:43-46`)
- F4: I-R6.3 "unconditional ELECTRON_RUN_AS_NODE" is stale — already gated at `worker-runner.js:29`; NODE_PATH already deduped. Test premise would be green today. (`phase-03:56-59`)
- F5: Phase 1 cites renderer `:405` for answer payload, but `:405` is `game-random`; answer `{roomId,answer,timeSpent}` comes from `use-game-player.js:50-54`. All 3 answer field names differ. (`phase-01:40-42`)
- F6: I-R5.2 "wipes apiKey" stale — sentinel preservation already at `settings.js:30-32`; real bug is partial-`ai`-object replacement. Reconcile deep-merge with existing sentinel. (`phase-02:48-50`)
- F7: Phase 5 throw-removal assumes Phase 4 shared HTML renderers fix the RASTER throw at `server-fallback.js:63-70` — different subsystem; handoff to static representation underspecified. (`phase-05:48-51`)
- F8: R2's 8 items labeled Medium in Phase 7 but Low in report/Phase 8 — ownership ambiguity; per-phase count not auditable from doc. (`phase-07:23` vs report `:14`)

## What checked out (no action)
All other heavily-cited anchors are accurate: C1/C2/C3/C4 line cites, withShareTokens/resolveColorField/computeMixedValues existence + reusability, shape parity 6-vs-13, I-R1.2 raw-color sites, RENDERERS missing `game` (19 vs 18), redo `slice(-19)`, share.js non-atomic read+write, pptx-exporter "worse engine" claims, getServerRasters location.

## Unresolved Questions (for planner)
1. F1 is blocking: what does "auth"/"session" mean in a system with no user accounts? Resolve before Phase 2, or rewrite I-R5.4 to enforceable controls (deleted-source refusal + size cap + rate limit) and drop "unauth rejected" test.
2. F2: confirm planner intends to ADD `withTemplates`/`withHistory` helpers (and a lock-ordering for cross-file fork/save-as-template) — currently implied as "existing".
3. F7: which concrete mechanism routes timeline/game through the raster path vs emitting static HTML directly?

Status: DONE_WITH_CONCERNS
Summary: Plan's file:line citations are overwhelmingly accurate (C1–C4, shape parity, all three prior-plan helpers verified reusable), but one Critical unstated dependency (no auth system exists, yet Phase 2 + locked decision #1 require it) and one High (missing lock helpers for templates/history/cross-file fork) plus 6 Medium stale/mislocated premises need planner resolution before implementation.
