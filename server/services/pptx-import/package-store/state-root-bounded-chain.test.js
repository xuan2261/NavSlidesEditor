const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { openPackageStore } = require('./index')

const roots = []

async function createStore() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-state-root-'))
  roots.push(rootDir)
  const store = await openPackageStore({ rootDir })
  await store.acquireWriter()
  return { rootDir, store }
}

async function readRoot(rootDir) {
  return JSON.parse(await fs.readFile(path.join(rootDir, 'state-root.json'), 'utf8'))
}

function chainDepth(root) {
  let depth = 0
  for (let node = root?.predecessor; node; node = node.predecessor) depth += 1
  return depth
}

afterAll(async () => {
  await Promise.all(roots.map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('state root predecessor chain', () => {
  it('stops nesting once the retained depth is reached', async () => {
    const { rootDir, store } = await createStore()

    for (let i = 0; i < 25; i += 1) await store.mutate(() => {})

    expect(chainDepth(await readRoot(rootDir))).toBeLessThanOrEqual(3)
    await store.releaseWriter()
  })

  it('keeps state-root.json from growing with the publish count', async () => {
    const { rootDir, store } = await createStore()

    for (let i = 0; i < 5; i += 1) await store.mutate(() => {})
    const early = (await fs.stat(path.join(rootDir, 'state-root.json'))).size
    for (let i = 0; i < 40; i += 1) await store.mutate(() => {})
    const later = (await fs.stat(path.join(rootDir, 'state-root.json'))).size

    // Bounded, not merely slower-growing: an unbounded chain grew ~300 bytes per
    // publish, so 40 more publishes would have added roughly 12 KB.
    expect(later - early).toBeLessThan(1024)
    await store.releaseWriter()
  })

  it('falls back past a predecessor that no longer validates', async () => {
    const { rootDir, store } = await createStore()
    for (let i = 0; i < 4; i += 1) await store.mutate(() => {})
    const root = await readRoot(rootDir)
    await store.releaseWriter()

    // Destroy the current index and its immediate predecessor's, so recovery has
    // to walk further back than one level to find a verified root.
    await fs.rm(path.join(rootDir, root.stateFile))
    await fs.rm(path.join(rootDir, root.predecessor.stateFile))

    const reopened = await openPackageStore({ rootDir })
    expect(reopened.getState().generation).toBeGreaterThanOrEqual(0)
    expect(await readRoot(rootDir)).not.toMatchObject({ stateFile: root.stateFile })
  })
})
