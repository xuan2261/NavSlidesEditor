# CI Gate Verification

Date: 2026-05-31

## PR fast lane

Target: under 20 minutes when run as required checks.

Commands:

- Local: `npm run lint`
- Local: `npx vitest run tests/unit/github-actions-ci-release-confidence-contract.test.js`
- Local/CI: `npm run matrix:gate`
- CI: `required-checks` fan-in summarizes the currently blocking workflow jobs.

Status: `feature-coverage-gate` runs `npm run matrix:gate` in CI as warn-first. Promote only after two consecutive green CI runs and an operator branch-protection update.

## Merge full lane

Commands:

- CI: `npm run test:coverage`
- CI: `npm run build`
- CI: `npx playwright test --project=chromium --shard=N/4`
- CI: `npx playwright test --project=chromium-live`
- CI: `npx playwright test tests/e2e/a11y/ --project=mobile-chromium`
- CI: `npx playwright test tests/e2e/visual/`
- CI: `npm run test:corpus` when `./PPTX` exists.
- CI: `npm run test:load:api:smoke` and `npm run test:load:ws:smoke`.

Runtime budget: each workflow job has a timeout; Playwright is sharded; k6 stays smoke-profile in default CI.

## Release strict lane

Commands:

- Local/CI: `npm run test:pptx:strict`
- Local/CI: `npm run electron:prepare`
- Local: `npm run electron:build:win` before a Windows release.
- Local/CI: `npm run test:load:api:load` and `npm run test:load:ws:load` for pre-release load confidence.
- Manual: verify release checklist from Phase 6 before tagging.

External AI/sync/GitHub/rclone checks stay contract/local unless a hermetic adapter or dedicated test credentials are added.

## Branch protection mapping

Current stable required context: `Required checks summary`.

Current fan-in jobs:

- `lint`
- `unit-coverage`
- `build`
- `e2e-chromium`
- `e2e-live`
- `e2e-mobile`
- `e2e-visual`
- `pptx-corpus`
- `load-smoke`

Operator action required:

- Keep branch protection pointed at `Required checks summary` to avoid shard-name churn.
- Do not require `Feature coverage gate (warn-first, non-required)` until two consecutive green CI runs are recorded.
- Treat adding any job to `required-checks.needs` as an operator-approved required-check behavior change, even when the protected context name stays `Required checks summary`.
- After operator approval, add `feature-coverage-gate` to `required-checks.needs`; update branch protection only if the repository requires individual job contexts instead of the summary context.

## Rollback path

If a newly promoted gate blocks unrelated work:

1. Remove only the new job from `required-checks.needs`.
2. Keep the job and tests running as report-only.
3. Open a dated issue with owner, failure mode, and re-promotion criteria.
4. Re-promote after two consecutive green target-branch CI runs.

Do not delete tests or weaken assertions as the rollback mechanism.

## Quarantine policy

Every quarantine entry must include owner, linked issue, expiry date, severity, and whether it is release-strict debt.

Critical journey quarantine blocks release signoff. Non-critical quarantine can stay merge-allowed only while expiry is valid.

## Destructive loopback guard

Playwright API write helpers reject non-loopback `PLAYWRIGHT_TEST_BASE_URL`.

k6 destructive load scripts now preflight:

- `API_BASE_URL` must be `http://127.0.0.1`, `https://127.0.0.1`, `http://localhost`, or `https://localhost`.
- `WS_URL` must be `ws://127.0.0.1`, `wss://127.0.0.1`, `ws://localhost`, or `wss://localhost`.

The CI load-smoke job uses `http://127.0.0.1:3002/api` and `ws://127.0.0.1:3002/ws/?EIO=4&transport=websocket`.

## Secret and artifact scanning

Run before publishing release artifacts or sharing reports:

```bash
rg --no-ignore --hidden -n -I -e "(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9_]{36,}|BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY|AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9_-]{20,})" plans reports playwright-report test-results coverage dist dist-electron server/data server/uploads
```

For GitHub-side scanning, use secret scanning alerts when available and keep uploaded Playwright/coverage artifacts at `retention-days: 14`.

Unresolved questions:

- None.
