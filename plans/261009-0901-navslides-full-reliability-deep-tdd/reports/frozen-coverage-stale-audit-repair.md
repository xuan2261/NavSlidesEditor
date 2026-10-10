# Frozen coverage stale-audit repair

## Observed failure
`final-coverage-frozen02-runtime.json`: exit 1; before/after full input SHA256 `3ebdfd3c0c77b1ddf379dac6d5e3b5060c636ca0b5d90502f700a5a13fe8b5a0`; before/after backend SHA256 `11b99818295da61dac29fd0439deaf21c34b15430946b12eeb999943cf778ccc`; inventory 671. Raw report: 5,666 total, 5,662 passed, one failed, three pending. Sole failure: `tests/unit/electron-desktop-runtime-contracts.test.js`, confirmation-dialog meta-test, ENOENT reading removed `client/src/utils/native-dialog-audit.test.js`. Failed receipt is retained; never relabeled passed.

## Advice and decision
Required failed-verification counsel: `FrozenCoverageObsoleteAuditCounsel` (kongming, same-model; counsel only), delivered before root-cause inspection/edits. Recommendation: remove obsolete `readText` audit assertion, retain true `isTrustedAppUrl`, `isExternalHttpUrl`, and `withDesktopCsp` behavior; never restore dead audit or shim. Main inspection proved three cases inspected source strings instead of executed behavior. Removed those cases and unused FS/path imports/helper. Desktop packaging/security physical qualification is not proven by these removed meta-tests and remains separately blocked as documented.

## Narrow verification
`desktop-behavior-repair-final01.json`: actual Vitest wrapper exit 0; four retained behavioral checks passed; inventory 671 with exact configured lane union true, inventory SHA256 `e6233af6a65a4a4c3d7a6cf8ee8247fcb274f527ce6301a56f4725767ce612a4`. No production source changed in this repair. Final unfiltered coverage produces fresh `final-coverage-frozen03.json` and `final-coverage-frozen03-runtime.json`; this note does not predict their result or change floors (lines 74, branches 60, functions 68, statements 71).

## Nonexecuted platform cases
- `server/services/pptx-import/worker-runner.test.js`: SIGKILL escalation of child ignoring SIGTERM; skipped on Windows (POSIX signal behavior).
- `server/services/storage.test.js`: create/replace/repair secret file with owner-only POSIX mode; skipped on Windows.
- `server/services/pptx-import/package-store/writer-lock-reclaim.test.js`: PID reused by newer process; Linux-only execution.

Skipped cases do not count as passed and cannot satisfy Linux qualification.
