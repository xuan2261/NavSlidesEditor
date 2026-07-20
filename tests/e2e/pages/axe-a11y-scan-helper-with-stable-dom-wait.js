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
 * Run an axe scan after waiting for DOM stability.
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
  const blocking = results.violations.filter((v) =>
    v.impact === 'critical' || v.impact === 'serious'
  )
  return { results, critical, blocking, label }
}

/**
 * Known serious or critical a11y node targets baselined from current implementation.
 * These are real component bugs (unlabeled selects, untitled inputs) that
 * require component refactoring outside the Phase 7 coverage scope.
 * The gate asserts no new serious or critical violations beyond this baseline.
 * Tracked in reports/a11y-baseline-known-critical-violations-2026-05-19.md.
 */
export const A11Y_BASELINE_KNOWN_BLOCKING = {
  editor: {},
  home: {
    'frame-focusable-content': ['["iframe","html"]'],
    'select-name': ['["select"]'],
  },
  present: {
    'html-has-lang': ['["html"]'],
  },
  share: {
    'html-has-lang': ['["html"]'],
  },
  'live-viewer': {},
  settings: {
    'button-name': ['[".px-2\\\\.5"]'],
  },
  'share-modal': {},
}

export function newBlockingViolations(violations, baselineLabel) {
  const baseline = A11Y_BASELINE_KNOWN_BLOCKING[baselineLabel] || {}
  return violations.flatMap((violation) => {
    const allowedTargets = new Set(baseline[violation.id] || [])
    const newNodes = violation.nodes.filter(
      (node) => !allowedTargets.has(JSON.stringify(node.target))
    )
    return newNodes.length ? [{ ...violation, nodes: newNodes }] : []
  })
}
