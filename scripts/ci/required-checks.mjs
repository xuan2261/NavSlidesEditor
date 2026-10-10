import { pathToFileURL } from 'node:url'

export const REQUIRED_JOB_IDS = Object.freeze([
  'lint',
  'unit-coverage',
  'vitest-performance-budget',
  'build',
  'e2e-chromium',
  'e2e-pptx-import',
  'e2e-live',
  'e2e-mobile',
  'e2e-visual',
  'pptx-corpus-metrics',
  'load-smoke',
  'docker-artifact',
  'container-supply-chain',
])

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function verifyRequiredChecks(needs) {
  if (!isRecord(needs)) throw new Error('needs must be a JSON object of job results')
  const rejected = REQUIRED_JOB_IDS.filter((id) => {
    if (!Object.hasOwn(needs, id)) return true
    const job = needs[id]
    return !isRecord(job) || !Object.hasOwn(job, 'result') || job.result !== 'success'
  })
  if (rejected.length > 0) {
    throw new Error(`Required jobs missing or not successful: ${rejected.join(', ')}`)
  }
}

function main() {
  try {
    let needs
    try {
      needs = JSON.parse(process.env.NEEDS_JSON ?? '')
    } catch {
      // Parser errors can include input bytes; keep untrusted job data out of logs.
      throw new Error('NEEDS_JSON must contain valid JSON job results')
    }
    verifyRequiredChecks(needs)
    console.log(`All ${REQUIRED_JOB_IDS.length} required jobs succeeded`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
