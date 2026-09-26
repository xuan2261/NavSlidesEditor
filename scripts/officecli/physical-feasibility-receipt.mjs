import {
  assertReviewedManifest,
  assertSafeReceipt,
  failure,
} from './physical-feasibility-support.mjs'

const FIXTURES = new Map([
  ['good-package.pptx', {
    sha256: 'A870BA588E1F29D0DE0814C2F52977A2556A3041A4291FB19174E210274C17D1',
    actual: 'accepted',
    validationPath: 'production-preflight-and-gateway',
    reasonCode: null,
  }],
  ['bad-crc.pptx', {
    sha256: '9D572715870493397798E82473593F4CF373B01DDDEB8175EAB034C131274607',
    actual: 'rejected',
    validationPath: 'production-preflight',
    reasonCode: 'zip-crc-mismatch',
  }],
  ['malformed-xml.pptx', {
    sha256: '4F3B3BC9E807BAF99ECD2C462BBB95D7212457AC24CA424B69903DF73425E55C',
    actual: 'rejected',
    validationPath: 'production-preflight',
    reasonCode: 'xml-dtd-prohibited',
  }],
])

function invalid(message) {
  throw failure('AUTHORITATIVE_RECEIPT_INVALID', message)
}

function assertProcessEvidence(processes) {
  if (!Array.isArray(processes) || processes.length < 2) invalid('Process evidence is incomplete')
  for (const operation of ['version', 'validate']) {
    const process = processes.find((entry) => entry.operation === operation)
    if (process?.exitCode !== 0 ||
        !Number.isSafeInteger(process.stdoutBytes) ||
        !Number.isSafeInteger(process.stderrBytes) ||
        !Number.isFinite(process.durationMs) ||
        !/^[A-F0-9]{64}$/.test(process.stdoutSha256 || '') ||
        !/^[A-F0-9]{64}$/.test(process.stderrSha256 || '')) {
      invalid(`${operation} process evidence is invalid`)
    }
  }
}

export function assertAuthoritativeReceipt(receipt, manifest) {
  assertReviewedManifest(manifest)
  assertSafeReceipt(receipt)
  if (receipt?.schemaVersion !== 1 || receipt.status !== 'passed' ||
      receipt.authoritative !== true) invalid('Receipt is not authoritative')
  if (!Number.isFinite(Date.parse(receipt.acquiredAt)) ||
      receipt.upstream?.releasePage !== manifest.upstream.releasePage ||
      receipt.upstream?.assetUrl !== manifest.releaseAsset.sourceAssetUrl ||
      !Number.isFinite(receipt.durationMs) || receipt.durationMs < 0) {
    invalid('Acquisition or upstream evidence is invalid')
  }
  const binary = receipt.binary
  if (binary?.version !== manifest.version ||
      binary?.sha256 !== manifest.releaseAsset.sha256 ||
      binary?.byteLength !== manifest.releaseAsset.byteLength) {
    invalid('Binary identity does not match the canonical manifest')
  }
  const legal = receipt.legal
  if (legal?.spdx !== manifest.license.spdx ||
      legal?.licenseTextSha256 !== manifest.license.textSha256 ||
      legal?.upstreamNoticeStatus !== manifest.license.upstreamNoticeStatus ||
      legal?.redistributionReviewStatus !== manifest.license.redistributionReviewStatus) {
    invalid('Legal evidence does not match the canonical manifest')
  }
  if (receipt.processPolicy?.stdoutBounded !== true ||
      receipt.processPolicy?.stderrBounded !== true ||
      receipt.processPolicy?.shellDisabled !== true ||
      receipt.processPolicy?.runtimeDownload !== false ||
      receipt.processPolicy?.pathLookup !== false ||
      receipt.processPolicy?.memoryLimitEnforced !== false ||
      receipt.processPolicy?.descendantProcessLimitEnforced !== false ||
      !receipt.processPolicy?.limitations?.includes('memory-limit-unproven') ||
      !receipt.processPolicy?.limitations?.includes('descendant-containment-unproven')) {
    invalid('Known process limitations are not disclosed')
  }
  if (!Array.isArray(receipt.fixtures) || receipt.fixtures.length !== FIXTURES.size) {
    invalid('Fixture evidence is incomplete')
  }
  for (const fixture of receipt.fixtures) {
    const expected = FIXTURES.get(fixture.name)
    if (!expected || fixture.sha256 !== expected.sha256 || fixture.actual !== expected.actual ||
        fixture.validationPath !== expected.validationPath ||
        fixture.reasonCode !== expected.reasonCode || fixture.ok !== true) {
      invalid(`Fixture evidence is invalid: ${fixture.name || 'unknown'}`)
    }
  }
  assertProcessEvidence(receipt.processes)
  if (typeof receipt.host?.platform !== 'string' || typeof receipt.host?.release !== 'string' ||
      typeof receipt.host?.arch !== 'string' ||
      !/^[A-F0-9]{64}$/.test(receipt.host?.identityHash || '')) {
    invalid('Host evidence is invalid')
  }
  return receipt
}
