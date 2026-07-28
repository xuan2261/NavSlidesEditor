# Code Review — Import PPTX (codebase scan, advisory)

Date: 2026-07-26 · Branch: `feature/pptx-import-reliability-ux-evidence-hardening` · Mode: advisory (no code changed)

Scope: server import route + pipeline, media persistence, zip guards, job manager, client admission/wait/UI.
Verification run: `npx vitest run server/routes/pptx-import.test.js server/routes/pptx-import-durable-job.test.js server/routes/pptx-import-crash-points.test.js server/services/pptx-import-job-manager.test.js` → **53 passed / 0 failed**.

Two findings below are proven by execution, not by reading. The rest are cited to source lines.

> **Status 2026-07-26 (post-fix):** all findings resolved or withdrawn — see [Resolution](#resolution).
> **L4, L6, L7 were withdrawn: the defects do not exist.** Read that section before acting on any
> finding above.

---

## HIGH

### H1. Media budget double-charges deduplicated media → false 413 on ordinary decks
`server/services/pptx-import/media.js:108`, `:141`

`reserve(buffer.length)` is charged **per element occurrence**, before `persistDedupedBuffer`
(`media-dedup.js:52`) collapses identical bytes by SHA-256. `mapImage` calls this once per image
element (`mapper/map-image.js:79`), not once per `ppt/media/` part.

Proven — 3 identical 75-byte PNGs against a 150-byte budget:

```
call 1: url=ok   usedBytes=75
call 2: url=ok   usedBytes=150
call 3: THREW media-budget-exceeded  usedBytes=150
files actually written to disk: 1
```

225 bytes charged, 75 bytes stored, import killed.

Real-world trigger: one 5 MB logo placed on 100 slides charges 500 MB against
`MAX_AGGREGATE_MEDIA_BYTES` (500 MB, `constants.js`) while storing 5 MB. `reserve` throws
`PptxImportError(413)` (`resource-budgets.js:24`) and unwinds the whole import. This is the
standard corporate-template shape, not an edge case.

Fix: charge per unique hash — resolve dedup first, reserve only on a real write. Or keep the
pre-reserve and release it on a dedup hit.

### H2. One 150 s deadline covers both admission-retry and the import → guaranteed "outcome unknown" under contention
`client/src/pages/HomePage.jsx:658,664-665` · `client/src/utils/pptx-job-wait.js:5`

`deadlineAt = Date.now() + DEFAULT_PPTX_JOB_MAX_WAIT_MS` (120 s import + 30 s slack = **150 s**) is
passed to *both* `api.importPptxAsync` (`HomePage.jsx:667`) and `waitForPptxJob`
(`HomePage.jsx:687`). Admission is configured for `maxBusyRetries: 72 × 5000 ms` = **360 s**.

Arithmetic:

| | |
|---|---|
| total client budget | 150 s |
| admission retry window configured | 360 s |
| admission retries actually reachable | **30 of 72** |
| import needs (server `IMPORT_TIMEOUT_MS`) | 120 s |

With `MAX_CONCURRENT_RUNNING = 1` (`pptx-import-job-manager.js:5`), the second concurrent user waits
~120 s for the slot, is admitted with ~30 s left, and hits the transport deadline mid-import →
`PPTX_JOB_OUTCOME_UNKNOWN` → *"Import timed out before a final outcome was confirmed. Check existing
presentations before importing again."* (`HomePage.jsx:735-739`) — while the import actually succeeds.

That is precisely the scenario `retryOnBusy` exists to serve, and it fails in it. No test covers the
composition: `api.test.js` exercises busy-retry with `busyRetryDelayMs: 0/1/17` and no consumed
deadline; `pptx-job-wait.test.js` exercises `OUTCOME_UNKNOWN` in isolation.

Fix: re-base the wait deadline at admission success (`Date.now() + DEFAULT_PPTX_JOB_MAX_WAIT_MS`),
give admission its own separate budget. Add a test asserting a 100 s admission wait still leaves a
full import window.

---

## MEDIUM

### M1. `persistMediaBlob` charges the budget before it validates
`media.js:141` reserves → `:143` rejects on extension → `:152` rejects on magic-byte mismatch.
Rejected bytes stay charged for the rest of the import. A deck carrying many disallowed media parts
starves legitimate media mapped later. `persistImageBuffer` orders this correctly (detect `:104`,
reserve `:108`) — the two functions disagree.

### M2. Budget-overflow policy is inconsistent across the same resource
`mapper/map-media.js:72-79` wraps `reserve` in try/catch → `media-budget-exceeded` warning +
placeholder (graceful). `media.js:108`/`:141` leave it unguarded → `PptxImportError(413)` unwinds the
entire import (fatal). Same budget, two policies, decided by which element type happens to hit the
ceiling first. Degrade-with-warning matches the pipeline's partial-success model everywhere else.

### M3. SSE capability secret is sent in the URL query string
`pptx-job-wait.js:291-295` builds `/api/pptx/jobs/:id/stream?capability=<32-byte hex>`; the server
accepts it query-only for SSE (`pptx-import.js:563-570`, justified — EventSource cannot set headers).

`pptx-import.js:558` states the capability is *"never logged/persisted"*. The app has no request
logger, so that holds in-process — but nginx / Caddy / Cloudflare log full query strings by default,
and reverse-proxied self-hosting is the documented deployment. The guarantee does not survive the
deployment shape.

Options: one-time short-TTL stream ticket exchanged for the capability; or a `HttpOnly` cookie scoped
to the stream path. Minimum: document the proxy log-scrubbing requirement.

### M4. Every package is fully decompressed twice, and non-XML entries are materialized only to be discarded
`parse-worker.js:12` runs `validatePptxPackage`; `importer.js:67` then runs `loadPptxArchive` →
`validatePptxPackage` again. Already tracked in-repo — `perf/matrix-summary.js:44`:
`"worker validatePptxPackage + host loadPptxArchive full revalidate"`.

Compounding it: `pptx-guards.js readBoundedZipEntry` does `chunks.push(Buffer.from(chunk))` +
`Buffer.concat` for **every** entry, but for non-XML parts only `.length` is consumed
(`pptx-guards.js:150`). A 100 MB media part is copied into RAM and thrown away — twice per import.

Fix: stream-count non-XML parts without accumulating; hand the validated zip from worker to host
instead of re-validating.

### M5. `spawnSync` for EMF/WMF conversion blocks the entire event loop
`emf-wmf-sandbox.js:110`, `timeout: 30_000`. This process also serves Socket.IO live presentations,
SSE import progress, and the REST API — all frozen for the duration. Ten EMF images ≈ 5 minutes of
stalls. Default-off (`PPTX_EMF_CONVERT !== '1'`) contains it today, but it becomes a production
incident the first time an operator enables it. Fix: async `spawn`, or run inside the existing forked
parser worker.

---

## LOW

- **L1** `pptx-import.js:541-542` — `packageCommit`/`packageRollback` default to `null` when
  `NODE_ENV === 'test'`. Tests do inject real implementations (`crash-points.test.js:362,633`), so the
  path *is* covered, but the default wiring production actually runs (`:808`) is never constructed in
  test. Prefer a test-supplied double over branching production defaults on `NODE_ENV`.
- **L2** `createMediaBudget` (`resource-budgets.js:15`) has no `release`; `createMediaTransaction.rollback`
  reverts files and hashes but not budget. Harmless today (budget is per-import, then discarded) —
  becomes a leak the moment budgets are shared or retried.
- **L3** File-size constraint (`CLAUDE.md`: under 200 LOC) — `routes/pptx-import.js` **817**,
  `utils/pptx-job-wait.js` **458**, `package-store/lifecycle.js` **541**, `mapper/map-presentation.js`
  **494**, `pptx-import-semantic-and-roundtrip-fidelity-tester.js` **1479**. The route file carries five
  concerns: multipart admission, capability auth, durable-job serialization, orchestration,
  reconciliation. Natural split: `pptx-import-admission.js` / `-capability.js` / `-durable-view.js` /
  `run-import.js`.
- **L4** `map-media.js:38` calls `buildMediaUrlAllowlist()` per URL, re-parsing env + every origin;
  `constants.js` already exports the memoized `MEDIA_URL_ALLOWLIST`. If per-call rebuild is deliberate
  (runtime env changes in tests), say so in a comment.
- **L5** `HomePage.jsx:701-705` — `imported.presentation` client-create fallback "for legacy servers".
  Current server returns only `{presentationId, reportSummary}`. Dead path. YAGNI.
- **L6** `map-media.js:24` `isPrivateHost` misses IPv4-mapped IPv6 (`::ffff:127.0.0.1`). Not
  exploitable — the origin allowlist is the real gate and is empty by default — but the defense-in-depth
  layer has a hole worth closing.
- **L7** `pptx-import.js:226` — durable jobs in `queued`/`running` serialize `percent: 0`, so a
  post-restart poll shows a progress bar snapping backwards. Cosmetic.
- **L8** `pptx-import.js:214` — `serializeDurableImportJob` emits `message` but no `error` field;
  `pptx-job-wait.js:132` reads `job.error` for failed jobs, so durable failures always surface the
  generic `"PPTX import failed"` instead of the real reason.
- **L9** `vector-media-convert.js:59` `convertAndPersistVectorImage` is exported but referenced only by
  its own test — the live path is `map-image.js:26-51 tryConvertUnsupportedVector`, which duplicates it.
  The two have diverged: the live one threads `mediaBudget` + `mediaTransaction` into
  `persistImageBuffer`, the dead one does not (`vector-media-convert.js:62-64`). A future caller gets an
  un-budgeted, un-rollbackable write. Delete it, or make it the single implementation and have
  `map-image` call it.

---

## Verified strengths — do not regress

Evidence-based, not padding. These are the parts most import features get wrong:

- **Stored-XSS defense is doubled.** Import-time DOMPurify with a tag/attr allowlist and href protocol
  validation (`services/pptx-import/sanitize.js:22-45`, applied at `mapper/map-presentation.js:73`,
  `map-shape.js:39`, `map-diagram.js:20`, slide notes `map-presentation.js:414`) **and** render-time
  sanitization (`shared/src/element-renderers.js:11`, `content-safety.js`).
- **Zip guards are thorough** (`pptx-guards.js`): PK signature check, entry-count cap, declared
  uncompressed size checked *before* inflation, per-entry + aggregate streaming caps, separate XML byte
  budget, fail-closed CRC32 with a recorded corpus probe.
- **EMF converter policy is genuinely hardened** (`emf-wmf-sandbox.js`): absolute path required,
  basename allowlist, trusted-root containment via `realpath`, symlink + hardlink rejection, SHA-256
  pinning, `shell: false`, narrowed env. (The blocking call is M5; the policy itself is sound.)
- **Capability check uses `timingSafeEqual`** with a length pre-check (`pptx-import-job-manager.js:62-77`).

---

## Suggested order

1. H1 — silently breaks ordinary decks; smallest fix.
2. H2 — turns a working import into a scary error under the exact contention it was built for.
3. M1 + M2 together — one coherent budget policy.
4. M4 — largest perf win, already tracked in-repo.
5. M3, M5 — deployment-shape hardening.

---

## Resolution

Fixed 2026-07-26, test-first. Verification: `npx vitest run server/services/pptx-import/
server/routes/pptx-import{,-durable-job,-crash-points}.test.js server/routes/presentations.test.js
client/src/utils/{pptx-job-wait,api}.test.js client/src/pages/HomePage.pptx-import-lifecycle.test.jsx`
→ **160 files, 1386 passed, 2 skipped, 0 failed**. ESLint over the touched tree: 0 errors (11 warnings,
all pre-existing in files this fix set never opened).

| # | Outcome | What changed |
|---|---------|--------------|
| H1 | fixed | Budget charged inside `persistDedupedBuffer`, immediately before the write — the one point that knows the content is not already stored. Dedup hits cost nothing. |
| H2 | fixed | Wait deadline re-based at admission success; admission gets its own budget. |
| M1 | fixed | Same change as H1: charging moved past all validation, so rejected bytes are never charged. |
| M2 | fixed | Unified on degrade-with-warning. Added `tryReserve` (non-throwing); over-budget media yields a placeholder + `media-budget-exceeded` warning instead of a 413 that discards the report's evidence trail. |
| M3 | **re-scoped** | Transport left alone; the misleading comment was the actual defect. See below. |
| M4 | **half fixed** | Non-XML parts are now stream-counted (`measureBoundedZipEntry`), not copied into RAM and discarded. Double-validate deliberately kept — see below. |
| M5 | fixed | `spawnSync` → async `spawn`. All policy gates (hash pin, trusted root, `shell:false`, narrow env, timeout) preserved. The first cut introduced a deadlock; see Second round. |
| L1 | fixed | Removed the `NODE_ENV` branch; tests inject `packageCommit: null, packageRollback: null` explicitly. |
| L2 | **rejected (YAGNI)** | Budget is per-import; a media-transaction rollback always ends the job (`native-reimport-validator.js:149-186`). No path reuses a budget after rollback, so `release()` would be dead code. |
| L3 | **deferred** | See below. |
| L4 | **withdrawn** | `MEDIA_URL_ALLOWLIST` does not exist in source — only in stale plan/report markdown. The "say so in a comment" ask is already satisfied verbatim at `constants.js:63-64`. The finding came from a prior report, not from current source. |
| L5 | fixed | Dead client-create fallback removed. |
| L6 | **withdrawn** | `embeddedIpv4()` (`map-media.js:24-31`) already handles both forms. Verified empirically: `net.isIPv6('::ffff:127.0.0.1')` is true and `new URL().hostname` normalizes to the hex form `::ffff:7f00:1`, which the hex branch decodes. Added the missing regression test instead of a fix. |
| L7 | **withdrawn** | No progress bar exists; the client never reads `percent`. `pptx-import-durable-job.test.js:276-281` pins `percent: 0` for running jobs. Nothing snaps backwards. |
| L8 | fixed | `durableJobMessage()` distinguishes a rolled-back failure (retry is safe) from one that may have left partial data; client prefers `job.error \|\| job.message`. |
| L9 | fixed | Dead `convertAndPersistVectorImage` deleted; its test rewritten against the composition the pipeline actually runs. |

**M3 re-scoped.** The app has **no user authentication** — `server/index.js:76-128` mounts CORS, rate
limiting, and a local-mutation ingress policy, nothing else. Anyone who can reach the server already
reads and deletes every deck via `/api/presentations`. The capability guards exactly four routes
(status, stream, cancel, reconcile), all scoped to one import job that expires in minutes, so a
capability leaked to a proxy access log grants strictly *less* than the open API beside it. A ticket
exchange or scoped cookie would add state, a second auth transport, and new Electron/polling failure
modes to protect a secret weaker than its neighbour — over-engineering. The real defect was the
comment claiming the secret is *"never logged/persisted"*, true only in-process. Corrected to state
the proxy exposure and its bound.

**M4 half fixed, deliberately.** Stream-counting non-XML parts is contained and obviously correct.
Handing the validated zip from worker to host is *not*: the worker/host split exists so a hostile
package is parsed in an isolated process, and moving a 500 MB structure over IPC costs more than
re-reading it. The second validate is an isolation cost, not an oversight. `opc-inventory.js` keeps
collecting — it sha256s and nested-zip-probes every part (`:119`, `:127`).

**L3 deferred.** The 200-LOC rule is violated by ~12 files in this feature and by
`routes/presentations.js` (1311) outside it — a repo-wide pre-existing condition, not a defect in the
reviewed work. Splitting `routes/pptx-import.js` (840) is the only one with a real complexity
argument, but it is the file this fix set edits throughout, and an 840-line mechanical move would
bury the security-relevant changes and make them unreviewable. Worth doing as its own commit.

---

## Second round (delegated review of the fix set)

A `code-reviewer` pass over the fixes returned `CHANGES_REQUIRED` with empirical repros. It caught a
**new failure mode the M5 fix introduced**: `spawnSync` drains the child's pipes, `spawn` does not, and
nothing read `child.stdout`. A converter printing more than the pipe buffer (64KB on Linux, the
documented Docker deployment) blocked on write until the timeout killed a conversion that would have
succeeded. Reproduced as a RED test at 256KB before fixing.

| # | Outcome | What changed |
|---|---------|--------------|
| F1 stdout deadlock | fixed | `stdio: ['ignore','ignore','pipe']`. Stdout is discarded, so it cannot fill; stderr is the only pipe and is drained. |
| F2 background budget | fixed | Real: the data-URL background path charged per placement, so one template background on 40 slides cost ~40×. `tryReserve(bytes, contentKey)` now dedups by content sha256. |
| F4 test coverage | fixed | The one async test covered only success — which is why F1 passed CI. Added flood, timeout-kill, stderr-surfacing, stderr-bounding, and abort tests. |
| F5 stderr bound | fixed | Was check-then-append, so the real cap was 8KB + one chunk (measured 32KB). Now caps Buffer slices and decodes once through `StringDecoder`, which also stops a multibyte sequence splitting into `U+FFFD`. |
| F6 stdio settle | fixed | `'close'` waits for every pipe holder; a grandchild would stall it. `'exit'` now arms a 500ms unref'd grace timer. Cheap because `MAX_CONCURRENT_RUNNING = 1` means one stalled promise blocks *all* imports. |
| F7 abort ignored | fixed | `options.signal` was accepted and dropped, so cancelling an import left a converter per image running to its 30s timeout. Now threaded into `spawn`. |
| F8 plan IDs in code | fixed | `(Phase 07)` removed from the two lines this fix set rewrote. |
| F9 spawn throws | fixed (self-found) | Not from the reviewer. Wiring `signal` into `spawn` gave it a synchronous throw path (`ERR_INVALID_ARG_TYPE`), and a throw inside a Promise executor rejects rather than returning the documented `{ ok, error, code }`. `map-image.js:33` awaits it with no `try/catch` and branches on `.ok`, so one unconvertible image would have failed the whole deck — the exact failure mode this fix set exists to remove. Now caught and returned as `CONVERT_FAILED`. |
| F3 no budget release | **rejected** | Reviewer agreed there is no live leak: `importer.js:88` creates one budget per import and discards it, so rollback has nothing to leak into. Adding `release()` would be dead API of exactly the kind deleted as L9. |

Also removed `createMediaBudget().reserve()` — the throwing variant had zero production callers after
M2, and it was the API shape that caused H1. Its test now asserts the same invariant via `tryReserve`.

**Budget semantics, settled.** The reviewer asked whether the budget bounds disk bytes or peak memory.
Neither: it bounds **distinct media content** an import pulls in. The disk path already met this (a
dedup hit returns before the charge); the background path now does too.

**The durable-receipt 403 is intentional.** The old guard was `if (!durableJob?.controlCapabilityHash)
return true` — fail-*open*, which let anyone holding a job UUID read, cancel, or reconcile a durable
job. Production always writes the hash (`routes/pptx-import.js:426` reads it from the live job during
commit), so only genuinely pre-capability receipts become unreachable, and those describe finished
imports whose presentation the presentations API serves regardless. The comment saying so was
restored.

---

## Unresolved questions

1. Is `MAX_CONCURRENT_RUNNING = 1` a deliberate single-user self-host assumption or a placeholder?
   H2 is fixed either way, but the answer decides whether admission contention is routine or rare.
2. Should `routes/pptx-import.js` be split now as a separate follow-up commit (L3), or left?
3. `convertVectorImage` is now async — an intentional internal contract change. Every in-repo caller
   awaits it. Confirm no out-of-tree consumer depends on the sync return.
4. On converter timeout the error string is now `convert-killed-SIGTERM` rather than the old
   `spawnSync` `ETIMEDOUT` message. `code` is unchanged (`CONVERT_FAILED`), which is what callers
   branch on. Acceptable?
5. `.tmp/` and `.vs/` are untracked and not in `.gitignore`. Measured: **227 untracked files**, mostly
   `.tmp/full-unit-validation-retry/` test-run blobs, indexes, and history plus audit PNGs. `git add -A`
   would sweep all of it in. Add both to `.gitignore`, or keep staging scoped by hand?
6. Not a code defect, but in-scope and it stopped this session: the disk hit 0 bytes free mid-run.
   `server/uploads/` holds **34,840 PNGs / 3.3 GB** and `plans/reports/pptx-import-real-browser-audit-runs/`
   held another 1.7 GB (deleted with your approval to unblock). Import dedupes by SHA-256 within a
   deck, but nothing prunes across imports and every test run adds more. Worth a retention policy or a
   cleanup script, or is unbounded growth accepted for a self-hosted single-user deployment?
