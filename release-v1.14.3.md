# NavSlides Editor v1.14.3

Release date: 2026-06-16

## Highlights

- Completed the long-term automated coverage expansion pass with depth-tag governance, canonical element behavior evidence, browser-depth workflows, external-boundary contracts, visual/a11y/k6 lane ownership, and manual-smoke disposition.
- Stabilized GitHub full CI after coverage expansion: feature coverage captures fresh Playwright JSON evidence, mobile a11y is scoped to the intended touch suite, and the critical create/edit/persist journey waits for the autosave request containing the edited marker before reload.
- Split visual regression into a dedicated `chromium-visual` Playwright project while preserving canonical `chromium` snapshot filenames, avoiding duplicate baselines.
- Tightened release-confidence evidence so the required matrix, E2E shards, visual regression, mobile, live, PPTX corpus, feature coverage, and k6 lanes pass together on `master`.
- Synchronized root and workspace package versions to `1.14.3`.

## Verification

- GitHub CI run `27608087560` passed:
  - Lint
  - Unit + Coverage Gate
  - Build client
  - Feature coverage gate
  - PPTX corpus fidelity
  - E2E chromium shards 1/4, 2/4, 3/4, and 4/4
  - E2E visual regression
  - E2E mobile-chromium
  - E2E live
  - k6 load smoke
  - Required checks summary
- Local focused verification passed during release prep:
  - `npx playwright test tests/e2e/critical-user-journeys.spec.js --project=chromium`
  - `npx vitest run tests/unit/no-wait-for-timeout.test.js tests/unit/playwright-config.test.js`
  - `npm run lint`
