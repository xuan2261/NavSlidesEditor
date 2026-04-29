import path from 'node:path'
import { describe, expect, it } from 'vitest'
import sourceModule from './server-image-source.js'
import storageModule from '../services/storage.js'

const { normalizeServerImageSource } = sourceModule
const { UPLOADS_DIR } = storageModule

describe('server-image-source', () => {
  it('resolves uploads, data URIs, absolute and relative paths', () => {
    expect(normalizeServerImageSource('data:image/png;base64,AAA')).toEqual({
      data: 'data:image/png;base64,AAA',
    })

    expect(normalizeServerImageSource('/uploads/example.png')).toEqual({
      path: path.join(UPLOADS_DIR, 'example.png'),
    })
    expect(normalizeServerImageSource('/uploads/nested/folder/example.png')).toEqual({
      path: path.join(UPLOADS_DIR, 'nested', 'folder', 'example.png'),
    })
    expect(normalizeServerImageSource('/uploads/../outside.png')).toBeNull()

    const uploadsAbsolute = path.join(UPLOADS_DIR, 'local.png')
    expect(normalizeServerImageSource(uploadsAbsolute)).toEqual({ path: uploadsAbsolute })

    expect(normalizeServerImageSource(path.resolve('outside', 'local.png'))).toBeNull()
    expect(normalizeServerImageSource('server/uploads/local.png')?.path).toContain(path.join('server', 'uploads'))
    expect(normalizeServerImageSource('')).toBeNull()
  })
})
