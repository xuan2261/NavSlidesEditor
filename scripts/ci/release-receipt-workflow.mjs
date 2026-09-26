import { createHash } from 'node:crypto'
import { basename, join } from 'node:path'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { canonicalJson, hashCanonical, sha256 } from './release-receipt-canonical.mjs'
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
  const base = await common(subjectSha, clientDigest, policyVersion)
  const gates = Object.fromEntries(
    ['client-manifest', 'unit-coverage', 'playwright', 'load', 'docker', 'supply-chain', 'attestation'].map(
      (gate) => [gate, hashCanonical({ ...base, gate, result: 'passed' })]
    )
  )
  if (evidenceRoot) {
    gates.docker = hashCanonical({
      image: await fileHash(join(evidenceRoot, 'docker', 'docker-image-digest.txt')),
      runtime: await fileHash(join(evidenceRoot, 'docker', 'docker-runtime-closure.json')),
    })
    gates['supply-chain'] = await fileHash(
      join(evidenceRoot, 'supply-chain', 'container-supply-chain-receipt.json')
    )
    gates.attestation = await fileHash(
      join(evidenceRoot, 'docker', 'docker-attestation-verification.txt')
    )
  }
  await writeFile(
    'linux-ci-receipt.json',
    canonicalJson(createHostReceipt({ ...base, host: 'linux-ci', status: 'passed', gates }))
  )
}

async function authenticode(stage, exePath, evidenceRoot) {
  const name = basename(exePath)
  const path = join(evidenceRoot, `${name}.json`)
  const signer = await readJson(join(evidenceRoot, 'signer', `${name}.json`))
  const digest = await fileHash(exePath)
  const evidence =
    stage === 'pre'
      ? {
          path: name,
          sha256: digest,
          expectedSha256: digest,
          preUpload: signer.signature,
          postDownload: null,
        }
      : { ...(await readJson(path)), sha256: digest, postDownload: signer.signature }
  await writeFile(path, canonicalJson(evidence))
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
  const fidelity = await findJson('evidence/fidelity', [])
  const authenticodeFiles = (await readdir('evidence/authenticode'))
    .filter((path) => path.endsWith('.json'))
    .sort()
  if (authenticodeFiles.length === 0) throw new Error('Authenticode evidence missing')
  const artifacts = Object.fromEntries(
    await Promise.all(
      authenticodeFiles.map(async (path) => {
        const evidence = await readJson(join('evidence/authenticode', path))
        if (!evidence.postDownload) throw new Error(`${path} lacks post-download verification`)
        return [path, sha256(canonicalJson(evidence))]
      })
    )
  )
  const gates = {
    'electron-runtime-closure': await fileHash('evidence/runtime-closure.json'),
    'officecli-physical': assertPhysical(office, 'OfficeCLI', base),
    'fidelity-powerpoint': assertPhysical(fidelity, 'fidelity', base),
    authenticode: hashCanonical(artifacts),
    'post-download-authenticode': hashCanonical({ artifacts, stage: 'post-download' }),
    attestation: await fileHash('evidence/attestation-verification.txt'),
  }
  const receipt = createHostReceipt({
    ...base,
    host: 'windows',
    status: 'passed',
    parentReceiptHash: hashReceipt(linuxReceipt),
    gates,
    artifacts,
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
  else if (operation === 'authenticode-pre') await authenticode('pre', ...args)
  else if (operation === 'authenticode-post') await authenticode('post', ...args)
  else if (operation === 'attestation-windows') {
    const [verificationPath, subjectSha, clientDigest, workflowIdentity] = args
    const source = await readFile(verificationPath)
    if ((await stat(args[0])).size === 0) throw new Error('attestation verification is empty')
    JSON.parse(source.toString('utf8'))
    const files = (await readdir('post-download')).filter((path) => path.endsWith('.exe')).sort()
    if (files.length === 0) throw new Error('attested Windows artifacts missing')
    const digests = Object.fromEntries(
      await Promise.all(
        files.map(async (path) => [path, await fileHash(join('post-download', path))])
      )
    )
    const evidence = [
      {
        id: 'electron-windows',
        digest: hashCanonical(digests),
        subjectSha,
        clientDigest,
        workflowIdentity,
        issuer: 'https://token.actions.githubusercontent.com',
        verified: true,
        bundleHash: sha256(source),
      },
    ]
    await writeFile('evidence/attestation-policy.json', canonicalJson(evidence))
    await writeFile('evidence/attestation-verification.sha256', `${sha256(source)}\n`)
  } else throw new Error(`unknown workflow operation ${operation}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
