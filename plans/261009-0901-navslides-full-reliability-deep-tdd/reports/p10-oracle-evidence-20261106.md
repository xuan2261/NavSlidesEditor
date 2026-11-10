# P10 oracle evidence — 2026-11-06

Scope: Phase 10 execution under `plans/261009-0901-navslides-full-reliability-deep-tdd/phase-10-pptx-portable.md`. The 2026-11-06 Vitest results below are observed passes, not dirty-input certification from HEAD alone. The 2026-11-07 source-bound supplement below supplies missing execution provenance and foreign import authority negatives. Binary: `C:/nvm4w/nodejs/node.exe` v22.22.0.

## Receipts (all fresh, 2026-11-06)

1. `plans/261009-0901-navslides-full-reliability-deep-tdd/reports/p10-existing-protection-20261106-run3.json`
   - Vitest JSON, success true, 16 suites passed, 61 tests passed, 0 failed.
   - Files: `portable.test.js`, `project-import.test.js`, `portable-package-project.test.js`, `sync.test.js`.
   - Determinism: 2 consecutive full passes (run2: 61/61, run3: 61/61).

2. `plans/261009-0901-navslides-full-reliability-deep-tdd/reports/p10-portable-client-20261106-run1.json`
   - Vitest JSON, success true, 18 suites passed, 117 tests passed, 0 failed.
   - Files: `export-project.test.js`, `import-project.test.js`, `use-export-actions.test.js`, `api.test.js`, `HomePage.project-import-lifecycle.test.jsx`, `project-import-archive.test.js`, `package-backed-presentation-read.test.js`.

3. `plans/261009-0901-navslides-full-reliability-deep-tdd/reports/p10-atomicity-dedup-20261106-run1.json`
   - Vitest JSON, success true, 5 suites passed, 14 tests passed, 0 failed.
   - Files: `portable-package-project-dedup.test.js`, `project-import-archive-inventory.test.js`, `portable-descriptor-atomicity.test.js`.

4. `plans/261009-0901-navslides-full-reliability-deep-tdd/reports/p10-e2e-portable-20261106-run1.json`
   - Playwright JSON, chromium project, workers=1, retries=0, duration 209.8s.
   - 7/7 tests passed: 0 unexpected, 0 flaky, 0 skipped.
   - Files: `tests/e2e/export/portable-package-real-browser.spec.js`, `tests/e2e/export/portable-package-export-refusals.spec.js`.

5. `plans/261009-0901-navslides-full-reliability-deep-tdd/reports/p10-process-kill-20261106-run1.json`
   - Source-bound process-kill proof: `node server/portable-process-kill-proof.cjs`.
   - Status passed, exitCode 0, startedAt 2026-11-06T15:29:08.891Z, completedAt 2026-11-06T15:30:11.931Z (63s).
   - Scenarios: all 5 boundaries (`prepublication`, `root-committed`, `raw-applied`, `owner-committed`, `cleanup-partial`) cleanup=true.

Historical totals: 192 Vitest tests, seven native browser journeys and five process-termination boundaries; these are different evidence classes, not a homogeneous 199/199 total.

## Complete Oracle Mapping (P10-01 .. P10-15)

| ID | Risk | Tình huống / setup | Oracle pass/fail | Bằng chứng thực tế trong receipts |
|---|---|---|---|---|
| P10-01 | C | Package+projection+media export/import root mới | Original hash giữ, deck mở/media đủ, authority rebound đúng | PASS: E2E `P10-01/12/13/14 owned media via Home A-B-C` (34.6s) & `Editor A-B-C` (38.1s); `portable-package-project.test.js` "reopens immutable Original and destination media after import" |
| P10-02 | C | Destination changes sau preflight | Conflict không xóa head/owner/projection mới | PASS: `portable.test.js` "preserves a winner published during preflight (replace=false/true)" (409 SYNC_DESTINATION_CHANGED) & "rejects create-new over an existing destination without changing its authority" |
| P10-03 | C | Source head đổi khi export | SYNC_SOURCE_CHANGED; không archive mixed | PASS: `portable.test.js` "rejects a source head advanced while real blob bytes are being read" (409 SYNC_SOURCE_CHANGED); `project-export.js` rechecks head hash across async reads |
| P10-04 | C | Missing/extra/duplicate revision/blob/payload | Reject trước publication | PASS: `portable-descriptor-atomicity.test.js` 9 tests (missing/extra/duplicate revision, blob descriptor, supplied payload); `project-import-archive-inventory.test.js` rejects missing/extra physical package payload |
| P10-05 | H | Digest/length mismatch hoặc corrupt existing blob | Reject; no new head | PASS: `portable-descriptor-atomicity.test.js` "P10-05: corrupt existing destination blob refuses portable admission without a new head or losing valid staged/source bytes" |
| P10-06 | H | Foreign owner/source-map/journal authority | Reject spoofed authority | PASS with 2026-11-07 supplement: `portable.test.js` journal preflight refusal, `portable-retained-authority.test.js` foreign source-map revision/generation/schema import refusal, and `project-import-archive-v2.test.js` foreign presentation ZIP authority refusal; all executed in source-bound 214/214 receipt |
| P10-07 | H | Duplicate/traversal/absolute media path | Reject, không file ngoài sandbox | PASS: `project-import-archive.test.js` 5 tests (rejects unsafe archive path `/outside.png`, `media/../outside.png`, `media\outside.png`, `C:/outside.png`, `media/%2e%2e.png`); `project-import-archive-inventory.test.js` "rejects exact duplicate ZIP payload entries" |
| P10-08 | H | Kill giữa package commit và media/projection | Restart recover hoặc reconcile-required; không success thiếu media | PASS: `p10-process-kill-20261106-run1.json` status passed, exit 0, all 5 boundaries (prepublication, root-committed, raw-applied, owner-committed, cleanup-partial) cleanup=true; bounds process kill |
| P10-09 | H | Import same archive twice create-new | Hai destination độc lập, không cross-owner deletion | PASS: `portable-package-project-dedup.test.js` "P10-09: identical archive twice in one store independently owns authority; permanent deletion preserves sibling HTTP consumers after restart" |
| P10-10 | H | Explicit replace đúng expectedHead | Đúng generation và ownership; giữ original cần retention | PASS: `portable.test.js` "requires explicit replace and rebases onto the destination predecessor" (generation rebased, predecessorId = hash(expectedHead)) & "rechecks replace after asynchronous staging" |
| P10-11 | M | Plain legacy JSON không package | Vẫn import; không claim lossless/original | PASS: E2E `P10-11 legacy plain JSON imports, saves an edit and survives reload` (18.6s); limitations recorded in receipt: "Legacy JSON compatibility, not package-backed authority or Office qualification" |
| P10-12 | H | A→B→C roundtrip và Original download | Hash invariants; không mutable source reuse | PASS: E2E `P10-01/12/13/14 owned media via Home A-B-C` & `Editor A-B-C`; `portable-package-project.test.js` "exports B then reopens C with A and B offline and preserves Original/media hashes" |
| P10-13 | C | Export package-backed deck không local media, Open qua Home và Editor | ZIP v2 vẫn có package; cả hai entrypoints giữ Original/authority | PASS: E2E `P10-01/12/13/14 no local media via Home A-B-C` (34.8s) & `no local media via Editor A-B-C` (32.6s) — package-backed archive without local media successfully roundtripped via both Home and Editor |
| P10-14 | C | Media filenames đổi ở B/C, root A không truy cập | Canonical GET dùng destination URLs, media fetch thành công; pending/committed hashes hợp lệ | PASS: E2E `P10-01/12/13/14 owned media via Home A-B-C` & `Editor A-B-C`; `portable.test.js` 4 parameterised tests "rebinds canonical media and immutable Original (pending=%s, replace=%s)" rewrite media URLs and recompute hashes |
| P10-15 | H | Save barrier conflict hoặc missing owned media khi export | Abort với lỗi user-visible, không download stale/degraded full archive | PASS: E2E `P10-15 refuses package export with missing owned media` (23.5s) & `P10-15 refuses package export with save generation conflict` (18.9s) |

## Limitations and Boundaries
- Process termination / SIGKILL proof only, not power-loss/fsync durability qualification.
- Browser qualification conducted on Chromium (Windows local); not native OfficeCLI conversion or external PowerPoint.
- No code change, no commit, no publish in this evidence gathering lane.
- Gate 10 reconciliation uses the historical browser/process receipts plus the source-bound 2026-11-07 Vitest supplement; each captures its own scope, not an invented common digest.

## Source-bound supplement — 2026-11-07

`p10-bound-20261107.json`: 214/214 passed, zero failed, exit 0. `p10-bound-20261107-identity.json` preserves exact invocation, Node executable identity and matching before/after 2,150-file manifests (`8175131c6dd8b0646f9a6503ea4ed5d5399d95e5375b160c37df5792b368bf95`). Includes all fourteen earlier Vitest files plus retained-authority/archive-v2 negatives. Final reconciliation compared every recorded focused/browser/process file hash with the current workspace: no recorded-file differences. This comparison does not turn a dirty workspace into a clean release subject or merge different manifest scopes.
