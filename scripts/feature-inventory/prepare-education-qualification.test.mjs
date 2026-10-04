import { afterEach, describe, expect, it } from 'vitest'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import {
  collectDeclaredInputs,
  createSubject,
  stageQualification,
} from './education-qualification-stage.mjs'

const roots = []
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'education-stage-'))
  roots.push(root)
  for (const dir of [
    'client/src',
    'client/nested',
    'shared/src',
    'server/data',
    'server/uploads',
    'docs',
    'config',
    'scripts/feature-inventory/reports',
  ])
    mkdirSync(join(root, dir), { recursive: true })
  writeFileSync(join(root, 'config/production.env'), 'NODE_ENV=production\n')
  writeFileSync(
    join(root, 'client/.npmrc'),
    '//registry.invalid/:_authToken=private-fixture-secret'
  )
  writeFileSync(join(root, 'client/nested/production.env'), 'TOKEN=private-fixture-secret\n')
  writeFileSync(join(root, 'client/nested/.env.local'), 'TOKEN=private-fixture-secret\n')
  for (const [file, data] of Object.entries({
    'package.json': '{}',
    'package-lock.json': '{}',
    'client/src/app.js': 'source',
    'shared/src/policy.js': 'policy',
    'server/data/presentations.json': 'PRIVATE',
    'server/uploads/private.png': 'PRIVATE',
    'docs/guide.md': 'docs',
    'config/.env': 'SECRET',
    '.env': 'SECRET',
    'scripts/feature-inventory/reports/education-release-evidence.json': 'OUTPUT',
  }))
    writeFileSync(join(root, file), data)
  return root
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
describe('safe frozen qualification stage', () => {
  it('copies only declared inputs and creates isolated fixture data without source mutation', () => {
    const root = fixture(),
      stage = join(root, 'stage'),
      subject = createSubject(root)
    stageQualification(root, stage, subject)
    expect(readFileSync(join(stage, 'client/src/app.js'), 'utf8')).toBe('source')
    expect(readFileSync(join(stage, 'server/data/presentations.json'), 'utf8')).toBe('[]\n')
    expect(readFileSync(join(root, 'server/data/presentations.json'), 'utf8')).toBe('PRIVATE')
    expect(existsSync(join(stage, 'server/uploads/private.png'))).toBe(false)
    expect(existsSync(join(stage, '.env'))).toBe(false)
    expect(existsSync(join(stage, 'config/.env'))).toBe(false)
    expect(existsSync(join(stage, 'client/nested/production.env'))).toBe(false)
    expect(existsSync(join(stage, 'client/nested/.env.local'))).toBe(false)
    expect(existsSync(join(stage, 'client/.npmrc'))).toBe(false)
    expect(readFileSync(join(stage, 'config/production.env'), 'utf8')).toBe('NODE_ENV=production\n')
    expect(
      existsSync(join(stage, 'scripts/feature-inventory/reports/education-release-evidence.json'))
    ).toBe(false)
  })
  it.each(['feature-inventory', 'education-qualification-helpers'])(
    'executes staged imports under %s and binds their source changes without admitting reports or secrets',
    (directory) => {
      const root = fixture(),
        stage = join(root, 'stage'),
        source = `scripts/${directory}`
      mkdirSync(join(root, source, 'reports'), { recursive: true })
      writeFileSync(
        join(root, source, 'weights.mjs'),
        'export const weightedTotal = values => values.reduce((sum, value, index) => sum + value * (index + 1), 0)\n'
      )
      writeFileSync(
        join(root, source, 'index.mjs'),
        "import { weightedTotal } from './weights.mjs'; export const total = weightedTotal([2, 3])\n"
      )
      writeFileSync(join(root, source, '.env.local'), 'TOKEN=private-fixture-secret\n')
      writeFileSync(join(root, source, 'reports/run-results.json'), 'generated receipt\n')
      const subject = createSubject(root)
      stageQualification(root, stage, subject)
      const entry = pathToFileURL(join(stage, source, 'index.mjs')).href
      const result = execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `const module = await import(${JSON.stringify(entry)}); console.log(JSON.stringify(module.total))`,
        ],
        { cwd: stage, encoding: 'utf8' }
      )
      expect(JSON.parse(result)).toBe(8)
      expect(existsSync(join(stage, source, '.env.local'))).toBe(false)
      expect(existsSync(join(stage, source, 'reports/run-results.json'))).toBe(false)
      writeFileSync(join(root, source, 'reports/run-results.json'), 'updated receipt\n')
      expect(createSubject(root).subjectHash).toBe(subject.subjectHash)
      writeFileSync(
        join(root, source, 'weights.mjs'),
        'export const weightedTotal = values => values.reduce((sum, value) => sum + value, 0)\n'
      )
      expect(() => stageQualification(root, join(root, 'changed-stage'), subject)).toThrow(
        /frozen|changed/i
      )
      expect(existsSync(join(root, 'changed-stage'))).toBe(false)
    }
  )
  it('boots staged native reconciliation without treating executable inventory as generated metadata', () => {
    const root = fixture(),
      stage = join(root, 'stage'),
      source = 'server/services/pptx-import/reconciliation'
    mkdirSync(join(root, source), { recursive: true })
    writeFileSync(
      join(root, source, 'inventory.js'),
      readFileSync(
        new URL('../../server/services/pptx-import/reconciliation/inventory.js', import.meta.url)
      )
    )
    writeFileSync(join(root, 'scripts/feature-inventory/inventory.json'), '{"generated":true}')
    writeFileSync(join(root, source, '.env.local'), 'TOKEN=private-fixture-secret\n')
    const subject = createSubject(root)
    stageQualification(root, stage, subject)
    const result = execFileSync(
      process.execPath,
      [
        '-e',
        `const { createInventory } = require('./${source}/inventory.js'); const inventory = createInventory({ source: 'native', slides: [{ part: 'ppt/slides/slide1.xml', objects: [{ kind: 'text', nativeId: '42' }] }] }); const object = inventory.slides[0].objects[0]; console.log(JSON.stringify({ key: object.key, kind: object.kind, source: object.lineage.source }))`,
      ],
      { cwd: stage, encoding: 'utf8' }
    )
    expect(JSON.parse(result)).toEqual({
      key: 'ppt/slides/slide1.xml#42',
      kind: 'text',
      source: 'native',
    })
    expect(existsSync(join(stage, 'scripts/feature-inventory/inventory.json'))).toBe(false)
    expect(existsSync(join(stage, source, '.env.local'))).toBe(false)
    writeFileSync(join(root, 'scripts/feature-inventory/inventory.json'), '{"generated":"changed"}')
    expect(createSubject(root).subjectHash).toBe(subject.subjectHash)
  })
  it('executes staged shared and client JSON consumers while binding only canonical static data', () => {
    const root = fixture(),
      stage = join(root, 'stage')
    for (const dir of ['shared/data/nested', 'client/src/utils'])
      mkdirSync(join(root, dir), { recursive: true })
    const geometry = '<circle cx="12" cy="12" r="3"></circle>'
    writeFileSync(
      join(root, 'shared/data/icon-paths.json'),
      JSON.stringify({ Circle: geometry, Star: '<path d="M1 1L2 2"></path>' })
    )
    const excluded = [
      'shared/data/ordinary.json',
      'shared/data/private.json',
      'shared/data/nested/icon-paths.json',
      'shared/data/.env.local',
    ]
    for (const file of excluded) writeFileSync(join(root, file), 'private fixture data')
    writeFileSync(
      join(root, 'shared/src/icon-consumer.cjs'),
      `const icons = require('../data/icon-paths.json'); module.exports = name => '<svg viewBox="0 0 24 24">' + icons[name.replace(/Icon$/, '')] + '</svg>'`
    )
    writeFileSync(
      join(root, 'client/src/utils/icon-consumer.mjs'),
      `import icons from '../../../shared/data/icon-paths.json' with { type: 'json' }; export default name => '<svg viewBox="0 0 24 24">' + icons[name.replace(/Icon$/, '')] + '</svg>'`
    )
    const subject = createSubject(root)
    stageQualification(root, stage, subject)
    const shared = pathToFileURL(join(stage, 'shared/src/icon-consumer.cjs')).href
    const client = pathToFileURL(join(stage, 'client/src/utils/icon-consumer.mjs')).href
    const result = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const shared = await import(${JSON.stringify(shared)}); const client = await import(${JSON.stringify(client)}); console.log(JSON.stringify([shared.default('CircleIcon'), client.default('CircleIcon')]))`,
      ],
      { cwd: stage, encoding: 'utf8' }
    )
    expect(JSON.parse(result)).toEqual([
      `<svg viewBox="0 0 24 24">${geometry}</svg>`,
      `<svg viewBox="0 0 24 24">${geometry}</svg>`,
    ])
    for (const file of excluded) {
      expect(existsSync(join(stage, file))).toBe(false)
      writeFileSync(join(root, file), 'changed private data')
    }
    expect(createSubject(root).subjectHash).toBe(subject.subjectHash)
    writeFileSync(
      join(root, 'shared/data/icon-paths.json'),
      JSON.stringify({ Circle: '<circle cx="12" cy="12" r="9"></circle>' })
    )
    expect(() => stageQualification(root, join(root, 'changed-stage'), subject)).toThrow(
      /frozen|changed/i
    )
    expect(existsSync(join(root, 'changed-stage'))).toBe(false)
  })
  it('refuses a linked canonical static-data directory rather than following external assets', () => {
    const root = fixture(),
      external = fixture()
    mkdirSync(join(external, 'shared/data'), { recursive: true })
    writeFileSync(join(external, 'shared/data/icon-paths.json'), '{}')
    symlinkSync(join(external, 'shared/data'), join(root, 'shared/data'), 'junction')
    expect(() => collectDeclaredInputs(root)).toThrow(/symbolic|symlink/i)
  })
  it('refuses an existing empty or unrelated directory without deleting contents', () => {
    const root = fixture(),
      stage = join(root, 'stage')
    mkdirSync(stage)
    expect(() => stageQualification(root, stage, createSubject(root))).toThrow(/exist|collision/i)
    writeFileSync(join(stage, 'keep'), 'owned by user')
    expect(() => stageQualification(root, stage, createSubject(root))).toThrow()
    expect(readFileSync(join(stage, 'keep'), 'utf8')).toBe('owned by user')
  })
  it('refuses stage destinations inside source, dependency and repository metadata directories', () => {
    const root = fixture(),
      subject = createSubject(root)
    for (const destination of ['client/new-stage', '.git/new-stage', 'node_modules/new-stage']) {
      expect(() => stageQualification(root, join(root, destination), subject)).toThrow()
      expect(existsSync(join(root, destination))).toBe(false)
    }
  })
  it('rejects altered frozen input before creating a destination', () => {
    const root = fixture(),
      stage = join(root, 'stage'),
      subject = createSubject(root)
    writeFileSync(join(root, 'client/src/app.js'), 'changed')
    expect(() => stageQualification(root, stage, subject)).toThrow(/frozen|changed/i)
    expect(existsSync(stage)).toBe(false)
  })
  it('refuses secret-bearing settings even under the declared production env name', () => {
    const root = fixture()
    writeFileSync(
      join(root, 'config/production.env'),
      'NODE_ENV=production\nTOKEN=private-fixture-secret\n'
    )
    expect(() => createSubject(root)).toThrow(/secret/i)
  })
  it('stages only the allowed production runtime settings', () => {
    const root = fixture(),
      stage = join(root, 'stage')
    const safeEnv = 'PORT=3002\nNODE_ENV=production\n'
    writeFileSync(join(root, 'config/production.env'), safeEnv)
    stageQualification(root, stage, createSubject(root))
    expect(readFileSync(join(stage, 'config/production.env'), 'utf8')).toBe(safeEnv)
  })
  it('excludes generated reports from the exact subject but includes docs and lockfiles', () => {
    const root = fixture(),
      before = createSubject(root)
    writeFileSync(
      join(root, 'scripts/feature-inventory/reports/education-release-evidence.json'),
      'new receipt'
    )
    expect(createSubject(root).subjectHash).toBe(before.subjectHash)
    writeFileSync(join(root, 'docs/guide.md'), 'changed docs')
    expect(createSubject(root).subjectHash).not.toBe(before.subjectHash)
    const inputs = collectDeclaredInputs(root)
    expect(inputs.map((file) => file.path)).toContain('package-lock.json')
    expect(inputs.map((file) => file.path)).not.toContain('server/data/presentations.json')
  })
  it('refuses symlinks to external source rather than following private files', () => {
    const root = fixture(),
      external = fixture()
    symlinkSync(join(external, 'client/src'), join(root, 'shared/src/linked'), 'junction')
    expect(() => collectDeclaredInputs(root)).toThrow(/symbolic|symlink/i)
  })
  it('rejects traversal in a supplied frozen file manifest', () => {
    const root = fixture(),
      subject = createSubject(root)
    subject.files.push({ path: '../private', hash: 'a'.repeat(64) })
    expect(() => stageQualification(root, join(root, 'stage'), subject)).toThrow()
  })
})
