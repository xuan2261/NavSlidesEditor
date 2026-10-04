import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileHash, treeHash } from './education-evidence-files.mjs'
import { createRequire } from 'node:module'
import { createSubject } from './education-qualification-stage.mjs'
import manifestRuntime from '../ci/artifact-manifest-runtime.cjs'

export function defaultLaneOrigins(lane, env = process.env) {
  if (lane !== 'production-browser') return ['http://127.0.0.1:3002']
  const port = env.PLAYWRIGHT_SERVER_PORT || '3202'
  const base = env.PLAYWRIGHT_TEST_BASE_URL || `http://127.0.0.1:${port}`
  const api = env.PLAYWRIGHT_API_BASE_URL || `http://127.0.0.1:${port}/api`
  const origins = [base, api].map((value) => {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw new Error('Qualification origin must be an explicit HTTP(S) origin')
    return url.origin
  })
  return [...new Set([...origins, 'null'])]
}

export const LANES = Object.freeze(['production-browser', 'electron-dev', 'windows-packaged'])
export function identifyLane(root, lane, options = {}) {
  if (!LANES.includes(lane)) throw new Error(`Unknown artifact lane: ${lane}`)
  if (lane === 'windows-packaged' && process.platform !== 'win32')
    throw new Error('Windows packaged qualification requires the actual Windows environment.')
  const paths =
    lane === 'windows-packaged'
      ? {
          installer: options.installer,
          exe: options.exe,
          client: options.resources && resolve(options.resources, 'client/dist'),
          clientManifest:
            options.resources && resolve(options.resources, 'client-dist-manifest.json'),
          shared:
            options.resources && resolve(options.resources, 'server/node_modules/revealjs-shared'),
          vendor: options.resources && resolve(options.resources, 'server/vendor'),
          shell: options.resources && resolve(options.resources, 'app.asar'),
          server: options.resources && resolve(options.resources, 'server'),
        }
      : {
          client: resolve(root, 'client/dist'),
          clientManifest: resolve(root, 'client-dist-manifest.json'),
          shared: resolve(root, 'shared'),
          vendor: resolve(root, 'server/vendor'),
        }
  if (lane === 'electron-dev')
    paths.exe = options.exe || resolve(root, 'node_modules/electron/dist/electron.exe')
  const inputHash = options.context?.subjectHash || createSubject(root).subjectHash
  manifestRuntime.verifyClientArtifact({
    rootDir: paths.client,
    manifestPath: paths.clientManifest,
    expectedInputHash: inputHash,
  })
  const artifactHashes = {},
    artifactPaths = {},
    artifactKinds = {}
  for (const [key, path] of Object.entries(paths)) {
    if (!path || !existsSync(path))
      throw new Error(`Missing ${lane} artifact ${key}: ${path || '(not supplied)'}`)
    const absolute = resolve(path),
      isFile = ['installer', 'exe', 'shell', 'clientManifest'].includes(key)
    artifactHashes[key] = isFile ? fileHash(absolute) : treeHash(absolute)
    artifactPaths[key] = absolute
    artifactKinds[key] = isFile ? 'file' : 'tree'
  }
  const require = createRequire(resolve(root, 'package.json'))
  const { REVEAL_RUNTIME_VERSION } = require('./shared/src/reveal-runtime-assets.js')
  const versions = JSON.parse(readFileSync(resolve(root, 'runtime-versions.json'), 'utf8'))
  const browserMetadata = JSON.parse(
    readFileSync(
      resolve(dirname(require.resolve('playwright-core/package.json')), 'browsers.json'),
      'utf8'
    )
  ).browsers.find((browser) => browser.name === 'chromium')
  if (String(browserMetadata?.revision) !== versions.playwrightChromiumRevision)
    throw new Error('Installed browser revision differs from frozen runtime policy.')
  const browserVersion =
    options.browserVersion ||
    (lane === 'production-browser' ? browserMetadata.browserVersion : null)
  if (!browserVersion)
    throw new Error(
      'Desktop lanes require --browser-version from actual preliminary Electron process.versions.chrome observation.'
    )
  return {
    artifactHashes,
    artifactPaths,
    artifactKinds,
    runtimeVersion: REVEAL_RUNTIME_VERSION,
    runtimeVersions: versions,
    environment: process.platform,
    browser: 'chromium',
    browserVersion,
    projects:
      options.projects ||
      (lane === 'production-browser'
        ? ['chromium', 'chromium-live', 'tablet-touch', 'mobile']
        : [lane]),
    origins: options.origins || defaultLaneOrigins(lane),
    protocol: lane === 'production-browser' ? ['http:', 'file:'] : ['http:'],
  }
}
export function assertArtifactIdentities(context) {
  for (const [name, lane] of Object.entries(context.lanes || {})) {
    if (!LANES.includes(name)) throw new Error(`Unknown frozen lane: ${name}`)
    const required =
      name === 'windows-packaged'
        ? ['installer', 'exe', 'client', 'clientManifest', 'shared', 'vendor']
        : name === 'electron-dev'
          ? ['exe', 'client', 'clientManifest', 'shared', 'vendor']
          : ['client', 'clientManifest', 'shared', 'vendor']
    if (required.some((key) => !lane.artifactHashes?.[key]))
      throw new Error(`Incomplete frozen artifact lane: ${name}`)
    manifestRuntime.verifyClientArtifact({
      rootDir: lane.artifactPaths.client,
      manifestPath: lane.artifactPaths.clientManifest,
      expectedInputHash: context.subjectHash,
    })
    for (const [key, hash] of Object.entries(lane.artifactHashes || {})) {
      const path = lane.artifactPaths?.[key]
      if (!path || !['file', 'tree'].includes(lane.artifactKinds?.[key]))
        throw new Error(`Missing artifact location: ${name}/${key}`)
      const actual = lane.artifactKinds[key] === 'file' ? fileHash(path) : treeHash(path)
      if (actual !== hash)
        throw new Error(`Frozen ${name}/${key} changed; affected lane must be requalified.`)
    }
  }
}
