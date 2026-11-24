import { expect } from '@playwright/test'
import { resolve } from 'node:path'
import { loadRequiredCells } from '../../../scripts/feature-inventory/education-release-policy.mjs'
import { recordScenario } from './release-evidence-adapter.js'
import { ELEMENT_DEFAULTS } from '../../../client/src/data/element-defaults.js'

const root = resolve(__dirname, '../../..')
export async function observe(
  testInfo,
  page,
  identity,
  scenarioId,
  expected,
  observed,
  artifacts = [],
  execution = {}
) {
  const filter = {
    gameType: null,
    questionKind: null,
    presetId: null,
    mode: 'local',
    lane: 'production-browser',
    ...identity,
    scenarioId,
  }
  const cells = (await loadRequiredCells(root, ELEMENT_DEFAULTS)).filter((cell) =>
    Object.entries(filter).every(([key, value]) => cell[key] === value)
  )
  expect(cells, `Required cell not registered: ${JSON.stringify(filter)}`).toHaveLength(1)
  const filename =
    `${cells[0].capabilityId}-${filter.questionKind || filter.presetId || 'native'}-${filter.lane}-${scenarioId}`.replace(
      /[^a-z0-9.-]/gi,
      '-'
    )
  const screenshot = testInfo.outputPath(`${filename}.png`)
  await page.screenshot({ path: screenshot, fullPage: true })
  await recordScenario(testInfo, cells[0], {
    page,
    expected,
    observed,
    execution,
    artifacts: [...artifacts, screenshot],
  })
}
