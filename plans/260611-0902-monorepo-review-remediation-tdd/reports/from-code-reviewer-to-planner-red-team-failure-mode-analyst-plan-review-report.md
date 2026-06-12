# Red-Team Plan Review — Failure Mode Analyst / Flow Tracer

Plan: `260611-0902-monorepo-review-remediation-tdd`
Reviewer posture: hostile, Murphy's-Law failure-mode lens. Every finding grep-verified.

Verified TRUE (not attacked): `withShareTokens` helper exists (`storage.js:160`); C2 missing
`deletedAt` guard (`index.js:153-173`); C1 namespace/field mismatch (`use-game-socket.js:27,33`
vs `game-socket-handler.js:9,15`); C3 unescaped href (`markdown-import.js:115`, `url-safety.js:6`);
C4 declared-size trust (`pptx-guards.js:67`); I-R4.2/I-R4.3/I-R4.4 (`live-rooms.js:98`,
`game-room-manager-singleton-service.js:72,109`); I-R2.3 redo cap (`EditorPage.jsx:935`).

---

## Finding 1: Game TTL cleanup + host-authz both block on an UNRESOLVED open question; cleanup will kill live games on reconnect
- Severity: **Critical**
- Location: Phase 1 §I-R4.4, §I-R4.5; plan Unresolved Q1
- Flaw: Players are keyed by `socket.id` (`game-room-manager-singleton-service.js:39` `room.players.set(socketId,...)`). A reconnecting player always gets a NEW socket.id. The plan's I-R4.4 mitigation is "schedule empty-room cleanup on leave/disconnect ... cancel on rejoin (debounce)" and I-R4.5 adds a host check "analogous to live `canControlRoom`." But game rooms have NO `presenterId`/host token field at all (room shape is `gameId/status/players/...`, no host) — `canControlRoom` (`live-rooms.js:146`) keys off `presenterId`, which games lack. Both fixes require a stable player/host identity, which is plan Unresolved Q1 ("Game host identity beyond socket.id?") — explicitly deferred, not decided.
- Failure scenario: Mobile player's socket drops for 2s mid-quiz. `disconnect` → `players.size` hits 0 → cleanup scheduled. Grace window expires before reconnect (or reconnect arrives as a new socket the debounce cannot correlate to the old one) → room with ALL scores/answers destroyed mid-game. Separately, I-R4.5 test 3 ("non-host emits `game-next` → rejected") cannot even be authored: there is no host concept to check against.
- Evidence: `game-room-manager-singleton-service.js:13-25` (room shape, no host), `:39` (socketId keying), `:128-134` (`leaveRoom` deletes by socketId), `game-socket-handler.js:12` (`currentGameId` per-socket, no role); plan.md:115 (Q1 unresolved); phase-01 lines 60, 82, 105-106.
- Suggested fix: Resolve Q1 BEFORE Phase 1 codes I-R4.4/I-R4.5 (introduce a client-persisted `playerId` + host token). Make Q1 a hard blocker on Phase 1, not a "scout will figure it out" note. Cleanup must key the grace/cancel on stable `playerId`, never socket.id.

## Finding 2: C2 "suspend share tokens on soft-delete" silently destroys share config on restore (data-loss, no rollback)
- Severity: **Critical**
- Location: Phase 2 §C2 ("on soft-delete, suspend ... associated share tokens — decision locked: suspend on soft-delete")
- Flaw: `DELETE /:id` is a SOFT delete (sets `deletedAt`; deck is recoverable from trash). The plan adds suspension of share tokens at soft-delete time but never defines suspend as reversible, and never pairs it with an un-suspend on restore. If "suspend" deletes/revokes tokens (the existing hard-delete behavior the plan mirrors), then restoring a trashed deck leaves it with all share links permanently gone — irreversible loss of user-visible config, with no pre-restore snapshot for share-tokens (I-R5.3 snapshots the DECK only, not share-tokens).
- Failure scenario: User trashes a deck, share links revoked. Next day restores it from trash. Every previously-distributed share URL now 404s; no record to regenerate the same tokens. Soft-delete was supposed to be reversible; the share side is not.
- Evidence: phase-02 lines 33-41 (soft-delete is `deletedAt`-only; "suspend on soft-delete"), lines 53-55 (I-R5.3 snapshot is deck-only); `index.js:221-263` (share serve path). The plan never states tokens are restored on undelete.
- Suggested fix: Define "suspend" as a reversible flag (`suspendedAt` on the token, not deletion). Restore/undelete must clear it. Add a test: trash → restore → original share URL works again.

## Finding 3: Phase 5 stop-throw test (test 3) passes WITHOUT Phase 4 — the declared 5→4 dependency is not actually enforced by the test, so shipping 5 first silently degrades exports to placeholders
- Severity: **High**
- Location: Phase 5 §I-R3.3, TDD test 3; Dependencies `[4]`
- Flaw: Phase 5 test 3 asserts "strict-mode export of timeline/game → no throw, static output." The cheapest way to make `server-fallback.js:63-71` stop throwing is to route timeline/game down `addPlaceholder` (already exists, `server-fallback.js:14-35`) — i.e. weaken strict mode. That makes test 3 green with ZERO dependency on Phase 4's shared renderers. The "static output" assertion is satisfied by the gray "preview unavailable" placeholder. So if Phase 5 ships before Phase 4 (or Phase 4 regresses), every timeline/game element silently exports as a gray box and the test stays green — the exact fidelity failure the phase exists to prevent.
- Failure scenario: Owner runs phases out of order or Phase 4's `RENDERERS` entry (`element-renderers.js`) is reverted. Test 3 green, corpus green (placeholders are valid output), users get gray boxes instead of timeline/game snapshots. Dependency `[4]` is documented but unguarded.
- Evidence: phase-05 lines 7,48-51,72; `server-fallback.js:14-35` (placeholder path), `:49-66` (rasterizable → raster; falls through to placeholder when raster null). The raster path itself needs Phase 4's shared renderer to produce non-empty DOM, but test 3 never asserts the output is the real renderer vs placeholder.
- Suggested fix: Test 3 must assert the exported image is NON-placeholder (e.g. distinguishable pixels / presence of title text), forcing a true dependency on Phase 4. Add a guard test that fails if `game`/`timeline` resolve to the placeholder branch.

## Finding 4: Engine consolidation (Phase 5) makes the global `rasterCache` race WORSE and leaks memory on the interactive client route — M3 fix is ordered AFTER the consolidation that introduces it
- Severity: **High**
- Location: Phase 5 §I-R3.4 + §M3; Implementation Steps 3 (consolidate) vs 6 (mediums)
- Flaw: The client-facing path `rasterizeComplexElements` (`pptx-exporter.js:92-141`) has NO cache today. The plan points it at `getServerRasters` (`server-raster.js:146`), which uses a module-global `rasterCache` (`:20`) and is only ever cleared by `server-export.js:79`. The interactive route `presentations.js:240` calls the client path on demand and NEVER clears the cache. After consolidation that route populates the global cache forever → unbounded memory keyed by full-slide content hash. Worse, `clearRasterCache()` at `server-export.js:79` is global: a finishing export wipes cache entries another concurrent export is relying on.
- Failure scenario: Two users export the same deck concurrently. Export A finishes, calls `clearRasterCache()`, wiping entries. Meanwhile the interactive raster route keeps inserting per-edit entries that are never cleared → server RSS climbs until OOM. The plan schedules consolidation in step 3 but the M3 cache-scoping fix in step 6, so the leak/race exists for the duration of the phase and any partial landing.
- Evidence: `server-raster.js:20,153-154,203,207-209`; `server-export.js:79`; `pptx-exporter.js:92` (no cache today); `presentations.js:240` (interactive caller). phase-05 lines 34-42 (consolidate), 58 (M3 deferred).
- Suggested fix: Land M3 (per-export scoped cache, no module global) in the SAME step as consolidation. Never call a global `clearRasterCache()` while any export may be in flight.

## Finding 5: C3 markdown XSS fix hardens the source but not the sink; Open Q3 is unresolved yet the Critical is scheduled as importer-only
- Severity: **High**
- Location: Phase 3 §C3; plan Unresolved Q3
- Flaw: The fix escapes href at `markdown-import.js:115` and tightens `isSafeHref`. But this only sanitizes ONE entry point at write time. Whether the rendered sink (`element.content` → HTML in share view / htmlGenerator) is safe is plan Q3 — UNRESOLVED. If any consumer emits `content` without `sanitizeRichTextHtml`, then (a) already-imported poisoned decks stay exploitable, and (b) other content producers (paste, AI generation) bypass the importer guard entirely. A Critical XSS fixed only at one of N sources is not fixed.
- Failure scenario: Attacker imports malicious markdown before the fix ships (content persisted), or pastes the same payload post-fix via a non-import path. Share view renders it. The "Critical" remains live.
- Evidence: `markdown-import.js:110-116`; `url-safety.js:3-15`; phase-03 lines 38-42 ("Scout must confirm ... if no → still fix but note non-exploitable"); plan.md:117 (Q3 unresolved). `index.js:160` shows share view sanitizes customCSS only, not element content.
- Suggested fix: Resolve Q3 BEFORE Phase 3 closes C3. Harden the SINK (centralized output sanitization) in addition to the importer. Add a migration/scan for already-persisted poisoned content, or treat the sink fix as the primary C3 remedy.

## Finding 6: Live room cleanup (I-R4.2) misses the pre-registered-but-abandoned room leak and races viewer joins on presenter-less rooms
- Severity: **High**
- Location: Phase 6 §I-R4.2
- Flaw: The fix triggers cleanup "when presenter leaves and no viewers remain." But rooms are PRE-REGISTERED via REST `registerRoom` (`live-rooms.js:50`) before any presenter socket connects, and viewers may join presenter-less rooms (`:76-77`). A room whose presenter never connects never fires `leaveRoom` for a presenter → the "presenter leaves" trigger never runs → that room leaks forever. This is a distinct leak from the one the plan targets and is left unaddressed.
- Failure scenario: Client calls the REST register endpoint (link generation / pre-warm) but the user closes the tab before the socket connects. Room sits in the `rooms` Map with no presenter, no viewers, no TTL. Repeated over time → unbounded growth, exactly the symptom I-R4.2 claims to fix. Separately: presenter disconnects, no viewers → cleanup scheduled; a viewer who already holds the pre-registered code joins during the grace window; if cleanup fires first the viewer gets `room-not-found`.
- Evidence: `live-rooms.js:49-54` (registerRoom), `:75-81` (viewer join without presenter), `:87-113` (leaveRoom only nulls presenterId); phase-06 lines 39-44.
- Suggested fix: Add a creation-time TTL for rooms that never see a presenter connect (sweep `createdAt` + no presenterId + no viewers). Cancel on presenter connect. Cover with a test: register room, never connect → removed after window.

## Finding 7: Phase 5 test 4 is a phantom — after consolidation it compares the single engine to itself
- Severity: **Medium**
- Location: Phase 5 TDD test 4 ("client path and server path produce identical rasters")
- Flaw: Step 3 consolidates BOTH paths onto `getServerRasters` and deletes the duplicate. Test 4 then "compares" client vs server output, but both now invoke the identical function → the assertion is tautological and can never fail. It executes code without proving behavior (classic phantom test) and gives false confidence that consolidation preserved fidelity.
- Failure scenario: Consolidation subtly changes raster output vs the old `rasterizeComplexElements`. Test 4 is green regardless because there is no longer an independent second path. Regression ships undetected; only corpus/browser-audit might catch it (and those are not the named guard).
- Evidence: phase-05 lines 34-42 ("make the client path use getServerRasters; delete the duplicate"), line 74 (test 4 as "regression guard"); `pptx-exporter.js:92` vs `server-raster.js:146`.
- Suggested fix: Snapshot the OLD `rasterizeComplexElements` output for a fixture deck BEFORE deletion and compare the consolidated output against that fixed baseline. Then delete.

## Finding 8: Phase 8 bcrypt-500 fix targets the wrong file; following the plan literally leaves the defect live
- Severity: **Medium**
- Location: Phase 8 §Security Lows; Related Code Files ("Modify (security): `server/routes/share.js`")
- Flaw: The "bcrypt throws on undefined hash → 500" defect is the `bcrypt.compare(pwd, tokenData.password)` calls where `tokenData.password` may be undefined. Grep shows these live at `server/index.js:275` (POST `/share/:token`) and `explore.js:59` — NOT in `share.js`. `share.js` only HASHES on create (`:73`), it never compares. The plan's create-test file `server/routes/share-no-password-bcrypt.test.js` and the "Modify share.js" target both point at the wrong module. Editing share.js will not fix the 500.
- Failure scenario: Implementer edits share.js per the plan, test passes against the wrong route or is written against index.js by accident, and the actual `POST /share/:token` 500 (and explore fork path) persists.
- Evidence: `index.js:266-276` (`pwd` + `bcrypt.compare` on possibly-undefined `tokenData.password`); `explore.js:53-61`; `share.js:73` (hash only, no compare); phase-08 lines 48,51,55-57.
- Suggested fix: Retarget to `server/index.js` POST `/share/:token` (guard `if (!tokenData.password) return 401/redirect` before compare) and `explore.js:53-61`. Fix Related Code Files + test location accordingly.

## Finding 9: I-R6.3 finding is factually stale — `ELECTRON_RUN_AS_NODE` is already conditionally gated; the test would prove nothing
- Severity: **Medium**
- Location: Phase 3 §I-R6.3 ("worker fork resolves via NODE_PATH + unconditional `ELECTRON_RUN_AS_NODE`")
- Flaw: `worker-runner.js:29-31` already gates the env var: `if (isElectron ?? Boolean(process.versions.electron)) env.ELECTRON_RUN_AS_NODE = '1'`. It is NOT unconditional. The finding text is inaccurate against current source, so any "tighten the gate" work and its test have no real defect to bite on, wasting P0-phase effort and eroding confidence in the finding set.
- Failure scenario: Implementer "fixes" an already-correct gate, possibly introducing a regression (e.g. breaking the Electron worker path), to satisfy a finding that no longer reflects the code.
- Evidence: `worker-runner.js:17-34` (NODE_PATH scoping + conditional gate at `:29`); phase-03 lines 22, 56-59.
- Suggested fix: Re-verify I-R6.3 against current `worker-runner.js`. If only NODE_PATH-scope tightening remains, downgrade to Low/cosmetic and correct the description; drop the "unconditional" claim.

---

## Cross-cutting concern (not a numbered finding)
I-R5.1 claims to "use the existing `withShareTokens`/equivalent helper" for templates and history,
but `storage.js` exports NO `withTemplates` and NO history `with*` helper (only `withPresentations`,
`withShareTokens`, `withAnalytics`, `withMediaDb` — `storage.js:225-264`). For those paths the helper
must be CREATED, not "swapped." The plan hedges this once ("storage.js only if helper missing") but the
TDD/steps read as a swap. Scope/effort for I-R5.1 is understated for templates + history.

## Unresolved questions for the planner
1. Will Q1 (stable game player/host identity) be a hard blocker on Phase 1, given I-R4.4 AND I-R4.5 both depend on it?
2. Is soft-delete share suspension reversible on restore? If not, that is data loss, not hardening.
3. Does C3 close the rendering SINK, or only the import source? Q3 must resolve before C3 is marked done.
4. Will M3 cache scoping land in the same commit as Phase 5 engine consolidation (else interim leak)?

Status: DONE_WITH_CONCERNS
Summary: Plan is well-evidenced overall, but two Criticals (game cleanup/authz both blocked on the deferred Q1; soft-delete share suspension risks irreversible data loss) and three Highs (unenforced 5→4 dependency, rasterCache consolidation leak ordering, C3 source-not-sink) need rework before execution; plus mislocated bcrypt fix and a stale I-R6.3 finding.
