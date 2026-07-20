/**
 * Engineering milestone contract for PPTX import 1:1 fidelity.
 * Product claim of full 1:1 is only valid after the final milestone row is green.
 * Metric ids match plans/260709-1306-.../plan.md Global SLA metrics.
 */

const METRIC_IDS = Object.freeze({
  P1: 'P1',
  V1: 'V1',
  V2: 'V2',
  E1: 'E1',
  E2: 'E2',
  E3: 'E3',
  E4: 'E4',
  R1: 'R1',
  G0: 'G0',
  G1: 'G1',
})

const { CLAIM_LEVELS, CLAIM_WORDING } = require('./evidence/evidence-contract')

const CLAIM_POLICIES = Object.freeze(Object.fromEntries(CLAIM_LEVELS.map((claimLevel, index) => [
  claimLevel,
  Object.freeze({
    claimLevel,
    level: index + 1,
    requiresProtectedCi: true,
    requiresProtectedProvider: index === CLAIM_LEVELS.length - 1,
    allowedWording: CLAIM_WORDING[claimLevel],
  }),
])))

/**
 * Progressive engineering gates (not product 1:1 until phase08_full).
 * meanSsim / minSsim null means not required at that milestone.
 */
const MILESTONES = Object.freeze({
  phase01: Object.freeze({
    id: 'phase01',
    requires: Object.freeze([METRIC_IDS.P1]),
    meanSsim: null,
    minSsim: null,
    permanentPlaceholderMax: null,
    chartGapMax: null,
    smartArtGapMax: null,
    originalPptxRequired: true,
  }),
  phase02: Object.freeze({
    id: 'phase02',
    requires: Object.freeze([METRIC_IDS.P1, METRIC_IDS.V1, METRIC_IDS.V2]),
    meanSsim: null,
    minSsim: null,
    permanentPlaceholderMax: null,
    chartGapMax: null,
    smartArtGapMax: null,
    originalPptxRequired: true,
    baselineRecorded: true,
  }),
  phase04: Object.freeze({
    id: 'phase04',
    requires: Object.freeze([METRIC_IDS.P1, METRIC_IDS.V1, METRIC_IDS.V2, METRIC_IDS.E1, METRIC_IDS.E4]),
    meanSsim: 0.95,
    minSsim: null,
    permanentPlaceholderMax: 0,
    chartGapMax: null,
    smartArtGapMax: null,
    originalPptxRequired: true,
  }),
  phase05: Object.freeze({
    id: 'phase05',
    requires: Object.freeze([METRIC_IDS.P1, METRIC_IDS.V1, METRIC_IDS.V2, METRIC_IDS.E2, METRIC_IDS.E4]),
    meanSsim: 0.97,
    minSsim: null,
    permanentPlaceholderMax: 0,
    chartGapMax: 0,
    smartArtGapMax: null,
    originalPptxRequired: true,
  }),
  phase06_07: Object.freeze({
    id: 'phase06_07',
    requires: Object.freeze([METRIC_IDS.P1, METRIC_IDS.V1, METRIC_IDS.V2, METRIC_IDS.E3, METRIC_IDS.E4]),
    meanSsim: 0.98,
    minSsim: null,
    permanentPlaceholderMax: 0,
    chartGapMax: 0,
    smartArtGapMax: 0,
    originalPptxRequired: true,
  }),
  phase08_full: Object.freeze({
    id: 'phase08_full',
    requires: Object.freeze([
      METRIC_IDS.P1,
      METRIC_IDS.V1,
      METRIC_IDS.V2,
      METRIC_IDS.E1,
      METRIC_IDS.E2,
      METRIC_IDS.E3,
      METRIC_IDS.E4,
      METRIC_IDS.R1,
    ]),
    meanSsim: 0.99,
    minSsim: 0.97,
    permanentPlaceholderMax: 0,
    chartGapMax: 0,
    smartArtGapMax: 0,
    sceneGraphUnmappedMax: 0,
    roundTripMin: 0.99,
    originalPptxRequired: true,
    productOneToOneClaimAllowed: true,
  }),
})

function getMilestone(id) {
  return MILESTONES[id] || null
}

function phase01RequiresP1Only() {
  const m = MILESTONES.phase01
  return m.requires.length === 1 && m.requires[0] === METRIC_IDS.P1 && m.originalPptxRequired === true
}

module.exports = {
  CLAIM_LEVELS,
  CLAIM_POLICIES,
  METRIC_IDS,
  MILESTONES,
  getMilestone,
  phase01RequiresP1Only,
}
