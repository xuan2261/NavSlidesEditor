# PPTX Import — End-to-End Review + Applied Fixes

Date: 2026-07-26
Branch: `feature/pptx-import-reliability-ux-evidence-hardening` @ `8fe2c4ac` (uncommitted working tree)
Scope agreed with user: whole feature end-to-end, committed + uncommitted together; verify the
active plan's "Completed" claims against source.

Plan under audit: `plans/260726-0616-pptx-import-reliability-ux-evidence-hardening-deep-tdd/plan.md`
(`status: completed`, 11/11 phases Completed, 13/13 global success criteria `[x]`).

**Status.** Pass 1 was report-only. The user then approved **"All findings incl. P3s"** (excluding the
200-LOC refactor) and **"auto-reclaim on proven owner absence"** as the lock policy. All approved fixes
are implemented, and each is individually verified — see [Fixes applied](#fixes-applied).

**Not yet done:** the full-suite release gate. The first attempt was invalidated because I launched it
against a tree I was still editing; a clean run is in flight. Nothing is committed. Until that run is
green this work is *implemented and individually verified*, **not** *shipped*.

Review ran under `--advice` (`kongming` advisory supervision). Its two severity corrections were
**re-verified against source before being accepted**, not taken at face value; both are recorded below.

---

## Baseline health (measured, not claimed)

| Check | Result |
|---|---|
| Full unit suite, pre-fix (`npm run test`, minus the pre-excluded autosave characterization file) | **513 files passed / 1 skipped; 4136 tests passed / 3 skipped; exit 0**; 1198s |
| Focused PPTX suite, pre-fix (7 files) | 145 passed |
| ESLint over PPTX surface | clean, exit 0 |

The test baseline was genuinely green. No finding below was found by a failing test — all were found
by reading code and then reproduced.

**Caveat on comparing before/after totals.** The pre-fix baseline ran *minus the pre-excluded autosave
characterization file* (513 files / 4136 tests); a plain `npx vitest run` collects 519 files / 4174.
The two numbers are **not** apples-to-apples, so the gate is "zero failures", not "matches the baseline
count".

---

## Findings, ranked

### P0 — Ungraceful stop permanently bricks the entire server (not just PPTX import) — **FIXED**

**What.** `PackageStore` takes an exclusive on-disk writer lock at boot. It was only ever released by
an explicit graceful shutdown, and **no reachable code path performed one**. Any other termination
orphaned the lock, and the next boot died before the HTTP listener was created.

Chain:
- `server/index.js` — `startServer()` does `await initializePackageStore(...)` **before** `http.createServer`.
- `package-store-runtime.js:40` — `store.acquireWriter()`.
- `writer-lock.js` — `writeDurable(lockPath, ..., { flag: 'wx' })` → `EEXIST` → throws
  `Package store writer lock is held; stale reclaim requires proven owner absence`.
- Release only via `shutdownPackageStore()` → reachable only from `server.once('close')` and `server.once('error')`.
- **`server.close()` was never called anywhere in `server/`.** Grep for
  `process.on('SIGINT'|'SIGTERM'|'exit'|'uncaughtException')` across `server/` and `electron/` returned **zero** handlers.
- `storage.js:108-122` stale-file sweep matches only `/\.tmp\.(\d+)\.\d+$/` — it does not touch `writer.lock`.
- The lock record stored `host` and `pid` but **nothing ever read them**, so the "proven owner absence"
  the error message demanded was never computed.

**Evidence — reproduced end-to-end against the real server on an isolated `SLIDES_DATA_DIR`:**

```
[boot1] started: true      → "Server running on http://localhost:3099"
[boot1] writer.lock present while running: true
[kill ] SIGKILL (ungraceful, no server.close())
[kill ] writer.lock left behind: true
[boot2] started: false | exitCode: 1
        Server failed to start Error: Package store writer lock is held; stale reclaim requires proven owner absence
            at WriterLock.acquire (writer-lock.js:36:15)
            at async PackageStore.acquireWriter (package-store/index.js:37:20)
            at async package-store-runtime.js:40:7
            at async startServer (server/index.js:331:3)
```

**Impact.** Ctrl+C, `taskkill`, an OOM kill, a crash, or power loss left the app **unbootable**, with an
opaque error and an undocumented fix (delete `server/data/writer.lock`). Whole-application
availability, not a degraded import feature. The Electron desktop path was also exposed:
`before-quit` called `serverInstance.close()` synchronously and un-awaited, and `server.close()` does
not emit `close` while the app's own Socket.IO connections are live — so the release very likely never
ran there either.

**Caveat, stated honestly.** How often the user's real workflow hit this is undetermined.
`fencing-epoch.json` read `epoch: 561`, showing many completed acquire/release cycles — but under
`NODE_ENV=test` `withPackageStore()` acquires and releases per call, so most of those 561 are
plausibly test runs, not server boots. The mechanism is proven regardless.

---

### P1 — `state-root.json` grows without bound; every publish rewrites the whole chain — **FIXED**

**What.** `state-store.js` set `predecessor: this.root` on each publish, embedding the entire previous
root object — which embedded *its* predecessor, and so on. `schemas.js:112 validateStateRoot` did not
bound or strip it. Every `mutate()` re-serialized and fsynced the full chain.

**Evidence — measured on an isolated store:**

```
 publishes | state-root.json bytes | nesting depth
         1 |                   302 |             0
        10 |                  2985 |             9
       100 |                 29896 |            99
       200 |                 59896 |           199
avg 299 B per publish; extrapolated 10k publishes ≈ 3.0 MB rewritten+fsynced on every subsequent publish
```

Perfectly linear: O(N) cost per write, O(N²) cumulative, unbounded file. Boot also `JSON.parse`d the
whole chain.

**Why it was nearly all dead weight.** `recover()` consulted exactly **one** predecessor level — there
was no loop. Depth ≥2 only mattered across repeated consecutive corruption events on successive boots.

**Note vs. the plan.** Phase 6 acknowledges "physical compaction not enabled" — but that residual is
about blob/job retention. The predecessor chain was a **separate, unmentioned** growth vector, and
`retention-dry-run.js` does not address it.

---

### P1 — `import-report.js` contained raw control bytes: unreviewable diff + a booby-trapped regex — **FIXED**

**What.** Three raw control bytes (`0x00`, `0x1f`, `0x7f` at byte offsets 842/844/845) written literally
inside a regex character class instead of as escapes. Verified codepoints of the class: `[91, 0, 45, 31, 127, 93]`.

Two distinct consequences:

1. **Git treated the file as binary** — `Bin 7227 -> 8763 bytes`. It had *no reviewable diff*. A
   security-relevant sanitizer changed in this branch could not be code-reviewed at all.
2. **The line rendered as `.replace(/[ -]/g, ' ')`.** Anyone "fixing that obvious typo" silently
   destroys control-character stripping, with no test naming the invariant and no visible diff to
   catch it. A trap for the next maintainer, not a cosmetic issue.

The file was valid JavaScript and functioned correctly — a reviewability and maintenance-safety
defect, not a runtime bug.

**Control-byte sweep across the repo:** 4 of 1292 tracked JS/JSX files contained raw control bytes.
Only `import-report.js` was production code (**now 0**). The other three are deliberate test fixtures
and were left alone: `text-ooxml-adapter.test.js:67`, `tiptap-single-plain-run-eligibility.test.js:49`,
`tests/e2e/critical-pptx-journey.spec.js:99`.

---

### P2 — `sanitizeDiagnostic` leaked control characters on the widest untrusted path — **FIXED**

*Raised by `kongming`, then independently confirmed with a repro before acceptance.*

**What.** `diagnostics.js:13 sanitizeDiagnostic` stripped XML tags, long base64 runs, and emails — but
began `String(raw)` with **no control-character stripping**. It is the sanitizer that untrusted parser
output, worker stderr/stdout, and thrown error messages actually flow through, and it is by far the
most widely used one on the import surface:

- `routes/pptx-import.js` — **8 call sites** (`:95`, `:127`, `:290`, `:526`, `:633`, `:668`, `:684`, plus the import at `:7`)
- `worker-runner.js` — **10 call sites** carrying raw child-process `stderr || stdout` (`:135`, `:147`, `:171`, `:172`, `:179`, `:189`, `:190`, `:202`, `:216`, `:217`)
- also `importer.js:77`, `parse-worker.js:62`, `pptx-import-qualification{,-source}.js`, the fidelity tester

Repro codepoints surviving the old implementation: `[27, 27, 7, 0, 27, 7, 127]`.

**Why this is the live one.** Worker `stderr` is attacker-influenced by construction — it carries text
derived from the uploaded PPTX — and lands in operator logs and API error bodies.

---

### P2 — `error-handler.js` was a global unsanitized sink — **FIXED**

The app-wide Express error handler logged `err.message` straight to `console.error` and echoed it into
the JSON response, for **every route**, not just import. Same class as above with a wider blast radius.

---

### P3 — `import-report.js sanitizeMessage` asymmetry — **FIXED** *(downgraded from P2)*

**What.** In the same file, `safeType()` stripped control chars; `sanitizeMessage()` only did
`.replace(/\s+/g, ' ')`. JS `\s` excludes `\x00-\x08`, `\x0e-\x1f`, `\x7f`.

```
input           : "parse failed\x00NUL\x1b[31mANSI\x07BEL\x7fDEL\bBS"
sanitizeMessage : "parse failed\x00NUL\x1b[31mANSI\x07BEL\x7fDEL\bBS"
LEAKS CONTROL   : true
```

**Downgraded to P3 on verified containment.** `kongming` argued this is contained; I traced it rather
than accept the claim, and the trace holds:

- `import-report.js:238 toEditorImportReport` projects each diagnostic to `{type, slideIndex}` only — **`message` is dropped**.
- `import-report.js:163 toReportSummary` drops `diagnostics` entirely.
- Every route consuming the report uses one of those two projections.
- `stripAuthority` has no consumer outside `dto.js`.

So `sanitizeMessage` output reaches **disk and logs**, never a client surface. Real but hygiene-only —
which is why the sibling `sanitizeDiagnostic` (above), not this one, is the P2.

**Precision correction to pass 1.** Pass 1 implied the response body was a raw terminal vector. It is
not: `res.json()` JSON-escapes control characters in transit. The direct injection sink is
`console.error` and any downstream consumer that **prints the parsed string**. Recording the
correction so the weaker claim isn't re-inherited.

---

### P3 — `MEDIA_URL_ALLOWLIST` was a dead, module-load-time snapshot — **FIXED**

`constants.js:35` computed `MEDIA_URL_ALLOWLIST = buildMediaUrlAllowlist()` once at import time and
exported it (line 77). Nothing consumed it — `map-media.js` correctly calls `buildMediaUrlAllowlist()`
fresh each time. A stale-config footgun for the next consumer who reaches for the obvious-looking constant.

---

### P3 — `isPrivateHost` missed IPv4-mapped IPv6 and NAT64 — **FIXED**

`mapper/map-media.js` covered IPv4 private ranges and `::1`/`fc`/`fd`/`fe8x`, but not `::ffff:127.0.0.1`,
`::`, or NAT64 forms. Defense-in-depth: the origin allowlist is **empty by default and exact-match**,
and `gateExternalMediaUrl` blocks private hosts *even when allowlisted* (fail-closed — verified, and
good). Only reachable if an operator allowlists a hostile origin — but see the delta table below; it
was **not** a vacuous fix.

---

### P3 — Project 200-LOC file constraint violated on the import surface — **NOT FIXED (out of approved scope)**

`CLAUDE.md` requires files under 200 LOC. `server/routes/pptx-import.js` is **817**,
`client/src/utils/pptx-job-wait.js` is **458**, `package-store/lifecycle.js` is ~21.8 KB. A
stated-standard deviation, not a defect. The user explicitly excluded this refactor from the fix scope.

---

### Note — same defect class outside the agreed scope (no fix applied)

`routes/sync.js:289` logs raw rclone child-process stderr: `console.error('[rclone]', args[0], stderr || err.message)`.
The surrounding code is deliberate and correct about the *client* boundary — it rejects with a generic
error so raw stderr never reaches the HTTP response, and says so in a comment. The residual is only
that unsanitized child-process bytes still reach the **operator's terminal**.

Risk framing, honestly: rclone is operator-configured and its stderr echoes paths and remote names,
not uploaded-document content — so this is materially weaker than the PPTX worker-stderr path, which
carries attacker-supplied text by construction. It is out of the agreed PPTX-import scope and was
**not** changed. Flagging it so the newly-added `stripControlChars` helper is a known option if you
want the same treatment applied there.

Scope check performed: across the whole import request path (`routes/pptx-import.js`, `worker-runner.js`,
`importer.js`, `parse-worker.js`) there is **no** raw `console.*` of worker `stdout`/`stderr` — every
such log routes through `sanitizeDiagnostic`. The remaining `console.*` calls under
`services/pptx-import/` are all operator-run CLI tooling (`pptx-import-corpus-cli.js`,
`pptx-import-adversarial-suite.js`, `oracle/pptx-oracle-cli.js`, the fidelity tester), not the request path.

---

### Note — duplicate weaker XML guard (DRY/fragility, no fix applied)

`opc-relationship-parser.js:16` carries its own XML entity/DTD guard, weaker than the canonical one in
`pptx-guards.js:143-158`. **Refuted for the primary import path**, which routes through the strong
guard. Flagged only as a fragility risk for the secondary consumers
`native-reimport-validator.js` / `native-reimport-workspace.js`, where the weaker copy is what runs.

---

## Plan claim audit

| Claim | Verdict | Basis |
|---|---|---|
| EMF/WMF converter hash-pinned, realpath-contained, symlink/hardlink-rejecting, fail-closed | **Verified true** | `emf-wmf-sandbox.js`: SHA256 pin, `fs.realpathSync.native`, `nlink > 1` reject, `path.relative` containment, `allowBareName` escape hatch removed |
| External media origins fail-closed, exact-origin, no default localhost trust | **Verified true** | `constants.js addOrigin`; empty default; private hosts blocked even if allowlisted |
| List isolation — a missing-head row cannot make healthy rows unavailable | **Verified true** | `presentations.js:128` quarantine collection; `:147` `X-Presentations-Quarantined-Count`; healthy rows still a bare array |
| Retention dry-run default-off, non-destructive, physical compaction not enabled | **Verified true** | `retention-dry-run.js`: `destructiveEnabled: false`, no mutation of StateStore/WAL |
| Durable rollback authority exists | **Verified true** | `import-commit.js:244 rollbackImport` asserts writer, marks `cancellationPoint: 'rolled-back'` |
| Import report survives reload (server-owned, client PUT strips) | **Verified true (structurally)** | `_pptxImportReport` allowlisted in `authority-sanitizer.js`/`dto.js`; rendered by `pptx-import-report-panel.jsx` |
| Parser worker isolation — heap cap, env allowlist, kill escalation | **Verified true** | `worker-runner.js`: `--max-old-space-size` forced, `NODE_OPTIONS` deliberately omitted, SIGTERM→SIGKILL with unref'd timer, ack timeout |
| `state-store.js mutate()` atomicity | **Verified true (resolved)** | Compute-then-commit; `package-store/index.js:76-106`. An earlier concern that a partial mutation could publish is refuted. |
| Crash-safe durable publish (WAL prepare → root swap → completed) | **True in structure, weaker on Windows** | Protocol is sound and fencing is re-asserted before the root swap. But `durable-fs.js:14` returns `{supported:false}` for directory fsync on win32, so rename durability after power loss is not guaranteed on the primary platform. Honest platform limit, not a coding error. |
| Phase 5: report "sanitized at the server boundary" (line 38); "Never render raw HTML or unsanitized paths/stderr" (line 60) | **Was literally false when written** | Neither `sanitizeMessage` nor `sanitizeDiagnostic` stripped control characters at the time the phase was marked Completed. Both do now. |
| "11/11 decks pass, semantic 100.0%, roundtrip 63.0%" | **Not verified** | Requires a corpus run; out of scope this pass. The plan itself already flags the strict-qualification figures ("5/11 pass, 378 unmapped leaves") as inherited and unverified. |

Net: the security and contract claims that could be checked held up under source inspection. The gap
was not in what the plan claims — it was in the **operational lifecycle around** the package store
(P0, P1), which no phase claimed and no test covered, plus the sanitization claim above that no test
enforced.

---

## Fixes applied

Ten fixes and six new test files. Each verified empirically, not just by reading.

| # | Fix | Files |
|---|---|---|
| 1 | Writer-lock auto-reclaim on **proven** owner absence + fencing-epoch bump | `package-store/writer-lock.js` |
| 2 | `SIGINT`/`SIGTERM` handlers + exported `stopServer`; Electron `before-quit` awaits it | `server/index.js`, `electron/main.js` |
| 3 | Predecessor chain bounded to depth 3; recovery walks the retained chain | `package-store/state-store.js` |
| 4 | Control bytes → textual escapes; single shared sanitizer | `utils/strip-control-chars.js` (new), `import-report.js` |
| 5 | `sanitizeDiagnostic` strips control chars first | `pptx-import/diagnostics.js` |
| 6 | Global error handler sanitizes before log and response | `middleware/error-handler.js` |
| 7 | Dead `MEDIA_URL_ALLOWLIST` export deleted | `pptx-import/constants.js` |
| 8 | IPv4-mapped IPv6, `::`, and NAT64 blocked | `mapper/map-media.js` |
| 9 | Imported `title` sanitized at the single choke point every import path stamps through | `pptx-import/create-imported-presentation.js` |
| 10 | Package-store release failure logged instead of silently swallowed (3 call sites) | `server/index.js` |

**Fix 9 — why the choke point.** The title enters as multer `originalname` (`routes/pptx-import.js:660`,
attacker-controlled), survives `map-presentation.js:456` (which strips only the `.pptx` extension), and
reaches `routes/github.js:199-205`, where it becomes a **git commit message**. Sanitizing at
`create-imported-presentation.js` covers every import path in one place instead of hardening each sink.
The fallback chain is sanitize-then-fall-through, so a title made entirely of control bytes degrades to
`originalName` and then to `'Imported Presentation'` rather than to an empty string.

**Fix 10 — why it is not cosmetic.** A store that fails to release is *precisely* the condition that
leaves the writer lock held and blocks the next boot — the P0 failure mode. Swallowing it hid the only
signal an operator would get. It logs and continues: a noisy shutdown must not turn an otherwise healthy
stop into a non-zero exit.

### P0 — reclaim proven against the original repro

Same script, same isolated `SLIDES_DATA_DIR`, port 3099:

```
[boot1] started: true → "Server running on http://localhost:3099"
[boot1] writer.lock present while running: true
[kill ] SIGKILL (ungraceful, no server.close())
[kill ] writer.lock left behind: true
[boot2] started: true | exitCode: undefined
[boot2] output : [package-store] reclaimed writer lock abandoned by pid 22428 at 2026-07-26T11:45:06.351Z; fencing epoch 1 -> 2
         Server running on http://localhost:3099
=== VERDICT ===
lock orphaned by ungraceful stop : true
second boot succeeded            : true
```

Reclaim is deliberately narrow — it requires **all** of: same host, an integer pid, and `process.kill(pid, 0)`
raising `ESRCH`. `EPERM` (alive under another user), a foreign host, and an unreadable record all
**refuse** to reclaim. The fencing epoch is what makes this safe by construction: `assertOwned`
compares the on-disk nonce *and* epoch, so a resurrected stale writer is fenced out even if the
liveness probe were ever wrong.

### Graceful shutdown — verified, with an honest platform caveat

`stopServer` releases the lock (`lock released by stopServer: true`, verified in-process on port 3098).
But on Windows, `child.kill('SIGINT')` calls `TerminateProcess` and **JS handlers do not run** →
`lock released after SIGINT: false`. That is Node-on-Windows semantics, not a defect in the handler.
The handler is effective on POSIX/Docker `SIGTERM` and on a real Windows console Ctrl+C; the reclaim
path covers every ungraceful case on every platform. This is why **both** halves were needed —
handlers alone never survive `SIGKILL` or power loss.

### SSRF fix is non-vacuous — 5 of 8 cases were previously reachable

Measured by running the pre-fix `isPrivateHost` verbatim against the post-fix gate:

```
[::ffff:7f00:1]     old-blocked: false  now-blocked: true   FIXED (was reachable)
[::ffff:a00:5]      old-blocked: false  now-blocked: true   FIXED (was reachable)
[::ffff:a9fe:a9fe]  old-blocked: false  now-blocked: true   FIXED (was reachable)   ← 169.254.169.254 cloud metadata
[64:ff9b::7f00:1]   old-blocked: false  now-blocked: true   FIXED (was reachable)
[::]                old-blocked: false  now-blocked: true   FIXED (was reachable)
[::1]               old-blocked: true   now-blocked: true   same
[fd00::1]           old-blocked: true   now-blocked: true   same
[2606:4700::1111]   old-blocked: false  now-blocked: false  same   ← no over-blocking
```

**New empirical fact worth recording:** Node's URL parser **always** normalizes IPv4-mapped IPv6 to
hex — `::ffff:127.0.0.1` arrives at the gate as `::ffff:7f00:1`. So the hex branch is the one that
fires in practice; the dotted branch is defensive only. The code comment says exactly this, because a
comment claiming both forms occur would have been wrong.

### New tests (23, all passing, 9.50s)

| File | Covers |
|---|---|
| `server/utils/strip-control-chars.test.js` | Helper unit tests, plus the invariant asserted **at each sanitizer boundary** (`sanitizeDiagnostic`, `buildBoundedImportReport`) rather than only on the helper |
| `package-store/writer-lock-reclaim.test.js` | Reclaims a dead owner; advances epoch 7→8; refuses a live owner, a foreign host, an unreadable record; uncontested acquire not flagged as reclaim. Uses a spawned-then-exited child for a guaranteed-dead pid |
| `package-store/state-root-bounded-chain.test.js` | Depth ≤3 after 25 publishes; size growth <1 KB over 40 publishes; recovery walks past a broken predecessor |
| `mapper/map-media-private-host.test.js` | 7 `it.each` cases blocked **even when the origin is allowlisted**, plus public-origin-allowed and never-allowlisted cases |
| `create-imported-presentation.test.js` (extended) | Control bytes stripped from a mapped title and from the `originalName` fallback; fall-through when sanitizing leaves nothing |
| `server/index-shutdown-writer-lock.test.js` | Boot → lock present; `stopServer` → lock gone; **second boot still starts** |

**The shutdown test is not vacuous — proven by negative control.** With the release temporarily replaced
by a no-op, it fails (`expected [ Array(1) ] to deeply equal []`); restored, it passes. It exercises
`stopServer` directly rather than signalling a child, because `child.kill()` on Windows calls
`TerminateProcess` and never runs JS handlers — a signal-based test would assert nothing on this
platform. `stopServer` is the shared path for POSIX `SIGTERM`, a real Windows console Ctrl+C, and the
Electron quit, so testing it covers all three.

Test placement note: `map-media-private-host.test.js` is deliberately a **new sibling** rather than an
edit to the user's already-modified `map-media.test.js`, to avoid colliding with uncommitted work.

### Verification status

| Check | Result |
|---|---|
| Focused suite (pptx-import + `routes/pptx-import.test.js` + middleware) | **154 files passed; 1233 passed / 2 skipped**; 459.49s — no regressions |
| New tests (4 files) | **23 passed**; 9.50s |
| `node --check` on all 10 modified/created source files | all ok |
| ESLint on all 14 touched files | **exit 0, zero errors, zero warnings** |
| Server-only suite (`npx vitest run server/`) | **211 files, 1627 passed / 2 skipped, 0 failed** |
| New shutdown + title tests | **6 passed**, plus a passing negative control |
| Full unit suite (the release gate) | **see below — first attempt invalidated, clean run pending** |

#### A full-suite run I invalidated myself

A `npx vitest run` started at 18:46:52 reported `3 failed | 515 passed | 1 skipped (519)`. **That result
does not count, and not because the failures were benign.** The run tested a tree I was still editing:

| File | Modified | Relative to the run (18:46:52 → 19:07:39) |
|---|---|---|
| `routes/pptx-import.test.js` | 18:47:11 | 19 s after start |
| `mapper/map-media.js` | 18:51:39 | during |
| `vector-media-convert.js` | 19:01:38 | during |
| `routes/pptx-import.js` | 19:03:38 | during |
| `emf-wmf-sandbox.js` / `.test.js` | 19:18:52 / 19:19:06 | after |

Vitest reads each test file lazily as it reaches it, so across 21 minutes some files were the old
version and some the new. The proof is in the failure output itself — it reported a test named
*"rejects bare PATH binary names by default when conversion is forced"* with `delete
process.env.PPTX_EMF_ALLOW_BARE_NAME` at line 50. Neither that test name nor `PPTX_EMF_ALLOW_BARE_NAME`
exists anywhere in the tree. The `ok: undefined` that could not be explained from the current source
came from an opt-in branch that returned an object missing `ok: false` — code that is gone.

Those edits were not stray: they are the fix pass recorded in
`plans/reports/code-review-260726-1805-pptx-import.md`, landing in the same working tree — H1 → `media.js`,
M5 (`spawnSync` → async `spawn`) → `emf-wmf-sandbox.js`, L9 → `vector-media-convert.js`. Two workstreams
were editing one uncommitted tree while a suite ran against it.

Two dead-end theories were discarded on the way: parallel-worker contention (refuted — `vitest.config.mjs`
sets `fileParallelism: false`), and cumulative shared-`SLIDES_DATA_DIR` pollution across 519 sequential
files (plausible, and wrong). The cause was procedural, and the responsibility is mine for launching the
run without first confirming the tree was quiescent: **a verification run against a moving tree proves
nothing in either direction.** A green result would have been exactly as worthless as the red one.

The gating run was relaunched at 19:28 against a frozen tree, fingerprinted beforehand (1460 source
files, mtime + size) so the "nothing moved" claim is checkable rather than asserted.

The two `no-control-regex` warnings in the sanitizer module are suppressed with justified inline
disables — matching control characters is that module's entire purpose, and leaving the warnings
standing would mask a real one later.

---

## Hypotheses raised and then refuted

Recorded so they aren't re-litigated:

- **SSE write to a dead socket crashes the process** — refuted. Built a real HTTP server repro, killed
  the socket, then broadcast: `emitProgress` and `completeJob` both returned normally, `uncaught = none`.
  Node swallows writes to destroyed sockets.
- **`packageCommit`/`packageRollback` disabled under `NODE_ENV=test` means the production path is untested** —
  refuted. 11 explicit injections in `pptx-import-crash-points.test.js`, 3 more in `pptx-import.test.js`.
- **Export redaction breaks the media manifest** — refuted. `buildArchiveMediaManifestEntries` reads only
  `element.src`, `element.poster`, `slide.background`; none are redacted.
- **`pending-visibility` thrown as terminal is a bug** — refuted. Intentional Contract-B behavior, handled
  with a clear user-facing message at `HomePage.jsx:730`.
- **The parser-worker env allowlist silently drops operator-configured budgets** — refuted. Budgets are
  compile-time constants in `constants.js`/`resource-budgets.js`; the `PPTX_*` knobs that do exist are all
  read in the parent process.
- **`state-store.js mutate()` could publish a partial mutation** — refuted. Compute-then-commit,
  `package-store/index.js:76-106`.
- **`opc-relationship-parser.js` weak XML guard is exploitable on the import path** — refuted for the
  primary path; retained only as a DRY/fragility note for the native-reimport consumers.

---

## Unresolved questions

1. **Windows directory-fsync limitation** — accept and document as a stated platform limit, or pursue a
   `FlushFileBuffers`-on-directory-handle equivalent? Unchanged by this pass.
2. **Corpus fidelity numbers** — run the corpus to verify the 11/11 / 100% / 63.0% baseline, or defer to
   the sibling package-first plan?
3. **Phase 5 doc lines 38 and 60** now describe behavior that is finally true. Should the phase file be
   annotated to record that the claim preceded the implementation, or left as-is since it is no longer
   false?
4. **`opc-relationship-parser.js` duplicate guard** — collapse onto `pptx-guards.js`, or leave the
   native-reimport path on its own weaker copy?
5. **The 200-LOC deviations** (`pptx-import.js` at 817, `pptx-job-wait.js` at 458) remain. Separate job,
   per the user's own scoping.
