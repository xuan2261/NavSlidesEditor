import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { digest, fileHash, inside } from './education-evidence-files.mjs'
import { assertFrozenSubject } from './education-qualification-stage.mjs'
import { verifyInstallerPayload, assertPlainPath } from './education-installer-payload.mjs'
import manifestRuntime from '../ci/artifact-manifest-runtime.cjs'

export async function verifyPackageStage(context, { resources, installer, exe }) {
  if (!resources || !installer || !exe)
    throw new Error('Installer, executable and embedded resources paths are required.')
  for (const path of [resources, installer, exe]) assertPlainPath(path)
  let stage = resolve(resources)
  while (!existsSync(resolve(stage, 'education-qualification-context.json'))) {
    if (dirname(stage) === stage)
      throw new Error('Package is not inside an isolated frozen qualification stage.')
    stage = dirname(stage)
  }
  const staged = JSON.parse(
    readFileSync(resolve(stage, 'education-qualification-context.json'), 'utf8')
  )
  for (const key of ['schemaVersion', 'runId', 'subjectHash', 'policyHash'])
    if (staged[key] !== context[key]) throw new Error(`Isolated package stage ${key} mismatch.`)
  assertFrozenSubject(stage, context)
  for (const path of [resources, installer, exe])
    if (!inside(stage, path))
      throw new Error('Package artifacts must come from the same isolated stage.')
  await verifyInstallerPayload({ resources, installer, exe })
  return stage
}

function verifyPackagedLocalParser(root, context, resources) {
  const prefix = 'vendor-overrides/image-size-disabled/'
  const declared = context.files.filter((file) => file.path.startsWith(prefix))
  if (!declared.length) throw new Error('Frozen manifest lacks required image-size source files.')
  const source = resolve(root, prefix)
  assertPlainPath(source)
  const expected = manifestRuntime.collectFiles(source)
  const hashes = new Map(declared.map((file) => [file.path.slice(prefix.length), file.hash]))
  if (
    expected.length !== declared.length ||
    expected.some((file) => hashes.get(file.path) !== file.sha256)
  ) {
    throw new Error('Declared image-size source inventory differs from frozen source.')
  }
  // Frozen records bind path/hash; take byte counts only from the fully attested source inventory.
  const installed = resolve(resources, 'server/node_modules/image-size')
  assertPlainPath(installed)
  if (JSON.stringify(manifestRuntime.collectFiles(installed)) !== JSON.stringify(expected)) {
    throw new Error('Packaged image-size file inventory differs from frozen source.')
  }
}

export function verifyPackagedSources(root, context, resources) {
  if (!resources) throw new Error('Supply --resources from the newly emitted Windows package.')
  const client = manifestRuntime.verifyClientArtifact({
    rootDir: resolve(resources, 'client/dist'),
    manifestPath: resolve(resources, 'client-dist-manifest.json'),
    expectedInputHash: context.subjectHash,
  })
  const require = createRequire(resolve(root, 'package.json'))
  const { extractFile } = require('@electron/asar')
  let server = 0,
    shared = 0,
    shell = 0
  for (const file of context.files) {
    let packaged
    if (file.path.startsWith('server/')) {
      packaged = resolve(resources, file.path)
      server++
    } else if (file.path.startsWith('shared/')) {
      packaged = resolve(
        resources,
        'server/node_modules/revealjs-shared',
        file.path.slice('shared/'.length)
      )
      shared++
    } else if (
      file.path.startsWith('electron/') &&
      !file.path.endsWith('server-package-lock.json')
    ) {
      if (digest(extractFile(resolve(resources, 'app.asar'), file.path)) !== file.hash)
        throw new Error(`Packaged shell differs from frozen source: ${file.path}`)
      shell++
      continue
    } else continue
    if (fileHash(packaged) !== file.hash)
      throw new Error(`Embedded package differs from frozen source: ${file.path}`)
  }
  if (!server || !shared || !shell)
    throw new Error('Frozen source manifest lacks required package source identities.')
  verifyPackagedLocalParser(root, context, resources)
  return { server, shared, shell, clientInputHash: client.inputHash }
}
