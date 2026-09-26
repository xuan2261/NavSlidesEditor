import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import {
  SHA256,
  assertCommon,
  assertHex,
  canonicalJson,
  hashCanonical,
} from './release-receipt-canonical.mjs'

export const hashReceipt = hashCanonical

export function createQualificationId(common) {
  const identity = {
    clientDigest: common.clientDigest,
    lockHashes: common.lockHashes,
    policyVersion: common.policyVersion,
    schemaVersion: common.schemaVersion,
    subjectSha: common.subjectSha,
  }
  assertCommon({ ...common, qualificationId: 'pending' })
  return hashCanonical(identity)
}

export function createHostReceipt(input) {
  const receipt = {
    schemaVersion: input.schemaVersion,
    policyVersion: input.policyVersion,
    qualificationId: input.qualificationId,
    host: input.host,
    status: input.status,
    subjectSha: input.subjectSha,
    clientDigest: input.clientDigest,
    lockHashes: input.lockHashes,
    ...(input.parentReceiptHash ? { parentReceiptHash: input.parentReceiptHash } : {}),
    gates: input.gates,
    artifacts: input.artifacts ?? {},
  }
  assertCommon(receipt)
  if (receipt.qualificationId !== createQualificationId(receipt)) {
    throw new Error('qualificationId mismatch')
  }
  if (!['passed', 'failed'].includes(receipt.status)) throw new Error('invalid host status')
  if (!receipt.host || !receipt.gates || Object.keys(receipt.gates).length === 0) {
    throw new Error('host and gates are required')
  }
  for (const [name, digest] of Object.entries(receipt.gates)) {
    assertHex(digest, SHA256, `gates.${name}`)
  }
  return receipt
}

export function createNotSelectedReceipt(input) {
  const receipt = {
    schemaVersion: input.schemaVersion,
    policyVersion: input.policyVersion,
    qualificationId: input.qualificationId,
    host: input.host,
    status: 'not-selected',
    subjectSha: input.subjectSha,
    clientDigest: input.clientDigest,
    lockHashes: input.lockHashes,
    parentReceiptHash: input.parentReceiptHash,
    gates: {},
    artifacts: {},
  }
  assertCommon(receipt)
  if (receipt.qualificationId !== createQualificationId(receipt)) {
    throw new Error('qualificationId mismatch')
  }
  assertHex(receipt.parentReceiptHash, SHA256, 'parentReceiptHash')
  return receipt
}

function verifyChild(receipt, common, host, linuxHash) {
  assertCommon(receipt, common)
  if (canonicalJson(receipt.lockHashes) !== canonicalJson(common.lockHashes)) {
    throw new Error(`${host} lock hashes mismatch`)
  }
  if (receipt.qualificationId !== createQualificationId(receipt)) {
    throw new Error(`${host} qualificationId mismatch`)
  }
  if (receipt.host !== host) throw new Error(`${host} receipt missing`)
  if (host !== 'linux-ci' && receipt.parentReceiptHash !== linuxHash) {
    throw new Error(`${host} parent receipt hash mismatch`)
  }
}

export function createGreenShaRoot(input) {
  const { policy, linuxReceipt: linux } = input
  if (linux.host !== 'linux-ci' || linux.status !== 'passed')
    throw new Error('Linux receipt failed')
  assertCommon(linux)
  if (
    policy.policyVersion !== linux.policyVersion ||
    (policy.receiptSchemaVersion !== undefined &&
      policy.receiptSchemaVersion !== linux.schemaVersion)
  ) {
    throw new Error('receipt policy version mismatch')
  }
  if (linux.qualificationId !== createQualificationId(linux)) {
    throw new Error('Linux qualificationId mismatch')
  }
  const linuxTarget = policy.targets['linux-ci']
  if (linuxTarget && linuxTarget.selected !== true) {
    throw new Error('linux-ci must be selected')
  }
  for (const gate of linuxTarget?.requiredGates ?? []) {
    if (!linux.gates[gate]) throw new Error(`linux-ci missing required gate ${gate}`)
  }
  const linuxHash = hashReceipt(linux)
  const common = linux
  const receipts = {
    windows: input.windowsReceipt,
    'linux-desktop': input.linuxDesktopReceipt,
    'macos-desktop': input.macosDesktopReceipt,
  }
  for (const [host, receipt] of Object.entries(receipts)) {
    verifyChild(receipt, common, host, linuxHash)
    const target = policy.targets[host]
    const expectedStatus = target.selected ? 'passed' : 'not-selected'
    if (receipt.status !== expectedStatus) throw new Error(`${host} must be ${expectedStatus}`)
    for (const gate of target.requiredGates ?? []) {
      if (!receipt.gates[gate]) throw new Error(`${host} missing required gate ${gate}`)
    }
  }
  return {
    schemaVersion: linux.schemaVersion,
    policyVersion: linux.policyVersion,
    qualificationId: linux.qualificationId,
    status: 'passed',
    subjectSha: linux.subjectSha,
    clientDigest: linux.clientDigest,
    lockHashes: linux.lockHashes,
    ...(input.releaseTag ? { releaseTag: input.releaseTag } : {}),
    ...(input.workflow ? { workflow: input.workflow } : {}),
    children: Object.fromEntries(
      [['linux-ci', linux], ...Object.entries(receipts)].map(([host, receipt]) => [
        host,
        { hash: hashReceipt(receipt), status: receipt.status },
      ])
    ),
  }
}

async function main() {
  const [operation, inputPath, outPath] = process.argv.slice(2)
  if (!operation || !inputPath || !outPath) throw new Error('usage: <operation> <input> <out>')
  const input = JSON.parse(await readFile(inputPath, 'utf8'))
  let result
  if (operation === 'qualification-id') result = { qualificationId: createQualificationId(input) }
  else if (operation === 'host') result = createHostReceipt(input)
  else if (operation === 'not-selected') result = createNotSelectedReceipt(input)
  else if (operation === 'root') {
    const load = async (path) => JSON.parse(await readFile(path, 'utf8'))
    result = createGreenShaRoot({
      policy: await load(input.policy),
      linuxReceipt: await load(input.linuxReceipt),
      windowsReceipt: await load(input.windowsReceipt),
      linuxDesktopReceipt: await load(input.linuxDesktopReceipt),
      macosDesktopReceipt: await load(input.macosDesktopReceipt),
    })
  } else throw new Error(`unknown operation ${operation}`)
  await writeFile(outPath, canonicalJson(result))
  process.stdout.write(`${hashReceipt(result)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
