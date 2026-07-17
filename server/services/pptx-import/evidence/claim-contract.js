const CLAIM_LEVELS = Object.freeze([
  'original-recovery',
  'package-preservation',
  'valid-edited-package',
  'feature-editability',
  'powerpoint-compatibility-visual-fidelity',
])

const CLAIM_WORDING = Object.freeze({
  'original-recovery': 'Original PPTX bytes can be recovered.',
  'package-preservation': 'The original package and edited package lineage are preserved.',
  'valid-edited-package': 'The edited output is a structurally valid PPTX package.',
  'feature-editability': 'Covered features remain semantically editable.',
  'powerpoint-compatibility-visual-fidelity':
    'The edited package meets the pinned PowerPoint visual-fidelity policy.',
})

function claimIndex(claimLevel) {
  return CLAIM_LEVELS.indexOf(claimLevel)
}

module.exports = { CLAIM_LEVELS, CLAIM_WORDING, claimIndex }
