## TL;DR

**Confirmed test/API mismatch; NO-GO until repaired tests pass.** `verifyVendor` is private. Repair the tests through the existing exported `verifyRuntimeClosure` API; do not expand production exports.

Advisory from the requested same model, `local52186/gpt-6.1-sol`; no independent-model validation. No edits, tests, builds, lint, or formatting performed.

## Confirmed cause

- `scripts/education-runtime-assets.test.js:21` calls `closure.verifyVendor`.
- `scripts/verify-runtime-closure.js:184–186` exports the Electron hook, `verifyRuntimeClosure`, and `verifyLocalRequireClosure`—**not** `verifyVendor`.
- The first two cases fail at their baseline verification, before modifying either asset (`education-runtime-assets.test.js:27–36`). Their tamper/missing-file behavior remains unverified.

**Checkpoint correction:** the third case places its rejected-publication and unchanged-manifest assertions **before** its failing verification (`education-runtime-assets.test.js:41–45`). The supplied exception does not support “no rollback assertion executed” for that case. It still lacks successful final integrity verification.

## Recommended repair

Use the temporary **root**, not the vendor directory:

```js
const verify = root => closure.verifyRuntimeClosure({
  rootDir: root,
  requiredServerModules: [],
  requireClientDist: false,
  requiredVendorPaths: required,
  expectedRevealVersion: null,
})
```

Replace every `verify(vendor)` with `verify(root)`.

These options already have precedent in `scripts/verify-runtime-closure.test.js:62–68`. They exclude unrelated server dependencies, client artifacts, and Reveal-version requirements while preserving required education paths, manifest validation, size checks, and hashes.

The public wrapper still scans server JS for local `require` closure (`verify-runtime-closure.js:125`). The actual builder emits a bundled browser IIFE (`build-education-runtime.js:9–11`); exercise that path rather than bypassing the scan.

**Alternatives:** the default Electron hook and CLI are unsuitable for this isolated asset-only fixture: they retain packaged-runtime defaults. Calling `verifyLocalRequireClosure` alone cannot validate asset hashes.

## Regressions to retain

1. **Actual published JS and CSS:** preserve the existing builder/publication path.
2. **Same-size tamper:** retain the byte flip and exact hash-mismatch assertion for each asset. This distinguishes hash enforcement from size checking.
3. **Missing asset:** retain deletion and the exact missing-file assertion for each asset.
4. **Failed replacement preserves the live runtime:**
   - Verify the initial publication before attempting replacement.
   - Capture the old manifest and both asset buffers.
   - Stage changed JS while omitting CSS.
   - Assert publication rejects, the manifest and both live buffers remain unchanged, and public closure verification succeeds.

The changed replacement JS makes preservation meaningful: a broken publisher must not partially replace live JS.

**Atomicity distinction:** missing CSS is rejected during staging, before either rename (`vendor-publication.js:104–119`). This proves failed-publication preservation, **not** execution of the backup-restoration branch at lines 120–123. Do not describe it as rename-failure rollback coverage.

## Check / next

Repair the helper and preservation assertions, run the focused asset test, then rerun the supplied eight-file command. Require all three asset cases to reach their intended assertions and the full checkpoint to pass.

**Avoid:** exporting a test-only helper, mocking verification, replacing generated assets with synthetic strings, or weakening expected errors to accept the current `TypeError`. Production asset failure is not established by this checkpoint; production integrity is not yet proven either.