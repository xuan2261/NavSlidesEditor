import { describe, expect, it } from 'vitest'
import rasterModule from './server-background-raster.js'

const { rasterizeBackground } = rasterModule

describe('server-background-raster', () => {
  it('rasterizes gradient backgrounds to PNG data URI', async () => {
    const dataUri = await rasterizeBackground(
      { type: 'gradient', gradient: 'linear-gradient(90deg, #0f172a, #e2e8f0)' },
      { width: 960, height: 540 }
    )

    expect(typeof dataUri).toBe('string')
    expect(dataUri.startsWith('data:image/png;base64,')).toBe(true)
  }, 60000)
})
