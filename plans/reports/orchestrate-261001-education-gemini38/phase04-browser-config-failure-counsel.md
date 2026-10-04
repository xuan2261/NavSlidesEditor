## TL;DR — GO for minimal throwaway config repair

Override `globalSetup` with an absolute path **only in `.tmp/phase04.playwright.config.cjs`**, after `...base`:

```js
globalSetup: path.resolve(__dirname, '../tests/e2e/global-setup.js'),
```

Keep production configuration, global setup behavior, and permanent regression assertions unchanged.

## Evidence and diagnosis

- `playwright.config.js:29` exports the relative string `./tests/e2e/global-setup.js`.
- `.tmp/phase04.playwright.config.cjs:4-9` imports and spreads that configuration, but rebases only `testDir`; `globalSetup` remains relative.
- The supplied failure occurs during `resolveScript` / configuration loading. **No regression test ran.**
- **[INFERENCE, high confidence]** Loading the wrapper from `.tmp` changes the resolution context for the inherited relative setup path. An absolute path removes that ambiguity without changing the setup module.

The readiness check remains intact: `tests/e2e/global-setup.js:1,9,21-22` reads `PLAYWRIGHT_API_BASE_URL`, requests `/presentations`, and awaits readiness. The wrapper sets `http://127.0.0.1:34102/api` before importing the base configuration (`.tmp/phase04.playwright.config.cjs:3-4`); the base preserves that override (`playwright.config.js:8,25`).

## What to do

1. Add the single override above after `...base`.
2. Run the original command unchanged:
   ```text
   npx playwright test --config .tmp/phase04.playwright.config.cjs --project=chromium --workers=1 --reporter=line --retries=0
   ```
3. Capture the selected tests, executed count, results, and exit code. If execution fails next at API readiness or within a test, diagnose that distinct failure rather than bypassing it.

## What to avoid

- Do not disable or replace global setup, alter permanent assertions, or change the root config.
- Do not relocate or copy the setup module; that adds unnecessary harness divergence.
- Do not count configuration loading, test discovery alone, or the reported manual passes as permanent regression acceptance.

## Acceptance and assumptions

**Phase04 remains unaccepted** until the actual regression tests execute and pass, together with all other required receipts.

Assumption: coordinator-owned client/API servers remain available at the configured endpoints. Their current availability was not checked; the retained global setup will check API readiness.

Read-only counsel; no edits or execution performed. Separate-context, same-model counsel on `local52186/gpt-6.1-sol`; no model-family independence.