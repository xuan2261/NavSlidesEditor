#!/usr/bin/env node
/**
 * Composite SLA gate for Phase 08c (engineering).
 * Exit 0 only when configured metric checks pass.
 * Does NOT claim product 1:1 unless phase08_full thresholds are green.
 */
const fs = require('fs-extra')
const path = require('node:path')
const { getMilestone, METRIC_IDS } = require('./sla-contract')

function parseArgs(argv) {
  const args = { milestone: 'phase08_full', json: false }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--milestone') args.milestone = argv[++i]
    if (argv[i] === '--json') args.json = true
  }
  return args
}

async function checkP1() {
  // original package module exists + baseline original.pptx API
  const mod = require('./original-package')
  return { id: METRIC_IDS.P1, ok: typeof mod.persistOriginalPptx === 'function' }
}

async function checkOracleBaseline(
  milestone,
  baselinePath = path.join(__dirname, 'oracle', 'baseline-ssim.json')
) {
  const exists = await fs.pathExists(baselinePath)
  if (!exists) {
    return [
      { id: METRIC_IDS.V1, ok: false, detail: 'missing-baseline' },
      { id: METRIC_IDS.V2, ok: false, detail: 'missing-baseline' },
    ]
  }
  const baseline = await fs.readJson(baselinePath)
  const present = Boolean(
    (typeof baseline.deckCount === 'number' &&
      Number.isInteger(baseline.deckCount) &&
      baseline.deckCount >= 1) ||
      (Array.isArray(baseline.decks) && baseline.decks.length >= 1)
  )
  const numeric = present && baseline.debt === false
  const mean = baseline.meanSsim
  const min = baseline.minSsim
  const meanOk =
    numeric &&
    typeof mean === 'number' &&
    Number.isFinite(mean) &&
    (milestone?.meanSsim == null || mean >= milestone.meanSsim)
  const minOk =
    numeric &&
    typeof min === 'number' &&
    Number.isFinite(min) &&
    (milestone?.minSsim == null || min >= milestone.minSsim)
  return [
    {
      id: METRIC_IDS.V1,
      ok: meanOk,
      detail: baseline.debt ? 'debt-recorded-not-evidence' : meanOk ? 'numeric-mean-pass' : 'numeric-mean-fail',
      meanSsim: baseline.meanSsim,
    },
    {
      id: METRIC_IDS.V2,
      ok: minOk,
      detail: baseline.debt ? 'debt-recorded-not-evidence' : minOk ? 'numeric-min-pass' : 'missing-or-failing-min',
      minSsim: baseline.minSsim,
    },
  ]
}

function metricCheck(id, actual, limit, comparison = 'max') {
  const numeric = typeof actual === 'number' && Number.isFinite(actual)
  const ok =
    numeric &&
    (limit == null ||
      (comparison === 'min' ? actual >= Number(limit) : actual <= Number(limit)))
  return { id, ok, actual: numeric ? actual : null, limit, detail: ok ? 'numeric-pass' : 'missing-or-failing-evidence' }
}

async function checkCorpusEvidence(milestone, baselinePath = path.join(__dirname, 'corpus-baseline.json')) {
  if (!(await fs.pathExists(baselinePath))) {
    return [METRIC_IDS.E1, METRIC_IDS.E2, METRIC_IDS.E3, METRIC_IDS.E4, METRIC_IDS.R1]
      .map((id) => ({ id, ok: false, detail: 'missing-corpus-baseline' }))
  }
  const baseline = await fs.readJson(baselinePath)
  const evidence = baseline.summary?.corpusEvidence || {}
  if (baseline.evidenceVersion !== 2) {
    return [METRIC_IDS.E1, METRIC_IDS.E2, METRIC_IDS.E3, METRIC_IDS.E4, METRIC_IDS.R1]
      .map((id) => ({ id, ok: false, detail: 'stale-corpus-evidence' }))
  }
  return [
    metricCheck(METRIC_IDS.E1, evidence.sceneGraphUnmapped, milestone.sceneGraphUnmappedMax),
    metricCheck(METRIC_IDS.E2, evidence.chartCoverageGapCount, milestone.chartGapMax),
    metricCheck(METRIC_IDS.E3, evidence.smartArtCoverageGapCount, milestone.smartArtGapMax),
    metricCheck(METRIC_IDS.E4, evidence.permanentPlaceholderCount, milestone.permanentPlaceholderMax),
    metricCheck(METRIC_IDS.R1, baseline.summary?.avgRoundTripStability, milestone.roundTripMin, 'min'),
  ]
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  const milestone = getMilestone(args.milestone) || getMilestone('phase08_full')
  const nested = await Promise.all([
    checkP1(),
    checkOracleBaseline(milestone),
    checkCorpusEvidence(milestone),
  ])
  const checks = nested.flat()
  const byId = Object.fromEntries(checks.map((c) => [c.id, c]))
  const required = milestone?.requires || []
  const failed = required.filter((id) => !byId[id]?.ok)
  const report = {
    milestone: milestone?.id || args.milestone,
    productOneToOneClaimAllowed:
      Boolean(milestone?.productOneToOneClaimAllowed) && failed.length === 0,
    checks,
    failed,
    // Full numeric SLA not claimed until oracle actuals + corpus floors green
    claim: failed.length ? 'sla-gate-failed' : 'numeric-sla-evidence-passed',
  }
  if (args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  else {
    process.stdout.write(`SLA gate ${report.milestone}: ${failed.length ? 'FAIL' : 'PASS'} (${report.claim})\n`)
    for (const c of checks) process.stdout.write(`  ${c.id}: ${c.ok ? 'ok' : 'FAIL'} ${c.detail || ''}\n`)
  }
  return failed.length ? 1 : 0
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}

module.exports = { checkCorpusEvidence, checkOracleBaseline, main, metricCheck, parseArgs }
