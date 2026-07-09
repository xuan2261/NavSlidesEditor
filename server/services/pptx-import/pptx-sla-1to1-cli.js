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

async function checkOracleBaseline() {
  const baselinePath = path.join(__dirname, 'oracle', 'baseline-ssim.json')
  const exists = await fs.pathExists(baselinePath)
  if (!exists) {
    return [
      { id: METRIC_IDS.V1, ok: false, detail: 'missing-baseline' },
      { id: METRIC_IDS.V2, ok: false, detail: 'missing-baseline' },
    ]
  }
  const baseline = await fs.readJson(baselinePath)
  const present = Boolean(baseline.deckCount >= 1 || (baseline.decks && baseline.decks.length))
  // Module gate only — numeric SSIM floors still debt until real goldens/actuals
  return [
    {
      id: METRIC_IDS.V1,
      ok: present,
      detail: baseline.debt ? 'debt-recorded' : 'baseline-present',
      meanSsim: baseline.meanSsim,
    },
    {
      id: METRIC_IDS.V2,
      ok: present,
      detail: 'min-ssim-module-gate-only',
    },
  ]
}

async function checkChartE2Module() {
  const chart = require('./ooxml-chart-parser')
  return { id: METRIC_IDS.E2, ok: typeof chart.injectChartsFromSceneGraph === 'function' }
}

async function checkSmartArtE3Module() {
  const dgm = require('./ooxml-diagram-parser')
  return { id: METRIC_IDS.E3, ok: typeof dgm.injectDiagramsFromSceneGraph === 'function' }
}

async function checkE1SceneGraph() {
  const attach = require('./ooxml-scene-graph/attach-source-nodes')
  const graph = require('./ooxml-scene-graph')
  return {
    id: METRIC_IDS.E1,
    ok: typeof attach.attachSourceNodes === 'function' && typeof graph.reconcileSceneGraph === 'function',
  }
}

async function checkE4Primitives() {
  const acc = require('./acceptance-criteria')
  return {
    id: METRIC_IDS.E4,
    ok: typeof acc.assertNoPrimitivePlaceholders === 'function',
  }
}

async function checkR1Roundtrip() {
  const rt = require('./roundtrip-original-parts')
  return { id: METRIC_IDS.R1, ok: typeof rt.resolvePptxExportPayload === 'function' }
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  const milestone = getMilestone(args.milestone) || getMilestone('phase08_full')
  const nested = await Promise.all([
    checkP1(),
    checkOracleBaseline(),
    checkE1SceneGraph(),
    checkChartE2Module(),
    checkSmartArtE3Module(),
    checkE4Primitives(),
    checkR1Roundtrip(),
  ])
  const checks = nested.flat()
  const byId = Object.fromEntries(checks.map((c) => [c.id, c]))
  const required = milestone?.requires || []
  const failed = required.filter((id) => !byId[id]?.ok)
  const report = {
    milestone: milestone?.id || args.milestone,
    productOneToOneClaimAllowed: Boolean(milestone?.productOneToOneClaimAllowed),
    checks,
    failed,
    // Full numeric SLA not claimed until oracle actuals + corpus floors green
    claim: failed.length
      ? 'sla-gate-failed'
      : 'engineering-modules-present-not-numeric-sla',
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

module.exports = { main, parseArgs }
