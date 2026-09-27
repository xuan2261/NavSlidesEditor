import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertAuthoritativeReceipt } from './physical-feasibility-receipt.mjs'
import { failure } from './physical-feasibility-support.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MANIFEST_PATH = path.join(
  ROOT,
  'server/services/pptx-import/officecli/qualification-manifest.json'
)

export function verifyExternalReceiptFile(
  { receiptPath, expectedSourceCommit, expectedReceiptSha256 },
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
) {
  if (typeof receiptPath !== 'string' || receiptPath.trim() === '') {
    throw failure('EXTERNAL_RECEIPT_PATH_REQUIRED', 'External receipt path is required')
  }
  if (!path.isAbsolute(receiptPath)) {
    throw failure(
      'EXTERNAL_RECEIPT_PATH_INVALID',
      'Receipt path must be absolute and outside the repository'
    )
  }
  let resolvedRoot
  let resolvedReceiptPath
  try {
    resolvedRoot = fs.realpathSync(ROOT)
    resolvedReceiptPath = fs.realpathSync(receiptPath)
  } catch {
    throw failure('EXTERNAL_RECEIPT_UNREADABLE', 'External physical receipt could not be read')
  }
  const relativePath = path.relative(resolvedRoot, resolvedReceiptPath)
  const insideRepository =
    relativePath === '' ||
    (!path.isAbsolute(relativePath) &&
      relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`))
  if (insideRepository) {
    throw failure('EXTERNAL_RECEIPT_PATH_INVALID', 'Receipt path must be outside the repository')
  }

  let bytes
  try {
    bytes = fs.readFileSync(resolvedReceiptPath)
  } catch {
    throw failure('EXTERNAL_RECEIPT_UNREADABLE', 'External physical receipt could not be read')
  }
  const receiptSha256 = crypto.createHash('sha256').update(bytes).digest('hex')
  if (receiptSha256 !== expectedReceiptSha256) {
    throw failure(
      'EXTERNAL_RECEIPT_DIGEST_MISMATCH',
      'External receipt bytes do not match the pinned SHA-256'
    )
  }

  let receipt
  try {
    receipt = JSON.parse(bytes.toString('utf8'))
  } catch {
    throw failure('EXTERNAL_RECEIPT_INVALID_JSON', 'External physical receipt is not valid JSON')
  }
  assertAuthoritativeReceipt(receipt, manifest, expectedSourceCommit)
  return { receipt, receiptSha256 }
}

function parseArguments(argv) {
  const options = {}
  const flags = new Map([
    ['--receipt', 'receiptPath'],
    ['--expected-source-commit', 'expectedSourceCommit'],
    ['--expected-receipt-sha256', 'expectedReceiptSha256'],
  ])
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const key = flags.get(flag)
    const value = argv[index + 1]
    if (!key || !value || value.startsWith('--') || options[key]) {
      throw failure(
        'ARGUMENT_INVALID',
        'Supply one receipt path, source commit, and receipt SHA-256'
      )
    }
    options[key] = value
    index += 1
  }
  if (Object.keys(options).length !== flags.size) {
    throw failure('ARGUMENT_INVALID', 'Supply one receipt path, source commit, and receipt SHA-256')
  }
  return options
}

function main() {
  const options = parseArguments(process.argv.slice(2))
  const { receipt, receiptSha256 } = verifyExternalReceiptFile(options)
  process.stdout.write(
    `${JSON.stringify({
      status: 'verified',
      receiptSha256,
      sourceCommit: options.expectedSourceCommit,
      schemaVersion: receipt.schemaVersion,
      claimScope: receipt.claimScope,
      fixtureResults: receipt.fixtures.map(({ name, expected, actual, reasonCode }) => ({
        name,
        expected,
        actual,
        reasonCode,
      })),
      accountIsolationClaim: receipt.executionContext.accountIsolationClaim,
      egressDenialClaim: receipt.executionContext.egressDenialClaim,
      containmentClaim: receipt.executionContext.containmentClaim,
    })}\n`
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(`${error?.code || 'EXTERNAL_RECEIPT_INVALID'}: ${error?.message || 'failed'}`)
    process.exitCode = 1
  }
}
