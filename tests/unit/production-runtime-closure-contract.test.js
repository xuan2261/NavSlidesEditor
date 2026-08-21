import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '..', '..')
const expected = {
  node: '22.22.0',
  nodeFloor: '>=22.13.0',
  nodeImage:
    'node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94',
  electron: '42.9.3',
  electronBuilder: '26.15.3',
  tiptap: '2.27.2',
  undici: '7.29.0',
}

const readText = (...parts) => readFileSync(resolve(root, ...parts), 'utf8').replace(/\r\n/g, '\n')
const readJson = (...parts) => JSON.parse(readText(...parts))

describe('production runtime closure contract', () => {
  it('keeps one checked-in runtime version owner aligned with manifests', () => {
    expect(readJson('runtime-versions.json')).toEqual(expected)

    const rootPkg = readJson('package.json')
    const clientPkg = readJson('client', 'package.json')
    const serverPkg = readJson('server', 'package.json')
    const tiptapEntries = Object.entries(clientPkg.dependencies).filter(([name]) =>
      name.startsWith('@tiptap/')
    )

    expect(rootPkg.engines.node).toBe(expected.nodeFloor)
    expect(rootPkg.devDependencies.electron).toBe(expected.electron)
    expect(rootPkg.devDependencies['electron-builder']).toBe(expected.electronBuilder)
    expect(serverPkg.dependencies.undici).toBe(expected.undici)
    expect(tiptapEntries.length).toBeGreaterThan(0)
    expect(new Set(tiptapEntries.map(([, version]) => version))).toEqual(new Set([expected.tiptap]))
  })

  it('aligns Docker, Electron builder and CI with exact runtime versions', () => {
    const dockerfile = readText('Dockerfile')
    const builder = readText('electron-builder.yml')
    const workflowDir = resolve(root, '.github', 'workflows')
    const workflows = readdirSync(workflowDir)
      .filter((name) => /\.ya?ml$/i.test(name))
      .map((name) => readText('.github', 'workflows', name))
      .join('\n')

    expect([
      ...dockerfile.matchAll(
        new RegExp(`FROM ${expected.nodeImage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')
      ),
    ]).toHaveLength(2)
    expect(dockerfile).toContain('RUN npx playwright install --with-deps chromium')
    const localOverrideCopy = 'COPY vendor-overrides/ ./vendor-overrides/'
    expect(dockerfile.match(/^COPY vendor-overrides\/ \.\/vendor-overrides\/$/gm)).toHaveLength(2)
    expect(dockerfile.indexOf(localOverrideCopy)).toBeLessThan(dockerfile.indexOf('RUN npm ci'))
    expect(dockerfile.lastIndexOf(localOverrideCopy)).toBeLessThan(
      dockerfile.indexOf('RUN node scripts/prepare-electron.js')
    )
    expect(builder).toContain(`electronVersion: '${expected.electron}'`)
    expect(workflows).not.toMatch(/node-version:\s*['"]?20(?:['"]|\s|$)/)
    expect(workflows).toContain(`NODE_VERSION: '${expected.node}'`)
  })

  it('qualifies the production Docker artifact in the required CI fan-in', () => {
    const workflow = readText(
      '.github',
      'workflows',
      'github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml'
    )

    expect(workflow).toContain('docker-artifact:')
    expect(workflow).toContain('docker build --tag navslides-editor:ci .')
    expect(workflow).toContain('node scripts/verify-runtime-closure.js --require-client-dist')
    expect(workflow).toContain('/vendor/socket.io/socket.io.min.js')
    expect(workflow).toContain('/api/pptx/import')
    expect(workflow).toContain('/pptx-original')
    expect(workflow).toContain('docker restart navslides-editor-ci')
    expect(workflow).toMatch(/required-checks:[\s\S]*needs:[\s\S]*- docker-artifact/)
  })

  it('uses immutable action pins and npm ci in the release workflow', () => {
    const workflow = readText('.github', 'workflows', 'release.yml')

    expect(workflow).toContain('actions/checkout@11d5960a326750d5838078e36cf38b85af677262')
    expect(workflow).toContain('actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020')
    expect(workflow).toContain('actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02')
    expect(workflow).toContain('actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093')
    expect(workflow).toContain(
      'softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65'
    )
    expect(workflow).toContain('run: npm ci')
    expect(workflow).not.toContain('run: npm install')
  })

  it('uses a checked-in isolated Electron server lock', () => {
    const lockPath = resolve(root, 'electron', 'server-package-lock.json')
    expect(existsSync(lockPath)).toBe(true)

    const serverPkg = readJson('server', 'package.json')
    const isolatedLock = readJson('electron', 'server-package-lock.json')
    const expectedDependencies = { ...serverPkg.dependencies }
    delete expectedDependencies['revealjs-shared']

    expect(isolatedLock.lockfileVersion).toBe(3)
    expect(isolatedLock.packages[''].dependencies).toEqual(expectedDependencies)
    expect(readText('scripts', 'prepare-electron.js')).toContain(
      "['ci', '--omit=dev', '--ignore-scripts']"
    )
  })

  it('starts production cross-platform without POSIX assignment syntax', () => {
    const rootPkg = readJson('package.json')
    expect(rootPkg.scripts.start).toBe('node --env-file=config/production.env server/index.js')
    expect(readText('config', 'production.env')).toBe('NODE_ENV=production\n')
  })
})
