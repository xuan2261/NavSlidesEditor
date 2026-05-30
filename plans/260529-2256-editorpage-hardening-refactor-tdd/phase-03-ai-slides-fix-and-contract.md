---
phase: 3
title: "AI Slides Fix And Contract"
status: pending
priority: P1
effort: "1-1.5d"
dependencies: [2]
---

# Phase 3: AI Slides Fix And Contract

> **Red Team #8 (High), #9 (High), #15-part (Medium) — applied.** (#8) The current inline builder interpolates `item.title`/bullets RAW into `<h1>/<h2>/<li>` (`EditorPage.jsx:1791-1792`) with NO escaping, while the server escapes every field (`ai.js:177,184,189`). `outline` is user-controllable via the AIGenerator "Edit JSON" textarea (`AIGeneratorModal.jsx:54,61,187-192`). The builder is currently defanged ONLY by an undocumented downstream render-sink invariant. The original "byte-identical output" criterion would CODIFY the unescaped output as the contract and block hardening. (#9) The `data.elementSlides ?? builder` fallback feeds future server-supplied element objects straight into `element.content`; the `html`/`code`/`svg` sinks render in a scripts-enabled same-origin iframe (`canvas-element-wrapper.jsx:196`) / unsanitized `hljs` (`:197`) — a typedef-only contract is an unvalidated trust path. (#15) The server route is the only correct escaped exemplar; its escaping must be ported into the builder BEFORE Phase 7 deletes the route.

## Overview

Stop the useless `/api/ai/generate-slides` round-trip in `onCreatePresentation` and build slides client-side from the already-available `outline`, **escaping every interpolated field** (matching the server's existing escaping). Seed the roadmap by defining a single shared **slide-element contract** with **runtime validation** (not a bare typedef) so a future real AI-layout server can return usable element-based slides without opening an XSS hole in the client.

## Requirements

- Functional: AI Generator produces slides instantly from `outline`; no network call for the build step. Output equivalent to the current rendered result BUT with all interpolated text escaped (title/bullets/content) like the server already does.
- Non-functional: extract slide-building into a tested pure function; define a versioned, runtime-validated contract for future server payloads (schema check + element-`type` allowlist + content sanitization).
- Security: no user/AI-supplied string reaches HTML output unescaped; no server-supplied element bypasses sanitization or the safe-`type` allowlist.

## Architecture

- Current flow (`EditorPage.jsx:1767-1808`): POST outline → server maps to `<section>` strings (`server/routes/ai.js:168-209`, escaped, no AI) → client ignores `data.slides`, rebuilds from `outline` UNESCAPED.
- New flow: pure `buildSlidesFromOutline(outline)` returns element-based slides (matching `ELEMENT_DEFAULTS.text` shape), with each interpolated field escaped. **Port the server's escaping** (`escapeHtml` at `ai.js:177` / the shared `escapePlainText` exported from `shared/src/content-safety.js` — grep-confirm the exact exported name during implementation) into the builder so the escaping behavior lives client-side independent of the (now-deprecated, kept) server route. No fetch.
- **Roadmap seed (contract, runtime-validated):** add `shared/src/types/ai-slide-contract.js` defining `AiSlideElement` / `AiGeneratedSlide` (element-based, versioned `contractVersion`) AND a small runtime validator `validateAiSlides(payload)` that: (a) checks `contractVersion`, (b) **allowlists element `type` to a safe set EXCLUDING `html`/`code`/`svg`** (the unsanitized sinks), (c) passes every `content` through the client sanitizer before it reaches state. Client consumes via `data.elementSlides ?? buildSlidesFromOutline(outline)` ONLY after `validateAiSlides` accepts it — a future AI server populating `elementSlides` needs zero client change BUT cannot inject executable content. **No new endpoint built this round.**
- **Verified caller map (consistency sweep):** two paths hit `/api/ai/generate-slides` — (a) the inline `fetch` in `EditorPage.jsx:1769`, and (b) `aiGenerateSlides()` wrapper in `client/src/utils/ai.js:34`. Grep confirms **(b) is dead** — never imported anywhere (only `aiRewrite`/`aiGenerateOutline`/`aiTranslate`/`testAIConnection` are consumed). So after this phase removes (a) and deletes the dead wrapper (b), the server route has ZERO in-repo callers. (Note for Phase 7: the route is an HTTP endpoint reachable by any external client — grep proves no in-repo caller, not that no external integration exists.)
- Action this phase: remove inline fetch (a); delete dead `aiGenerateSlides` wrapper (b) + any test referencing it. Annotate the server route as caller-less in-repo. <!-- Updated: Validation Session 1 — route deprecated, not removed in Phase 7 -->Phase 7 ANNOTATES this route as deprecated/caller-less (it does NOT delete it — Validation Session 1 LOCKED; hard deletion deferred to a future release since the self-hostable app may have external HTTP callers grep cannot see).

## Related Code Files

- Create: `client/src/utils/build-slides-from-outline.js` (pure, < 80 LOC; escapes every interpolated field)
- Create: `client/src/utils/build-slides-from-outline.test.js`
- Create: `shared/src/types/ai-slide-contract.js` (JSDoc typedefs + `contractVersion` + runtime `validateAiSlides(payload)`: schema check + safe-`type` allowlist excluding `html`/`code`/`svg` + content sanitization)
- Create: `shared/src/types/ai-slide-contract.test.js` (validator: rejects bad `contractVersion`, strips/rejects `html`/`code`/`svg` element types, sanitizes content)
- Modify: `client/src/pages/EditorPage.jsx` — `onCreatePresentation` (`:1767-1808`): drop `fetch`, call builder, gate any `data.elementSlides` through `validateAiSlides`, fix the wrong `unused-vars` comment (`:1777`).
- Modify: `client/src/utils/ai.js` — delete dead `aiGenerateSlides` wrapper (`:34-45`); remove any referencing test.
- Read for context: `server/routes/ai.js` (`:168-209`, the escaped exemplar — port its `escapeHtml`), `shared/src/content-safety.js` (grep the exact exported escape/sanitize fn name), `client/src/utils/content-safety.js`, `client/src/components/canvas/canvas-element-wrapper.jsx` (`:161` text sink vs `:196-197` html/code sinks — why the allowlist excludes those types), `client/src/data/element-defaults.js`, `client/src/components/AIGeneratorModal.jsx` (`:54,61,187-192` user-controllable outline)

## Implementation Steps

1. **RED**: write `build-slides-from-outline.test.js` — given an outline (title layout w/ bullets, content layout, custom), expect element-based slides: each slide has `id`, `elements:[{id,type:'text',x,y,width,height,zIndex,content}]`, `notes` from `item.notes ?? item.speakerNotes`; title layout centers h1+bullets; content layout uses h2+ul. **Add a security case: an outline field containing `<img src=x onerror=...>` / `<script>` must appear ESCAPED in the produced `content` (e.g. `&lt;script&gt;`), not raw.** Test currently fails (function absent).
2. **GREEN**: implement `buildSlidesFromOutline` extracting the inline logic from `:1778-1796`, but wrap every interpolated field (`item.title`, each `bp`, content) in the ported escape fn (match the server's `escapeHtml`/shared `escapePlainText`). Output is the ESCAPED equivalent of the current render — deliberately NOT byte-identical to the old unescaped inline output.
3. Refactor `onCreatePresentation`: remove `fetch`/`await res.json()`/`if (data.slides)`; `const newSlides = data?.elementSlides ? validateAiSlides(data.elementSlides) : buildSlidesFromOutline(outline)` (validator returns sanitized slides or throws → caught by existing try/catch → `alert`); keep the `try/catch` + `alert` on failure; fix comment at `:1777`. Note the deliberate error-path change: slides are now always built locally on the happy path (no fetch failure branch).
4. Add `ai-slide-contract.js` typedefs + `validateAiSlides`; reference the typedef in the builder's JSDoc and in `onCreatePresentation`.
5. Delete dead `aiGenerateSlides` wrapper in `utils/ai.js`; grep-confirm no import remains; annotate server route as caller-less in-repo (comment explains the why: contract-based client builder superseded it — not finding-coded).
6. Run Phase 1 suite + new unit tests → GREEN. Confirm the Phase 1 `onCreatePresentation` characterization test (raw-`fetch` lock) now asserts NO fetch fires — this is the deliberate, test-visible behavior change.

## Success Criteria

- [ ] `buildSlidesFromOutline` unit-tested (title/content/custom/empty-bullets/notes-fallback **+ escaping of `<script>`/`onerror` payloads**), all green.
- [ ] `onCreatePresentation` makes NO network call; slides built locally; comment at `:1777` corrected.
- [ ] Every interpolated outline field is HTML-escaped in the produced `content` (matches server escaping behavior); a script/`onerror` payload in `outline` does NOT survive as executable HTML.
- [ ] `ai-slide-contract.js` defines a versioned element-based payload AND `validateAiSlides` enforces schema + safe-`type` allowlist (no `html`/`code`/`svg`) + content sanitization; client uses `elementSlides`-validated `?? builder` fallback.
- [ ] Generated slide HTML is the ESCAPED equivalent of pre-change output (NOT byte-identical — escaping is the intended diff); snapshot the escaped output as the new contract.
- [ ] Phase 1 characterization suite stays GREEN (with the deliberate `onCreatePresentation` no-fetch change reflected).

## Risk Assessment

- **Risk (High, now mitigated):** Freezing unescaped output as the contract blocks future hardening. **Mitigation:** "byte-identical" criterion dropped; builder escapes fields and snapshots the escaped output.
- **Risk (High, now mitigated):** `elementSlides` fallback is an unvalidated server→content trust path into scripts-enabled sinks. **Mitigation:** `validateAiSlides` runtime gate — schema + safe-`type` allowlist + sanitization; future endpoint cannot inject `html`/`code`/`svg`.
- **Risk:** Removing the route breaks an unknown caller. **Mitigation:** do NOT delete — only annotate as deprecated/caller-less (Validation Session 1 LOCKED; the route stays, hard deletion deferred to a future release). The route's escaping is ported into the builder first so nothing is lost when internal use stops.
- **Risk:** Over-engineering the contract (YAGNI). **Mitigation:** contract is one small typedef file + a focused `validateAiSlides` (schema + allowlist + sanitize) + a `??` fallback — no endpoint, no provider wiring. The validator is load-bearing security, not speculative generality.
