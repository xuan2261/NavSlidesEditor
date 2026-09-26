import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { GIT_SHA, SHA256, assertHex } from './release-receipt-canonical.mjs'

export function verifyArtifactAttestations(input) {
  assertHex(input.subjectSha, GIT_SHA, 'subjectSha')
  assertHex(input.clientDigest, SHA256, 'clientDigest')
  if (!input.workflowIdentity) throw new Error('workflow identity is required')
  const issuer = input.issuer ?? 'https://token.actions.githubusercontent.com'
  const byId = new Map()
  for (const attestation of input.attestations ?? []) {
    if (byId.has(attestation.id)) throw new Error(`duplicate attestation ${attestation.id}`)
    byId.set(attestation.id, attestation)
  }
  return input.requiredArtifactIds.map((id) => {
    const item = byId.get(id)
    if (!item || item.verified !== true) throw new Error(`${id} lacks verified attestation`)
    if (item.subjectSha !== input.subjectSha) throw new Error(`${id} subject SHA mismatch`)
    if (item.clientDigest !== input.clientDigest) throw new Error(`${id} client digest mismatch`)
    if (item.workflowIdentity !== input.workflowIdentity) {
      throw new Error(`${id} workflow identity mismatch`)
    }
    if (item.issuer !== issuer) throw new Error(`${id} attestation issuer mismatch`)
    assertHex(item.digest, SHA256, `${id} digest`)
    assertHex(item.bundleHash, SHA256, `${id} bundleHash`)
    return {
      id,
      bundleHash: item.bundleHash,
      digest: item.digest,
      verified: true,
      issuer: item.issuer,
      workflowIdentity: item.workflowIdentity,
    }
  })
}

async function main() {
  const [evidencePath, ids, subjectSha, clientDigest, workflowIdentity] = process.argv.slice(2)
  if (!evidencePath || !ids || !subjectSha || !clientDigest || !workflowIdentity) {
    throw new Error('usage: <evidence.json> <ids> <subject> <client-digest> <workflow-identity>')
  }
  const attestations = JSON.parse(await readFile(evidencePath, 'utf8'))
  const result = verifyArtifactAttestations({
    requiredArtifactIds: ids.split(',').filter(Boolean),
    subjectSha,
    clientDigest,
    workflowIdentity,
    issuer: 'https://token.actions.githubusercontent.com',
    attestations,
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
