# Red-Team Security-Adversary Plan Review

- Date: 2026-06-11
- Reviewer role: security adversary + fact checker (grep-verified)
- Target: `plans/260611-0902-monorepo-review-remediation-tdd` (plan.md + phase-02, phase-03)
- Scope of attack: untrusted-import (C3/C4), SSRF (I-R5.5), share/fork trust boundary (C2/I-R5.4), background gate (I-R6.1). Author HTML/CSS/JS treated as trusted (out of scope, per lock).
- Verdict: plan correctly diagnoses the core defects, but several **fixes are incomplete or infeasible as written**. The most serious is the C2 serve-path list (misses 6+ paths) and the I-R5.4 "require auth" requirement (no auth layer exists anywhere).

---

## Finding 1: C2 deletedAt-guard list is incomplete — 6+ serve paths leak trashed deck content
- **Severity:** Critical (blocks success — C2 is locked P0)
- **Location:** Phase 2, "Architecture › C2 — soft-delete guard"
- **Flaw:** The plan enumerates only THREE guard points: `renderShareView` (index.js:153-173), `GET /:id` (presentations.js:249-258), explore fork (explore.js:63-66). The actual code has many more by-id read/serve paths that return trashed deck content. The plan's own Success Criterion "deleting a deck immediately stops ALL public serving/forking" is not met by the listed set.
- **Failure scenario:** Owner trashes a deck containing sensitive content. Attacker (or the owner who believed it private) hits `GET /api/presentations/:id/present`, `/:id/export`, or pushes it live via GitHub — all still render the full deck. Under multi-user/proxy these are cross-user exposures identical to C2.
- **Evidence (file:line):**
  - `server/routes/presentations.js:393-432` `GET /:id/present` — `find(p=>p.id===...)`, no `deletedAt` guard, renders full HTML.
  - `server/routes/presentations.js:376-391` `GET /:id/export` — no guard, serves full HTML attachment.
  - `server/routes/presentations.js:353-374` `POST /:id/duplicate` — no guard, clones a trashed deck into a live one.
  - `server/routes/presentations.js:434-457` `POST /:id/save-as-template` — no guard, exfiltrates trashed deck into templates.
  - `server/routes/presentations.js:459-507` `GET /:id/uploads` — no guard, lists upload refs of trashed deck.
  - `server/routes/github.js:60-84` GitHub push — `find(p=>p.id===presId)`, no guard, publishes trashed deck to a public repo.
  - `server/routes/share.js:50-54` `POST /:id/share` — no guard, lets a NEW share token be minted for an already-trashed deck (then served via index.js).
- **Suggested fix:** Centralize the guard. Add a `findServeablePresentation(id)` helper in storage that returns null when `deletedAt` is set, and route EVERY by-id read/serve/fork/export/duplicate/template/github/share-create path through it. The phase must enumerate all 9 sinks, not 3, and the C2 regression test must assert 404/refuse on each.

---

## Finding 2: I-R5.4 "require auth on fork" is infeasible — no auth infrastructure exists
- **Severity:** Critical (the locked P0 fix cannot be implemented as specified)
- **Location:** Phase 2, "I-R5.4 — fork hardening" ("require auth (under multi-user model)"); plan.md Locked Decision #1.
- **Flaw:** The plan repeatedly prescribes "require a session" / "fork-write should require a session" but there is **no session, user, or auth middleware anywhere in the server**. Grep for `req.session|req.user|authenticate|requireAuth|passport|jwt.verify` returns zero matches. The whole app is single-trust-domain file storage with no identity. "Require auth" is not a 2-line fix; it is net-new infrastructure (login, session store, user-deck ownership model) that the plan budgets at "2d" for the entire phase.
- **Failure scenario:** Implementer reaches step 5 ("Fork auth/cap → test 5"), discovers there is no `req.user` to check, and either (a) stalls/blocks, or (b) ships a fake gate (e.g. a hardcoded header check) that provides no real protection — exactly the AI-risk "defensive paranoia / phantom" pattern. The locked P0 then ships unfixed while the test passes against a stub.
- **Evidence (file:line):**
  - `server/routes/explore.js:45-82` — fork handler has no auth check, no ownership concept; `readPresentations`/`writePresentations` are global.
  - Grep (server-wide): no `req.session`, `req.user`, `requireAuth`, `passport`, `jwt` — auth layer absent.
  - `server/index.js:312-330` `startServer` — no auth middleware mounted; CORS is the only access control and is `origin:'*'` in non-prod.
- **Suggested fix:** Split I-R5.4 honestly. The achievable-now parts (size cap, refuse trashed source via Finding 1 helper, per-IP/token rate limit) belong in this phase. "Require auth" must be carved out as an explicit dependency/blocker — either descoped to "the proxy enforces auth in front of the app" (document the trust assumption) or promoted to its own prerequisite phase that builds the identity layer. Do not let a test assert "unauth fork rejected" against a stub gate.

---

## Finding 3: C4 fix ignores the largest OOM vector — JSZip + parser worker both materialize the whole archive
- **Severity:** Critical (C4 is locked P0; the proposed fix leaves the dominant DoS path open)
- **Location:** Phase 3, "C4 + I-R6.2 — zip-bomb" (stream-measure in pptx-guards + media.js pre-check).
- **Flaw:** The plan's measured-inflation fix targets `pptx-guards.js` and `media.js`. But the guard itself already calls `await fs.readFile(filePath)` then `JSZip.loadAsync(bytes)` BEFORE any per-entry measurement, and the parser worker runs full `pptxtojson` over the archive AFTER the guard. JSZip `loadAsync` decompresses entries lazily, but `entry.async('nodebuffer')` (media) and the parser's XML expansion both inflate without a cumulative budget. "Stream-measure in media.js" does not bound the parser worker's heap. There is no `--max-old-space-size` cap on the forked worker.
- **Failure scenario:** Attacker crafts a <100MB PPTX whose `ppt/slides/slideN.xml` parts (NOT media) expand to GBs (classic XML/nested-element bomb). Media guards never see it; the parser worker OOMs the box (or the Electron-embedded server). The plan's C4 test only crafts a media-inflation archive (test 2: "declaring tiny uncompressedSize but inflating large"), so it passes while the XML-part vector remains.
- **Evidence (file:line):**
  - `server/services/pptx-import/pptx-guards.js:50-52` — `fs.readFile` + `JSZip.loadAsync(bytes)`; whole file in memory before measurement.
  - `server/services/pptx-import/pptx-guards.js:19-21,67-70` — budget = sum of declared `_data.uncompressedSize` (attacker-controlled), confirmed.
  - `server/services/pptx-import/importer.js:11-17` — guard runs, then `runParserWorker` parses the SAME file with no inflation bound passed.
  - `server/services/pptx-import/worker-runner.js:64-69` — `fork(workerPath, ...)` with no `--max-old-space-size` in execArgv; `buildParserExecArgv` only strips `--watch`.
  - `server/services/pptx-import/media.js:122,131` — `entry.async('nodebuffer')` materializes before size check (the part the plan DOES cover).
- **Suggested fix:** (a) Add a real per-entry streaming inflation measurement using JSZip's `nodeStream` with a byte counter that aborts on per-entry + cumulative cap, replacing the declared-size sum. (b) Cap the parser worker heap: add `--max-old-space-size=<N>` to `buildParserExecArgv`, so a parse-bomb kills the worker (already SIGKILL-handled) instead of the host. (c) Add a C4 test for an XML-part bomb, not just a media bomb.

---

## Finding 4: SSRF "resolve-then-pin" is not wired to fetch — DNS rebinding stays open
- **Severity:** High
- **Location:** Phase 3 covers it via... actually Phase 2, "I-R5.5 — SSRF" ("resolve-then-pin (connect to the resolved IP, or re-validate after resolution)").
- **Flaw:** The plan offers two alternatives joined by "or": (a) pin the resolved IP, or (b) "re-validate after resolution". Option (b) does NOT close rebinding — it is exactly the current TOCTOU. And the current call site cannot pin without rework: `assertSafeAiEndpoint` returns a URL STRING; `callCustom` then does `new URL(safeEndpoint)`, rewrites the pathname, and `fetch(url)` — Node's fetch re-resolves DNS at connect time. There is no mechanism passed to fetch to force the validated IP. Pinning requires a custom `dispatcher`/`lookup` (undici Agent), which the plan does not mention. Without that, the "fix" is cosmetic.
- **Failure scenario:** Attacker sets a custom AI endpoint `http://rebind.attacker.tld`. Guard resolves it → public IP, passes. fetch re-resolves milliseconds later → attacker's DNS now returns `169.254.169.254` (cloud metadata) or `127.0.0.1`. Server fetches internal resource. `redirect:'manual'` (ai-provider.js:79) does nothing against rebinding.
- **Evidence (file:line):**
  - `server/services/ai-endpoint-guard.js:47-50` `resolveHost` uses `dns.lookup` for validation only; the resolved address is discarded (function returns the URL string at :83).
  - `server/services/ai-provider.js:70-77` — `assertSafeAiEndpoint` returns string → `new URL` → `fetch(url)` re-resolves; no `dispatcher`/pinned `lookup`.
  - `server/services/ai-endpoint-guard.js:66` — allowlist hosts `return parsed.toString()` BEFORE any IP check (confirms plan's "allowlist bypasses IP checks" — but note an allowlisted host that later rebinds is also unprotected).
- **Suggested fix:** Spell out the only correct option: resolve to IPs, validate ALL of them, then fetch with a pinned connection — pass an undici `Agent({ connect: { lookup: pinnedLookup } })` (or connect directly to the validated IP with `Host` header) so the connect-time address equals the validated one. Remove the "or re-validate" alternative; it does not close the hole. Also IP-check allowlisted hosts (don't early-return at :66).

---

## Finding 5: C3 severity/exploitability is overstated as written; the only render sink already sanitizes
- **Severity:** Medium (mis-prioritization, not a missed hole — but it drives wasted P0 effort)
- **Location:** Phase 3, "C3 — markdown import XSS"; plan.md Unresolved Q3.
- **Flaw:** Two factual issues with the C3 framing:
  1. The plan (and source report) says the payload `[t](/x"><img src=x onerror=alert(1)>)` "bơm `<img onerror>` vào element.content". But `simpleMarkdownToHtml` HTML-escapes `<`/`>`/`&` at the TOP (lines 75-77) BEFORE the link regex runs (line 110). So `<img>` is already `&lt;img&gt;` by the time links are processed — the injected tag cannot form. The ONLY un-neutralized char in the link path is the unescaped `"`, which can break the `href="..."` attribute and inject a NEW attribute on the `<a>` (e.g. `" onmouseover=...`), not a new tag. The real bug is narrower: attribute injection on the anchor, not arbitrary tag injection.
  2. Q3 ("any consumer rendering content without sanitize?") is answerable now by grep, and the answer is NO for the primary sink: the text renderer runs `sanitizeRichTextHtml(el.content)`, which strips `on*=` event attributes. So even the attribute-injection vector is neutralized at render in the share/export path. C3 is genuine defense-in-depth (persisted dirty HTML) but is NOT a live RCE/XSS through the known sinks.
- **Failure scenario:** Implementer treats C3 as a live P0 XSS, writes a test asserting "no `<img onerror>` persisted" (which already half-holds due to top-of-function escaping), and may conclude the fix works while the actual residual (anchor attribute injection) is untested. Mis-scoped test gives false confidence.
- **Evidence (file:line):**
  - `client/src/utils/markdown-import.js:74-77` — HTML entities escaped first (`<`→`&lt;` etc.), so tag injection in body text is already blocked.
  - `client/src/utils/markdown-import.js:110-116` — link regex interpolates `href` with no `"` escaping → attribute-injection vector (the real, narrower bug).
  - `client/src/utils/url-safety.js:6` — `isSafeHref` returns true for any `/`-prefixed string without content inspection (confirms lax check; allows `/x" onfocus=...`).
  - `shared/src/element-renderers.js:141` — text sink: `${sanitizeRichTextHtml(el.content || '')}`.
  - `shared/src/content-safety.js:14-19` — `stripEventAttributes` removes `on*=` at render → neutralizes the persisted attribute injection in this sink.
- **Suggested fix:** Re-label C3 as "defense-in-depth (attribute injection at import); not exploitable through known render sinks (all run sanitizeRichTextHtml)". Keep the fix (escape `"`/`<`/`>` in href + tighten isSafeHref) but the test must assert the SPECIFIC residual: `href` containing `"` produces no second attribute on the `<a>`. Do not assert "no `<img>`" — that already passes for the wrong reason. Resolve Q3 in the plan NOW (it's grep-answerable) rather than deferring to a Phase 3 scout.

---

## Finding 6: I-R6.1 background gate covers only http(s) refs — data:/relative/protocol-relative src bypass; escape sink correct
- **Severity:** High
- **Location:** Phase 3, "I-R6.1 — background allowlist" ("route src through the SAME allowlist that video/audio use" + "escape the emitted background URL").
- **Flaw:** The video/audio allowlist (`gateExternalMediaUrl`) only acts on refs matching `/^https?:\/\//i` and passes everything else through unchanged. `mapSlideBackground` builds `src` from `slide.fill.value.base64 || slide.fill.value.src`. Routing background `src` through the same gate therefore does NOT gate: `data:` URIs (no size cap on background data, unlike media which caps), protocol-relative `//evil.tld/x`, or relative refs — all bypass the `^https?` test and reach the unescaped emit. The plan's own Risk note even says "allow data: image MIME" — but the cited gate doesn't size-cap data: at all, so a giant base64 background is a separate DoS the plan doesn't bound.
- **Failure scenario:** Imported PPTX sets `slide.fill.value.src = "//attacker.tld/track.png"` (protocol-relative). Gate's `^https?` test fails → passes through → emitted as `data-background-image="//attacker.tld/track.png"` → viewer browser fetches attacker host (SSRF-via-victim / tracking / breakout). Or `src = 'x" onload="...'` style breakout if escape sink is wrong.
- **Evidence (file:line):**
  - `server/services/pptx-import/mapper/map-media.js:8-20` `gateExternalMediaUrl` — only gates `^https?://`; returns ref unchanged otherwise.
  - `server/services/pptx-import/mapper/map-presentation.js:123-130` `mapSlideBackground` — emits `{type:'image', src: image, image}` from `base64 || src` with no gating.
  - `shared/src/htmlGenerator.js:402-404` — `data-background-image="${absoluteSrc(imageSrc)}"` interpolated unescaped → confirms attribute-breakout sink; the plan's "escape the emitted background URL" is the correct mitigation for THIS line.
- **Suggested fix:** Gate background `src` with a function that handles ALL schemes: reject protocol-relative + non-allowlisted http(s) + unknown schemes; allow `data:image/*` only under a size cap (mirror MAX_MEDIA_SIZE); allow same-origin uploads. AND escape the emitted URL at htmlGenerator.js:404 (HTML-attribute-escape, not just absoluteSrc). Test both the scheme-bypass refs and the `"`-breakout ref.

---

## Finding 7: I-R5.1 atomic-swap omits the share-create + single-token-delete paths; explore fork is a full-array write
- **Severity:** Medium
- **Location:** Phase 2, "I-R5.1 — atomic mutations" (lists share.js:50-92,103-119, templates, save-as-template, explore fork, history restore).
- **Flaw:** The plan lists the revoke paths but the lost-update race is broader. `POST /:id/share` (share.js:50-92) does `readShareTokens()` → mutate → `writeShareTokens()` (non-atomic create), and the top-level `DELETE /api/shares/:token` (index.js:131-141) does the same read+delete+write. Two concurrent creates, or a create racing a revoke, drop one write. The explore fork (explore.js:63-76) reads ALL presentations and writes the WHOLE array back — under concurrency this clobbers any other deck write that landed in between (not just a lost fork, but lost edits to unrelated decks). The plan says "swap to withShareTokens" but doesn't note explore fork needs `withPresentations`, a different helper.
- **Failure scenario:** User A forks while User B saves an edit to a different deck. Fork's full-array write (read before B's save) overwrites B's save → B's edit silently lost. Classic last-writer-wins across the whole datastore.
- **Evidence (file:line):**
  - `server/routes/share.js:56-82` — `readShareTokens` + `writeShareTokens`, non-atomic create.
  - `server/index.js:131-141` `DELETE /api/shares/:token` — `readShareTokens`+`writeShareTokens`, not in plan's list.
  - `server/routes/explore.js:63-76` — `readPresentations()` → push → `writePresentations(presentations)` whole-array write.
  - `server/services/storage.js:133,160` — `withPresentations`/`withShareTokens` locked helpers exist; explore must use `withPresentations`, not `withShareTokens`.
- **Suggested fix:** Add `POST /:id/share` and the top-level `DELETE /api/shares/:token` to the atomic-swap list (use `withShareTokens`). Convert explore fork to `withPresentations((p)=>p.push(fork))` so it never reads-then-writes the whole array. Grep success criterion "no route does raw read+write on shared JSON" should explicitly include index.js and explore.js.

---

## Summary by severity

| # | Severity | Finding | Key evidence |
|---|----------|---------|--------------|
| 1 | Critical | C2 guard list misses 6+ serve paths | presentations.js:393,376,353,434,459; github.js:60; share.js:50 |
| 2 | Critical | I-R5.4 "require auth" infeasible — no auth layer | explore.js:45-82; grep: no req.user/session anywhere |
| 3 | Critical | C4 ignores parser-worker/JSZip OOM (XML-part bomb) | pptx-guards.js:50-52; importer.js:11-17; worker-runner.js:64-69 |
| 4 | High | SSRF "re-validate or pin" doesn't pin fetch → rebinding open | ai-endpoint-guard.js:47-50,83; ai-provider.js:70-77 |
| 5 | Medium | C3 overstated; body pre-escaped + sink sanitizes; real bug = anchor attr injection | markdown-import.js:74-77,110-116; element-renderers.js:141; content-safety.js:14-19 |
| 6 | High | I-R6.1 gate only http(s); data:/protocol-relative bypass; escape sink correct | map-media.js:8-20; map-presentation.js:123-130; htmlGenerator.js:402-404 |
| 7 | Medium | I-R5.1 omits share-create + shares DELETE; explore fork = whole-array clobber | share.js:56-82; index.js:131-141; explore.js:63-76 |

## Unresolved questions for the planner
1. Is the multi-user deploy expected to put auth in the proxy (so the app stays identity-less), or must the app grow a real identity layer? This blocks I-R5.4 (Finding 2) and changes Finding 1's "refuse fork of trashed" semantics.
2. Will C4's test corpus include a non-media XML-part bomb, or only the media-inflation case? (Finding 3 — without it the dominant vector is untested.)
3. Does the team accept the undici-Agent/pinned-lookup approach for SSRF, or is the AI custom-endpoint feature low-value enough to disable under multi-user instead? (Finding 4.)
