import { afterEach, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as storage from '../../server/services/storage.js'

const execFileAsync = promisify(execFile)
const testRoots = []
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const vitestEntrypoint = path.join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs')
const configPath = path.join(repoRoot, 'vitest.config.mjs')
const storageModuleUrl = pathToFileURL(path.join(repoRoot, 'server', 'services', 'storage.js')).href
const projectDataDir = path.join(repoRoot, 'server', 'data')
const projectUploadsDir = path.join(repoRoot, 'server', 'uploads')

function isWithinOrEqual(parent, child) {
  const relative = path.relative(parent, child)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

function probeSource(name) {
  return `
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import * as storage from ${JSON.stringify(storageModuleUrl)}

it('records isolated storage paths', async () => {
  storage.initDataFiles()
  const witness = {
    dataDir: process.env.SLIDES_DATA_DIR,
    uploadsDir: process.env.SLIDES_UPLOADS_DIR,
    storageDataDir: storage.DATA_DIR,
    storageUploadsDir: storage.UPLOADS_DIR,
    workerPid: process.pid,
  }
  await writeFile(
    path.join(process.env.SLIDES_ISOLATION_WITNESS_DIR, ${JSON.stringify(`${name}.json`)}),
    JSON.stringify(witness),
    { flag: 'wx' }
  )
  await new Promise((resolve) => setTimeout(resolve, 100))
  expect(witness.dataDir).toBe(witness.storageDataDir)
  expect(witness.uploadsDir).toBe(witness.storageUploadsDir)
})
`
}

async function runVitest(files, env, root) {
  try {
    await execFileAsync(
      process.execPath,
      [
        vitestEntrypoint,
        'run',
        '--config',
        configPath,
        '--root',
        root,
        '--fileParallelism',
        '--maxWorkers=2',
        '--pool=forks',
        ...files,
      ],
      { cwd: repoRoot, env, windowsHide: true, timeout: 30_000 }
    )
  } catch (error) {
    throw new Error(
      `Vitest storage-isolation probe failed:\n${error.stdout || ''}\n${error.stderr || ''}`,
      { cause: error }
    )
  }
}

async function readWitnesses(witnessDir, names) {
  return Promise.all(
    names.map(async (name) =>
      JSON.parse(await readFile(path.join(witnessDir, `${name}.json`), 'utf8'))
    )
  )
}

afterEach(async () => {
  await Promise.all(testRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })))
})

describe('Vitest storage isolation', () => {
  it('discovers root tests but excludes Claude worktree tests', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'navslides-vitest-discovery-'))
    testRoots.push(root)
    const witnessDir = path.join(root, 'witnesses')
    const worktreeDir = path.join(root, '.claude', 'worktrees', 'agent-a')
    await Promise.all([
      mkdir(witnessDir),
      mkdir(worktreeDir, { recursive: true }),
    ])
    const probe = (name) => `
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
it('${name}', async () => {
  await writeFile(path.join(process.env.SLIDES_ISOLATION_WITNESS_DIR, '${name}.txt'), 'ran')
})
`
    await Promise.all([
      writeFile(path.join(root, 'root.test.mjs'), probe('root-test')),
      writeFile(path.join(worktreeDir, 'ignored.test.mjs'), probe('worktree-test')),
    ])

    await runVitest([], { ...process.env, SLIDES_ISOLATION_WITNESS_DIR: witnessDir }, root)

    expect(existsSync(path.join(witnessDir, 'root-test.txt'))).toBe(true)
    expect(existsSync(path.join(witnessDir, 'worktree-test.txt'))).toBe(false)
  })

  it('uses a unique invocation root before storage imports and preserves caller paths', async () => {
    expect(process.env.SLIDES_DATA_DIR).toBe(storage.DATA_DIR)
    expect(process.env.SLIDES_UPLOADS_DIR).toBe(storage.UPLOADS_DIR)

    const root = await mkdtemp(path.join(tmpdir(), 'navslides-vitest-contract-'))
    testRoots.push(root)
    const witnessDir = path.join(root, 'witnesses')
    await Promise.all([
      writeFile(path.join(root, 'worker-a.test.mjs'), probeSource('worker-a')),
      writeFile(path.join(root, 'worker-b.test.mjs'), probeSource('worker-b')),
    ])
    await mkdir(witnessDir)

    const inheritedEnv = {
      ...process.env,
      SLIDES_ISOLATION_WITNESS_DIR: witnessDir,
      TEMP: projectDataDir,
      TMP: projectDataDir,
      TMPDIR: projectDataDir,
    }
    delete inheritedEnv.SLIDES_DATA_DIR
    delete inheritedEnv.SLIDES_UPLOADS_DIR
    await runVitest(
      [path.join(root, 'worker-a.test.mjs'), path.join(root, 'worker-b.test.mjs')],
      inheritedEnv,
      root
    )

    const generatedWitnesses = await readWitnesses(witnessDir, ['worker-a', 'worker-b'])
    const generatedDataDirs = new Set(generatedWitnesses.map((witness) => witness.dataDir))
    const generatedUploadsDirs = new Set(generatedWitnesses.map((witness) => witness.uploadsDir))
    expect(generatedDataDirs.size).toBe(1)
    expect(generatedUploadsDirs.size).toBe(1)
    expect(new Set(generatedWitnesses.map((witness) => witness.workerPid)).size).toBe(2)
    for (const witness of generatedWitnesses) {
      expect(witness.dataDir).toBe(witness.storageDataDir)
      expect(witness.uploadsDir).toBe(witness.storageUploadsDir)
      expect(path.isAbsolute(witness.dataDir)).toBe(true)
      expect(path.isAbsolute(witness.uploadsDir)).toBe(true)
      expect(witness.dataDir).not.toBe(projectDataDir)
      expect(witness.uploadsDir).not.toBe(projectUploadsDir)
      expect(path.dirname(witness.dataDir)).toBe(path.dirname(witness.uploadsDir))
      expect(isWithinOrEqual(projectDataDir, witness.dataDir)).toBe(false)
      expect(isWithinOrEqual(projectUploadsDir, witness.uploadsDir)).toBe(false)
    }
    expect(existsSync(path.dirname(generatedWitnesses[0].dataDir))).toBe(false)

    const callerDataDir = path.join(root, 'caller-data')
    const callerUploadsDir = path.join(root, 'caller-uploads')
    const callerWitnessDir = path.join(root, 'caller-witnesses')
    await mkdir(callerWitnessDir)
    const callerProbe = path.join(root, 'caller.test.mjs')
    await writeFile(callerProbe, probeSource('caller'))
    await runVitest(
      [callerProbe],
      {
        ...process.env,
        SLIDES_DATA_DIR: callerDataDir,
        SLIDES_UPLOADS_DIR: callerUploadsDir,
        SLIDES_ISOLATION_WITNESS_DIR: callerWitnessDir,
      },
      root
    )

    const [callerWitness] = await readWitnesses(callerWitnessDir, ['caller'])
    expect(callerWitness.dataDir).toBe(callerDataDir)
    expect(callerWitness.uploadsDir).toBe(callerUploadsDir)
    expect(callerWitness.storageDataDir).toBe(callerDataDir)
    expect(callerWitness.storageUploadsDir).toBe(callerUploadsDir)
    expect(existsSync(path.join(callerDataDir, 'presentations.json'))).toBe(true)
    expect(existsSync(callerUploadsDir)).toBe(true)
  }, 60_000)
})
