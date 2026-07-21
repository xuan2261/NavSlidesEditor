const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { BlobStore } = require('./blob-store')

describe('BlobStore', () => {
  let rootDir

  afterEach(async () => {
    if (rootDir) await fs.rm(rootDir, { recursive: true, force: true })
    rootDir = null
  })

  it('accepts a verified target when directory sync is denied after rename', async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-blob-store-'))
    const syncDirectoryFn = async () => {
      throw Object.assign(new Error('directory sync denied'), { code: 'EPERM' })
    }
    const store = new BlobStore(rootDir, { syncDirectoryFn })
    const bytes = Buffer.from('candidate package')

    const staged = await store.stage(bytes)
    const committed = await store.commit(staged)

    expect(committed).toMatchObject({
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      byteLength: bytes.length,
    })
    await expect(store.read(committed.sha256)).resolves.toEqual(bytes)
    expect(store.lastDirectorySync).toMatchObject({
      supported: false,
      reason: 'directory-fsync-denied-after-rename',
    })
  })
})
