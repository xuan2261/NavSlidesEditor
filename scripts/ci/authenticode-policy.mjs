import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { SHA256, assertHex } from './release-receipt-canonical.mjs'

const THUMBPRINT = /^[0-9A-F]{40,64}$/

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
  const [evidencePath, subject, thumbprint] = process.argv.slice(2)
  if (!evidencePath || !subject || !thumbprint) {
    throw new Error('usage: <evidence.json> <publisher-subject> <publisher-thumbprint>')
  }
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'))
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
