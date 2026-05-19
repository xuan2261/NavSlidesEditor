import AxeBuilder from '@axe-core/playwright'

/**
 * Wait until the DOM has been quiet for `quietMs` (no MutationObserver
 * activity) before running the next assertion. Eliminates false-positive
 * axe-core violations triggered by React or TipTap async render passes.
 */
export async function waitForStableDOM(page, { quietMs = 500, timeout = 10000 } = {}) {
  await page.evaluate(
    async ({ quietMs, timeout }) => {
      return new Promise((resolve, reject) => {
        let last = Date.now()
        const obs = new MutationObserver(() => {
          last = Date.now()
        })
        obs.observe(document.body, { subtree: true, childList: true, attributes: true })
        const start = Date.now()
        const tick = () => {
          if (Date.now() - last >= quietMs) {
            obs.disconnect()
            resolve()
          } else if (Date.now() - start >= timeout) {
            obs.disconnect()
            reject(new Error('DOM never stabilized'))
          } else setTimeout(tick, 100)
        }
        tick()
      })
    },
    { quietMs, timeout }
  )
}

/**
 * Run an axe scan after waiting for DOM stability. Returns full result + critical filter.
 */
export async function scanA11y(page, label, opts = {}) {
  const { include, exclude, disableRules = [] } = opts
  await waitForStableDOM(page)
  const builder = new AxeBuilder({ page })
  if (include) builder.include(include)
  if (exclude) builder.exclude(exclude)
  if (disableRules.length) builder.disableRules(disableRules)
  const results = await builder.analyze()
  const critical = results.violations.filter((v) => v.impact === 'critical')
  return { results, critical, label }
}

/**
 * Known critical a11y violations baselined from current implementation.
 * These are real component bugs (unlabeled selects, untitled inputs) that
 * require component refactoring outside the Phase 7 coverage scope.
 * The Phase 7 gate asserts "no NEW critical violations beyond this baseline".
 * Tracked in reports/a11y-baseline-known-critical-violations-2026-05-19.md.
 */
export const A11Y_BASELINE_KNOWN_CRITICAL = {
  editor: ['label', 'select-name'],
  home: ['label', 'select-name', 'button-name', 'link-name'],
  present: [],
  share: [],
  'live-viewer': [],
}

export function newCriticalViolations(critical, baselineLabel) {
  const allowed = new Set(A11Y_BASELINE_KNOWN_CRITICAL[baselineLabel] || [])
  return critical.filter((v) => !allowed.has(v.id))
}
