# Frontend contract regression repair

## Scope and decision

Owned test-only repair under accepted full16 plan, `--auto --advice --tdd`. No frontend production file was changed by this worker. Main and `OfflineMediaAndLintFailureCounsel` authorized retirement of the two wholly implementation-text audit files and native browser-boundary fixture repair. No budgets, timeouts, coverage thresholds, assertions, or consumers were weakened.

## Recorded RED and diagnosis

Historical full-suite command:

```text
npm run test:coverage -- --maxWorkers=1 --no-file-parallelism --reporter=default --reporter=json --outputFile=plans/261009-0901-navslides-full-reliability-deep-tdd/reports/final-coverage.json
```

The preserved original output is `artifact://537`, especially lines 6208–6280. This was a failing broad run (18 failed files, 24 failed tests and one unhandled error); source changed during execution, so it is not current-source final proof. The four failures within this ownership were:

- Local and external poster-only cases returned their original URL rather than the exact PNG data URL.
- Native-dialog source audit found `SettingsConflict.jsx:confirm`.
- Tailwind source audit found one `style={{...}}` in `canvas-element-wrapper.jsx`.

The historical poster defect was already repaired by Main before this worker's focused run: current `offlineExport.js` includes `poster` alongside `src` and `data-background-image` for both upload and external inlining. This worker did not rerun the old suite or claim an additional production fix.

The offline harness mixed jsdom `Blob` fixtures with a Node `Blob` PNG fixture and replaced browser `FileReader` with a `Response(blob)` conversion. That was not the browser API boundary. The test now uses real jsdom `FileReader` and the existing same-realm `blobFrom` helper for every fixture; `Buffer` only decodes the fixed PNG bytes. Exact poster data-URL expectations for both URL cases remain unchanged. The recorded historical output alone does not establish that the mixed-realm harness caused the old poster failures; the production regex omission was separately repaired by Main.

Actual source inspection disproved the initial callback hypothesis: `SettingsConflict.jsx:23` calls **`window.confirm`**, not a local callback. Main was notified and accepted ownership of a themed confirmation repair, functional cancel/discard tests, and actual browser conflict-path smoke. The existing Settings save/draft smoke does not cover that discard path. Audit retirement is therefore not a claim that the product gap did not exist.

The wrapper's sole literal inline style is a chart/latex preview hit-area overlay (`position: absolute`, `inset: 0`, `zIndex: 1`, line 697), not measurement CSS. No runtime overlay was removed and no static style budget was widened.

## Changes and remaining protection

- `client/src/utils/offlineExport.test.js`: remove custom `FileReader`; replace PNG `NodeBlob` with browser-native helper; retain all ten consumer tests, including the two exact PNG poster assertions, captions, required-asset rejection/recovery, CSS dependencies and iframe behavior.
- Delete `client/src/utils/native-dialog-audit.test.js`: its one test scanned source with a regex, not an exercised dialog flow.
- Delete `client/src/utils/tailwind-inline-style-audit.test.js`: all five tests counted source styles or asserted incidental paths/classes. No AST/source-text replacement was added.
- Preserve existing semantic Settings tests (save, dirty draft, pending edits, conflict rebase/secret choices, failure retry, accessible connection feedback and modal interaction) and canvas keyboard/media/control behavior tests.

Retirement removes six structural tests, not functional Settings or renderer consumer tests. Main's separate native confirmation semantic repair is explicitly required to close the proved discard-flow gap.

## Focused GREEN

Executed once, sequentially with one worker:

```text
npx vitest run --project=client-jsdom client/src/utils/offlineExport.test.js client/src/pages/SettingsPage.test.jsx client/src/pages/SettingsPage.draft.test.jsx client/src/components/canvas/canvas-element-wrapper.test.jsx --maxWorkers=1 --no-file-parallelism --reporter=default --reporter=json --outputFile=plans/261009-0901-navslides-full-reliability-deep-tdd/reports/frontend-contract-regression-final.json
```

Exit **0**; **4 files, 67 tests passed**:

| File | Passed |
| --- | ---: |
| `offlineExport.test.js` | 10 |
| `SettingsPage.draft.test.jsx` | 14 |
| `SettingsPage.test.jsx` | 5 |
| `canvas-element-wrapper.test.jsx` | 38 |

Runner duration 13.44 seconds; command wall time 16.64 seconds. Machine-readable evidence: `frontend-contract-regression-final.json` adjacent to this report. No new unexpected failed verification occurred.

## Actual-render evidence and freshness limits

Main's prior `bg149` native Chromium run passed 7/7, including Settings status/native typography, Home/Editor portable A→B→C with and without media, strict video-frame observation, and export refusal cases. Its retained artifacts are in `reports/browser-final04/`; media cases include `C-offline.html`, `C-offline-decoded.png`, and `portable-browser-receipt.json`. This worker changed no production or browser fixture source, so these test-only edits do not themselves invalidate the offline-poster render evidence. This is reused Main-owned evidence, not a new browser run by this worker.

This focused result predates any subsequent Main-owned SettingsConflict production repair; Main must rerun the affected semantic/native conflict path on the final production state. No full suite, full build, coverage run, browser run, LSP check, or final release freshness gate was executed by this worker. Other broad-run failures and the native discard-flow production repair remain Main/peer-owned, not hidden by this report.

## Cleanup

No temporary scripts, fake API implementations, scaffolds, skipped cases, or replacement source audits were created. Historical failure output remains preserved; report and JSON receipt are intentional deliverables. No commit, push, publication, tag or GitHub setting change was made.
