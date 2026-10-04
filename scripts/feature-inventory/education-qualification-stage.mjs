import {
  existsSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  lstatSync,
  readFileSync,
  constants,
} from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { digest, fileHash, treeFiles, inside } from './education-evidence-files.mjs'

export const DECLARED_ROOTS = Object.freeze([
  'client',
  'server',
  'shared',
  'electron',
  'scripts',
  'config',
  'docs',
  'website',
  'tests',
  'plugins',
  'vendor-overrides',
  'native',
  'build',
  '.github',
])
export const DECLARED_FILES = Object.freeze([
  'package.json',
  'package-lock.json',
  'electron-builder.yml',
  'playwright.config.js',
  'playwright.education-desktop.config.cjs',
  'vitest.config.mjs',
  'eslint.config.mjs',
  'runtime-versions.json',
  'Dockerfile',
  'docker-compose.yml',
  'render.yaml',
  'README.md',
  'README_vi.md',
  'NOTICE',
  'LICENSE',
  'DESIGN.md',
  'CLAUDE.md',
  'AGENTS.md',
  '.prettierrc',
  '.prettierignore',
  '.gitignore',
  '.dockerignore',
  'vitest-setup-storage-isolation.js',
  'vitest-setup-jsdom-pointer-event-polyfills-for-radix-ui.js',
])
const EXCLUDED_SEGMENTS = new Set([
  'node_modules',
  'dist',
  'dist-electron',
  '.git',
  '.tmp',
  '.playwright',
  '.cache',
  '.electron-tmp',
  'bin',
  'obj',
  'uploads',
  'test-results',
  'playwright-report',
  'coverage',
  'vendor',
])
const GENERATED =
  /(?:education-(?:release|package|qualification)|run-results|coverage-matrix|extended-domain-coverage|inventory|build_output|client-dist-manifest|runtime-receipt|release-state|\.log(?:\.|$))/i
const SOURCE_CODE = /\.(?:[cm]?js|jsx|ts|tsx|go|rs|cs|c|cpp|h|sh|ps1)$/
function declared(path, isDirectory = false) {
  const parts = path.split('/')
  if (parts.some((part) => EXCLUDED_SEGMENTS.has(part) || /^node-modules-backup-/.test(part)))
    return false
  if (path === 'server/data' || path.startsWith('server/data/'))
    return path === 'server/data' || path === 'server/data/built-in-templates.json'
  if (path === 'shared/data' || path.startsWith('shared/data/'))
    return path === 'shared/data' || path === 'shared/data/icon-paths.json'
  if (
    path === 'scripts/feature-inventory/reports' ||
    path.startsWith('scripts/feature-inventory/reports/')
  )
    return false
  if (/\/reports(?:\/|$)|\/\.vitepress\/cache(?:\/|$)|\/\.vitepress\/dist(?:\/|$)/.test(path))
    return false
  if (
    path.startsWith('config/') &&
    ![
      'config/production.env',
      'config/release-target-policy.json',
      'config/container-vulnerability-policy.json',
      'config/vitest',
    ].includes(path) &&
    !path.startsWith('config/vitest/')
  )
    return false
  const basename = parts.at(-1)
  if (
    ['.npmrc', '.yarnrc', '.netrc', '.pypirc', '.git-credentials'].includes(basename) ||
    /\.(?:bak|tmp|log)$/.test(basename)
  )
    return false
  if (path === 'config/production.env') return true
  if (/^\.env|\.env(?:\.|$)|\.(?:pem|key|pfx|p12|jks)$/i.test(basename)) return false
  if (!SOURCE_CODE.test(basename) && /credential|secret|token|rclone\.conf/i.test(basename))
    return false
  if (isDirectory || SOURCE_CODE.test(basename)) return true
  if (GENERATED.test(basename) && !/\.(?:[cm]?js|json)$/.test(basename)) return false
  if (
    GENERATED.test(basename) &&
    /^(?:inventory|run-results|client-dist-manifest|runtime-receipt|release-state|education-release-evidence|education-package-receipt)/.test(
      basename
    )
  )
    return false
  return true
}
export function collectDeclaredInputs(root) {
  const files = []
  for (const dir of DECLARED_ROOTS) {
    const path = resolve(root, dir)
    if (!existsSync(path)) continue
    if (lstatSync(path).isSymbolicLink()) throw new Error(`Refusing symbolic link: ${path}`)
    files.push(...treeFiles(path, declared, root))
  }
  for (const file of DECLARED_FILES)
    if (existsSync(resolve(root, file))) {
      if (lstatSync(resolve(root, file)).isSymbolicLink())
        throw new Error(`Refusing symbolic link: ${file}`)
      files.push({ path: file, hash: fileHash(resolve(root, file)) })
    }
  const env = files.find((file) => file.path === 'config/production.env')
  if (
    env &&
    !/^(?:\s*(?:PORT=\d+|NODE_ENV=production)\s*)*$/.test(
      readFileSync(resolve(root, env.path), 'utf8')
    )
  )
    throw new Error('Production env contains undeclared potentially secret settings.')
  return files.sort((a, b) => a.path.localeCompare(b.path))
}
export function createSubject(root) {
  const files = collectDeclaredInputs(root)
  if (!files.some((file) => file.path === 'package-lock.json'))
    throw new Error('Locked dependencies are required.')
  return { subjectHash: digest(files), files }
}
export function assertFrozenSubject(root, subject) {
  if (!subject || !Array.isArray(subject.files) || digest(subject.files) !== subject.subjectHash)
    throw new Error('Invalid frozen source manifest.')
  for (const file of subject.files)
    if (
      !inside(root, resolve(root, file.path)) ||
      file.path.split(/[\\/]/).includes('..') ||
      !declared(file.path)
    )
      throw new Error('Unsafe frozen input path.')
  const actual = createSubject(root)
  if (actual.subjectHash !== subject.subjectHash)
    throw new Error('Frozen source changed; requalification is required.')
}
export function stageQualification(root, destination, subject) {
  const source = resolve(root),
    stage = resolve(destination)
  if (existsSync(stage)) throw new Error(`Qualification stage collision: ${stage} already exists.`)
  if (inside(stage, source) || stage === source)
    throw new Error('Stage cannot contain the original source tree.')
  if (
    stage.startsWith('\\\\') ||
    stage.split(/[\\/]/).some((part) => ['.git', 'node_modules', 'uploads'].includes(part))
  )
    throw new Error('Stage cannot use protected repository/dependency/user-data directories.')
  for (const dir of DECLARED_ROOTS)
    if (inside(resolve(source, dir), stage))
      throw new Error('Stage cannot be inside a declared input directory.')
  for (let parent = dirname(stage); ; parent = dirname(parent)) {
    if (existsSync(parent) && lstatSync(parent).isSymbolicLink())
      throw new Error(`Refusing symbolic stage ancestor: ${parent}`)
    if (dirname(parent) === parent) break
  }
  assertFrozenSubject(source, subject)
  mkdirSync(dirname(stage), { recursive: true })
  mkdirSync(stage, { recursive: false })
  for (const file of subject.files) {
    const target = join(stage, file.path)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(join(source, file.path), target, constants.COPYFILE_EXCL)
    if (fileHash(target) !== file.hash) throw new Error(`Frozen copy changed: ${file.path}`)
  }
  mkdirSync(join(stage, 'server/data'), { recursive: true })
  mkdirSync(join(stage, 'server/uploads'), { recursive: true })
  for (const name of ['presentations', 'templates', 'media'])
    writeFileSync(join(stage, `server/data/${name}.json`), '[]\n', { flag: 'wx' })
  mkdirSync(join(stage, 'qualification-fixtures/data'), { recursive: true })
  mkdirSync(join(stage, 'qualification-fixtures/uploads'), { recursive: true })
  writeFileSync(join(stage, 'qualification-fixtures/data/presentations.json'), '[]\n', {
    flag: 'wx',
  })
  return {
    stage,
    copiedFiles: subject.files.length,
    fixtureData: join(stage, 'qualification-fixtures/data'),
    fixtureUploads: join(stage, 'qualification-fixtures/uploads'),
  }
}
