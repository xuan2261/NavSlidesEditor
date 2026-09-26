import crypto from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const IMAGE_DIGEST = /^sha256:[a-f0-9]{64}$/
const hash = (value) =>
  crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')

function assertSbom(sbom) {
  const spdx = typeof sbom?.spdxVersion === 'string' && sbom.spdxVersion.startsWith('SPDX-')
  const cyclonedx = sbom?.bomFormat === 'CycloneDX'
  if (!spdx && !cyclonedx) throw new Error('SPDX or CycloneDX SBOM is required')
  if (!Array.isArray(sbom.packages ?? sbom.components) || !(sbom.packages ?? sbom.components).length) {
    throw new Error('SBOM package inventory is empty')
  }
}

function approvedException(vulnerability, policy) {
  const matches = policy.exceptions.filter(
    (entry) =>
      entry.id === vulnerability.VulnerabilityID &&
      (!entry.package || entry.package === vulnerability.PkgName)
  )
  return matches.length > 0
}

export function verifyContainerSupplyChain(input, now = Date.now()) {
  const { policy, report, sbom, browser, expected, actualImageDigest } = input
  if (policy?.schemaVersion !== 1) throw new Error('unsupported container policy schema')
  if (!Array.isArray(policy.failSeverities) || !Array.isArray(policy.exceptions)) {
    throw new Error('container policy is invalid')
  }
  for (const entry of policy.exceptions) {
    if (!entry.id || !entry.reason || !Number.isFinite(Date.parse(entry.expires))) {
      throw new Error(`invalid exception for ${entry.id ?? 'unknown'}`)
    }
    if (Date.parse(entry.expires) <= now) throw new Error(`expired exception for ${entry.id}`)
  }
  if (!IMAGE_DIGEST.test(actualImageDigest) || actualImageDigest !== expected.imageDigest) {
    throw new Error('container image digest mismatch')
  }
  assertSbom(sbom)
  if (browser?.playwrightVersion !== expected.playwrightVersion) {
    throw new Error('Playwright version drift')
  }
  if (!browser?.chromium?.revision || !browser.chromium.executablePath) {
    throw new Error('Chromium inventory is incomplete')
  }
  if (String(browser.chromium.revision) !== String(expected.chromiumRevision)) {
    throw new Error('Chromium revision drift')
  }
  const vulnerabilities = (report?.Results ?? []).flatMap((result) =>
    (result.Vulnerabilities ?? []).map((entry) => ({ ...entry, target: result.Target }))
  )
  const failures = vulnerabilities.filter(
    (entry) =>
      policy.failSeverities.includes(entry.Severity) &&
      !approvedException(entry, policy)
  )
  if (failures.length) {
    throw new Error(
      `unapproved vulnerabilities: ${failures
        .map((entry) => `${entry.VulnerabilityID}:${entry.PkgName}`)
        .join(',')}`
    )
  }
  return {
    schemaVersion: 1,
    status: 'passed',
    imageDigest: actualImageDigest,
    playwrightVersion: browser.playwrightVersion,
    chromiumRevision: String(browser.chromium.revision),
    vulnerabilityCount: vulnerabilities.length,
    policyHash: hash(policy),
    reportHash: hash(report),
    sbomHash: hash(sbom),
    browserInventoryHash: hash(browser),
  }
}

function parseArgs(args) {
  const values = {}
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]
    const value = args[index + 1]
    if (!key?.startsWith('--') || !value) throw new Error(`invalid argument ${key ?? ''}`)
    values[key.slice(2).replace(/-([a-z])/g, (_, character) => character.toUpperCase())] = value
  }
  return values
}

export async function runCli(args) {
  const values = parseArgs(args)
  const load = async (name) => JSON.parse(await readFile(values[name], 'utf8'))
  const actualImageDigest = (await readFile(values.imageDigest, 'utf8')).trim()
  const receipt = verifyContainerSupplyChain({
    policy: await load('policy'),
    report: await load('report'),
    sbom: await load('sbom'),
    browser: await load('browser'),
    expected: {
      imageDigest: values.expectedImageDigest,
      playwrightVersion: values.playwrightVersion,
      chromiumRevision: values.chromiumRevision,
    },
    actualImageDigest,
  })
  await writeFile(values.out, `${JSON.stringify(receipt, null, 2)}\n`)
  return receipt
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(process.argv.slice(2)).catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
