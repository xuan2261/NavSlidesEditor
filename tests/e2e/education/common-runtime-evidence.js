import { writeFile } from 'node:fs/promises'
import { observe } from './release-observations.js'

export async function recordCommon(
  testInfo,
  page,
  scenarioId,
  surface,
  expected,
  observed,
  artifacts = []
) {
  const data = testInfo.outputPath(`${scenarioId}-measured.json`)
  await writeFile(data, JSON.stringify({ expected, observed }, null, 2))
  await observe(
    testInfo,
    page,
    { element: 'game', capabilityId: `education.${scenarioId}`, surface },
    scenarioId,
    expected,
    observed,
    [...artifacts, data]
  )
}
