import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

const SHA256 = /^[A-F0-9]{64}$/
const SENSITIVE_KEY = /(?:stdout|stderr|rawOutput|configuredPath|canonicalPath|command)$/i
const WINDOWS_ABSOLUTE = /^[A-Za-z]:[\\/]/
const FIXTURE_HASHES = new Map([
  ['good-package.pptx', 'A870BA588E1F29D0DE0814C2F52977A2556A3041A4291FB19174E210274C17D1'],
  ['bad-crc.pptx', '9D572715870493397798E82473593F4CF373B01DDDEB8175EAB034C131274607'],
  ['malformed-xml.pptx', '4F3B3BC9E807BAF99ECD2C462BBB95D7212457AC24CA424B69903DF73425E55C'],
])

export function failure(code, message) {
  return Object.assign(new Error(message), { code })
}

export function parseArguments(argv, env = process.env) {
  const options = { malformed: [], acquiredAt: env.OFFICECLI_ACQUIRED_AT }
  const single = new Set(['--binary', '--valid', '--manifest', '--out', '--acquired-at'])
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (flag === '--malformed') {
      if (!value) throw failure('ARGUMENT_INVALID', '--malformed requires a value')
      options.malformed.push(value)
      index += 1
    } else if (single.has(flag)) {
      if (!value || options[argumentName(flag)]) throw failure('ARGUMENT_INVALID', `${flag} requires one value`)
      options[argumentName(flag)] = value
      index += 1
    } else {
      throw failure('ARGUMENT_INVALID', `Unknown argument: ${flag}`)
    }
  }
  return options
}

function argumentName(flag) {
  return {
    '--binary': 'binary',
    '--valid': 'valid',
    '--manifest': 'manifestPath',
    '--out': 'out',
    '--acquired-at': 'acquiredAt',
  }[flag]
}

export function assertPrerequisites(options) {
  const required = ['binary', 'valid', 'acquiredAt']
  if (required.some((key) => typeof options[key] !== 'string' || !options[key])) {
    throw failure('PHYSICAL_PREREQUISITE_MISSING', 'Required physical feasibility input is missing')
  }
  if (!Array.isArray(options.malformed) || options.malformed.length !== 2) {
    throw failure('PHYSICAL_PREREQUISITE_MISSING', 'Exactly two malformed fixtures are required')
  }
  const malformedNames = options.malformed.map((value) => path.basename(value)).sort()
  if (path.basename(options.valid) !== 'good-package.pptx' ||
      malformedNames.join(',') !== 'bad-crc.pptx,malformed-xml.pptx') {
    throw failure('PHYSICAL_PREREQUISITE_MISSING', 'Pinned feasibility fixtures are required')
  }
  if (!Number.isFinite(Date.parse(options.acquiredAt))) {
    throw failure('PHYSICAL_PREREQUISITE_MISSING', 'Acquisition timestamp is invalid')
  }
}

export function assertCanonicalFixturePaths(options, projectRoot) {
  const fixtureRoot = path.resolve(projectRoot, 'server/data/test-corpus/adversarial')
  const expected = new Map([
    ['good-package.pptx', path.join(fixtureRoot, 'good-package.pptx')],
    ['bad-crc.pptx', path.join(fixtureRoot, 'bad-crc.pptx')],
    ['malformed-xml.pptx', path.join(fixtureRoot, 'malformed-xml.pptx')],
  ])
  for (const candidate of [options.valid, ...options.malformed]) {
    const name = path.basename(candidate)
    if (path.resolve(candidate).toLowerCase() !== expected.get(name)?.toLowerCase()) {
      throw failure('FIXTURE_PATH_UNTRUSTED', `${name} must use the checked-in canonical fixture`)
    }
  }
}

export function assertReviewedManifest(manifest) {
  const license = manifest?.license
  const provenance = manifest?.provenance
  const asset = manifest?.releaseAsset
  const upstream = manifest?.upstream
  const reviewed = license?.spdx === 'Apache-2.0' &&
    SHA256.test(license?.textSha256 || '') &&
    ['present', 'absent'].includes(license?.upstreamNoticeStatus) &&
    license?.redistributionReviewStatus === 'reviewed-not-bundled' &&
    provenance?.releaseCommitVerified === true &&
    provenance?.checksumManifestVerified === true &&
    /^https:\/\/github\.com\/iOfficeAI\/OfficeCLI(?:\/|$)/.test(upstream?.repository || '') &&
    /^https:\/\/github\.com\/iOfficeAI\/OfficeCLI\/releases\//.test(upstream?.releasePage || '') &&
    /^https:\/\/github\.com\/iOfficeAI\/OfficeCLI\/releases\/download\//.test(asset?.sourceAssetUrl || '') &&
    SHA256.test(asset?.sha256 || '') && Number.isSafeInteger(asset?.byteLength)
  if (!reviewed) {
    throw failure('LEGAL_PROVENANCE_UNRESOLVED', 'OfficeCLI legal or provenance review is unresolved')
  }
}

export async function hashFile(filePath) {
  const hash = crypto.createHash('sha256')
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk)
  return hash.digest('hex').toUpperCase()
}

export async function inspectPinnedBinary(binary, manifest) {
  if (!path.win32.isAbsolute(binary) || /^\\\\/.test(binary)) {
    throw failure('BINARY_PATH_INVALID', 'OfficeCLI binary must use an absolute local Windows path')
  }
  const link = await fsp.lstat(binary)
  const canonicalPath = await fsp.realpath(binary)
  const stat = await fsp.stat(binary)
  if (!link.isFile() || link.isSymbolicLink() || link.isReparsePoint?.() ||
      !stat.isFile() || stat.isReparsePoint?.() || (stat.nlink && stat.nlink !== 1) ||
      path.win32.normalize(canonicalPath).toLowerCase() !== path.win32.normalize(binary).toLowerCase()) {
    throw failure('BINARY_PATH_UNSAFE', 'OfficeCLI binary path is unsafe')
  }
  const sha256 = await hashFile(binary)
  if (stat.size !== manifest.releaseAsset.byteLength || sha256 !== manifest.releaseAsset.sha256) {
    throw failure('BINARY_IDENTITY_MISMATCH', 'OfficeCLI binary does not match the pinned identity')
  }
  return { canonicalPath, sha256, byteLength: stat.size, size: stat.size }
}

export function fixtureHash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase()
}

export async function validateFixture(filePath, expected, context, snapshotRoot) {
  const started = Date.now()
  const bytes = await fsp.readFile(path.resolve(filePath))
  const name = path.basename(filePath)
  const sha256 = fixtureHash(bytes)
  if (sha256 !== FIXTURE_HASHES.get(name)) {
    throw failure('FIXTURE_IDENTITY_MISMATCH', `${name} does not match the pinned fixture`)
  }
  const snapshotPath = path.join(snapshotRoot, name)
  await fsp.writeFile(snapshotPath, bytes, { flag: 'wx', mode: 0o600 })
  const common = { name, sha256, byteLength: bytes.length }
  try {
    await context.validatePptxPackage(snapshotPath, name)
    if (expected === 'reject') {
      throw failure('MALFORMED_FIXTURE_ACCEPTED', `${name} passed the package safety gate`)
    }
    const revisionSha256 = sha256.toLowerCase()
    const revision = context.createRevisionDescriptor({
      id: `physical-${revisionSha256}`, sha256: revisionSha256, byteLength: bytes.length,
      safetyVerdict: { rawZipSafe: true, xmlSafe: true, verifiedSha256: revisionSha256 },
    }, bytes)
    const result = await context.gateway.validatePackage(revision)
    if (result?.ok !== true) throw failure('VALID_FIXTURE_REJECTED', `${name} was not validated`)
    return {
      ...common, expected, actual: 'accepted', ok: true,
      exitCode: result?.metrics?.exitCode ?? null, reasonCode: null,
      validationPath: 'production-preflight-and-gateway', durationMs: Date.now() - started,
    }
  } catch (error) {
    if (expected !== 'reject' || error?.code === 'MALFORMED_FIXTURE_ACCEPTED') throw error
    const reasonCode = error?.code || error?.reason
    if (typeof reasonCode !== 'string' || !reasonCode) {
      throw failure('MALFORMED_REJECTION_UNTYPED', `${name} did not produce a typed rejection`)
    }
    return {
      ...common, expected, actual: 'rejected', ok: true, exitCode: null,
      reasonCode, validationPath: 'production-preflight', durationMs: Date.now() - started,
    }
  }
}

export function hostReceipt(osModule) {
  const subject = [osModule.hostname(), osModule.platform(), osModule.release(), osModule.arch()].join('\0')
  return {
    platform: osModule.platform(),
    release: osModule.release(),
    arch: osModule.arch(),
    identityHash: crypto.createHash('sha256').update(subject).digest('hex').toUpperCase(),
  }
}

export function assertSafeReceipt(receipt) {
  function visit(value, key = '') {
    if (SENSITIVE_KEY.test(key)) throw failure('RECEIPT_UNSAFE', 'Receipt contains prohibited process or path data')
    if (typeof value === 'string' && (WINDOWS_ABSOLUTE.test(value) || value.startsWith('/'))) {
      throw failure('RECEIPT_UNSAFE', 'Receipt contains an absolute local path')
    }
    if (Array.isArray(value)) value.forEach((child) => visit(child, key))
    else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([childKey, child]) => visit(child, childKey))
    }
  }
  visit(receipt)
  return receipt
}
