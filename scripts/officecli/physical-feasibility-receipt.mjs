import {
  assertReviewedManifest,
  assertSafeReceipt,
  failure,
} from './physical-feasibility-support.mjs'

const FIXTURES = new Map([
  [
    'officecli-positive-powerpoint-16.pptx',
    {
      sha256: '29B2D6F12E922204C4A914D3C3BC427FF48B0915231DFF37DCF3F91A21D00FC2',
      actual: 'accepted',
      validationPath: 'production-preflight-and-gateway',
      reasonCode: null,
      exitCode: 0,
    },
  ],
  [
    'bad-crc.pptx',
    {
      sha256: '9D572715870493397798E82473593F4CF373B01DDDEB8175EAB034C131274607',
      actual: 'rejected',
      validationPath: 'production-preflight',
      reasonCode: 'zip-crc-mismatch',
      exitCode: null,
    },
  ],
  [
    'malformed-xml.pptx',
    {
      sha256: '4F3B3BC9E807BAF99ECD2C462BBB95D7212457AC24CA424B69903DF73425E55C',
      actual: 'rejected',
      validationPath: 'production-preflight',
      reasonCode: 'xml-dtd-prohibited',
      exitCode: null,
    },
  ],
])

function invalid(message) {
  throw failure('AUTHORITATIVE_RECEIPT_INVALID', message)
}

function assertProcessEvidence(processes) {
  if (!Array.isArray(processes) || processes.length < 2) invalid('Process evidence is incomplete')
  const versionProcesses = processes.filter((entry) => entry.operation === 'version')
  const validationProcesses = processes.filter((entry) => entry.operation === 'validate')
  if (
    versionProcesses.length === 0 ||
    validationProcesses.length !== 1 ||
    versionProcesses.length + validationProcesses.length !== processes.length
  ) {
    invalid('Process evidence is incomplete')
  }
  for (const process of [...versionProcesses, ...validationProcesses]) {
    if (
      process.exitCode !== 0 ||
      !Number.isSafeInteger(process.stdoutBytes) ||
      !Number.isSafeInteger(process.stderrBytes) ||
      !Number.isFinite(process.durationMs) ||
      !/^[A-F0-9]{64}$/.test(process.stdoutSha256 || '') ||
      !/^[A-F0-9]{64}$/.test(process.stderrSha256 || '')
    ) {
      invalid(`${process.operation} process evidence is invalid`)
    }
  }
}

export function assertAuthoritativeReceipt(receipt, manifest, expectedSourceCommit) {
  assertReviewedManifest(manifest)
  assertSafeReceipt(receipt)
  if (!/^[a-f0-9]{40}$/.test(expectedSourceCommit ?? ''))
    invalid('Expected source commit is required')
  if (receipt?.schemaVersion !== 2 || receipt.status !== 'passed' || receipt.authoritative !== true)
    invalid('Receipt is not authoritative')
  if (receipt.claimScope !== 'local-physical-feasibility') {
    invalid('Receipt claim scope must remain local physical feasibility')
  }
  if (
    receipt.subject?.commit !== expectedSourceCommit ||
    receipt.subject?.worktree?.clean !== true ||
    receipt.subject?.worktree?.trackedClean !== true ||
    receipt.subject?.worktree?.untrackedClean !== true
  ) {
    invalid('Source subject does not match the clean expected commit')
  }
  if (
    !Number.isFinite(Date.parse(receipt.acquiredAt)) ||
    receipt.upstream?.releasePage !== manifest.upstream.releasePage ||
    receipt.upstream?.assetUrl !== manifest.releaseAsset.sourceAssetUrl ||
    !Number.isFinite(receipt.durationMs) ||
    receipt.durationMs < 0
  ) {
    invalid('Acquisition or upstream evidence is invalid')
  }
  const binary = receipt.binary
  if (
    binary?.version !== manifest.version ||
    binary?.sha256 !== manifest.releaseAsset.sha256 ||
    binary?.byteLength !== manifest.releaseAsset.byteLength
  ) {
    invalid('Binary identity does not match the canonical manifest')
  }
  const legal = receipt.legal
  if (
    legal?.spdx !== manifest.license.spdx ||
    legal?.licenseTextSha256 !== manifest.license.textSha256 ||
    legal?.upstreamNoticeStatus !== manifest.license.upstreamNoticeStatus ||
    legal?.redistributionReviewStatus !== manifest.license.redistributionReviewStatus
  ) {
    invalid('Legal evidence does not match the canonical manifest')
  }
  if (
    receipt.processPolicy?.stdoutBounded !== true ||
    receipt.processPolicy?.stderrBounded !== true ||
    receipt.processPolicy?.shellDisabled !== true ||
    receipt.processPolicy?.runtimeDownload !== false ||
    receipt.processPolicy?.pathLookup !== false ||
    receipt.processPolicy?.memoryLimitEnforced !== false ||
    receipt.processPolicy?.descendantProcessLimitEnforced !== false ||
    !receipt.processPolicy?.limitations?.includes('memory-limit-unproven') ||
    !receipt.processPolicy?.limitations?.includes('descendant-containment-unproven')
  ) {
    invalid('Known process limitations are not disclosed')
  }
  const context = receipt.executionContext
  if (
    context?.account !== 'invoking-account' ||
    context?.accountIsolationClaim !== false ||
    context?.egressDenialClaim !== false ||
    context?.containmentClaim !== false ||
    context?.riskCode !== 'invoking-account-file-and-network-access'
  ) {
    invalid('Execution context and residual risk are not disclosed')
  }
  if (!Array.isArray(receipt.fixtures) || receipt.fixtures.length !== FIXTURES.size) {
    invalid('Fixture evidence is incomplete')
  }
  const fixtureNames = new Set()
  for (const fixture of receipt.fixtures) {
    if (fixtureNames.has(fixture?.name)) invalid('Fixture identity is duplicated')
    fixtureNames.add(fixture?.name)
    const expected = FIXTURES.get(fixture?.name)
    if (
      !expected ||
      fixture.sha256 !== expected.sha256 ||
      fixture.actual !== expected.actual ||
      fixture.validationPath !== expected.validationPath ||
      fixture.reasonCode !== expected.reasonCode ||
      fixture.exitCode !== expected.exitCode ||
      fixture.ok !== true
    ) {
      invalid(`Fixture evidence is invalid: ${fixture?.name || 'unknown'}`)
    }
  }
  if (fixtureNames.size !== FIXTURES.size) invalid('Fixture identity coverage is incomplete')

  assertProcessEvidence(receipt.processes)
  if (
    typeof receipt.host?.platform !== 'string' ||
    typeof receipt.host?.release !== 'string' ||
    typeof receipt.host?.arch !== 'string' ||
    !/^[A-F0-9]{64}$/.test(receipt.host?.identityHash || '')
  ) {
    invalid('Host evidence is invalid')
  }
  return receipt
}
