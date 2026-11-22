import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { SHA256, assertHex } from './release-receipt-canonical.mjs'

const THUMBPRINT = /^[0-9A-F]{40,64}$/
export const WINDOWS_SIGNING_ENV_KEYS = [
  'WINDOWS_SIGNING_SCRIPT',
  'WINDOWS_SIGNING_SUBJECT',
  'WINDOWS_SIGNING_THUMBPRINT',
  'RFC3161_TIMESTAMP_URL',
]

export function resolveWindowsSigningMode(env = process.env, policy = null) {
  if (!env || typeof env !== 'object' || Array.isArray(env)) {
    throw new Error('Windows signing environment object is required')
  }
  const keys = policy?.authenticode?.signingEnvVars ?? WINDOWS_SIGNING_ENV_KEYS
  if (!Array.isArray(keys) || keys.length !== 4) {
    throw new Error('Windows signing policy must declare all 4 signingEnvVars')
  }
  const present = []
  for (const key of keys) {
    const raw = env[key]
    if (raw === undefined || raw === null || raw === '') continue
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      throw new Error(`partial WINDOWS_SIGNING_* configuration: invalid whitespace value for ${key}`)
    }
    present.push(key)
  }
  if (present.length === 0) {
    if (policy !== null) {
      const unsignedMode = policy?.authenticode?.unsignedMode
      const disclosure = policy?.authenticode?.unsignedReleaseDisclosure
      if (
        unsignedMode !== 'authenticode-unsigned' ||
        typeof disclosure !== 'string' ||
        disclosure.trim().length < 20
      ) {
        throw new Error('unsigned Windows release policy requires authenticode-unsigned and disclosure')
      }
      return {
        mode: 'authenticode-unsigned',
        signed: false,
        unsignedReleaseDisclosure: disclosure,
      }
    }
    return { mode: 'authenticode-unsigned', signed: false, unsignedReleaseDisclosure: '' }
  }
  if (present.length !== keys.length) {
    const missing = keys.filter((key) => !present.includes(key))
    throw new Error(
      `partial WINDOWS_SIGNING_* configuration: missing ${missing.join(', ')}; provide all 4 signing inputs or none`
    )
  }
  const thumbprint = env.WINDOWS_SIGNING_THUMBPRINT.trim().toUpperCase()
  if (!THUMBPRINT.test(thumbprint)) {
    throw new Error('WINDOWS_SIGNING_THUMBPRINT must be a 40..64 hex certificate thumbprint')
  }
  return {
    mode: 'signed',
    signed: true,
    publisherSubject: env.WINDOWS_SIGNING_SUBJECT.trim(),
    publisherThumbprint: thumbprint,
    timestampUrl: env.RFC3161_TIMESTAMP_URL.trim(),
  }
}

export function verifyUnsignedWindowsEvidence({ evidence, expectedSha256, policy }) {
  if (!evidence?.path?.toLowerCase().endsWith('.exe')) throw new Error('Windows EXE is required')
  if (evidence.mode !== 'authenticode-unsigned' || evidence.signed !== false) {
    throw new Error('unsigned Windows evidence mode mismatch')
  }
  assertHex(evidence.sha256, SHA256, 'sha256')
  assertHex(evidence.expectedSha256, SHA256, 'expectedSha256')
  assertHex(evidence.postDownloadSha256, SHA256, 'postDownloadSha256')
  if (evidence.sha256 !== evidence.expectedSha256 || evidence.postDownloadSha256 !== evidence.sha256) {
    throw new Error('post-download hash mismatch')
  }
  if (expectedSha256 !== undefined && evidence.sha256 !== expectedSha256) {
    throw new Error('downloaded EXE verification identity mismatch')
  }
  const disclosure = policy?.authenticode?.unsignedReleaseDisclosure
  if (
    policy?.authenticode?.unsignedMode !== 'authenticode-unsigned' ||
    typeof disclosure !== 'string' ||
    disclosure.trim().length < 20 ||
    evidence.unsignedReleaseDisclosure !== disclosure
  ) {
    throw new Error('unsigned Windows release disclosure mismatch')
  }
  return {
    path: evidence.path,
    mode: 'authenticode-unsigned',
    signed: false,
    sha256: evidence.sha256,
    unsignedReleaseDisclosure: disclosure,
    verified: true,
  }
}

function verifySignature(signature, expected, label) {
  if (!signature || signature.status !== 'Valid') throw new Error(`${label} signature is not Valid`)
  if (signature.signerSubject !== expected.publisherSubject) {
    throw new Error(`${label} publisher subject mismatch`)
  }
  const actualThumbprint = (signature.signerThumbprint ?? '').toUpperCase()
  const expectedThumbprint = (expected.publisherThumbprint ?? '').toUpperCase()
  if (!THUMBPRINT.test(expectedThumbprint) || actualThumbprint !== expectedThumbprint) {
    throw new Error(`${label} publisher thumbprint mismatch`)
  }
  const timestamp = signature.timestamp
  if (!timestamp || timestamp.type !== 'RFC3161' || timestamp.trusted !== true) {
    throw new Error(`${label} trusted RFC3161 timestamp is required`)
  }
  if (!Number.isFinite(Date.parse(timestamp.value)))
    throw new Error(`${label} timestamp is invalid`)
  const notBefore = Date.parse(signature.certificate?.notBefore)
  const notAfter = Date.parse(signature.certificate?.notAfter)
  const signedAt = Date.parse(timestamp.value)
  if (
    ![notBefore, notAfter].every(Number.isFinite) ||
    signedAt < notBefore ||
    signedAt > notAfter
  ) {
    throw new Error(`${label} certificate was not valid at signing time`)
  }
}

export function verifyAuthenticodeEvidence({ expected, evidence }) {
  if (!evidence?.path?.toLowerCase().endsWith('.exe')) throw new Error('Windows EXE is required')
  assertHex(evidence.sha256, SHA256, 'sha256')
  assertHex(evidence.expectedSha256, SHA256, 'expectedSha256')
  if (evidence.sha256 !== evidence.expectedSha256) throw new Error('post-download hash mismatch')
  verifySignature(evidence.preUpload, expected, 'pre-upload')
  verifySignature(evidence.postDownload, expected, 'post-download')
  if (
    evidence.preUpload.signerSubject !== evidence.postDownload.signerSubject ||
    evidence.preUpload.signerThumbprint.toUpperCase() !==
      evidence.postDownload.signerThumbprint.toUpperCase()
  ) {
    throw new Error('post-download signer identity mismatch')
  }
  return {
    path: evidence.path,
    publisherSubject: expected.publisherSubject,
    publisherThumbprint: expected.publisherThumbprint.toUpperCase(),
    sha256: evidence.sha256,
    timestamp: evidence.postDownload.timestamp.value,
    verified: true,
  }
}

async function main() {
  const [opOrPath, ...rest] = process.argv.slice(2)
  if (opOrPath === 'mode') {
    const policyPath = rest[0] || 'config/release-target-policy.json'
    const policy = JSON.parse(await readFile(policyPath, 'utf8'))
    process.stdout.write(`${JSON.stringify(resolveWindowsSigningMode(process.env, policy))}\n`)
    return
  }
  const [subject, thumbprint] = rest
  if (!opOrPath || !subject || !thumbprint) {
    throw new Error('usage: <evidence.json> <publisher-subject> <publisher-thumbprint> | mode [policy.json]')
  }
  const evidence = JSON.parse(await readFile(opOrPath, 'utf8'))
  process.stdout.write(
    `${JSON.stringify(
      verifyAuthenticodeEvidence({
        expected: { publisherSubject: subject, publisherThumbprint: thumbprint },
        evidence,
      })
    )}\n`
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
