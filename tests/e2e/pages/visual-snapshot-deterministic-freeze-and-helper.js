import { expect } from '@playwright/test'

/**
 * Freeze UI for visual snapshot determinism. Disables animations, hides
 * blinking carets, and removes hover transitions across the page.
 * Baselines for these snapshots MUST be generated in the
 * mcr.microsoft.com/playwright:v1.59.1-jammy Docker container.
 * Running --update-snapshots on a Windows or macOS host produces drift
 * that the CI gate will reject (see plans/.../phase-06-*.md and Patch-02).
 */
export async function freezeUiForSnapshot(page) {
  await page.addStyleTag({
    content: `*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; caret-color: transparent !important; }
            ::cursor { display: none !important; }
            *[data-blink], .blinking, .cursor-blink { animation: none !important; }`,
  })
}

export async function suppressTutorialAndOverlays(page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('navSlidesTutorialSeen', 'true')
      window.localStorage.setItem('navSlidesProductTourSeen', 'true')
    } catch {}
  })
}

export async function expectStableScreenshot(page, name, opts = {}) {
  await freezeUiForSnapshot(page)
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
    threshold: 0.2,
    ...opts,
  })
}
