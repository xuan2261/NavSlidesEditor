const FEATURES = Object.freeze([
  'objects',
  'geometry',
  'text',
  'style',
  'relationships',
  'charts',
  'diagrams',
  'animations',
  'notes',
  'comments',
  'hyperlinks',
])
const REQUIRED_EVIDENCE = Object.freeze(['corpus', 'semantic', 'roundtrip', 'drift'])

function evidenceComplete(policy) {
  const evidence = policy?.evidence || {}
  if (!REQUIRED_EVIDENCE.every((key) => evidence[key] === true)) return false
  return !(policy.claimLevel >= 5 && evidence.protectedProvider !== true)
}

function resolveFeature(policy = {}) {
  const promoted = policy.requestedSource === 'officecli' && evidenceComplete(policy)
  return Object.freeze({
    source: promoted ? 'officecli' : 'native',
    promoted,
    requestedSource: policy.requestedSource || 'native',
    evidenceComplete: evidenceComplete(policy),
    patchAuthority: false,
  })
}

function resolvePromotionPolicy(input = {}) {
  const features = new Set([...FEATURES, ...Object.keys(input)])
  return Object.freeze(Object.fromEntries(
    [...features].sort().map((feature) => [feature, resolveFeature(input[feature])])
  ))
}

module.exports = {
  PROMOTION_FEATURES: FEATURES,
  REQUIRED_PROMOTION_EVIDENCE: REQUIRED_EVIDENCE,
  resolvePromotionPolicy,
}
