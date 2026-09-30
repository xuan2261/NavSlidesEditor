import { afterEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const roots = []
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const vitestCli = path.join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs')
const setupFile = path.join(repoRoot, 'vitest-setup-storage-isolation.js')
const storageUrl = pathToFileURL(path.join(repoRoot, 'server', 'services', 'storage.js')).href
const productionRoots = [
  path.join(repoRoot, 'server', 'data'),
  path.join(repoRoot, 'server', 'uploads'),
]

function cleanStorageEnv(overrides = {}) {
  const env = { ...process.env, ...overrides }
  for (const key of [
    'SLIDES_DATA_DIR',
    'SLIDES_UPLOADS_DIR',
    'NAVSLIDES_VITEST_STORAGE_ROOT',
    'NAVSLIDES_VITEST_STORAGE_OWNED',
    'NAVSLIDES_VITEST_STORAGE_OWNER_PID',
    'NAVSLIDES_VITEST_ALLOW_CALLER_STORAGE',
  ]) {
    if (!(key in overrides)) delete env[key]
  }
  return env
}

function probeSource(name) {
  return `
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import storage from ${JSON.stringify(storageUrl)}
it('records ${name}', async () => {
  storage.initDataFiles()
  await writeFile(path.join(process.env.WITNESS_DIR, '${name}.json'), JSON.stringify({
    dataDir: storage.DATA_DIR, uploadsDir: storage.UPLOADS_DIR, pid: process.pid
  }), { flag: 'wx' })
  await new Promise(resolve => setTimeout(resolve, 150))
})
`
}

async function makeProbe(files) {
  const root = await mkdtemp(path.join(tmpdir(), 'navslides-isolation-contract-'))
  roots.push(root)
  const witnessDir = path.join(root, 'witnesses')
  await mkdir(witnessDir)
  const config = path.join(root, 'vitest.config.mjs')
  await writeFile(
    config,
    `export default { test: {
      globals: true, environment: 'node', pool: 'forks', fileParallelism: true,
      maxWorkers: 2, include: ['*.test.mjs'], setupFiles: [${JSON.stringify(setupFile)}]
    } }\n`
  )
  await Promise.all(
    files.map((name) => writeFile(path.join(root, `${name}.test.mjs`), probeSource(name)))
  )
  return { root, witnessDir, config }
}

async function runProbe(probe, env) {
  return execFileAsync(
    process.execPath,
    [vitestCli, 'run', '--config', probe.config, '--root', probe.root],
    { cwd: probe.root, env, timeout: 30_000, windowsHide: true }
  )
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })))
})

describe('Vitest storage isolation', () => {
  it('gives parallel forks distinct production-safe roots and removes owned roots on exit', async () => {
    const probe = await makeProbe(['worker-a', 'worker-b'])
    await runProbe(
      probe,
      cleanStorageEnv({
        WITNESS_DIR: probe.witnessDir,
        NAVSLIDES_VITEST_STORAGE_MODE: 'parallel',
        NAVSLIDES_VITEST_INVOCATION_ID: 'contract',
      })
    )
    const witnesses = await Promise.all(
      ['worker-a', 'worker-b'].map(async (name) =>
        JSON.parse(await readFile(path.join(probe.witnessDir, `${name}.json`), 'utf8'))
      )
    )
    expect(new Set(witnesses.map((item) => item.pid)).size).toBe(2)
    expect(new Set(witnesses.map((item) => path.dirname(item.dataDir))).size).toBe(2)
    for (const witness of witnesses) {
      expect(path.dirname(witness.dataDir)).toBe(path.dirname(witness.uploadsDir))
      expect(productionRoots.some((root) => isWithin(root, witness.dataDir))).toBe(false)
      expect(productionRoots.some((root) => isWithin(root, witness.uploadsDir))).toBe(false)
      expect(existsSync(path.dirname(witness.dataDir))).toBe(false)
    }
  })

  it('requires serial opt-in for caller roots and rejects production roots', async () => {
    const probe = await makeProbe(['caller'])
    const callerData = path.join(probe.root, 'caller-data')
    const callerUploads = path.join(probe.root, 'caller-uploads')
    const callerEnv = {
      WITNESS_DIR: probe.witnessDir,
      SLIDES_DATA_DIR: callerData,
      SLIDES_UPLOADS_DIR: callerUploads,
      NAVSLIDES_VITEST_STORAGE_MODE: 'serial',
    }
    await expect(runProbe(probe, cleanStorageEnv(callerEnv))).rejects.toMatchObject({ code: 1 })
    await runProbe(
      probe,
      cleanStorageEnv({ ...callerEnv, NAVSLIDES_VITEST_ALLOW_CALLER_STORAGE: '1' })
    )
    expect(existsSync(path.join(callerData, 'presentations.json'))).toBe(true)
    expect(existsSync(callerUploads)).toBe(true)

    const unsafeProbe = await makeProbe(['unsafe'])
    await expect(
      runProbe(
        unsafeProbe,
        cleanStorageEnv({
          WITNESS_DIR: unsafeProbe.witnessDir,
          SLIDES_DATA_DIR: productionRoots[0],
          SLIDES_UPLOADS_DIR: productionRoots[1],
          NAVSLIDES_VITEST_STORAGE_MODE: 'serial',
          NAVSLIDES_VITEST_ALLOW_CALLER_STORAGE: '1',
        })
      )
    ).rejects.toMatchObject({ code: 1 })
  }, 60_000)
})
