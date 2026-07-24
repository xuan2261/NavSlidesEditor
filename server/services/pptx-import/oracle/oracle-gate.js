const { getMilestone } = require('../sla-contract')

const BLOCKED_REASON = /^(?:missing-|unavailable|pptx-oracle-disabled|oracle-off|incomplete-)|-unavailable$/
const FLOAT_COMPARE_EPSILON = Number.EPSILON * 8
const unique = (values) => [...new Set(values)].sort()

function evidenceReasons(name, result) {
  if (result?.valid === true) return []
  return Array.isArray(result?.reasons) && result.reasons.length ? result.reasons : [`invalid-${name}-evidence`]
}

function comparisonSummary(comparison) {
  if (!comparison || comparison.failed || !Array.isArray(comparison.decks) || !comparison.decks.length) {
    return { reasons: ['visual-comparison-failed'] }
  }
  if (!Number.isSafeInteger(comparison.deckCount) || comparison.deckCount !== comparison.decks.length) {
    return { reasons: ['comparison-deck-inventory-mismatch'] }
  }
  const scores = []
  const files = new Set()
  for (const deck of comparison.decks) {
    if (typeof deck?.file !== 'string' || !deck.file || files.has(deck.file)) {
      return { reasons: ['comparison-deck-inventory-mismatch'] }
    }
    files.add(deck.file)
    if (deck.ok !== true || !Array.isArray(deck.slides) || !deck.slides.length) return { reasons: ['comparison-slide-inventory-mismatch'] }
    for (let index = 0; index < deck.slides.length; index += 1) {
      const slide = deck.slides[index]
      if (slide?.index !== index || !Number.isFinite(slide.ssim) || slide.ssim < 0 || slide.ssim > 1) {
        return { reasons: ['non-finite-visual-scores'] }
      }
      scores.push(slide.ssim)
    }
  }
  const meanSsim = scores.reduce((sum, score) => sum + score, 0) / scores.length
  const minSsim = Math.min(...scores)
  if (comparison.meanSsim !== meanSsim || comparison.minSsim !== minSsim) {
    return { reasons: ['comparison-summary-mismatch'] }
  }
  return { meanSsim, minSsim, reasons: [] }
}

function verdictForReasons(reasons) {
  return reasons.some((reason) => BLOCKED_REASON.test(reason)) ? 'blocked' : 'failed'
}

function evaluateVisualGate({ oracleDisabled = false, envelope, golden, source, actual, comparison } = {}) {
  const policy = getMilestone('phase08_full')
  const reasons = []
  if (oracleDisabled) reasons.push('pptx-oracle-disabled')
  for (const [name, result] of Object.entries({ envelope, golden, source, actual })) {
    reasons.push(...evidenceReasons(name, result))
  }
  const summary = comparisonSummary(comparison)
  reasons.push(...summary.reasons)
  const integrityReasons = unique(reasons)
  const integrity = integrityReasons.length
    ? { verdict: verdictForReasons(integrityReasons), reasons: integrityReasons }
    : { verdict: 'passed', reasons: [] }
  if (integrity.verdict !== 'passed') {
    return {
      policy: { id: policy.id, meanSsim: policy.meanSsim, minSsim: policy.minSsim }, integrity,
      qualification: { verdict: 'blocked', reasons: ['integrity-not-passed'] },
    }
  }
  const qualificationReasons = []
  if (summary.meanSsim + FLOAT_COMPARE_EPSILON < policy.meanSsim) qualificationReasons.push('mean-ssim-below-phase08-full-policy')
  if (summary.minSsim + FLOAT_COMPARE_EPSILON < policy.minSsim) qualificationReasons.push('slide-ssim-below-phase08-full-policy')
  return {
    policy: { id: policy.id, meanSsim: policy.meanSsim, minSsim: policy.minSsim }, integrity,
    qualification: qualificationReasons.length
      ? { verdict: 'failed', reasons: qualificationReasons }
      : { verdict: 'passed', reasons: [] },
  }
}

function gateExitCode(result, mode) {
  if (mode === 'integrity') return result?.integrity?.verdict === 'passed' ? 0 : 1
  if (mode === 'qualification' || mode === 'qualify') return result?.qualification?.verdict === 'passed' ? 0 : 1
  return 1
}

module.exports = { comparisonSummary, evaluateVisualGate, gateExitCode }
