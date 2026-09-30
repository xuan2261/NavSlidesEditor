import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { requireCleanGitSubject } from './clean-git-subject.mjs'
import { parseReleaseTag } from './release-subject.mjs'

const WORKSPACES = ['client', 'server', 'shared', 'website']
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const SHA_PATTERN = /^[0-9a-f]{40}$/

function git(directory, ...args) {
  try {
    return execFileSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch (error) {
    throw new Error(error.stderr?.trim() || `git ${args.join(' ')} failed`)
  }
}

async function readJson(root, relativePath) {
  let contents
  try {
    contents = await readFile(resolve(root, relativePath), 'utf8')
  } catch (error) {
    throw new Error(`${relativePath} could not be read: ${error.message}`)
  }
  try {
    const value = JSON.parse(contents)
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('expected object')
    return value
  } catch (error) {
    throw new Error(`${relativePath} must contain a JSON object: ${error.message}`)
  }
}

function requireVersion(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} version ${JSON.stringify(actual)} does not match ${expected}`)
  }
}

function checkLock(lock, relativePath, version, workspacePaths = []) {
  if (lock.lockfileVersion !== 3) throw new Error(`${relativePath} must use lockfileVersion 3`)
  requireVersion(lock.version, version, `${relativePath} top-level`)
  const packages = lock.packages
  if (!packages || typeof packages !== 'object' || Array.isArray(packages)) {
    throw new Error(`${relativePath} must contain a packages object`)
  }
  if (!packages[''] || typeof packages[''] !== 'object') {
    throw new Error(`${relativePath} must contain the root package entry`)
  }
  requireVersion(packages[''].version, version, `${relativePath} root package`)
  const workspaces = Object.fromEntries(
    workspacePaths.map((workspace) => {
      const entry = packages[workspace]
      if (!entry || typeof entry !== 'object') {
        throw new Error(`${relativePath} is missing workspace entry ${workspace}`)
      }
      requireVersion(entry.version, version, `${relativePath} workspace ${workspace}`)
      return [workspace, entry.version]
    })
  )
  return {
    lockfileVersion: lock.lockfileVersion,
    version: lock.version,
    root: packages[''].version,
    ...(workspacePaths.length ? { workspaces } : {}),
  }
}

function compareCoreVersions(left, right) {
  const leftParts = left.split('.').map(BigInt)
  const rightParts = right.split('.').map(BigInt)
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] < rightParts[index] ? -1 : 1
    }
  }
  return 0
}

function rcOrdinal(tag) {
  return BigInt(tag.slice(tag.lastIndexOf('.') + 1))
}

function findReleaseTag(root, version, headSha) {
  const candidates = git(root, 'tag', '--list')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((tag) => ({ tag, parsed: parseReleaseTag(tag, version) }))
    .filter(({ parsed }) => parsed)
    .map(({ tag, parsed }) => {
      const ref = `refs/tags/${tag}`
      const tagObjectSha = git(root, 'rev-parse', '--verify', ref)
      const tagCommitSha = git(root, 'rev-parse', '--verify', `${ref}^{commit}`)
      if (!SHA_PATTERN.test(tagObjectSha) || !SHA_PATTERN.test(tagCommitSha)) {
        throw new Error(`${tag} did not resolve to full Git object IDs`)
      }
      return { tag, parsed, tagObjectSha, tagCommitSha }
    })
  if (!candidates.length)
    throw new Error(`no valid RC or final tag matches package version ${version}`)

  const matching = candidates.filter(({ tagCommitSha }) => tagCommitSha === headSha)
  if (!matching.length) throw new Error(`release tag for ${version} does not peel to checkout HEAD`)
  return (
    matching.find(({ parsed }) => parsed.kind === 'final') ??
    matching.reduce((latest, next) => (rcOrdinal(next.tag) > rcOrdinal(latest.tag) ? next : latest))
  )
}

async function main() {
  if (process.argv.length !== 2) throw new Error('release-state accepts no arguments')
  const root = git(process.cwd(), 'rev-parse', '--show-toplevel')
  const subject = requireCleanGitSubject(root)
  const headSha = subject.commit

  const rootPackage = await readJson(root, 'package.json')
  const version = rootPackage.version
  if (typeof version !== 'string' || !VERSION_PATTERN.test(version)) {
    throw new Error('package.json version must be a canonical stable SemVer version')
  }
  if (compareCoreVersions(version, '1.16.2') <= 0) {
    throw new Error('package.json version must be newer than published v1.16.2')
  }

  const workspaceVersions = {}
  for (const workspace of WORKSPACES) {
    const manifest = await readJson(root, `${workspace}/package.json`)
    requireVersion(manifest.version, version, `${workspace}/package.json`)
    workspaceVersions[workspace] = manifest.version
  }
  const workspaceLock = await readJson(root, 'package-lock.json')
  const electronLock = await readJson(root, 'electron/server-package-lock.json')
  const locks = {
    'package-lock.json': checkLock(workspaceLock, 'package-lock.json', version, [...WORKSPACES]),
    'electron/server-package-lock.json': checkLock(
      electronLock,
      'electron/server-package-lock.json',
      workspaceVersions.server
    ),
  }
  const releaseTag = findReleaseTag(root, version, headSha)
  const isCandidate = releaseTag.parsed.kind === 'rc'

  return {
    schemaVersion: 1,
    subject,
    versions: { package: version, workspaces: workspaceVersions, locks },
    release: {
      tag: releaseTag.tag,
      kind: releaseTag.parsed.kind,
      ...(releaseTag.parsed.rcNumber ? { rcNumber: releaseTag.parsed.rcNumber } : {}),
      classification: isCandidate ? 'candidate' : 'final-release',
      tagObjectSha: releaseTag.tagObjectSha,
      tagCommitSha: releaseTag.tagCommitSha,
      publicationStatus: 'not-verified',
    },
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
