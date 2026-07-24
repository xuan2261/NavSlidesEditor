---
phase: 3
title: "Untrusted Import Hardening"
status: complete
priority: P1
effort: "2d"
dependencies: []
---

# Phase 3: Untrusted Import Hardening

## Overview
Imported PPTX archives and pasted markdown cross the trust boundary (unlike author
HTML). Close the origin-XSS via markdown import, the zip-bomb budget bypass, and
the media/background gates that let untrusted archive content fetch remote hosts
or exhaust memory.

## Findings Covered
- **C3** (Critical) — XSS at origin via markdown import (href unescaped + lax `isSafeHref`).
- **C4** (Critical) — zip-bomb budget bypass (trusts archive-declared `uncompressedSize`; materializes buffer before guard).
- **I-R6.1** — slide background `src` not gated by allowlist; emitted unescaped.
- **I-R6.2** — media inflate before size check (part of C4 vector).
- **I-R6.3** — worker fork resolves via NODE_PATH + unconditional `ELECTRON_RUN_AS_NODE`.
- **M-R6×4** — IDOR job routes; dead/redundant href post-process; `runImport` fire-and-forget; `vMerge/hMerge` cell-merge semantics.

## Requirements
- Functional: importing a malicious markdown/PPTX cannot persist executable HTML,
  cannot fetch remote hosts via background/media, cannot OOM the process.
- Non-functional: legitimate imports keep fidelity; guards stream-measure real
  inflation, not declared size.

## Architecture

### C3 — markdown import XSS
- `client/src/utils/markdown-import.js:110-116`: escape `"` (and `<`,`>`) in href
  before interpolation into `<a href="...">`.
- `client/src/utils/url-safety.js:3` `isSafeHref`: stop returning `true` blindly
  for `/ # ./ ..` prefixes; validate the full string for embedded quotes/markup.
- Sanitize at import time so persisted `element.content` is clean (defense at source).
- **Scout must confirm** (open Q3): is there any consumer rendering `element.content`
  without `sanitizeRichTextHtml`? If yes → severity confirmed exploitable; if no →
  still fix (defense-in-depth) but note non-exploitable.

### C4 + I-R6.2 — zip-bomb
- `server/services/pptx-import/pptx-guards.js:19-21,67-70`: do not trust
  `_data.uncompressedSize`; measure actual inflated bytes via streaming with a
  hard per-entry cap AND a cumulative cap.
- `server/services/pptx-import/media.js:97-99,131-134`: check size BEFORE
  `entry.async('nodebuffer')` materializes; stream + abort on cap breach.

### I-R6.1 — background allowlist
- `server/services/pptx-import/mapper/map-presentation.js:123-130`: route
  `slide.fill.value.src` through the SAME allowlist that video/audio use.
- `shared/src/htmlGenerator.js:402-404`: escape the emitted background URL.

### I-R6.3 — worker isolation
- `server/services/pptx-import/worker-runner.js:17-34`: scope NODE_PATH; gate
  `ELECTRON_RUN_AS_NODE` (only when actually under Electron). Env is not
  request-derived → lower urgency but tighten.

### Mediums
- IDOR job routes: scope jobs to owner/session (`pptx-import-job-manager` +
  `routes/pptx-import.js:112-137`); UUIDv4 hard-to-guess keeps it Medium.
- Remove dead href post-process in `sanitize.js:37-50` (redundant after DOMPurify).
- `runImport` fire-and-forget: ensure async errors surface (cleanup `finally` is OK;
  add rejection handling/logging). Verify temp cleanup.
- Verify `vMerge===0||hMerge===0` merge logic (`map-table.js:100`) against a
  pptxtojson 2.0.2 fixture (open Q4).

## Related Code Files
- Modify: `client/src/utils/markdown-import.js`, `client/src/utils/url-safety.js`
- Modify: `server/services/pptx-import/pptx-guards.js`, `media.js`, `mapper/map-presentation.js`, `worker-runner.js`, `sanitize.js`, `map-table.js`, `pptx-import-job-manager.js`
- Modify: `server/routes/pptx-import.js`, `shared/src/htmlGenerator.js`
- Create: `client/src/utils/markdown-import-xss.test.js`, `server/services/pptx-import/zip-bomb-guard.test.js`, `server/services/pptx-import/background-allowlist.test.js`
- Reference (read): `client/src/components/properties/import-fidelity-properties.test.jsx`, `pptx-import/generated-fixtures.test.js`, `geometry.test.js`

## TDD — Tests First
1. **C3**: import `[t](/x"><img src=x onerror=alert(1)>)` → persisted content has
   NO `<img onerror>`, href attribute properly escaped (red today).
2. **C4**: craft a small archive declaring tiny `uncompressedSize` but inflating
   large → guard aborts based on measured bytes, not declared (red today).
3. **I-R6.1**: background `src` to a non-allowlisted host → rejected/sanitized;
   emitted URL escaped.
4. **M-merge**: table fixture with vMerge/hMerge → cells merge as expected.

## Implementation Steps
1. Scout: confirm Q3 (content sanitize consumers) + Q4 (merge semantics fixture).
2. Write failing tests 1–4.
3. C3 escape + isSafeHref tighten → test 1 green.
4. C4 stream-measure + media pre-check → test 2 green.
5. I-R6.1 background gate + escape → test 3 green.
6. I-R6.3 worker tighten; Mediums (IDOR scope, dead-code removal, async errors, merge) → test 4 + grep clean.

## Success Criteria
- [x] Tests 1–4 green.
- [x] No import path interpolates an unescaped untrusted URL/href.
- [x] Inflation guard measured-based; cumulative cap enforced.
- [x] `npm run test:corpus` still green (no fidelity regression).

## Red-Team Amendments (2026-06-11)

- **C3 is defense-in-depth, NOT live XSS (Medium, relabel).** Body is
  HTML-escaped at `markdown-import.js:74-77` BEFORE the link regex (`:110`), so
  `<img>` tag injection can't form. The only render sink
  (`element-renderers.js:141`) runs `sanitizeRichTextHtml`, which strips `on*=`
  (`content-safety.js:14-19`). **Q3 is answered now:** the sink DOES sanitize →
  not exploitable end-to-end. Real residual bug is narrower: unescaped `"` in the
  anchor href attribute. **Rewrite test 1** to assert the specific `"`-attribute
  residual is escaped (not "no `<img>`", which already holds). Keep the fix
  (still worth closing) but downgrade severity and stop claiming live XSS.

- **C4 misses the dominant OOM vector (Critical).** The plan fixes `media.js` +
  declared-size, but the bigger bomb is XML parts, not media:
  `pptx-guards.js:50-52` does `fs.readFile` + `JSZip.loadAsync(whole file)` BEFORE
  any measurement, and `worker-runner.js:64-69` forks the parser with NO
  `--max-old-space-size`. **Required additions:** (a) stream/measure per-entry
  inflation before full load where feasible; (b) cap the worker heap
  (`--max-old-space-size`) so a parser OOM kills the worker, not the host;
  (c) add an XML-part-bomb test (highly compressible XML entry), not only a media bomb.

- **I-R6.1 background gate only covers http(s) (High).** `gateExternalMediaUrl`
  (`map-media.js:8-20`) only acts on `^https?://`. `data:`, protocol-relative
  `//evil.tld`, and relative refs bypass. **Required:** gate ALL schemes;
  size-cap `data:` backgrounds; escape the emit sink (`htmlGenerator.js:404`).

- **I-R6.3 is stale (drop or downgrade).** `ELECTRON_RUN_AS_NODE` is already
  conditionally gated at `worker-runner.js:29` (not "unconditional"); NODE_PATH is
  deduped. The premise is outdated → a test on it goes green immediately. Verify
  current state first; only tighten if a real gap remains.


  allow safe relative forms but reject embedded quotes/`<`/`>`; test both.
- **Risk:** stream-measuring inflation slows large legit imports. *Mitigation:*
  cap is generous; abort only on breach; benchmark a real 50-slide deck.
- **Risk:** background allowlist rejects data: URIs used legitimately by import.
  *Mitigation:* allow `data:` image MIME with size cap, same as media path.
