# Native save proof and official follow-up (2026-11-16)

Changed files: `scripts/verify-native-save-latency.mjs` and this directory's
`helpers.mjs`/`server-child.mjs`/`README.md`. The official harness/config are unchanged.
No build, browser, or native harness execution was performed during this repair.
Syntax checks and a lightweight temporary-file serializer write/read check were
performed for the earlier compact-authority encoding change; that historical check is
not qualification of current original-HTTP-byte evidence. See the current
[continuation](../../plans/handoffs/native-save-latency-20261121.md) for runtime results.

## Parent execution, only after CPU workers have stopped

From `C:/Work/NavSlidesEditor`, Git Bash:

```bash
export PATH="/c/nvm4w/nodejs:$PATH"
node scripts/ci/build-client-dist.mjs
node scripts/verify-runtime-closure.js --require-client-dist
node scripts/verify-native-save-latency.mjs
```

Stop on any nonzero command; do not run the next command following a failure.
The canonical build wrapper is required, not direct Vite alone: it produces the
current-source `client-dist-manifest.json`. Its child `npm`/`node` must resolve via
this PATH. Use pinned installed dependencies/browser; do not update them.

The native harness creates fresh OS-temp data/uploads directories and passes
isolation in the owned child's environment **before module load**. The observer
spawns `process.execPath` (with the PATH above, `C:/nvm4w/nodejs/node.exe`), not a
shell/npm wrapper. `server-child.mjs` imports the actual `server/index.js`, calls
normal `startServer(0, { host: '127.0.0.1' })`, checks the normal `/health/ready`
endpoint, then reports its ephemeral port and PID over IPC. No special routes,
server mocks, or parent-process writer are installed. Browser and
`context.request` use that same origin; the real 39-slide import and original
package hash checks are unchanged. It never consumes an external URL/data root. It retains that data on **all**
exits. Each invocation creates a new exclusive
`plans/261009-0901-navslides-full-reliability-deep-tdd/reports/native-save-20261116-<UUID>/`.
Inspect `result.json`, `result-before-cleanup.json`, `http.jsonl`, authority JSON,
and `reload-or-failure.png`; `started.json`/`isolation.json` survive early errors.
No existing receipt is overwritten, and no presentation/data is deleted.
`result.json` records topology (observer/server PIDs, executable, readiness,
port, log paths, shutdown acknowledgement and exit). Child stdout/stderr are
retained in `server.stdout.log`/`server.stderr.log`. Finally, the owner requests
shutdown over IPC; the child awaits normal `stopServer` before acknowledging and
exiting, and the parent awaits exit. Cleanup errors fail the receipt. Only the
owned ChildProcess may receive a kill fallback after failed graceful shutdown;
no unrelated process is enumerated or killed. Cleanup waits are not an acceptance
budget and do not extend the continuous observation window.

Earlier same-process observer failures remain **FAIL**, never retrospective
passes. This separate-process topology removes server event-loop contention
from the observer, but is not itself runtime evidence of acceptance. The official
navigator already uses a separate production server process and is unchanged.
Default input remains native per-character keyboard; `NATIVE_SAVE_INPUT=clipboard`
is a distinct native clipboard-paste diagnostic, not a keyboard result. Both
retain the exact marker-string oracle.

The unchanged **30000ms** total observation starts immediately before native
keyboard typing. Complete marker-bearing PUT/200 completion, authoritative GET,
reload, exact canvas and thumbnail text, 39 slides and advancing generation must
all be observed inside it. Monotonic checks after awaited operations reject late
completion even if the Node timer itself was blocked. Timeout is permanently
FAIL; eventual persistence cannot upgrade it. Response and request-finished times
are captured synchronously, without response-body callback timing contamination.
A Save/Saved button is not a persistence oracle. Screenshot happens outside the
latency measurement (on failure too). All HTTP failures/page errors invalidate
proof. This diagnostic is not the official navigator qualification.

## Authority artifact encoding

`artifactEncoding` in current receipts records **original validated HTTP JSON bytes**
for both complete authority snapshots, not compact reserialized JSON. Each response
is parsed once for validation; all fields, nested objects, arrays and exact marker/content
strings remain in the original bytes, without sampling or projection. Response reads,
validation and both mandatory awaited file writes remain inside the unchanged 30000ms
window, followed by the existing monotonic guard. Result/setup metadata retains pretty
JSON (indentation 2). Older compact-JSON receipts and artifacts remain unchanged. Exclusive
`wx` writes and the existing JSONL event append behavior are unchanged; neither
claims an fsync durability guarantee.

The earlier `ce4c8303-1b95-4db9-9eb4-daf23b3b8727` clipboard run remains **FAIL**:
its final authority evidence write exceeded the remaining deadline despite the
marker/generation and reload text observations. Compact serialization is an
execution-efficiency change, not a retrospective pass or runtime qualification.
Existing artifacts are retained unchanged; timing, oracles, diagnostic and
qualification flags are not relaxed.

## Official exclusive navigator qualification

Read phase13 and finish prerequisites phases06/07 first. Run only after the native
proof succeeds and all other diagnostics, builds, tests, profilers and CPU-heavy
workers are stopped. Freeze source/build/vendor/test inputs for the whole run:
execution-identity before/after hashing rejects changes. Keep the same physical
hardware and pinned Chromium, headless 1440x900/device scale1. No dev server,
existing/shared server, retries, repeatEach override, sample reduction or budget
changes. Select a currently unused loopback port (example below: 3202).

```bash
export PATH="/c/nvm4w/nodejs:$PATH"
unset PLAYWRIGHT_USE_DEV_SERVERS PLAYWRIGHT_REUSE_EXISTING_SERVER
unset PLAYWRIGHT_TEST_BASE_URL PLAYWRIGHT_API_BASE_URL PLAYWRIGHT_CLIENT_PORT
export NODE_ENV=production
export PLAYWRIGHT_SERVER_PORT=3202
export PLAYWRIGHT_RUN_ID="navigator-20261116-$(node -p 'require("node:crypto").randomUUID()')"
export PLAYWRIGHT_HTML_OPEN=never
export PLAYWRIGHT_HTML_OUTPUT_DIR="plans/261009-0901-navslides-full-reliability-deep-tdd/reports/$PLAYWRIGHT_RUN_ID/html"
export NAVIGATOR_REPORT_OUTPUT="plans/261009-0901-navslides-full-reliability-deep-tdd/reports/$PLAYWRIGHT_RUN_ID/navigator-candidate.json"
export NAVIGATOR_BASELINE_INPUT="plans/261009-0901-navslides-full-reliability-deep-tdd/reports/navigator-baseline.json"
node scripts/verify-runtime-closure.js --require-client-dist
node node_modules/@playwright/test/cli.js test tests/e2e/navigator-performance.spec.js --project=chromium --workers=1 --retries=0 --output="plans/261009-0901-navslides-full-reliability-deep-tdd/reports/$PLAYWRIGHT_RUN_ID/test-results"
```

For a new baseline instead of candidate comparison, unset
`NAVIGATOR_BASELINE_INPUT` and choose a unique `navigator-baseline.json` output.
The historical baseline is explicitly noisy/over-budget; successful collection
alone cannot close phase13/14. Inspect `summary.complete`, noise/stability,
budgets/comparison, retained failed samples and execution identity.

Official config starts `npm start` (including runtime-closure prestart), never
reuses a server when the reuse variable is unset, and isolates data under
`.playwright/runs/$PLAYWRIGHT_RUN_ID/{data,uploads}`. Preserve these on failure.
All ten fixtures remain: nine 50/100/300 parent x 0/1/3 child decks and real
39-slide package; separate cold, one discarded warmup, five randomized rounds,
20 interaction samples. Existing 30000ms persistence oracles, fixed budgets,
stable-ID behavior, native hitpoint interactions and screenshots remain intact.
Retain command/exit/output evidence; do not claim gate closure without results.
