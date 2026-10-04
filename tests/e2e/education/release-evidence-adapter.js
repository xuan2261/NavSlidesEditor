import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import schema from '../../../shared/src/education/release-evidence-schema.js'
import release from '../../../shared/src/education/release-capabilities.js'
import { fileHash } from '../../../scripts/feature-inventory/education-evidence-files.mjs'

export const SCENARIO_ATTACHMENT = 'education-scenario'
export function scenarioAttachment(
  cell,
  { expected, observed, result = 'passed', artifacts = [], limitations = [], execution = {} }
) {
  const scenario = {
    ...cell,
    expected,
    observed,
    result,
    artifactPaths: artifacts.map((path) => resolve(path)),
    limitations,
    execution,
    timestamp: new Date().toISOString(),
  }
  schema.validateScenario(scenario)
  return {
    name: SCENARIO_ATTACHMENT,
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify(scenario)),
  }
}
export function collectScenarioRecords(attachments, status) {
  return attachments
    .filter((attachment) => attachment.name === SCENARIO_ATTACHMENT)
    .map((attachment) => {
      const scenario = JSON.parse(
        attachment.body ? attachment.body.toString('utf8') : readFileSync(attachment.path, 'utf8')
      )
      schema.validateScenario(scenario)
      return { ...scenario, result: status === 'passed' ? scenario.result : status }
    })
}
export async function recordScenario(testInfo, cell, options) {
  const { page, ...observation } = options
  const execution = { ...observation.execution }
  if (page) {
    execution.viewport =
      page.viewportSize() ||
      (await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })))
    const url = new URL(page.url())
    execution.protocol = url.protocol
    execution.origin = url.origin
    execution.browser = page.context().browser()?.browserType().name() || execution.browser
    execution.browserVersion = page.context().browser()?.version() || execution.browserVersion
  }
  if (
    !execution.viewport ||
    !execution.protocol ||
    !execution.origin ||
    !execution.browser ||
    !execution.browserVersion
  )
    throw new Error(
      'Scenario must provide actual page or complete execution viewport/protocol/origin/browser/browserVersion metadata.'
    )
  if (!observation.artifacts?.length)
    throw new Error('Scenario must attach actual observed screenshot/download artifact paths.')
  const attachment = scenarioAttachment(cell, { ...observation, execution })
  const record = JSON.parse(attachment.body.toString('utf8'))
  record.artifactFileHashes = Object.fromEntries(
    record.artifactPaths.map((path) => [path, fileHash(path)])
  )
  await testInfo.attach(SCENARIO_ATTACHMENT, {
    body: Buffer.from(JSON.stringify(record)),
    contentType: 'application/json',
  })
}
export const { cellKey, RELEASE_SCENARIOS, SCHEMA_VERSION } = release
export const { validateScenario, validateEvidenceRecord } = schema
