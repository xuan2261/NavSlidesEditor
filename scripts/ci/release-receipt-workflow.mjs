import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { canonicalJson, hashCanonical } from './release-receipt-canonical.mjs'
import {
  createGreenShaRoot,
  createHostReceipt,
  createNotSelectedReceipt,
  createQualificationId,
  hashReceipt,
} from './release-receipts.mjs'

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const fileHash = async (path) => {
  const hash = createHash('sha256')
  hash.update(await readFile(path))
  return hash.digest('hex')
}

async function findJson(root, includes) {
  const entries = await readdir(root, { recursive: true })
  const matches = entries
    .filter((entry) => entry.endsWith('.json') && includes.every((word) => entry.includes(word)))
    .sort()
  if (matches.length !== 1) {
    throw new Error(`expected one receipt matching ${includes.join(',')}, found ${matches.length}`)
  }
  return readJson(join(root, matches[0]))
}

async function common(subjectSha, clientDigest, policyVersion) {
  const input = {
    schemaVersion: 'release-receipt-v1',
    policyVersion,
    subjectSha,
    clientDigest,
    lockHashes: {
      workspace: await fileHash('package-lock.json'),
      electron: await fileHash('electron/server-package-lock.json'),
    },
  }
  return { ...input, qualificationId: createQualificationId(input) }
}

async function linux(args) {
  const [subjectSha, clientDigest, policyVersion, evidenceRoot] = args
  if (!evidenceRoot) throw new Error('Linux qualification evidence root is required')
  const base = await common(subjectSha, clientDigest, policyVersion)
  const gates = Object.fromEntries(
    ['client-manifest', 'unit-coverage', 'playwright', 'load'].map((gate) => [
      gate,
      hashCanonical({ ...base, gate, result: 'passed' }),
    ])
  )
  const docker = join(evidenceRoot, 'docker')
  const scan = join(evidenceRoot, 'supply-chain')
  const scanReceiptPath = join(scan, 'container-supply-chain-receipt.json')
  const scanReceipt = await readJson(scanReceiptPath)
  const imageDigest = (await readFile(join(docker, 'docker-image-digest.txt'), 'utf8')).trim()
  if (scanReceipt.subject?.imageDigest !== imageDigest) {
    throw new Error('container scan image digest mismatch')
  }
  if (
    scanReceipt.scan?.status !== 'completed' ||
    !['passed', 'risk-accepted'].includes(scanReceipt.status) ||
    scanReceipt.securityStatus !== (scanReceipt.status === 'risk-accepted' ? 'advisory' : 'passed')
  ) {
    throw new Error('container scan advisory receipt is incomplete')
  }
  for (const [name, expected] of [
    ['container-trivy.json', scanReceipt.scan.trivyReportSha256],
    ['container-sbom.spdx.json', scanReceipt.subject.sbomSha256],
  ]) {
    if (`sha256:${await fileHash(join(scan, name))}` !== expected) {
      throw new Error(`container scan evidence mismatch: ${name}`)
    }
  }
  gates.docker = hashCanonical({
    image: await fileHash(join(docker, 'docker-image-digest.txt')),
    runtime: await fileHash(join(docker, 'docker-runtime-closure.json')),
  })
  gates.attestation = await fileHash(join(docker, 'docker-attestation-verification.txt'))
  const receiptHash = await fileHash(scanReceiptPath)
  gates['container-scan-advisory'] = receiptHash
  await writeFile(
    'linux-ci-receipt.json',
    canonicalJson(
      createHostReceipt({
        ...base,
        host: 'linux-ci',
        status: 'passed',
        gates,
        securityAdvisory: { status: scanReceipt.status, receiptHash },
      })
    )
  )
}

function assertPhysical(receipt, kind, base) {
  if (receipt.status !== 'passed') throw new Error(`${kind} physical receipt did not pass`)
  if (receipt.subjectSha !== base.subjectSha) throw new Error(`${kind} subject mismatch`)
  if (receipt.clientDigest !== base.clientDigest) throw new Error(`${kind} client digest mismatch`)
  return hashReceipt(receipt)
}

async function windows(args) {
  const base = await common(...args.slice(0, 3))
  const linuxReceipt = await findJson('evidence/linux', ['linux-ci'])
  const office = await findJson('evidence/officecli', [])
  const runtime = await readJson('evidence/runtime-closure.json')
  if (
    runtime.clientDist !== true ||
    runtime.clientSubject !== base.subjectSha ||
    !/^[0-9a-f]{64}$/.test(runtime.clientArtifactIdentity ?? '')
  ) {
    throw new Error('Windows runtime closure receipt invalid or subject mismatch')
  }
  const gates = {
    'electron-runtime-closure': await fileHash('evidence/runtime-closure.json'),
    'officecli-physical': assertPhysical(office, 'OfficeCLI', base),
  }
  const receipt = createHostReceipt({
    ...base,
    host: 'windows',
    status: 'passed',
    parentReceiptHash: hashReceipt(linuxReceipt),
    gates,
  })
  await writeFile('windows-qualification-receipt.json', canonicalJson(receipt))
}

async function createRoot(args) {
  const [subjectSha, clientDigest, policyVersion, releaseTag] = args
  const base = await common(subjectSha, clientDigest, policyVersion)
  const linuxReceipt = await findJson('receipts', ['linux-ci'])
  const linuxHash = hashReceipt(linuxReceipt)
  const optional = (host) =>
    createNotSelectedReceipt({ ...base, host, parentReceiptHash: linuxHash })
  const linuxDesktopReceipt = optional('linux-desktop')
  const macosDesktopReceipt = optional('macos-desktop')
  await writeFile('linux-desktop-receipt.json', canonicalJson(linuxDesktopReceipt))
  await writeFile('macos-desktop-receipt.json', canonicalJson(macosDesktopReceipt))
  const root = createGreenShaRoot({
    policy: await readJson('config/release-target-policy.json'),
    linuxReceipt,
    windowsReceipt: await findJson('receipts', ['windows-qualification']),
    linuxDesktopReceipt,
    macosDesktopReceipt,
    releaseTag,
    workflow: {
      pathRef: process.env.GITHUB_WORKFLOW_REF,
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    },
  })
  await writeFile('green-sha-root-receipt.json', canonicalJson(root))
}

async function main() {
  const [operation, ...args] = process.argv.slice(2)
  if (operation === 'linux') await linux(args)
  else if (operation === 'windows') await windows(args)
  else if (operation === 'create-root') await createRoot(args)
  else throw new Error(`unknown workflow operation ${operation}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
