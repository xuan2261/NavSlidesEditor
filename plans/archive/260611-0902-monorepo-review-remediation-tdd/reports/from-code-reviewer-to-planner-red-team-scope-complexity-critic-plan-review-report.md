# Red-Team Plan Review — Scope & Complexity Critic / Contract Verifier

- Plan: `plans/260611-0902-monorepo-review-remediation-tdd`
- Reviewer lens: YAGNI enforcer + contract-preservation verifier
- Date: 2026-06-11
- Verdict: plan is well-grounded (findings are real, file:line evidence checks out) but several fixes **over-reach the finding's actual severity** — refactors disguised as bugfixes, a gold-plated export renderer, an overloaded P0 phase, and two contract-changing rewrites that need narrowing before implementation.

---

## Finding 1: Phase 4 I-R1.1 "unify canvas geometry with shapeUtils" is a new-abstraction refactor, not the bugfix
- **Severity:** High
- **Location:** phase-04 §I-R1.1 (lines 32-38)
- **Flaw:** The real defect is 7 missing `case` branches in the canvas JSX renderer. `shape-element-renderer.jsx` handles rect/rounded-rect/circle/triangle/diamond/arrow-right/star then `default→<rect>` (`shape-element-renderer.jsx:90-164`); export `shapeUtils.js` handles all 14 incl. hexagon/pentagon/cloud/cylinder/parallelogram/trapezoid/bracket (`shapeUtils.js:126-187`). Minimal fix = add the 7 cases. The plan instead mandates "Canvas should consume the SAME geometry source as export (import shapeUtils path generators)". But there is **no shared geometry source to import**: `shapeUtils.shapeSvgString` is a monolithic **string** builder (template literals returning SVG markup, `shapeUtils.js:102-208`), while the canvas builds **React JSX** (`<polygon>`, `<g>`, `shape-element-renderer.jsx:74-166`). Geometry is inlined per-branch in both; no pure points/path function exists. "Unifying" requires extracting a brand-new geometry layer and rewiring BOTH surfaces onto it — a third module + 2 rewrites, far beyond a 7-case bug.
- **Failure scenario:** A 1-hour bug fix becomes a multi-file abstraction. The plan's own mitigation admits "unifying canvas shape geometry with shapeUtils changes existing pixel output subtly" (phase-04:97-98) — a self-inflicted risk: refactoring the 6 already-correct shapes can regress live presentations that currently render fine.
- **Evidence:** `shapeUtils.js:102-208` (string builder), `client/src/components/canvas/element-renderers/shape-element-renderer.jsx:74-166` (JSX builder) — identical geometry, incompatible output types, zero shared function.
- **Suggested fix:** Add the 7 missing `case` branches to the JSX switch, geometry mirrored from shapeUtils. Add a parity test asserting every shape produces non-`<rect>` output. Do NOT extract a shared geometry layer (YAGNI) unless a third consumer appears.

## Finding 2: Phase 4 I-R1.4 game "real static representation" is gold-plated past what I-R3.3 needs
- **Severity:** High
- **Location:** phase-04 §I-R1.4 (lines 54-59); locked decision #3 (plan.md:42-44)
- **Flaw:** The dispatcher already has the right pattern for unrenderable types: `renderElement` returns `''` for unknown types (`element-renderers.js:692`) and `renderPluginFallback` produces a labeled placeholder div (title + label badge, `element-renderers.js:633-637`). The minimal, consistent fix is a ~10-line fallback mirroring `renderPluginFallback`. The plan instead specifies "title + type badge + **question count or first question**". That creeps toward rendering game content, and "first question" is ambiguous: the `game` element holds multiple sub-game configs (`name-picker`, `hot-potato`, ...) each with different shapes (`element-defaults.js:224-249`) — "first question" doesn't exist for name-picker. The only hard requirement (from I-R3.3 / phase-05:48-51) is "never throw" — a placeholder satisfies that completely.
- **Failure scenario:** Implementer writes sub-type-aware content extraction (question parsing per game type) for an interactive-only element that exports rarely; adds branching + escaping surface for marginal value.
- **Evidence:** `element-renderers.js:633-650` (existing fallback precedent), `:692` (`if (!renderer) return ''`), `element-defaults.js:224-249` (game has heterogeneous sub-configs; no uniform "question" field).
- **Suggested fix:** Add a `game` entry that reuses the `renderPluginFallback` shape (title + "Interactive Game" badge), never throws. Drop "question count / first question" from scope.

## Finding 3: Phase 5 engine consolidation is a structural entry-point change bundled as "robustness", and Test 4 is self-contradictory
- **Severity:** Medium
- **Location:** phase-05 §I-R3.4+I-R3.1 (lines 34-42), Test 4 (line 73)
- **Flaw:** `pptx-exporter.js:rasterizeComplexElements` (145 LOC, client-facing, called from `exportPptx.js:45`) and `server-raster.js:getServerRasters` (219 LOC) ARE near-duplicate screenshot loops (`pptx-exporter.js:124-141` vs `server-raster.js:182-205`). Consolidating is reasonable, but the two have **diverged contracts**: getServerRasters carries a module-global `rasterCache` (`server-raster.js:203`, the M3 race) and per-element try/catch swallow; the client engine has neither and accepts only `{html,latex}` targets. "Make client path use getServerRasters; delete the duplicate" changes the export entry-point's caching and target-type contract — not just "stop the 500". And Test 4 ("client path and server path produce identical rasters") is meaningless after you DELETE one path.
- **Failure scenario:** Switching the client export onto the cached engine introduces stale-raster bleed across exports (the very M3 race the plan also wants to fix) at the user-facing export route; cache semantics change silently for existing callers.
- **Evidence:** `server/services/pptx-exporter.js:124-141`, `server/utils/server-raster.js:182-205`, `:203` (global cache absent from client path), `exportPptx.js:45` (caller).
- **Suggested fix:** Treat consolidation as its own step with explicit caller-contract review: fix M3 (per-export cache key or scoped cache) BEFORE pointing the client path at it. Rewrite Test 4 to pin output against a golden fixture, not path-vs-path equality.

## Finding 4: Phase 2 I-R5.5 SSRF fix is internally contradictory and severity is over-escalated
- **Severity:** Medium
- **Location:** phase-02 §I-R5.5 (lines 61-64), risk note (lines 109-110)
- **Flaw:** The guard is reached only for the `custom` AI provider (`ai-provider.js:70`), whose endpoint is operator/authed-user config (server-side `settings.ai.customEndpoint`). Existing guard already blocks literal private IPs, resolves+checks DNS (`ai-endpoint-guard.js:72-83`), and `redirect:'manual'` blocks redirect rebinding (`ai-provider.js:79`). Residual gap = pure DNS-rebinding TOCTOU (returns hostname URL at `:83`, fetch re-resolves). "Resolve-then-pin" is the right fix — BUT the plan also says "keep host allowlist for known-good" (phase-02:110), and the allowlist **early-returns before any IP check** (`ai-endpoint-guard.js:66`). You cannot simultaneously pin-by-resolved-IP AND honor an allowlist that skips IP checks; the allowlist is the exact bypass being flagged. The plan lists both as if compatible.
- **Failure scenario:** Implementer keeps the allowlist early-return "for CDNs" (its own mitigation) and ships a pin that any allowlisted host bypasses — fix is cosmetic.
- **Evidence:** `ai-endpoint-guard.js:66` (allowlist `return` skips IP check), `:77-83` (resolve+check but returns hostname), `ai-provider.js:70,79`.
- **Suggested fix:** Pick one model: either (a) pin every connection to the guard-approved IP via custom `agent.lookup` and DROP the IP-skipping allowlist (allowlist only gates *which hosts* are permitted, still IP-checked), or (b) accept TOCTOU as low-risk for an operator-config single field and downgrade to Medium. Resolve the contradiction in the phase before coding.

## Finding 5: Phase 2 is an overloaded grab-bag — P0 (C2) bundled with 6 cross-domain Mediums, contradicting "independently shippable"
- **Severity:** Medium
- **Location:** phase-02 Findings Covered (lines 18-24), Related Code Files (line 73)
- **Flaw:** One phase covers C2 (P0) + I-R5.1..5.5 + 6 Mediums (history prune, rclone stderr strip, raster-elements DoS, github path sanitize, media.js fs+DELETE-key reconcile, err.message routing) across 13 modify targets (index, presentations, explore, share, templates, settings, history, sync, media, github, ai-endpoint-guard, storage, error-handler/validate) at "2d". The plan claims each phase is "independently shippable behind its own green test suite" (plan.md:87), but the P0 soft-delete guard (C2: ~4 read-path guards + share-suspend) is the only thing that must ship first. Bundling media.js orphan-key reconciliation (a data-model change) and github path sanitization with the P0 dilutes review and inflates blast radius on the most time-sensitive phase.
- **Failure scenario:** The P0 cross-user data-exposure fix waits on / risks regression from unrelated media-orphan and rclone work; reviewers can't fast-track the security-critical subset.
- **Evidence:** phase-02:73 (13 modify targets); C2 alone = `server/index.js:156` + `presentations.js:249-258` + `explore.js:66` guards + share suspend.
- **Suggested fix:** Split Phase 2 into 2a (C2 + share-suspend + I-R5.1 atomicity — the P0/data-integrity core) and 2b (settings merge, SSRF, the 6 Mediums). Ship 2a first.

## Finding 6: Phase 2 I-R5.2 settings "deep-merge globally" changes an existing PUT contract the sentinel already handles
- **Severity:** Medium
- **Location:** phase-02 §I-R5.2 (lines 48-50)
- **Flaw:** Current `settings.js:27` is a shallow spread `{...existing, ...req.body}` and ALREADY has an explicit `***configured***` sentinel that preserves apiKey (`settings.js:30-32`); GET masks apiKey to exactly that sentinel (`:12`). So a GET-then-PUT round-trip preserves the key today. The bug is only when a client sends `{ai:{model}}` WITHOUT round-tripping the sentinel. The plan jumps to "deep-merge incoming over stored" for ALL keys + Zod + per-key array policy. Global deep-merge changes the PUT contract: today a client can replace a nested object wholesale (e.g., clear a field); after deep-merge that becomes impossible without explicit deletes. That is a behavior change to an existing public endpoint beyond the apiKey bug.
- **Failure scenario:** Existing clients that rely on object-replacement semantics silently get merged stale fields; the apiKey case may already be solved by the sentinel the implementer doesn't check first.
- **Evidence:** `server/routes/settings.js:27` (shallow spread), `:30-32` (sentinel preserve exists), `:12` (GET emits sentinel).
- **Suggested fix:** Scope the fix to the `ai` object (deep-merge `ai` only, preserve apiKey when omitted) — or verify clients round-trip the sentinel and document that as the contract. Don't rewrite global merge semantics. Confirm before changing the public PUT contract.

## Finding 7: Phase 8 P3 sweep buries genuine security Lows behind all fidelity work + creates double-fix bookkeeping
- **Severity:** Medium
- **Location:** phase-08 (dependencies line 7; findings lines 17-31; priority block 41-46)
- **Flaw:** Phase 8 `blockedBy [1..7]` and re-reads all 6 stream reports to re-triage Lows. Several R1 Lows are explicitly "Most folded into Phase 4 — verify here, don't double-fix" (phase-08:17-20) — i.e. Phase 4 and Phase 8 both claim the same findings, requiring cross-phase reconciliation (overhead, and a finding can silently fall between them). Worse, security-adjacent Lows — bcrypt-500 on `/share/:token` with `pwd` to a no-password token, SVG magic-byte bypass, Electron `will-navigate`/scheme allowlist — sit in the SAME P3 bucket as cosmetic "cache key SHA1" and dead code, gated behind ALL fidelity phases.
- **Failure scenario:** A real 500 DoS (bcrypt on undefined hash) and an Electron navigation-guard gap ship last (or get triaged won't-fix under time pressure) while shape-pixel fidelity ships first.
- **Evidence:** phase-08:7 (deps 1-7); :17-20 (R1 Lows duplicated with Phase 4); :41-44 (security Lows + cosmetic Lows in one P3 phase).
- **Suggested fix:** Pull the 3 security-adjacent Lows (bcrypt-500, SVG magic-byte, Electron nav) into Phase 2/3 (their security domains) with tests; leave Phase 8 for cosmetic/correctness Lows only. Assign each R1 Low to exactly ONE phase (Phase 4 owns them; remove from Phase 8) to kill the double-fix bookkeeping.

---

## Cross-cutting note (not a blocker): C1 decision gate is already pre-decided by evidence
Phase 1's "scout STEP 0: evaluate Option A vs B" spends a decision gate that the codebase already settles. The existing game e2e test connects to `/games` with `{gameId}` and is structured to pass (`tests/e2e/games/game-scoring-and-leaderboard.spec.js:11,65,73`), and `game-timer-*` events run through the LIVE default-namespace handler (`server/services/socket-handler.js`), so Option B (collapse to default namespace) WOULD collide with live handlers — exactly the risk the plan lists but doesn't resolve. Recommend the plan record "Option A, forced by existing e2e + live-handler collision" up front rather than re-deriving it, and just fix the CLIENT side (`use-game-socket.js:27,33` → `/games` + `gameId`). This shrinks C1 to a 2-hook change. Zod is already a dependency (`server/middleware/schemas.js`, used in ai.js/github.js/share.js), so Phase 2's "Add Zod" introduces no new dep — good, lower risk than implied.

## Unresolved questions for planner
1. Finding 1: confirm there is genuinely no third consumer needing a shared geometry layer — if not, the abstraction is YAGNI and must be cut.
2. Finding 4: which SSRF model — pin-and-drop-allowlist, or accept-TOCTOU-as-Medium? The two cannot coexist.
3. Finding 6: do existing settings clients round-trip the `***configured***` sentinel? If yes, the apiKey "bug" may be a client issue, not a server-merge rewrite.
4. Finding 7: are bcrypt-500 / Electron-nav acceptable to ship last, or should they move up to their security phases?

Status: DONE_WITH_CONCERNS
Summary: Findings are real and well-evidenced, but 4 fixes over-reach their finding's severity (shape-geometry refactor, gold-plated game renderer, global settings deep-merge, engine-delete) and 2 phases are over-bundled (Phase 2 P0+6 Mediums, Phase 8 buries security Lows). Narrow scope per the 7 findings before implementing.
