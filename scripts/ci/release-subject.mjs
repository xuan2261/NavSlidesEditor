import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const CORE = '(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)'
const TAG_PATTERN = new RegExp(`^v(${CORE})(?:-rc\\.([1-9]\\d*))?$`)
const SHA_PATTERN = /^[0-9a-f]{40}$/

export function parseReleaseTag(tag, packageVersion) {
  const match = TAG_PATTERN.exec(tag ?? '')
  if (!match || match[1] !== packageVersion) return null
  if (match[5]) {
    return { kind: 'rc', coreVersion: match[1], rcNumber: Number(match[5]) }
  }
  return { kind: 'final', coreVersion: match[1] }
}

function requireSha(value, label) {
  if (!SHA_PATTERN.test(value ?? '')) throw new Error(`${label} must be a full 40-hex SHA`)
}

export function verifyReleaseSubject(input) {
  const parsed = parseReleaseTag(input.tag, input.packageVersion)
  if (!parsed) throw new Error('tag must match the governed package version')
  requireSha(input.subjectSha, 'subjectSha')
  const artifactSubjects = input.artifactSubjects ?? []
  const receiptSubjects = input.receiptSubjects ?? []
  const bindings = [
    ['peeled tag commit', input.tagCommitSha],
    ['checkout HEAD', input.checkoutSha],
    ['successful main-CI head SHA', input.successfulCiHeadSha],
    ...artifactSubjects.map((sha, index) => [`artifact subject ${index}`, sha]),
    ...receiptSubjects.map((sha, index) => [`receipt subject ${index}`, sha]),
  ]
  if (artifactSubjects.length === 0 || receiptSubjects.length === 0) {
    throw new Error('artifact and receipt subjects are required')
  }
  for (const [label, value] of bindings) {
    requireSha(value, label)
    if (value !== input.subjectSha) throw new Error(`${label} does not match release subject SHA`)
  }
  return {
    packageVersion: input.packageVersion,
    releaseKind: parsed.kind,
    subjectSha: input.subjectSha,
    tag: input.tag,
  }
}

function args(argv) {
  const result = {}
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, '')
    if (!key || argv[index + 1] === undefined) throw new Error(`invalid argument ${argv[index]}`)
    if (Object.hasOwn(result, key)) throw new Error(`duplicate argument --${key}`)
    result[key] = argv[index + 1]
  }
  return result
}

async function main() {
  const options = args(process.argv.slice(2))
  const packageJson = JSON.parse(await readFile(options.package ?? 'package.json', 'utf8'))
  const result = verifyReleaseSubject({
    tag: options.tag,
    packageVersion: packageJson.version,
    subjectSha: options.subject,
    tagCommitSha: options['tag-commit'],
    checkoutSha: options.checkout,
    successfulCiHeadSha: options['ci-head'],
    artifactSubjects: (options['artifact-subjects'] ?? '').split(',').filter(Boolean),
    receiptSubjects: (options['receipt-subjects'] ?? '').split(',').filter(Boolean),
  })
  if (options.out) await writeFile(options.out, `${JSON.stringify(result, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
