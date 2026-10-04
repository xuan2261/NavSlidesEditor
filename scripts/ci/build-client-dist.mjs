import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { createManifest } from './create-client-dist-manifest.mjs'
import { createSubject } from '../feature-inventory/education-qualification-stage.mjs'

function compileClient(baseDir) {
  const args = ['run', 'build', '--workspace=client']
  if (process.platform === 'win32')
    execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm', ...args], {
      cwd: baseDir,
      stdio: 'inherit',
    })
  else execFileSync('npm', args, { cwd: baseDir, stdio: 'inherit' })
}
export async function buildClientDist(options, compile = () => compileClient(options.baseDir)) {
  const inputHash = createSubject(options.baseDir).subjectHash
  // Remove the prior receipt before invoking the compiler: failed builds cannot retain admission authority.
  fs.rmSync(options.out, { force: true })
  await compile()
  if (createSubject(options.baseDir).subjectHash !== inputHash)
    throw new Error(
      'Compilation source inputs changed during the client build; rebuild the frozen subject'
    )
  const manifest = createManifest({ ...options, inputHash })
  if (createSubject(options.baseDir).subjectHash !== inputHash)
    throw new Error('Compilation source inputs changed while capturing client output')
  fs.mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true })
  fs.writeFileSync(options.out, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
  return manifest
}
function optionsFromArgs(args) {
  const options = { baseDir: process.cwd(), locks: [], buildCommand: 'npm run build' }
  const allowed = new Set([
    'base-dir',
    'root',
    'out',
    'subject',
    'dirty',
    'build-command',
    'vite-version',
    'lock',
  ])
  for (let index = 0; index < args.length; index++) {
    const key = args[index].slice(2),
      value = args[++index]
    if (!args[index - 1].startsWith('--') || !allowed.has(key) || !value)
      throw new Error('Invalid client build argument')
    if (key === 'lock') options.locks.push(value)
    else options[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value
  }
  options.baseDir = path.resolve(options.baseDir)
  options.root = path.resolve(options.baseDir, options.root || 'client/dist')
  options.out = path.resolve(options.baseDir, options.out || 'client-dist-manifest.json')
  options.subject ||=
    process.env.BUILD_SUBJECT_SHA ||
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: options.baseDir, encoding: 'utf8' }).trim()
  options.dirty ??=
    process.env.BUILD_DIRTY ??
    execFileSync('git', ['status', '--porcelain'], {
      cwd: options.baseDir,
      encoding: 'utf8',
    }).trim().length > 0
  if (options.dirty === 'true') options.dirty = true
  else if (options.dirty === 'false') options.dirty = false
  const lock = JSON.parse(fs.readFileSync(path.join(options.baseDir, 'package-lock.json'), 'utf8'))
  options.viteVersion ||= lock.packages?.['node_modules/vite']?.version
  return options
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const manifest = await buildClientDist(optionsFromArgs(process.argv.slice(2)))
    console.log(
      JSON.stringify({
        artifactIdentity: manifest.artifact.identity,
        inputHash: manifest.build.inputHash,
        files: manifest.files.length,
      })
    )
  } catch (error) {
    console.error(`[client-build] ${error.message}`)
    process.exitCode = 1
  }
}
